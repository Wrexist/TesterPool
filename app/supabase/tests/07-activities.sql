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
-- `platform` is set explicitly on every fixture here, not left to the column
-- default: `activity_open` gates on `a.platform = 'android'`, so a future
-- change to that default would fail these assertions for a reason that has
-- nothing to do with activities.
insert into apps (id, owner_id, name, platform, opt_in_url, status,
                  accepting_activities, activity_target)
values ('aaaaaaaa-0000-0000-0000-00000000000a',
        '11111111-1111-1111-1111-111111111111',
        'Fernbank', 'android',
        'https://play.google.com/apps/testing/com.fernbank.app',
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
insert into apps (id, owner_id, name, platform, opt_in_url, status, accepting_activities, activity_target)
values ('aaaaaaaa-0000-0000-0000-00000000000b',
        '33333333-3333-3333-3333-333333333333',
        'Skint Two', 'android',
        'https://play.google.com/apps/testing/com.skint2.app', 'queued', true, 5)
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
insert into apps (id, owner_id, name, platform, status, accepting_activities, activity_target)
values ('aaaaaaaa-0000-0000-0000-00000000000c',
        '11111111-1111-1111-1111-111111111111', 'No Door', 'android', 'draft', true, 5)
on conflict (id) do nothing;
select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000c') ->> 'error'),
  'not_open', 'refuses an app that is not listed');

-- The flag, enforced in the database rather than only in the UI. The restore
-- runs even when the assertion fails: `ON_ERROR_STOP` would otherwise abort with
-- the flag still off, and the next run of this file would fail at the happy path
-- instead of here, pointing at the wrong thing.
do $$
declare v_err text;
begin
  update feature_flags set enabled = false where key = 'activities';
  v_err := start_activity('aaaaaaaa-0000-0000-0000-00000000000a') ->> 'error';
  update feature_flags set enabled = true where key = 'activities';
  perform assert_eq(v_err, 'activities_closed', 'the flag is enforced inside the RPC');
exception when others then
  update feature_flags set enabled = true where key = 'activities';
  raise;
end $$;

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
-- Step 2 cannot precede step 1. tester2 holds a seat whose opt-in was never
-- verified, and the UI simply does not render the button for that state — which
-- is not a guard, because every RPC here is reachable over REST.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select assert_eq(
  (submit_checkin((select id from assignments
                    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
                      and tester_id = '44444444-4444-4444-4444-444444444444'))
   ->> 'error'),
  'opt_in_required', 'an unverified activity cannot be checked in');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

-- Anchored to this seat's own ref_id. The header says every assertion here is,
-- and counting every streak_bonus the tester has ever received would have made
-- this one fail the day 01 or 02 awarded one for a reason of its own.
select assert_eq(
  (select count(*)::int from credit_ledger
    where user_id = '22222222-2222-2222-2222-222222222222'
      and reason = 'streak_bonus'
      and ref_id = (select id from assignments
                     where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
                       and tester_id = '22222222-2222-2222-2222-222222222222')),
  0, 'no streak bonus on an activity');

-- One session, once. A second call on a later UTC date used to log day 2: no
-- credits (daily_checkin pays 0) but days_checked_in, the streak and reliability
-- all inflated, and `testers_full` counts seats that reach 14.
-- Same day: the activity guard answers before the same-day guard does, because
-- it is the more specific of the two and sits above it.
select assert_eq(
  (submit_checkin((select id from assignments
                    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
                      and tester_id = '22222222-2222-2222-2222-222222222222'))
   ->> 'error'),
  'activity_already_logged', 'a same-day repeat is refused');

-- Tomorrow, simulated by clearing everything the same-day guard reads. This is
-- the case that was actually open: `already_checked_in_today` only ever looked
-- at today, so a tester coming back on a later UTC date logged day 2.
update assignments set last_checkin_on = null
 where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
   and tester_id = '22222222-2222-2222-2222-222222222222';
delete from checkins
 where assignment_id = (select id from assignments
                         where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
                           and tester_id = '22222222-2222-2222-2222-222222222222')
   and checkin_date = (now() at time zone 'utc')::date;

