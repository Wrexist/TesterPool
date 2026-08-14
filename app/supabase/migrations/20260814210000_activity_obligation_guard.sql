-- ============================================================================
-- TWO HOLES IN THE ACTIVITY GUARDS
--
-- Both found by review on the pull request, both reproduced against a replay of
-- this schema before being fixed here. A new migration rather than an edit to
-- `20260814180000_activities.sql`, because that one is already applied.
--
-- ---------------------------------------------------------------------------
-- 1. The balance check reserved nothing, so it only ever checked one job.
--
-- `start_activity` locked `profiles.credits` and compared it to 40, then
-- inserted the seat without deducting anything. The lock is released at commit
-- and the balance is unchanged, so the next caller reads the same number and
-- passes too. Reproduced: an owner holding 40 credits with `activity_target`
-- of 3 was given three seats — 120 credits of obligation against 40 credits of
-- balance.
--
-- That is worse than an owner running dry, because of what happens downstream:
-- `_charge_owner` takes them to zero and pays the tester the full amount
-- regardless, by design — "the tester is ALWAYS paid, whether the developer
-- budgeted for it is not their problem". So the shortfall is not absorbed by
-- anyone, it is *minted*, and invariant 1a says credits move and are never
-- minted. Three completed activities on a 40-credit owner would have created 80
-- credits from nothing.
--
-- The fix counts what the owner already owes across every app they own — a
-- balance is per-owner, not per-app — and requires it to cover the outstanding
-- work plus this new job. Conservative on purpose: a seat whose install has
-- already been charged still counts its whole 40, because erring toward
-- refusing a seat costs someone an afternoon and erring the other way costs the
-- economy its conservation.
--
-- ---------------------------------------------------------------------------
-- 2. An activity could be checked in repeatedly, and before its opt-in.
--
-- `submit_checkin` numbered an activity's day from its own count, so a second
-- call on a later UTC date logged day 2, then day 3. No credits are minted by
-- that — `daily_checkin` pays 0, which is the whole point of it paying 0 — but
-- `days_checked_in`, `current_streak`, `longest_streak` and reliability all
-- inflate, and `market_apps.testers_full` counts seats at 14 days. An activity
-- is one session; it gets one check-in.
--
-- It also never read the seat's status, so a tester could log a session before
-- proving they were in the closed track at all. Gated for activities only: pod
-- seats keep the behaviour they have had since the beginning, because in-flight
-- pods depend on it and this migration is not the place to change it.
-- ============================================================================

create or replace function start_activity(p_app uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_app record;
  v_cost integer;
  v_balance integer;
  v_taken integer;
  v_open integer;
  v_id uuid;
begin
  if v_me is null then raise exception 'not signed in'; end if;

  if not coalesce(
       (select enabled from feature_flags where key = 'activities'), true) then
    return jsonb_build_object('ok', false, 'error', 'activities_closed');
  end if;

  if exists (select 1 from profiles where id = v_me and is_banned) then
    raise exception 'account suspended';
  end if;

  select a.id, a.owner_id, a.status, a.platform, a.credits_paused,
         a.accepting_activities, a.activity_target, a.opt_in_url, a.google_group
    into v_app
    from apps a where a.id = p_app for update;

  if v_app.id is null then return jsonb_build_object('ok', false, 'error', 'unknown_app'); end if;
  if v_app.owner_id = v_me then return jsonb_build_object('ok', false, 'error', 'your_own_app'); end if;
  if v_app.platform <> 'android' then return jsonb_build_object('ok', false, 'error', 'listing_only'); end if;

  if v_app.status not in ('queued', 'in_pod', 'graduated') then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;
  if not v_app.accepting_activities then
    return jsonb_build_object('ok', false, 'error', 'not_accepting');
  end if;
  if v_app.credits_paused then
    return jsonb_build_object('ok', false, 'error', 'owner_out_of_credits');
  end if;

  -- The closed track is what is being joined, on a live app as much as a queued
  -- one. No track, no job.
  if v_app.opt_in_url is null and v_app.google_group is null then
    return jsonb_build_object('ok', false, 'error', 'no_opt_in_route');
  end if;

  if exists (select 1 from assignments s where s.app_id = p_app and s.tester_id = v_me) then
    return jsonb_build_object('ok', false, 'error', 'already_testing');
  end if;

  select count(*) into v_taken
    from assignments s
   where s.app_id = p_app and s.pod_id is null
     and s.status not in ('dropped', 'removed');

  if v_taken >= v_app.activity_target then
    return jsonb_build_object('ok', false, 'error', 'no_seats');
  end if;

  v_cost := cfg('install_charge') + cfg('review_charge');

  -- Everything this owner already owes, across every app they own. An activity
  -- seat stops being an obligation once its report is approved, because that is
  -- the last charge the seat can produce.
  select count(*) into v_open
    from assignments s
    join apps a2 on a2.id = s.app_id
   where a2.owner_id = v_app.owner_id
     and s.pod_id is null
     and s.status not in ('dropped', 'removed')
     and not exists (
       select 1 from feedback f
        where f.assignment_id = s.id
          and f.status in ('approved', 'arbitrated'));

  select credits into v_balance from profiles where id = v_app.owner_id for update;
  v_balance := coalesce(v_balance, 0);

  -- Cannot cover even one job: the listing is dry, so pause it. This is the
  -- original condition and it keeps the original consequence.
  if v_balance < v_cost then
    update apps set credits_paused = true where id = p_app and not credits_paused;
    insert into notifications (user_id, kind, payload, dedupe_key)
    values (v_app.owner_id, 'credits_exhausted',
            jsonb_build_object('app_id', p_app, 'short_by', v_cost - v_balance),
            'credits_exhausted:' || p_app)
    on conflict do nothing;
    return jsonb_build_object('ok', false, 'error', 'owner_out_of_credits');
  end if;

  -- Can cover a job but not this one on top of what is already running. The app
  -- is NOT paused: it is solvent, and it becomes available again on its own the
  -- moment one of the outstanding reports lands. Pausing here would punish an
  -- owner for having testers.
  if v_balance < v_cost * (v_open + 1) then
    return jsonb_build_object(
      'ok', false, 'error', 'owner_fully_committed',
      'outstanding', v_open, 'balance', v_balance);
  end if;

  insert into assignments (pod_id, app_id, tester_id, credits_escrowed, status)
  values (null, p_app, v_me, cfg('opt_in_verified'), 'opt_in_pending')
  returning id into v_id;

  insert into notifications (user_id, kind, payload, dedupe_key)
  values (v_app.owner_id, 'tester_joined',
          jsonb_build_object('app_id', p_app, 'assignment_id', v_id),
          'activity_joined:' || v_id)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'assignment_id', v_id,
                            'reward', cfg('opt_in_verified') + cfg('feedback_approved'));
