\set ON_ERROR_STOP on
\pset pager off

-- ===========================================================================
-- ACTIVITIES — a seat without a pod.
--
-- The economy is the one part of this product where a bug is not a bad screen
-- but a wrong balance, and `start_activity` is a new door into it: before this
-- migration the only way a member could be seated against a developer's balance
-- was pod matching, which had already checked that the developer had the money.
-- An activity has no matching, so every one of those checks has to be its own,
-- and each one is a way to spend a stranger's credits if it is missing.
--
-- What is asserted here, in order:
--   1. the happy path, and that the seat really has no pod
--   2. the five refusals, each of which is somebody's money if it fails open
--   3. that the transfers are the same 10 and 30 a pod seat moves — no more,
--      because an activity that paid differently would be an arbitrage between
--      the two products
--   4. that `submit_checkin` works on a pod-less seat, which the inner join
--      onto pods silently broke
--   5. that the RLS on `assignments` still refuses a direct insert, because a
--      client that can write its own seat does not need `start_activity` at all
--
-- Run after 01 (it uses 01's fixtures and helper).
-- ===========================================================================

-- 01's fixtures, and its assert_eq. Re-declared rather than assumed so this
-- file fails loudly if the order is wrong.
do $$ begin
  if to_regprocedure('assert_eq(anyelement,anyelement,text)') is null then
    raise exception 'run 01-economy.sql first';
  end if;
end $$;

delete from checkins where assignment_id in (select id from assignments where pod_id is null);
delete from disputes  where feedback_id in (
  select id from feedback where tester_id = '22222222-2222-2222-2222-222222222222');
-- 02 runs the tester into the daily report cap on purpose — that is the whole
-- of what 02 proves. The cap counts feedback rows filed today, so 07 has to
-- clear the day or its own report is refused by a guard that is working
-- correctly. The ledger entries those reports wrote are left alone; every
-- balance assertion below is anchored to a normalised starting balance and to
-- its own `ref_id`, never to a running total.
delete from feedback where tester_id = '22222222-2222-2222-2222-222222222222';
delete from feedback where assignment_id in (select id from assignments where pod_id is null);
delete from assignments where pod_id is null;
delete from apps where id = 'aaaaaaaa-0000-0000-0000-00000000000a';

-- ------------------------------------------------------------- fixtures
-- An app that is open to activities, owned by the creator, whose balance 01
-- left with enough in it to pay for work.
insert into apps (id, owner_id, name, opt_in_url, status,
                  accepting_activities, activity_target)
values ('aaaaaaaa-0000-0000-0000-00000000000a',
        '11111111-1111-1111-1111-111111111111',
        'Fernbank', 'https://play.google.com/apps/testing/com.fernbank.app',
        'queued', true, 2);

-- Two more testers, so the seat cap has something to bite on. Created before
-- the balances are normalised, because normalising reads every one of them.
insert into auth.users (id, email)
values ('44444444-4444-4444-4444-444444444444', 'tester2@test.dev'),
       ('55555555-5555-5555-5555-555555555555', 'tester3@test.dev')
on conflict (id) do nothing;

insert into profiles (id, handle, display_name)
values ('44444444-4444-4444-4444-444444444444', 'tester2', 'Tester Two'),
       ('55555555-5555-5555-5555-555555555555', 'tester3', 'Tester Three')
on conflict (id) do update set handle = excluded.handle;

-- Balances are normalised rather than assumed: 01, 02 and 03 all pay the tester
-- on their way through, so every absolute assertion below would otherwise be
-- reading whatever those files happened to leave behind. Normalising is what 01
-- does with its own fixtures and it keeps the numbers here readable as the
-- transfers they are testing.
do $$
declare r record; v_target int;
begin
  for r in select id, handle, credits from profiles
            where handle in ('creator', 'tester', 'tester2', 'tester3') loop
    v_target := case r.handle when 'creator' then 200 else 0 end;
    if r.credits <> v_target then
      perform award_credits(r.id, v_target - r.credits, 'admin_adjust', null, null,
                            'activity test fixture');
    end if;
  end loop;
  update apps set credits_paused = false where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
end $$;

select assert_eq((select credits from profiles where handle = 'tester'), 0,
                 'fixture: tester normalised to zero');

-- ===========================================================================
-- 1. The happy path
-- ===========================================================================

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

-- `activity_open` is what draws the button, and it is computed independently of
-- `start_activity` — two implementations of the same seven conditions. They are
-- asserted against each other here because the failure mode of a drift between
-- them is silent in both directions: a button the RPC refuses, or a seat that
-- is available and never offered.
select assert_eq(
  (select m.activity_open from
     market_apps('all', null, null, null, null, 'newest', 1, 0,
                 'aaaaaaaa-0000-0000-0000-00000000000a') m),
  true, 'market_apps: an open app offers the button');

select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000a') ->> 'ok')::boolean,
  true, 'start_activity: a member can take an open app');

