-- ============================================================================
-- ACTIVITIES — one app, one tester, one report, no cohort.
--
-- The marketplace has always shown what an app's work pays and never had a way
-- to start it. A seat existed only because pod matching made one, so a browsing
-- member's only route to any app was "wait for a pod to form", and with
-- `pod_matching` off for launch that route is closed. The result is a directory
-- of jobs nobody can take: a reward chip on every row and no button under it.
--
-- An activity is that button. A member picks an app that is open, joins its
-- closed testing track, uses it, files one private structured report, and is
-- paid the same +10 / +30 a pod seat pays, charged to the same owner. It is the
-- existing pipeline with the cohort removed, which is why almost nothing here
-- is new machinery — `on_optin_confirmed`, `review_feedback`, `submit_proof`,
-- the daily caps and `_charge_owner` all hang off an `assignments` row and an
-- `apps` row and never once look at a pod. Making `pod_id` nullable is most of
-- the feature.
--
-- WHAT THIS IS NOT, and the reason the schema still cannot express it: the
-- install is an opt-in to a closed testing track, and the report is private to
-- the developer. Not a public store install, not a store review, not a rating.
-- The competitor this shape is borrowed from pays for exactly those and is
-- selling its members an account termination; see docs/COMPETITOR-ONTOPRANK.md.
-- Invariant 1 in CLAUDE.md is unchanged and this migration adds no column that
-- could hold a public store action.
--
-- The objection this has to answer is the one written into app-detail.tsx:
-- seating someone directly is "a way to earn credits from a developer who never
-- agreed to pay them". Three things answer it, and all three are enforced here
-- rather than in the UI:
--
--   1. `apps.accepting_activities` — the owner's explicit consent. No app takes
--      an activity tester without it.
--   2. `apps.activity_target` — how many they agreed to, so exposure is bounded
--      at target x 40 rather than open-ended.
--   3. A balance check before the seat exists. A pod escrows against a balance
--      matching has already verified; an activity has no matching, so
--      `start_activity` refuses when the owner cannot cover the full 40 and
--      pauses the listing instead. The tester never does work that the owner
--      cannot pay for, which is the failure `_charge_owner` can only mitigate
--      after the fact.
-- ============================================================================

/* ------------------------------------------------------------ 0. new kinds */

-- Separate from the pod kinds on purpose: an owner reading "someone joined"
-- needs to know whether a fourteen-day clock just started against them or one
-- person picked the app up for an afternoon.
alter type notification_kind add value if not exists 'tester_joined';

/* ------------------------------------------------- 1. a seat without a pod */

-- The whole schema change. `assignments` already carries app_id and tester_id,
-- which is everything the payment path reads; pod_id was the only thing making
-- a cohort mandatory.
alter table assignments alter column pod_id drop not null;

comment on column assignments.pod_id is
  'The cohort this seat belongs to, or NULL for a one-off activity. Every join '
  'onto pods in the lifecycle jobs is an inner join, so activity rows are '
  'excluded from the 14-day clock, dropout detection and escrow release by '
  'construction — an activity has no clock to keep.';

-- `unique (pod_id, app_id, tester_id)` does not constrain activities: NULLs
-- compare as distinct, so a member could hold unlimited seats on one app.
create unique index if not exists assignments_activity_uidx
  on assignments (app_id, tester_id) where pod_id is null;

-- The feed asks "which apps are open to me" on every load.
create index if not exists assignments_activity_app_idx
  on assignments (app_id) where pod_id is null;

/* --------------------------------------------- 2. the owner's side of it */

alter table apps
  add column if not exists accepting_activities boolean not null default true,
  add column if not exists activity_target      integer not null default 5;

alter table apps drop constraint if exists apps_activity_target_sane;
alter table apps add constraint apps_activity_target_sane
  check (activity_target between 0 and 50);

comment on column apps.accepting_activities is
  'Whether this app takes one-off activity testers. The owner''s agreement to '
  'pay 10 + 30 per tester; start_activity refuses without it.';