end $$;

revoke execute on function start_activity(uuid) from anon, public;
grant  execute on function start_activity(uuid) to authenticated;

/* ------------------------------------------------ one session, once, in order */

create or replace function submit_checkin(
  p_assignment uuid, p_proof uuid default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_tester uuid; v_start timestamptz; v_pod uuid; v_day int; v_today date;
  v_days int; v_pay int; v_bonus int := 0; v_verified timestamptz;
begin
  select a.tester_id, a.pod_id, p.starts_at, a.days_checked_in, a.opt_in_verified_at
    into v_tester, v_pod, v_start, v_days, v_verified
    from assignments a left join pods p on p.id = a.pod_id
   where a.id = p_assignment;

  if v_tester is null then raise exception 'unknown assignment'; end if;
  if v_tester <> auth.uid() then raise exception 'not your assignment'; end if;

  v_today := (now() at time zone 'utc')::date;

  if v_pod is null then
    -- Step 2 cannot precede step 1. Enforced here rather than only in the UI,
    -- because every RPC in this schema is reachable over REST.
    if v_verified is null then
      return jsonb_build_object('ok', false, 'error', 'opt_in_required');
    end if;
    -- One session, and only one. There is no second day to log.
    if coalesce(v_days, 0) >= 1 then
      return jsonb_build_object('ok', false, 'error', 'activity_already_logged');
    end if;
    v_day := 1;
  else
    if v_start is null then raise exception 'pod has not started'; end if;
    v_day := (v_today - (v_start at time zone 'utc')::date) + 1;
    if v_day < 1 then raise exception 'pod has not started'; end if;
  end if;

  if exists (select 1 from checkins where assignment_id = p_assignment and checkin_date = v_today) then
    return jsonb_build_object('ok', false, 'error', 'already_checked_in_today');
  end if;

  v_pay := cfg('daily_checkin');
  insert into checkins (assignment_id, day_number, checkin_date, proof_id, note, credits_awarded)
  values (p_assignment, v_day, v_today, p_proof, p_note, v_pay);

  update assignments set days_checked_in = days_checked_in + 1, last_checkin_on = v_today, status = 'active'
   where id = p_assignment returning days_checked_in into v_days;

  perform award_credits(v_tester, v_pay, 'daily_checkin', 'assignment', p_assignment);

  if v_pod is not null and v_days >= 14 then
    v_bonus := cfg('streak_bonus_full');
    perform award_credits(v_tester, v_bonus, 'streak_bonus', 'assignment', p_assignment, 'Perfect 14/14 attendance');
  end if;

  update profiles set current_streak = current_streak + 1,
         longest_streak = greatest(longest_streak, current_streak + 1) where id = v_tester;
  perform recompute_reliability(v_tester);

  return jsonb_build_object('ok', true, 'day', v_day, 'days_total', v_days,
                            'credits', v_pay + v_bonus,
                            'activity', v_pod is null,
                            'perfect', v_pod is not null and v_days >= 14);
end $$;

revoke execute on function submit_checkin(uuid,uuid,text) from anon, public;
grant  execute on function submit_checkin(uuid,uuid,text) to authenticated;