-- Holding a seat is one of the seven conditions, so the button goes away and
-- the relation becomes 'testing' even though the app's status is still 'queued'
-- — the case the projection got wrong before it knew about activities.
select assert_eq(
  (select m.activity_open from
     market_apps('all', null, null, null, null, 'newest', 1, 0,
                 'aaaaaaaa-0000-0000-0000-00000000000a') m),
  false, 'market_apps: your own seat withdraws the button');

select assert_eq(
  (select m.relation from
     market_apps('all', null, null, null, null, 'newest', 1, 0,
                 'aaaaaaaa-0000-0000-0000-00000000000a') m),
  'testing', 'market_apps: an activity on a queued app reads as testing');

select assert_eq(
  (select m.is_activity from
     market_apps('all', null, null, null, null, 'newest', 1, 0,
                 'aaaaaaaa-0000-0000-0000-00000000000a') m),
  true, 'market_apps: the seat is flagged as an activity, not a pod seat');

select assert_eq(
  (select count(*)::int from assignments
    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
      and tester_id = '22222222-2222-2222-2222-222222222222'),
  1, 'start_activity: exactly one seat created');

-- The whole schema change. A seat with a pod would be swept by the pod
-- lifecycle jobs, which would then try to run a fourteen-day clock over it.
select assert_eq(
  (select pod_id from assignments
    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
      and tester_id = '22222222-2222-2222-2222-222222222222'),
  null::uuid, 'start_activity: the seat has no pod');

select assert_eq(
  (select status::text from assignments
    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
      and tester_id = '22222222-2222-2222-2222-222222222222'),
  'opt_in_pending', 'start_activity: the seat starts unverified');

-- Nothing has moved yet. The seat is a claim on the work, not the work.
select assert_eq((select credits from profiles where handle = 'tester'), 0,
                 'start_activity: taking a seat pays nothing on its own');

-- ===========================================================================
-- 2. The refusals
-- ===========================================================================

select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000a') ->> 'error'),
  'already_testing', 'refuses a second seat on the same app');

-- Your own app. Without this a developer tops up, tests themselves, and the
-- credits come straight back — a laundering loop that costs nothing and
-- manufactures a reliability record.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000a') ->> 'error'),
  'your_own_app', 'refuses the owner of the app');

-- The seat cap. activity_target is 2 and one is taken.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000a') ->> 'ok')::boolean,
  true, 'the second seat is allowed');

select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select assert_eq(
  (select m.activity_open from
     market_apps('all', null, null, null, null, 'newest', 1, 0,
                 'aaaaaaaa-0000-0000-0000-00000000000a') m),
  false, 'market_apps: a full listing does not offer the button');

select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000a') ->> 'error'),
  'no_seats', 'refuses past activity_target');

-- The `open` scope is the feed's default view and must not list an app the
-- member cannot start on.
select assert_eq(
  (select count(*)::int from
     market_apps('open', null, null, null, null, 'newest', 48, 0) m
    where m.id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  0, 'the open scope excludes an app with no seats left');

-- An owner who cannot pay. `_charge_owner` would take them to zero and pause
-- the app *after* the tester had done the work; refusing up front is the point.
insert into apps (id, owner_id, name, opt_in_url, status, accepting_activities, activity_target)
values ('aaaaaaaa-0000-0000-0000-00000000000b',
        '33333333-3333-3333-3333-333333333333',
        'Skint Two', 'https://play.google.com/apps/testing/com.skint2.app', 'queued', true, 5)
on conflict (id) do update set status = 'queued', credits_paused = false;

do $$
declare v int;
begin
  select credits into v from profiles where handle = 'broke';
  if v > 39 then
    perform award_credits('33333333-3333-3333-3333-333333333333'::uuid,
                          39 - v, 'admin_adjust', null, null, 'activity test fixture');
  end if;
end $$;

select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000b') ->> 'error'),
  'owner_out_of_credits', 'refuses when the owner cannot cover the whole job');

-- And it pauses the listing rather than leaving it advertising work nobody
-- will be paid for.
select assert_eq(
  (select credits_paused from apps where id = 'aaaaaaaa-0000-0000-0000-00000000000b'),
  true, 'a listing that cannot pay is paused');

