\set ON_ERROR_STOP on
\pset pager off

-- ===========================================================================
-- The columns that decide a payment — regression tests.
--
-- Both of these were live. The first moved 10 credits from a developer to a
-- tester with a single PATCH and no screenshot; the second reached the same
-- transfer one hop later, through the sweep that trusts an approved proof.
--
-- These tests run as `authenticated`, because that is who the exploit is
-- available to. Every other test file in this directory runs as the table owner
-- and would sail straight through the guards.
--
-- Runs after 01.
-- ===========================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Two different shapes of "no". An INSERT that RLS or a guard refuses raises;
-- an UPDATE that RLS filters out simply matches no rows and returns quietly.
-- Asserting only on the exception would have let the silent case through, which
-- is the more dangerous of the two, so each is checked for what it leaves
-- behind rather than for how it complained.
create or replace function assert_raises(p_sql text, p_what text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'PASS % (blocked: %)', p_what, sqlerrm;
    return;
  end;
  raise exception 'FAIL % — the write was allowed', p_what;
end $$;

create or replace function assert_no_effect(p_sql text, p_check text, p_what text)
returns void language plpgsql as $$
declare v_rows int; v_still boolean;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
  exception when others then
    raise notice 'PASS % (blocked: %)', p_what, sqlerrm;
    return;
  end;
  execute p_check into v_still;
  if not v_still then
    raise exception 'FAIL % — % row(s) written', p_what, v_rows;
  end if;
  raise notice 'PASS % (% row(s) matched, nothing changed)', p_what, v_rows;
end $$;

-- Its own tester, its own app, its own seat. Reusing 01's tester meant every
-- assertion "passed" against the daily review cap instead of against the thing
-- being tested — a false green, and the worst kind.
delete from feedback    where assignment_id = 'aaaa1111-0000-0000-0000-00000000dead';
delete from assignments where id = 'aaaa1111-0000-0000-0000-00000000dead';
delete from apps        where id = 'aaaa2222-0000-0000-0000-00000000dead';
delete from auth.users  where email = 'locks@test.dev';

insert into auth.users (id, email)
values ('aaaa3333-0000-0000-0000-00000000dead', 'locks@test.dev');
insert into profiles (id, handle, display_name)
values ('aaaa3333-0000-0000-0000-00000000dead', 'locks', 'Lock Tester')
on conflict (id) do update set handle = excluded.handle;

insert into apps (id, owner_id, name, opt_in_url, status)
values ('aaaa2222-0000-0000-0000-00000000dead',
        '11111111-1111-1111-1111-111111111111',
        'Locktest', 'https://play.google.com/apps/testing/com.locktest', 'in_pod');
insert into assignments (id, pod_id, app_id, tester_id)
values ('aaaa1111-0000-0000-0000-00000000dead',
        'bbbbbbbb-0000-0000-0000-000000000001',
        'aaaa2222-0000-0000-0000-00000000dead',
        'aaaa3333-0000-0000-0000-00000000dead');

select set_config('request.jwt.claim.sub', 'aaaa3333-0000-0000-0000-00000000dead', false);

do $$
declare v_before int;
begin
  select credits into v_before from profiles where handle = 'locks';
  perform set_config('tp.tester_before', v_before::text, false);
end $$;

set role authenticated;

-- 1. The direct one: stamp your own opt-in.
select assert_no_effect(
  $q$ update assignments set opt_in_verified_at = now(), status = 'active'
       where id = 'aaaa1111-0000-0000-0000-00000000dead' $q$,
  $q$ select opt_in_verified_at is null from assignments
       where id = 'aaaa1111-0000-0000-0000-00000000dead' $q$,
  'a tester cannot verify their own opt-in');

-- 2. Fake the clock: fourteen days of check-ins without checking in. This one
--    forges the evidence a developer shows Google as well as the escrow.
select assert_no_effect(
  $q$ update assignments set days_checked_in = 14
       where id = 'aaaa1111-0000-0000-0000-00000000dead' $q$,
  $q$ select days_checked_in = 0 from assignments
       where id = 'aaaa1111-0000-0000-0000-00000000dead' $q$,
  'a tester cannot write their own day count');

-- 3. The one-hop one: a self-approved proof, which the sweep would then trust.
select assert_raises(
  $q$ insert into proofs (uploader_id, assignment_id, kind, storage_path, status)
      values ('aaaa3333-0000-0000-0000-00000000dead',
              'aaaa1111-0000-0000-0000-00000000dead',
              'opt_in', 'aaaa3333-0000-0000-0000-00000000dead/fake.png', 'approved') $q$,
  'a tester cannot insert a proof, approved or otherwise');

-- 4. Report on somebody else's assignment, which inflates their evidence pack.
select assert_raises(
  $q$ insert into feedback (assignment_id, tester_id, app_id, first_impression, status)
      values ('cccccccc-0000-0000-0000-000000000009',
              'aaaa3333-0000-0000-0000-00000000dead',
              'aaaa2222-0000-0000-0000-00000000dead',
              'Not my assignment, but here is a glowing report.', 'submitted') $q$,
  'a tester cannot report on an assignment that is not theirs');

-- 5. Approve your own report.
select assert_raises(
  $q$ insert into feedback (assignment_id, tester_id, app_id, first_impression, status, credits_awarded)
      values ('aaaa1111-0000-0000-0000-00000000dead',
              'aaaa3333-0000-0000-0000-00000000dead',
              'aaaa2222-0000-0000-0000-00000000dead',
              'Marking my own homework as approved.', 'approved', 30) $q$,
  'a tester cannot approve their own report');

-- 6. Filing a real report still works, and lands unpaid and unreviewed.
insert into feedback (assignment_id, tester_id, app_id, first_impression, status, submitted_at)
values ('aaaa1111-0000-0000-0000-00000000dead',
        'aaaa3333-0000-0000-0000-00000000dead',
        'aaaa2222-0000-0000-0000-00000000dead',
        'The sync banner never clears after a cold start.', 'submitted', now());

reset role;

select assert_eq(
  (select credits_awarded from feedback where assignment_id = 'aaaa1111-0000-0000-0000-00000000dead'),
  0, 'a filed report carries no credits until the developer reviews it');

select assert_eq(
  (select credits from profiles where handle = 'locks'),
  current_setting('tp.tester_before')::int,
  'nothing above moved a single credit');

select '================= PAYMENT LOCK TESTS PASSED =================' as result;