select assert_eq(
  (submit_checkin((select id from assignments
                    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
                      and tester_id = '22222222-2222-2222-2222-222222222222'))
   ->> 'error'),
  'activity_already_logged', 'an activity gets one session, not one a day');

select assert_eq(
  (select days_checked_in from assignments
    where app_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
      and tester_id = '22222222-2222-2222-2222-222222222222'),
  1, 'the refused repeat did not advance the day count');

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
insert into apps (id, owner_id, name, platform, status, store_url, package_name, opt_in_url,
                  accepting_activities, activity_target, graduated_at)
values ('aaaaaaaa-0000-0000-0000-00000000000d',
        '11111111-1111-1111-1111-111111111111',
        'Fernbank Live', 'android', 'graduated',
        'https://play.google.com/store/apps/details?id=com.fernbank.live',
        'com.fernbank.live',
        'https://play.google.com/apps/testing/com.fernbank.live', true, 3, now())
on conflict (id) do update set status = 'graduated', credits_paused = false;

select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);

-- And the constraint is why the `no_opt_in_route` guard inside start_activity
-- cannot be reached through the table at all: stripping the route forces the
-- row to 'draft', so the refusal that actually comes back is 'not_open' from the
-- status gate one line above it. The guard stays as the second layer for a
-- caller that is not the table — a future migration, a backfill — but this is
-- what a tester hits, and the assertion says so rather than the comment
-- claiming a path it does not take.
update apps set opt_in_url = null, google_group = null, status = 'draft'
 where id = 'aaaaaaaa-0000-0000-0000-00000000000d';
select assert_eq(
  (start_activity('aaaaaaaa-0000-0000-0000-00000000000d') ->> 'error'),
  'not_open', 'stripping the route forces draft, so the status gate answers first');
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

-- Both scopes are "work you could pick up", so holding the seat removes the app
-- from each of them. Asserted for both, because the comment used to say the
-- opposite of what the assertion checked.
select assert_eq(
  (select count(*)::int from
     market_apps('live', null, null, null, null, 'newest', 48, 0) m
    where m.id = 'aaaaaaaa-0000-0000-0000-00000000000d'),
  0, 'the live scope drops an app once you hold its seat');

select assert_eq(
  (select count(*)::int from
     market_apps('open', null, null, null, null, 'newest', 48, 0) m
    where m.id = 'aaaaaaaa-0000-0000-0000-00000000000d'),
  0, 'the open scope drops it too');

-- A second tester still sees it, which is what makes the scope worth having.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select assert_eq(
  (select count(*)::int from
     market_apps('live', null, null, null, null, 'newest', 48, 0) m
    where m.id = 'aaaaaaaa-0000-0000-0000-00000000000d'),
  1, 'the live scope lists a published app that is still taking testers');

-- And the store URL is visible, because the listing is public.
select assert_eq(
  (select m.store_url is not null from
     market_apps('all', null, null, null, null, 'newest', 1, 0,
                 'aaaaaaaa-0000-0000-0000-00000000000d') m),
  true, 'a live app shows its public listing');

-- This assertion used to read `0` — no column anywhere in the schema could
-- record a public store review, rating or install, which was invariant 1 and
-- the product's whole legal argument.
--
-- `20260814240000_store_reviews.sql` ended that on the product owner's explicit
-- instruction, so the assertion has been narrowed rather than deleted: those
-- columns may now exist, but ONLY on `feedback`, and only the four the store
-- feature introduced. If a fifth appears, or one turns up on another table,
-- this fails — which is the point. The invariant is gone; the containment is
-- what is being tested now.
--
-- `08-store-reviews.sql` is where the behaviour of those columns is asserted,
-- including that they cannot be attached to a closed-track report at all.
select assert_eq(
  (select coalesce(array_agg(distinct table_name::text order by table_name::text), '{}')
     from information_schema.columns
    where table_schema = 'public'
      and (column_name ilike '%store_review%'
        or column_name ilike '%store_rating%'
        or column_name ilike '%public_install%'
        or column_name ilike '%star_rating%')),
  array['apps', 'feedback', 'store_review_audit']::text[],
  'store-review columns exist only on apps, feedback and the audit view');