-- An app with no way into a closed track has no step 1 to offer.
insert into apps (id, owner_id, name, status, accepting_activities, activity_target)
values ('aaaaaaaa-0000-0000-0000-00000000000c',
        '11111111-1111-1111-1111-111111111111', 'No Door', 'draft', true, 5)
on conflict (id) do nothing;
select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000c') ->> 'error'),
  'not_open', 'refuses an app that is not listed');

-- The flag, enforced in the database rather than only in the UI.
update feature_flags set enabled = false where key = 'activities';
select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000a') ->> 'error'),
  'activities_closed', 'the flag is enforced inside the RPC');
update feature_flags set enabled = true where key = 'activities';

-- ===========================================================================
-- 3. The transfers — identical to a pod seat's
-- ===========================================================================

-- Balances before. The creator paid nothing for the two seats themselves.
select assert_eq((select credits from profiles where handle = 'tester'), 0,
                 'tester still at zero before any work lands');

-- Confirming the opt-in is what moves the install charge. Done as the table
-- owner because that is what the moderator queue and the triage function are.
update assignments
   set opt_in_verified_at = now(), status = 'active'
 where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
   and tester_id = '22222222-2222-2222-2222-222222222222';

select assert_eq((select credits from profiles where handle = 'tester'), 10,
                 'confirmed install pays the tester 10');

select assert_eq(
  (select credits_paid from assignments
    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
      and tester_id = '22222222-2222-2222-2222-222222222222'),
  10, 'the seat records what it paid');

-- The owner's side of the same 10. Read as a delta so the number does not
-- depend on whatever 01 left in the balance.
select assert_eq(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where user_id = '11111111-1111-1111-1111-111111111111'
      and reason = 'install_charge'
      and ref_id = (select id from assignments
                     where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
                       and tester_id = '22222222-2222-2222-2222-222222222222')),
  -10, 'the app owner is charged the matching 10');

-- ===========================================================================
-- 4. Check-in on a seat with no pod
-- ===========================================================================
-- The bug this covers: `submit_checkin` joined assignments to pods on an inner
-- join, so an activity seat produced no row and the function raised
-- 'unknown assignment' against a seat that plainly existed. Step 2 of three
-- was unreachable for every activity.

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

select assert_eq(
  (submit_checkin((select id from assignments
                    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
                      and tester_id = '22222222-2222-2222-2222-222222222222'))
   ->> 'ok')::boolean,
  true, 'submit_checkin works on a seat with no pod');

select assert_eq(
  (select days_checked_in from assignments
    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
      and tester_id = '22222222-2222-2222-2222-222222222222'),
  1, 'the activity check-in is day one');

-- And it pays nothing, exactly as a pod check-in pays nothing. A check-in that
-- minted credits would be the inflation hole the economy was rebuilt to close.
select assert_eq((select credits from profiles where handle = 'tester'), 10,
                 'an activity check-in mints nothing');

-- No perfect-14 bonus can ever fire on a seat that has one day.
select assert_eq(
  (select count(*)::int from credit_ledger
    where user_id = '22222222-2222-2222-2222-222222222222'
      and reason = 'streak_bonus'),
  0, 'no streak bonus on an activity');

-- ===========================================================================
-- 5. The report, and its charge
-- ===========================================================================

-- A real report, and a critical one: invariant 2 says specific criticism is
-- paid at the same rate as praise, and an activity does not get to be the
-- exception.
insert into feedback (assignment_id, app_id, tester_id, status, severity,
                      device_model, what_broke, repro_steps, suggestion)
select id, app_id, tester_id, 'submitted', 2,
       'Pixel 6a',
       'Rotating the ledger screen closes the app.',
       'Open Ledger, turn the phone to landscape, it dies on the second rotate.',
       'Looks like the chart view is rebuilt on configuration change.'
  from assignments
 where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
   and tester_id = '22222222-2222-2222-2222-222222222222';

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select assert_eq(
  (review_feedback((select id from feedback
                     where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
                       and tester_id = '22222222-2222-2222-2222-222222222222'),
                   'useful') ->> 'ok')::boolean,
  true, 'the owner can approve an activity report');

select assert_eq((select credits from profiles where handle = 'tester'), 40,
                 'approved report pays 30, for 40 on the whole job');

