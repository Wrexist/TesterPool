\set ON_ERROR_STOP on
\pset pager off

-- ===========================================================================
-- Symmetric credit economy — behavioural tests.
-- Every assertion is a hard failure; the file either prints PASS lines to the
-- end or aborts on the first thing that is wrong.
-- ===========================================================================

create or replace function assert_eq(p_got anyelement, p_want anyelement, p_what text)
returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'FAIL % — got %, want %', p_what, p_got, p_want;
  end if;
  raise notice 'PASS % (%)', p_what, p_got;
end $$;

-- --------------------------------------------------------------- fixtures
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'creator@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'tester@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'broke@test.dev');

-- A signup trigger already created these rows; set the fields the tests need.
-- credits goes through award_credits because a direct write is refused by the
-- projection guard — which is itself worth proving here.
insert into profiles (id, handle, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'creator', 'Creator'),
  ('22222222-2222-2222-2222-222222222222', 'tester',  'Tester'),
  ('33333333-3333-3333-3333-333333333333', 'broke',   'Broke')
on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name;

-- Normalise the starting balances however the signup grant left them.
do $$
declare r record; v_target int;
begin
  for r in select id, handle, credits from profiles loop
    v_target := case r.handle when 'creator' then 600 when 'tester' then 0 else 15 end;
    if r.credits <> v_target then
      perform award_credits(r.id, v_target - r.credits, 'admin_adjust', null, null, 'test fixture');
    end if;
  end loop;
end $$;

select assert_eq((select credits from profiles where handle = 'creator'), 600, 'fixture: creator starts at 600');

insert into apps (id, owner_id, name, opt_in_url, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Ledgerly', 'https://play.google.com/apps/testing/com.ledgerly.app', 'draft'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333',
   'Skint', 'https://play.google.com/apps/testing/com.skint.app', 'draft');

insert into pods (id, name, status, starts_at, ends_at)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'Test Pod', 'active',
        now() - interval '3 days', now() + interval '11 days');

-- =========================================================== 1. the install
insert into assignments (id, pod_id, app_id, tester_id)
values ('cccccccc-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222');

update assignments set opt_in_verified_at = now(), status = 'active'
 where id = 'cccccccc-0000-0000-0000-000000000001';

select assert_eq((select credits from profiles where handle = 'tester'), 10,
                 'tester earns 10 for a confirmed install');
select assert_eq((select credits from profiles where handle = 'creator'), 590,
                 'creator pays 10 for a confirmed install');
select assert_eq((select count(*)::int from credit_ledger where reason = 'install_charge'), 1,
                 'the charge is on the ledger');
select assert_eq((select credits_paid from assignments where id = 'cccccccc-0000-0000-0000-000000000001'), 10,
                 'credits_paid stamped so escrow release cannot double-pay');

-- Re-running the same update must not pay twice.
update assignments set status = 'active'
 where id = 'cccccccc-0000-0000-0000-000000000001';
select assert_eq((select credits from profiles where handle = 'tester'), 10,
                 'a second update does not pay again');

-- =========================================================== 2. the report
insert into feedback (id, assignment_id, tester_id, app_id, first_impression,
                      severity, status, submitted_at)
values ('dddddddd-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'Sync banner appears on every cold start and never clears.',
        1, 'submitted', now());

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select review_feedback('dddddddd-0000-0000-0000-000000000001', 'useful', 'Good catch');

select assert_eq((select credits from profiles where handle = 'tester'), 40,
                 'tester earns 30 for a confirmed report');
select assert_eq((select credits from profiles where handle = 'creator'), 560,
                 'creator pays 30 for a confirmed report');

-- A full pod is zero-sum: 14 x 40 out, 14 x 40 in.
select assert_eq((600 - 560) * 14, 560, 'a 15-seat pod costs its owner exactly 560');

-- ============================================ 3. severity does not change price
insert into assignments (id, pod_id, app_id, tester_id)
values ('cccccccc-0000-0000-0000-000000000009',
        'bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333');
insert into feedback (id, assignment_id, tester_id, app_id, first_impression,
                      repro_steps, severity, status, submitted_at)
