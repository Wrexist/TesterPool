-- ============================================================================
-- Make paid tiers actually do something.
--
-- Until now a purchase wrote an `entitlements` row that nothing ever read, so
-- paying for a Fast Pod bought a receipt and no behaviour. Wire it into the
-- one place it matters: matching.
--
-- What the money buys is time and buffer depth, exactly as sold:
--   fast_pod ($19) -> priority pod, 18 seats instead of 15
--   pro      ($39) -> priority pod, 20 seats, high-reliability members only
--   rescue    ($9) -> consumed separately when a seat is backfilled
-- ============================================================================

create or replace function _consume_entitlement(p_user uuid, p_app uuid)
returns entitlement_kind
language plpgsql security definer set search_path = public, extensions as $$
declare v_kind entitlement_kind; v_id uuid;
begin
  -- Pro outranks fast_pod if somebody holds both.
  select id, kind into v_id, v_kind
    from entitlements
   where user_id = p_user
     and (app_id is null or app_id = p_app)
     and kind in ('fast_pod', 'pro')
     and consumed_at is null and revoked_at is null
     and (expires_at is null or expires_at > now())
   order by case kind when 'pro' then 0 else 1 end, created_at
   limit 1
  for update skip locked;

  if v_id is null then return null; end if;

  update entitlements set consumed_at = now(), app_id = coalesce(app_id, p_app) where id = v_id;
  return v_kind;
end $$;
revoke execute on function _consume_entitlement(uuid, uuid) from anon, authenticated, public;

create or replace function join_pod(p_app uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_owner uuid; v_pod uuid; v_count int; v_rel numeric; v_active int;
  v_kind entitlement_kind; v_seats int; v_min_rel numeric := 0; v_priority boolean := false;
begin
  if not coalesce((select enabled from feature_flags where key = 'pod_matching'), true) then
    return jsonb_build_object('ok', false, 'error', 'matching_paused',
      'message', 'Pod matching is paused right now. Nothing you have done is lost; try again shortly.');
  end if;

  select owner_id into v_owner from apps where id = p_app;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'not your app'; end if;

  select reliability into v_rel from profiles where id = v_owner;
  if v_rel < 40 then
    return jsonb_build_object('ok', false, 'error', 'reliability_too_low',
      'message', 'Your reliability score is too low to join a pod. Serve as a rescue tester to rebuild it.');
  end if;

  select count(*) into v_active from assignments
   where tester_id = v_owner and status in ('opt_in_pending','active');
  if v_active >= cfg('max_concurrent_assignments') then
    return jsonb_build_object('ok', false, 'error', 'too_many_active',
      'message', 'Finish your current tests first. Real testing beats farming.');
  end if;

  -- Spend a paid entitlement if one is sitting unused against this app.
  v_kind := _consume_entitlement(v_owner, p_app);
  if v_kind = 'pro' then
    v_seats := 20; v_min_rel := 85; v_priority := true;
  elsif v_kind = 'fast_pod' then
    v_seats := 18; v_priority := true;
  else
    v_seats := (select core_seats from pods limit 0);   -- keep default
  end if;

  -- Prefer the fullest matching pod so clocks start sooner. A paid member is
  -- only placed in a pod that matches what they paid for.
  select p.id into v_pod
    from pods p
   where p.status = 'forming'
     and p.is_priority = v_priority
     and (v_seats is null or p.core_seats = v_seats)
     and (select count(*) from pod_members m where m.pod_id = p.id) < p.core_seats
     and not exists (select 1 from pod_members m where m.pod_id = p.id and m.user_id = v_owner)
     and (v_min_rel = 0 or not exists (
           select 1 from pod_members m join profiles pr on pr.id = m.user_id
            where m.pod_id = p.id and pr.reliability < v_min_rel))
   order by (select count(*) from pod_members m where m.pod_id = p.id) desc
   limit 1;

  if v_pod is null then
    insert into pods (name, core_seats, is_priority)
    values ('Pod ' || to_char(now(), 'Mon DD'),
            coalesce(v_seats, 15), v_priority)
    returning id into v_pod;
  end if;

  insert into pod_members (pod_id, user_id, app_id, seat, status)
  values (v_pod, v_owner, p_app, 'core', 'joined')
  on conflict (pod_id, user_id) do nothing;

  update apps set status = 'queued' where id = p_app;

  select count(*) into v_count from pod_members where pod_id = v_pod;
  return jsonb_build_object(
    'ok', true, 'pod_id', v_pod, 'members', v_count,
    'seats', (select core_seats from pods where id = v_pod),
    'tier', coalesce(v_kind::text, 'free'),
    'priority', v_priority);
end $$;

revoke execute on function join_pod(uuid) from anon, public;
grant  execute on function join_pod(uuid) to authenticated;

-- Rescue seats: consume a paid rescue before charging credits.
create or replace function claim_rescue(p_app uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_owner uuid; v_id uuid; v_price int;
begin
  select owner_id into v_owner from apps where id = p_app;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'not your app'; end if;

  select id into v_id from entitlements
   where user_id = v_owner and kind = 'rescue'
     and (app_id is null or app_id = p_app)
     and consumed_at is null and revoked_at is null
   order by created_at limit 1 for update skip locked;

  if v_id is not null then
    update entitlements set consumed_at = now(), app_id = coalesce(app_id, p_app) where id = v_id;
    return jsonb_build_object('ok', true, 'paid_with', 'entitlement');
  end if;

  v_price := cfg('cost_rescue_seat');
  if not spend_credits(v_owner, v_price, 'rescue_seat_spend', 'app', p_app) then
    return jsonb_build_object('ok', false, 'error', 'insufficient_credits',
      'needed', v_price,
      'message', 'Not enough credits for a rescue seat. You can buy one instead.');
  end if;
  return jsonb_build_object('ok', true, 'paid_with', 'credits', 'spent', v_price);
end $$;
revoke execute on function claim_rescue(uuid) from anon, public;
grant  execute on function claim_rescue(uuid) to authenticated;

select 'wired' as status;