-- The full job cost the owner exactly what a pod seat costs: 40, no more.
select assert_eq(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where user_id = '11111111-1111-1111-1111-111111111111'
      and reason in ('install_charge', 'review_charge')
      and ref_id in (
        select id from assignments
         where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
           and tester_id = '22222222-2222-2222-2222-222222222222'
        union all
        select id from feedback
         where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
           and tester_id = '22222222-2222-2222-2222-222222222222')),
  -40, 'an activity costs the owner the same 40 a pod seat costs');

-- Critical feedback was paid the full rate. This is invariant 2 and it does not
-- get a discount because the seat came from the marketplace.
select assert_eq(
  (select status::text from feedback
    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
      and tester_id = '22222222-2222-2222-2222-222222222222'),
  'approved', 'a bug report on an activity is approved, not disputed away');

-- ===========================================================================
-- 5b. A live app is testable, and only through a closed track
-- ===========================================================================
-- A `graduated` app used to be a dead listing: start_activity refused it and
-- the reward was null. It takes activities now, because clearing Google's gate
-- says nothing about whether the game still has bugs.
--
-- The whole boundary of that change is one condition, asserted twice below: a
-- live app with no `opt_in_url` and no `google_group` is refused. Without it,
-- "test this app" on a published listing would mean the store page, and the
-- install we pay for would be a public store install — the thing invariant 1
-- exists to make unrepresentable.

-- The boundary turns out to be enforced twice, and the stronger of the two is
-- `app_needs_optin_to_queue`, which predates activities: any app past 'draft'
-- must carry an `opt_in_url` or a `google_group`. A published listing with a
-- store URL and no closed track is therefore not a state this schema can hold,
-- so "install from the store page" is unreachable rather than merely refused.
-- Asserted here because that constraint is now load-bearing for a reason it was
-- not written for, and a future migration relaxing it would open the door.
do $$
begin
  begin
    insert into apps (id, owner_id, name, status, store_url, package_name)
    values ('aaaaaaaa-0000-0000-0000-00000000000e',
            '11111111-1111-1111-1111-111111111111', 'No Track Live', 'graduated',
            'https://play.google.com/store/apps/details?id=com.notrack.live',
            'com.notrack.live');
    raise exception 'FAIL a live listing was created with no closed-track route';
  exception when check_violation then
    raise notice 'PASS a live listing cannot exist without a closed-track route';
  end;
end $$;

-- The routine shape instead: published, and running a closed track alongside
-- production. That track is the only route this product will pay for.
insert into apps (id, owner_id, name, status, store_url, package_name, opt_in_url,
                  accepting_activities, activity_target, graduated_at)
values ('aaaaaaaa-0000-0000-0000-00000000000d',
        '11111111-1111-1111-1111-111111111111',
        'Fernbank Live', 'graduated',
        'https://play.google.com/store/apps/details?id=com.fernbank.live',
        'com.fernbank.live',
        'https://play.google.com/apps/testing/com.fernbank.live', true, 3, now())
on conflict (id) do update set status = 'graduated', credits_paused = false;

select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);

-- The `no_opt_in_route` guard in start_activity is the second layer: it still
-- refuses if the route is ever removed at runtime.
update apps set opt_in_url = null, google_group = null, status = 'draft'
 where id = 'aaaaaaaa-0000-0000-0000-00000000000d';
select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000d') ->> 'error'),
  'not_open', 'an app with no route falls out of the open statuses');
update apps
   set opt_in_url = 'https://play.google.com/apps/testing/com.fernbank.live',
       status = 'graduated'
 where id = 'aaaaaaaa-0000-0000-0000-00000000000d';

select assert_eq(
  (select m.activity_open from
     market_apps('all', null, null, null, null, 'newest', 1, 0,
                 'aaaaaaaa-0000-0000-0000-00000000000d') m),
  true, 'market_apps: a live app with a closed track offers the button');

select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000d') ->> 'ok')::boolean,
  true, 'a live app can be taken once it has a closed track');

-- It pays what everything else pays. A live app is not a different rate, and a
-- rate that differed would be an arbitrage between the two.
select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000d') ->> 'error'),
  'already_testing', 'the live seat is a normal seat');

select assert_eq(
  (select pod_id from assignments
    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000d'
      and tester_id = '55555555-5555-5555-5555-555555555555'),
  null::uuid, 'a live app takes an activity, never a pod seat');

-- The `live` scope lists it; the `open` scope does too, since it is open.
select assert_eq(
  (select count(*)::int from
     market_apps('live', null, null, null, null, 'newest', 48, 0) m
    where m.id = 'aaaaaaaa-0000-0000-0000-00000000000d'),
  0, 'the live scope drops an app once you hold its seat');