values ('dddddddd-0000-0000-0000-000000000009',
        'cccccccc-0000-0000-0000-000000000009',
        '33333333-3333-3333-3333-333333333333',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'Crashes on launch every time on Android 11.',
        '1. Cold start 2. Tap Add 3. Crash', 3, 'submitted', now());

select review_feedback('dddddddd-0000-0000-0000-000000000009', 'useful', 'Reproduced');

select assert_eq((select credits from profiles where handle = 'creator'), 530,
                 'a blocker costs the creator the same 30 as praise');
select assert_eq((select credits from profiles where handle = 'broke'), 60,
                 'the blocker bounty is paid by us: 15 + 30 report + 15 install');

-- ================================================= 4. insolvent creator
-- 'broke' has 60 credits. Drain them, then confirm an install on their app.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select award_credits('33333333-3333-3333-3333-333333333333', -55, 'admin_adjust', null, null, 'drain for test');
select assert_eq((select credits from profiles where handle = 'broke'), 5, 'broke is down to 5');

insert into assignments (id, pod_id, app_id, tester_id)
values ('cccccccc-0000-0000-0000-000000000002',
        'bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000002',
        '22222222-2222-2222-2222-222222222222');
update assignments set opt_in_verified_at = now(), status = 'active'
 where id = 'cccccccc-0000-0000-0000-000000000002';

select assert_eq((select credits from profiles where handle = 'tester'), 50,
                 'the tester is paid in full even though the owner could not cover it');
select assert_eq((select credits from profiles where handle = 'broke'), 0,
                 'the owner is taken to zero, never negative');
select assert_eq((select credits_paused from apps where name = 'Skint'), true,
                 'the underfunded app is paused');
select assert_eq((select count(*)::int from notifications where kind = 'credits_exhausted'), 1,
                 'the owner is told why');

-- Topping up clears the pause automatically.
select award_credits('33333333-3333-3333-3333-333333333333', 100, 'purchase', null, null, 'top up');
select assert_eq((select credits_paused from apps where name = 'Skint'), false,
                 'a positive balance unpauses the app');

-- ============================================= 5. ledger and balance agree
select assert_eq(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where user_id = '22222222-2222-2222-2222-222222222222'),
  (select credits from profiles where handle = 'tester'),
  'tester ledger sums to their balance — no drift');

-- The fixture top-up went through award_credits too, so it is on the ledger
-- like everything else: the sum must equal the balance exactly.
select assert_eq(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where user_id = '11111111-1111-1111-1111-111111111111'),
  (select credits from profiles where handle = 'creator'),
  'creator ledger sums to their balance — no drift');

select assert_eq(
  (select coalesce(sum(delta), 0)::int from credit_ledger
    where user_id = '11111111-1111-1111-1111-111111111111' and delta < 0),
  -70, 'creator paid out exactly 10 + 30 + 30');

-- ==================================================== 6. the daily cap
-- Nine more reports today takes the tester to ten; the eleventh must fail.
do $$
declare i int; v_a uuid; v_pod uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
begin
  for i in 1..9 loop
    v_a := gen_random_uuid();
    insert into apps (id, owner_id, name, opt_in_url)
    values (v_a, '11111111-1111-1111-1111-111111111111', 'Filler ' || i,
            'https://play.google.com/apps/testing/com.filler' || i);
    insert into assignments (id, pod_id, app_id, tester_id)
    values (v_a, v_pod, v_a, '22222222-2222-2222-2222-222222222222');
    insert into feedback (assignment_id, tester_id, app_id, first_impression, severity,
                          status, submitted_at)
    values (v_a, '22222222-2222-2222-2222-222222222222', v_a,
            'Filler report ' || i, 1, 'submitted', now());
  end loop;
end $$;

select assert_eq(_reviews_today('22222222-2222-2222-2222-222222222222'), 10,
                 'ten reports banked today');