select assert_eq(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'feedback'
      and (column_name ilike '%store_review%'
        or column_name ilike '%store_rating%'
        or column_name ilike '%public_install%'
        or column_name ilike '%star_rating%')),
  4, 'and there are exactly four on feedback — rating, text, url, proof');

-- `apps` carries exactly one: the publisher's per-app consent. It is a boolean
-- and it must stay one — anything richer here would be the feature spreading.
select assert_eq(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'apps'
      and column_name ilike '%store_review%'),
  1, 'and exactly one on apps — the publisher opt-in');

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
-- 5d. An owner cannot be committed past their balance
-- ===========================================================================
-- The hole this closes, reproduced before it was fixed: the balance check
-- locked `profiles.credits` and compared it to 40, then inserted the seat
-- without reserving anything. The lock releases at commit with the balance
-- untouched, so every caller read the same 40 and passed. An owner holding 40
-- with `activity_target` 3 was given three seats — 120 of obligation against 40
-- of balance.
--
-- It does not end in an unpaid tester, which would be bad enough. `_charge_owner`
-- pays the tester in full and takes the owner to zero, by design, so the
-- shortfall is *minted*: three completed activities on that owner would have
-- created 80 credits from nothing, against invariant 1a.

insert into apps (id, owner_id, name, platform, opt_in_url, status,
                  accepting_activities, activity_target)
values ('cccccccc-0000-0000-0000-00000000000f',
        '11111111-1111-1111-1111-111111111111',
        'Overcommit', 'android',
        'https://play.google.com/apps/testing/com.overcommit.app', 'queued', true, 3)
on conflict (id) do update
  set status = 'queued', credits_paused = false,
      accepting_activities = true, activity_target = 3;

-- Exactly one job's worth, and nothing outstanding: every other activity seat
-- in this file has had its report approved or belongs to a different owner.
do $$
declare v int; v_open int;
begin
  select count(*) into v_open
    from assignments s join apps a2 on a2.id = s.app_id
   where a2.owner_id = '11111111-1111-1111-1111-111111111111'
     and s.pod_id is null and s.status not in ('dropped', 'removed')
     and not exists (select 1 from feedback f
                      where f.assignment_id = s.id
                        and f.status in ('approved', 'arbitrated'));
  -- Fund exactly one job beyond whatever is already outstanding, so the first
  -- seat is affordable and the second is not.
  select credits into v from profiles where handle = 'creator';
  perform award_credits('11111111-1111-1111-1111-111111111111'::uuid,
                        (40 * (v_open + 1)) - v, 'admin_adjust', null, null,
                        'overcommit fixture');
end $$;

select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select assert_eq(
  (start_activity('cccccccc-0000-0000-0000-00000000000f') ->> 'ok')::boolean,
  true, 'the first seat is affordable');

-- A different tester, a seat still open, and the balance already spoken for.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select assert_eq(
  (start_activity('cccccccc-0000-0000-0000-00000000000f') ->> 'error'),
  'owner_fully_committed', 'a second seat past the balance is refused');

select assert_eq(
  (select count(*)::int from assignments
    where app_id = 'cccccccc-0000-0000-0000-00000000000f' and pod_id is null),
  1, 'exactly one seat exists');

-- Solvent, so the listing is NOT paused: it comes back on its own the moment an
-- outstanding report lands. Pausing here would punish an owner for having
-- testers, which is the opposite of what the pause is for.
select assert_eq(
  (select credits_paused from apps where id = 'cccccccc-0000-0000-0000-00000000000f'),
  false, 'a fully committed listing is not paused');

-- The obligation is counted across every app the owner has, because a balance
-- is per-owner. A second listing must not reset the allowance.
insert into apps (id, owner_id, name, platform, opt_in_url, status,
                  accepting_activities, activity_target)
values ('cccccccc-0000-0000-0000-0000000000f2',
        '11111111-1111-1111-1111-111111111111',
        'Overcommit Two', 'android',
        'https://play.google.com/apps/testing/com.overcommit2.app', 'queued', true, 3)
on conflict (id) do update
  set status = 'queued', credits_paused = false,
      accepting_activities = true, activity_target = 3;

select assert_eq(
  (start_activity('cccccccc-0000-0000-0000-0000000000f2') ->> 'error'),
  'owner_fully_committed', 'a second listing does not reset the allowance');

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