-- A second tester still sees it, which is what makes the scope worth having.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select assert_eq(
  (select count(*)::int from
     market_apps('live', null, null, null, null, 'newest', 48, 0) m
    where m.id = 'aaaaaaaa-0000-0000-0000-00000000000d'),
  1, 'the live scope lists a published app that is still taking testers');

-- And the store URL is visible, because the listing is public — but it is a
-- link to look at, never a step that pays. Nothing in the schema can record an
-- action taken on the other side of it.
select assert_eq(
  (select m.store_url is not null from
     market_apps('all', null, null, null, null, 'newest', 1, 0,
                 'aaaaaaaa-0000-0000-0000-00000000000d') m),
  true, 'a live app shows its public listing');

select assert_eq(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public'
      and (column_name ilike '%store_review%'
        or column_name ilike '%store_rating%'
        or column_name ilike '%public_install%'
        or column_name ilike '%star_rating%')),
  0, 'no column exists that could record a public store review, rating or install');

-- ===========================================================================
-- 5c. The owner's controls
-- ===========================================================================
-- `set_activity_intake` is how a developer gives or withdraws the consent that
-- `start_activity` checks. Its one real job is refusing to touch somebody
-- else's listing: closing a rival's app would starve it of testers, and raising
-- its target would spend their credits.

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

select assert_eq(
  (set_activity_intake('aaaaaaaa-0000-0000-0000-00000000000a', false, null) ->> 'error'),
  'not_your_app', 'a stranger cannot change your intake settings');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select assert_eq(
  (set_activity_intake('aaaaaaaa-0000-0000-0000-00000000000a', false, null) ->> 'ok')::boolean,
  true, 'the owner can close their app to new testers');

select assert_eq(
  (select accepting_activities from apps where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  false, 'the setting is written');

-- Closing takes nobody's seat away. A tester mid-job has already done work the
-- owner is on the hook for, and withdrawing consent retroactively would be a
-- way to get free testing.
select assert_eq(
  (select count(*)::int from assignments
    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a' and pod_id is null
      and status not in ('dropped', 'removed')),
  2, 'closing an app leaves existing seats alone');

select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000a') ->> 'error'),
  'not_accepting', 'a closed app takes no new testers');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- Clamped, not rejected: a constraint violation is a worse thing for a
-- developer to read than simply landing on the maximum.
select assert_eq(
  ((set_activity_intake('aaaaaaaa-0000-0000-0000-00000000000a', true, 9999)) ->> 'target')::int,
  50, 'an over-large target is clamped to the maximum');

select assert_eq(
  ((set_activity_intake('aaaaaaaa-0000-0000-0000-00000000000a', null, -5)) ->> 'target')::int,
  0, 'a negative target is clamped to zero');

-- Null means "leave this one alone", so the two controls move independently.
select assert_eq(
  ((set_activity_intake('aaaaaaaa-0000-0000-0000-00000000000a', null, 2)) ->> 'accepting')::boolean,
  true, 'passing only a target does not disturb the switch');

-- ===========================================================================
-- 6. The client still cannot write its own seat
-- ===========================================================================
-- If `authenticated` can insert an assignment directly then `start_activity`
-- is decoration: every guard above is skipped by one POST. Run as the role a
-- signed-in session actually uses — as the table owner this passes against a
-- broken schema, which is the trap 05 already records.

-- `set role`, not `set local role`: psql runs in autocommit, so a `set local`
-- outside an explicit transaction is a no-op and the insert below would run as
-- the table owner — which bypasses RLS and passes against a broken schema. That
-- is the same trap 05 records, and it caught this file once already.
set role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);

do $$
begin
  begin
    insert into assignments (pod_id, app_id, tester_id)
    values (null, 'aaaaaaaa-0000-0000-0000-00000000000a',
            '55555555-5555-5555-5555-555555555555');
    raise exception 'FAIL a signed-in member inserted their own activity seat';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS direct insert of an activity seat is refused (%)', sqlerrm;
    when others then
      -- RLS with no INSERT policy surfaces as 42501; anything else that stops
      -- it is still a stop, but name it so a future change is visible.
      if sqlstate = '42501' then
        raise notice 'PASS direct insert of an activity seat is refused by RLS';
      else
        raise exception 'FAIL insert blocked by an unexpected error: % (%)', sqlerrm, sqlstate;
      end if;
  end;
end $$;

reset role;

select '================= ACTIVITY TESTS PASSED =================' as result;