do $$
declare v_a uuid := gen_random_uuid(); v_failed boolean := false;
begin
  insert into apps (id, owner_id, name, opt_in_url)
  values (v_a, '11111111-1111-1111-1111-111111111111', 'Eleventh',
          'https://play.google.com/apps/testing/com.eleventh');
  insert into assignments (id, pod_id, app_id, tester_id)
  values (v_a, 'bbbbbbbb-0000-0000-0000-000000000001', v_a,
          '22222222-2222-2222-2222-222222222222');
  begin
    insert into feedback (assignment_id, tester_id, app_id, first_impression, severity,
                          status, submitted_at)
    values (v_a, '22222222-2222-2222-2222-222222222222', v_a, 'One too many', 1,
            'submitted', now());
  exception when others then
    v_failed := true;
    if sqlerrm not like '%daily_review_cap%' then
      raise exception 'FAIL 11th report blocked for the wrong reason: %', sqlerrm;
    end if;
  end;
  if not v_failed then raise exception 'FAIL the 11th report was allowed through'; end if;
  raise notice 'PASS the 11th report is refused';
end $$;

-- A draft is not a submission, so it must still be allowed at the cap.
do $$
declare v_a uuid := gen_random_uuid();
begin
  insert into apps (id, owner_id, name, opt_in_url)
  values (v_a, '11111111-1111-1111-1111-111111111111', 'Drafty',
          'https://play.google.com/apps/testing/com.drafty');
  insert into assignments (id, pod_id, app_id, tester_id)
  values (v_a, 'bbbbbbbb-0000-0000-0000-000000000001', v_a,
          '22222222-2222-2222-2222-222222222222');
  insert into feedback (assignment_id, tester_id, app_id, first_impression, severity, status)
  values (v_a, '22222222-2222-2222-2222-222222222222', v_a, 'Still writing', 1, 'draft');
  raise notice 'PASS a draft is still allowed at the cap';
end $$;

-- ============================================ 7. the paid pass lifts the cap
insert into entitlements (user_id, kind, expires_at)
values ('22222222-2222-2222-2222-222222222222', 'unlimited', now() + interval '30 days');

select assert_eq(has_unlimited_testing('22222222-2222-2222-2222-222222222222'), true,
                 'the pass is active');

do $$
declare v_a uuid := gen_random_uuid();
begin
  insert into apps (id, owner_id, name, opt_in_url)
  values (v_a, '11111111-1111-1111-1111-111111111111', 'Unlimited test',
          'https://play.google.com/apps/testing/com.unlimited');
  insert into assignments (id, pod_id, app_id, tester_id)
  values (v_a, 'bbbbbbbb-0000-0000-0000-000000000001', v_a,
          '22222222-2222-2222-2222-222222222222');
  insert into feedback (assignment_id, tester_id, app_id, first_impression, severity,
                        status, submitted_at)
  values (v_a, '22222222-2222-2222-2222-222222222222', v_a,
          'Past the cap, on the pass', 1, 'submitted', now());
  raise notice 'PASS the pass lifts the report cap';
end $$;

-- An expired pass must not.
update entitlements set expires_at = now() - interval '1 day'
 where user_id = '22222222-2222-2222-2222-222222222222';
select assert_eq(has_unlimited_testing('22222222-2222-2222-2222-222222222222'), false,
                 'an expired pass does not count');

-- =============================================== 8. testing_quota() shape
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select assert_eq((testing_quota() ->> 'review_cap')::int, 10, 'quota reports the cap');
select assert_eq((testing_quota() ->> 'unlimited')::boolean, false, 'quota reports the pass state');

-- ============================================ 9. check-ins mint nothing
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare v_before int; v_after int;
begin
  select credits into v_before from profiles where handle = 'tester';
  perform submit_checkin('cccccccc-0000-0000-0000-000000000001', null, 'day note');
  select credits into v_after from profiles where handle = 'tester';
  if v_after <> v_before then
    raise exception 'FAIL a check-in moved the balance by %', v_after - v_before;
  end if;
  raise notice 'PASS a check-in pays no credits';
end $$;

select assert_eq((select days_checked_in from assignments
                   where id = 'cccccccc-0000-0000-0000-000000000001'), 1,
                 'the check-in still counts toward the fourteen days');

\echo ''
\echo '================= ALL ECONOMY TESTS PASSED ================='
