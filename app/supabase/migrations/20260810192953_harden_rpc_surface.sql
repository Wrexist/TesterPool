-- ============================================================================
-- SECURITY HARDENING
--
-- Supabase exposes every function in `public` as a REST endpoint. award_credits
-- and spend_credits are SECURITY DEFINER and take an arbitrary user id and
-- delta, so as shipped ANY signed-in user could POST /rest/v1/rpc/award_credits
-- and mint themselves unlimited credits. Same class of hole on _pay_tithe,
-- recompute_reliability and handle_new_user.
--
-- Fix: these are internal primitives. Revoke EXECUTE from anon/authenticated so
-- they are callable only from inside other SECURITY DEFINER functions (which
-- run as the owner) and from the service role. The user-facing RPCs stay
-- callable, because each one authorises against auth.uid() itself.
-- ============================================================================

revoke execute on function award_credits(uuid,integer,ledger_reason,text,uuid,text) from anon, authenticated, public;
revoke execute on function spend_credits(uuid,integer,ledger_reason,text,uuid)      from anon, authenticated, public;
revoke execute on function _pay_tithe(uuid,integer)                                 from anon, authenticated, public;
revoke execute on function recompute_reliability(uuid)                              from anon, authenticated, public;
revoke execute on function handle_new_user()                                        from anon, authenticated, public;
revoke execute on function cfg(text)                                                from anon, public;

-- User-facing RPCs: signed-in users only. Anonymous callers have no business here.
revoke execute on function join_pod(uuid)                        from anon, public;
revoke execute on function start_pod(uuid)                       from anon, public;
revoke execute on function submit_checkin(uuid,uuid,text)        from anon, public;
revoke execute on function review_feedback(uuid,text,text)       from anon, public;
revoke execute on function arbitrate_dispute(uuid,boolean,text)  from anon, public;
revoke execute on function is_mod()                              from anon, public;

grant execute on function join_pod(uuid)                       to authenticated;
grant execute on function start_pod(uuid)                      to authenticated;
grant execute on function submit_checkin(uuid,uuid,text)       to authenticated;
grant execute on function review_feedback(uuid,text,text)      to authenticated;
grant execute on function arbitrate_dispute(uuid,boolean,text) to authenticated;
grant execute on function is_mod()                             to authenticated;
grant execute on function cfg(text)                            to authenticated;

-- start_pod had no authorisation of its own: any signed-in user could start any
-- pod, including one they are not in. Restrict it to pod members and moderators.
create or replace function start_pod(p_pod uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_n int; v_made int := 0;
begin
  if not exists (
      select 1 from pod_members m
       where m.pod_id = p_pod and m.user_id = auth.uid() and m.status <> 'removed')
     and not exists (select 1 from profiles where id = auth.uid() and is_moderator)
  then
    raise exception 'you are not a member of this pod';
  end if;

  if exists (select 1 from pods where id = p_pod and status <> 'forming') then
    return jsonb_build_object('ok', false, 'error', 'already_started');
  end if;

  select count(*) into v_n from pod_members where pod_id = p_pod and status <> 'removed';
  if v_n < 6 then return jsonb_build_object('ok', false, 'error', 'not_enough_members'); end if;

  insert into assignments (pod_id, app_id, tester_id, credits_escrowed)
  select p_pod, owner.app_id, tester.user_id, cfg('opt_in_verified')
    from pod_members owner
    join pod_members tester on tester.pod_id = owner.pod_id and tester.user_id <> owner.user_id
   where owner.pod_id = p_pod and owner.app_id is not null
     and owner.status <> 'removed' and tester.status <> 'removed'
  on conflict (pod_id, app_id, tester_id) do nothing;
  get diagnostics v_made = row_count;

  update pods set status = 'active', locked_at = now(), starts_at = now(),
         ends_at = now() + (duration_days || ' days')::interval where id = p_pod;
  update pod_members set status = 'active' where pod_id = p_pod and status = 'joined';
  update apps set status = 'in_pod'
   where id in (select app_id from pod_members where pod_id = p_pod and app_id is not null);

  return jsonb_build_object('ok', true, 'assignments', v_made, 'members', v_n);
end $$;

revoke execute on function start_pod(uuid) from anon, public;
grant  execute on function start_pod(uuid) to authenticated;

-- Slugs must be URL-safe; the seed produced 'postmark radio'.
update greenlights g set slug = regexp_replace(lower(a.name), '[^a-z0-9]+', '-', 'g')
  from apps a where a.id = g.app_id and g.slug ~ '[^a-z0-9-]';

select proname, proacl from pg_proc where proname in ('award_credits','spend_credits','join_pod') order by proname;