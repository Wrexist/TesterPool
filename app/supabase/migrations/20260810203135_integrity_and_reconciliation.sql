-- ============================================================================
-- DATA INTEGRITY
--
-- The admin economy page found a real problem: profiles.credits summed to
-- 12,272 while the ledger only accounted for 2,400. The seed wrote balances
-- directly instead of going through award_credits, so 9,872 credits existed
-- with no entry explaining them.
--
-- The ledger is the source of truth. Reconcile by writing the missing history,
-- then make the drift impossible to reintroduce.
-- ============================================================================

-- 1. Back-fill an opening-balance entry for every unbacked credit.
insert into credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, memo, created_at)
select p.id,
       p.credits - coalesce(l.total, 0),
       p.credits,
       'admin_adjust',
       'reconciliation',
       p.id,
       'Opening balance reconciliation: seeded credits that predate the ledger',
       p.created_at
  from profiles p
  left join (select user_id, sum(delta) total from credit_ledger group by user_id) l
    on l.user_id = p.id
 where p.credits - coalesce(l.total, 0) <> 0;

-- 2. Guard: profiles.credits is a cached projection of the ledger and must only
--    ever move through award_credits/spend_credits, which write both in one
--    statement. Anything else is a bug, so make the database say so.
create or replace function guard_credits_projection()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.credits is distinct from old.credits
     and current_setting('testerpool.ledger_write', true) is distinct from 'on' then
    raise exception
      'profiles.credits is a projection of credit_ledger. Use award_credits() or spend_credits().';
  end if;
  return new;
end $$;

-- award_credits is the only writer; it sets the guard flag for its transaction.
create or replace function award_credits(
  p_user uuid, p_delta integer, p_reason ledger_reason,
  p_ref_type text default null, p_ref_id uuid default null, p_memo text default null
) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare v_balance integer;
begin
  if p_delta = 0 then
    select credits into v_balance from profiles where id = p_user;
    return v_balance;
  end if;

  perform set_config('testerpool.ledger_write', 'on', true);   -- transaction-local

  update profiles set credits = greatest(0, credits + p_delta), updated_at = now()
   where id = p_user returning credits into v_balance;
  if not found then raise exception 'award_credits: no such profile %', p_user; end if;

  insert into credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, memo)
  values (p_user, p_delta, v_balance, p_reason, p_ref_type, p_ref_id, p_memo);

  if p_delta > 0 and p_reason in
     ('daily_checkin','feedback_approved','bug_bounty','streak_bonus','rescue_bonus') then
    perform _pay_tithe(p_user, p_delta);
  end if;

  perform set_config('testerpool.ledger_write', 'off', true);
  return v_balance;
end $$;

create or replace function _pay_tithe(p_user uuid, p_delta integer)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_ref uuid; v_cut integer; v_bal integer;
begin
  select referred_by into v_ref from profiles where id = p_user;
  if v_ref is null then return; end if;
  v_cut := floor(p_delta * cfg('referral_tithe_pct') / 100.0);
  if v_cut <= 0 then return; end if;

  perform set_config('testerpool.ledger_write', 'on', true);
  update profiles set credits = credits + v_cut where id = v_ref returning credits into v_bal;
  insert into credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, memo)
  values (v_ref, v_cut, v_bal, 'referral_tithe', 'profile', p_user, 'Tithe on referee earnings');
end $$;

create trigger profiles_credits_projection
  before update of credits on profiles
  for each row execute function guard_credits_projection();

-- 3. updated_at maintenance, so "last changed" is never a lie.
create or replace function touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create trigger apps_touch     before update on apps     for each row execute function touch_updated_at();
create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();

-- 4. Constraints that encode the rules the product actually has.
alter table pods add constraint pod_seats_cover_requirement
  check (core_seats >= required_testers);

alter table assignments add constraint checkin_days_sane
  check (days_checked_in >= 0 and days_checked_in <= 60);

alter table apps add constraint opt_in_url_looks_like_play
  check (opt_in_url is null or opt_in_url ~* '^https?://');

-- 5. A single reconciliation check the admin dashboard and cron can both call.
create or replace function ledger_drift()
returns table (user_id uuid, handle citext, projected integer, ledger integer, drift integer)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.handle, p.credits, coalesce(l.total, 0)::integer,
         (p.credits - coalesce(l.total, 0))::integer
    from profiles p
    left join (select cl.user_id, sum(cl.delta) total from credit_ledger cl group by cl.user_id) l
      on l.user_id = p.id
   where p.credits <> coalesce(l.total, 0)
$$;
revoke execute on function ledger_drift() from anon, public;
grant  execute on function ledger_drift() to authenticated;

select (select count(*) from ledger_drift()) as remaining_drift,
       (select sum(credits) from profiles)   as outstanding,
       (select sum(delta) from credit_ledger) as ledger_total;