comment on column apps.activity_target is
  'How many activity testers the owner wants. Caps exposure at target x 40 '
  'credits, and is what the marketplace counts seats against.';

-- Defaults true because listing an app has always meant "I want testers and I
-- pay for them" — a pod charges the identical 40 per tester and no owner has
-- ever opted into that separately. What changed is the route, not the bill.
-- The balance check in start_activity is what protects a thin balance, and it
-- is a better protection than an opt-out would be.

/* ------------------------------------------------------ 3. start_activity */

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

  -- Locked for the duration: the seat count and the owner's balance are both
  -- read-then-written, and two testers tapping at once must not both pass a
  -- check that only one of them can satisfy.
  select a.id, a.owner_id, a.status, a.platform, a.credits_paused,
         a.accepting_activities, a.activity_target, a.opt_in_url, a.google_group
    into v_app
    from apps a where a.id = p_app for update;

  if v_app.id is null then return jsonb_build_object('ok', false, 'error', 'unknown_app'); end if;
  if v_app.owner_id = v_me then return jsonb_build_object('ok', false, 'error', 'your_own_app'); end if;
  if v_app.platform <> 'android' then return jsonb_build_object('ok', false, 'error', 'listing_only'); end if;
  if v_app.status not in ('queued', 'in_pod') then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;
  if not v_app.accepting_activities then
    return jsonb_build_object('ok', false, 'error', 'not_accepting');
  end if;
  if v_app.credits_paused then
    return jsonb_build_object('ok', false, 'error', 'owner_out_of_credits');
  end if;

  -- Without a track to join there is no install to prove, and the tester would
  -- reach step 1 and find nothing to open.
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

  -- The full job, not just the install. A tester who proves an install and then
  -- finds the report unpayable has done the work for half the money, and the
  -- half they lost is the half that took the effort.
  v_cost := cfg('install_charge') + cfg('review_charge');
  select credits into v_balance from profiles where id = v_app.owner_id for update;

  if coalesce(v_balance, 0) < v_cost then
    update apps set credits_paused = true where id = p_app and not credits_paused;
    insert into notifications (user_id, kind, payload, dedupe_key)
    values (v_app.owner_id, 'credits_exhausted',
            jsonb_build_object('app_id', p_app, 'short_by', v_cost - coalesce(v_balance, 0)),
            'credits_exhausted:' || p_app)
    on conflict do nothing;
    return jsonb_build_object('ok', false, 'error', 'owner_out_of_credits');
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

/* ------------------------------------- 4. check-in without a fourteen-day clock */

-- The inner join onto pods silently returned no rows for an activity, so
-- `submit_checkin` raised 'unknown assignment' on a seat that plainly existed.
-- An activity has no start date and no day 14: one check-in is the whole of
-- step 2, numbered from the seat itself rather than from a pod calendar.
create or replace function submit_checkin(
  p_assignment uuid, p_proof uuid default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_tester uuid; v_start timestamptz; v_pod uuid; v_day int; v_today date;
  v_days int; v_pay int; v_bonus int := 0;
begin
  select a.tester_id, a.pod_id, p.starts_at, a.days_checked_in
    into v_tester, v_pod, v_start, v_days
    from assignments a left join pods p on p.id = a.pod_id
   where a.id = p_assignment;

  if v_tester is null then raise exception 'unknown assignment'; end if;
  if v_tester <> auth.uid() then raise exception 'not your assignment'; end if;

  v_today := (now() at time zone 'utc')::date;

  if v_pod is null then
    -- Activity: the day number counts this seat's own check-ins.
    v_day := coalesce(v_days, 0) + 1;
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

  -- Pod seats only. An activity has no fourteen days to keep perfectly, and
  -- paying a completion bonus for one check-in would mint credits.
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

/* ---------------------------------------------------- 5. the feature flag */

insert into feature_flags (key, enabled, description) values
  ('activities', true,
   'Allow members to start a one-off activity on an app: join its closed test, use it, file one report. The marketplace''s own supply route, independent of pod matching.')
on conflict (key) do nothing;
