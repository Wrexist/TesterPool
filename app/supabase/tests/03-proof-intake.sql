\set ON_ERROR_STOP on
\pset pager off

-- ===========================================================================
-- Proof intake — security tests.
--
-- An approved opt-in proof moves credits. These assertions are the difference
-- between a verification step and a money printer, so each one names the attack
-- it is standing in the way of.
-- ===========================================================================

-- Two members, and an assignment belonging to the first.
insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'honest@test.dev'),
  ('66666666-6666-6666-6666-666666666666', 'cheat@test.dev');
insert into profiles (id, handle, display_name) values
  ('55555555-5555-5555-5555-555555555555', 'honest', 'Honest'),
  ('66666666-6666-6666-6666-666666666666', 'cheat',  'Cheat')
on conflict (id) do update set handle = excluded.handle;

insert into apps (id, owner_id, name, opt_in_url)
values ('eeeeeeee-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'Proofly',
        'https://play.google.com/apps/testing/com.proofly');

insert into assignments (id, pod_id, app_id, tester_id)
values ('ffffffff-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001',
        'eeeeeeee-0000-0000-0000-000000000001',
        '55555555-5555-5555-5555-555555555555');

-- A real uploaded object under honest's own prefix.
insert into storage.objects (bucket_id, name, owner, metadata)
values ('proofs',
        '55555555-5555-5555-5555-555555555555/ffffffff-0000-0000-0000-000000000001/opt-in-1.png',
        '55555555-5555-5555-5555-555555555555',
        '{"size": 240000}'::jsonb);

-- ============================================ 1. the happy path lands pending
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);

select assert_eq(
  (submit_proof('ffffffff-0000-0000-0000-000000000001', 'opt_in',
   '55555555-5555-5555-5555-555555555555/ffffffff-0000-0000-0000-000000000001/opt-in-1.png')
   ->> 'status'),
  'pending',
  'a submitted proof starts pending, never approved');

select assert_eq((select count(*)::int from proofs where status = 'pending'), 1,
                 'exactly one proof was created');
select assert_eq((select ai_confidence from proofs limit 1), null::numeric,
                 'no confidence is recorded at submission — that is triage''s job');
select assert_eq((select opt_in_verified_at from assignments
                   where id = 'ffffffff-0000-0000-0000-000000000001'), null::timestamptz,
                 'submitting a proof does not stamp the opt-in, so no credits move');

-- ================================ 2. a client cannot insert a proof directly
-- This is the one that used to be the money printer: status chosen by the
-- caller. The grant is what stops it; the trigger is the second lock.
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into proofs (uploader_id, assignment_id, kind, storage_path, status, ai_confidence)
    values ('55555555-5555-5555-5555-555555555555',
            'ffffffff-0000-0000-0000-000000000001', 'opt_in', 'x/y.png',
            'auto_approved', 0.99);
  exception when others then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL a proof was inserted pre-approved with a made-up confidence';
  end if;
  raise notice 'PASS a pre-approved proof cannot be inserted, even by the owner role';
end $$;

-- 2b. The same insert as `authenticated`, which is what a PostgREST client is.
-- The block above runs as the table owner, and grants do not apply to an owner,
-- so only the trigger could have failed it. This one exercises the revoke.
do $$
declare v_blocked boolean := false;
begin
  begin
    set local role authenticated;
    insert into proofs (uploader_id, assignment_id, kind, storage_path, status)
    values ('55555555-5555-5555-5555-555555555555',
            'ffffffff-0000-0000-0000-000000000001', 'opt_in', 'x/y.png', 'pending');
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  reset role;
  if not v_blocked then
    raise exception 'FAIL the authenticated role can insert into proofs directly';
  end if;
  raise notice 'PASS the authenticated role has no insert grant on proofs';
end $$;

-- ========================== 3. you cannot prove somebody else's assignment
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
select assert_eq(
  (submit_proof('ffffffff-0000-0000-0000-000000000001', 'opt_in',
   '66666666-6666-6666-6666-666666666666/x/opt-in.png') ->> 'error'),
  'not_yours',
  'another member cannot submit proof against your assignment');

-- ================== 4. you cannot claim an object under somebody else's prefix
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
select assert_eq(
  (submit_proof('ffffffff-0000-0000-0000-000000000001', 'opt_in',
   '66666666-6666-6666-6666-666666666666/ffffffff-0000-0000-0000-000000000001/opt-in-1.png')
   ->> 'error'),
  'bad_path',
  'a path under another member''s prefix is refused');

-- ============================== 5. you cannot claim an object that is not there
select assert_eq(
  (submit_proof('ffffffff-0000-0000-0000-000000000001', 'opt_in',
   '55555555-5555-5555-5555-555555555555/ffffffff-0000-0000-0000-000000000001/never-uploaded.png')
   ->> 'error'),
  'no_object',
  'a path with no object behind it is refused');

-- ================================================== 6. the hourly flood limit
do $$
declare i int; v_path text; v_res jsonb;
begin
  for i in 1..25 loop
    v_path := '55555555-5555-5555-5555-555555555555/ffffffff-0000-0000-0000-000000000001/flood-'
              || i || '.png';
    insert into storage.objects (bucket_id, name, owner, metadata)
    values ('proofs', v_path, '55555555-5555-5555-5555-555555555555', '{"size": 240000}'::jsonb);
    v_res := submit_proof('ffffffff-0000-0000-0000-000000000001', 'opt_in', v_path);
    if (v_res ->> 'error') = 'rate_limited' then
      raise notice 'PASS flood control stopped submission % of 25', i;
      return;
    end if;
  end loop;
  raise exception 'FAIL twenty-five proofs in an hour were all accepted';
end $$;

-- ============================= 7. triage approval is what stamps the opt-in
-- Standing in for the edge function, which writes as the service role.
update proofs set status = 'auto_approved', ai_confidence = 0.93
 where assignment_id = 'ffffffff-0000-0000-0000-000000000001'
   and storage_path like '%opt-in-1.png';

-- Balances start at the signup grant, so the payment is asserted as a delta.
create temp table baseline as
  select credits as before from profiles where handle = 'honest';

select assert_eq((stamp_approved_optins() ->> 'stamped')::int, 1,
                 'the sweep stamps an approved opt-in');
select assert_eq(
  (select opt_in_verified_at is not null from assignments
    where id = 'ffffffff-0000-0000-0000-000000000001'),
  true, 'the assignment is now verified');
select assert_eq(
  (select credits from profiles where handle = 'honest') - (select before from baseline),
  10, 'and only now does the tester get paid, exactly 10');

-- Running it again must not pay twice.
select assert_eq((stamp_approved_optins() ->> 'stamped')::int, 0,
                 'the sweep is idempotent');
select assert_eq(
  (select credits from profiles where handle = 'honest') - (select before from baseline),
  10, 'no second payment');

-- ================== 7b. approving the same proof twice pays once
-- admin_review_proof is the other route that stamps an opt-in and moves credit.
-- A double-clicked approve button must not bill the app owner twice.
insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'mod@test.dev');
-- admin_review_proof gates on _require_admin(), which reads profiles.role — a
-- stricter bar than is_moderator. Both are set so the fixture matches a real
-- admin rather than only a moderator.
insert into profiles (id, handle, display_name, is_moderator, role) values
  ('77777777-7777-7777-7777-777777777777', 'themod', 'The Mod', true, 'admin')
on conflict (id) do update set is_moderator = true, role = 'admin';

select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);

create temp table baseline2 as
  select (select credits from profiles where handle = 'honest') as tester,
         (select credits from profiles where handle = 'creator') as owner;

do $$
declare v_p uuid;
begin
  select id into v_p from proofs
   where assignment_id = 'ffffffff-0000-0000-0000-000000000001'
     and storage_path like '%opt-in-1.png';
  perform admin_review_proof(v_p, true, null);
  perform admin_review_proof(v_p, true, null);
  raise notice 'PASS approving twice does not raise';
end $$;

select assert_eq(
  (select credits from profiles where handle = 'honest') - (select tester from baseline2),
  0, 're-approving an already-verified opt-in pays the tester nothing more');
select assert_eq(
  (select credits from profiles where handle = 'creator') - (select owner from baseline2),
  0, 'and charges the app owner nothing more');

select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);

-- ============================ 8. an over-cap tester is deferred, not exploded
-- Take honest to their allowance, then approve one more proof for them.
do $$
declare i int; v_a uuid; v_p uuid;
begin
  for i in 1..10 loop
    v_a := gen_random_uuid();
    insert into apps (id, owner_id, name, opt_in_url)
    values (v_a, '11111111-1111-1111-1111-111111111111', 'Capfill ' || i,
            'https://play.google.com/apps/testing/com.capfill' || i);
    insert into assignments (id, pod_id, app_id, tester_id)
    values (v_a, 'bbbbbbbb-0000-0000-0000-000000000001', v_a,
            '55555555-5555-5555-5555-555555555555');
    if i < 10 then
      update assignments set opt_in_verified_at = now(), status = 'active' where id = v_a;
    else
      -- The tenth stays unverified but has an approved proof waiting.
      insert into proofs (uploader_id, assignment_id, kind, storage_path, status)
      values ('55555555-5555-5555-5555-555555555555', v_a, 'opt_in', 'capfill.png', 'pending')
      returning id into v_p;
      update proofs set status = 'approved' where id = v_p;
    end if;
  end loop;
end $$;

select assert_eq(_installs_today('55555555-5555-5555-5555-555555555555'), 10,
                 'honest is at the daily allowance');

-- The sweep must survive this rather than raising.
select assert_eq((stamp_approved_optins() ->> 'deferred')::int, 1,
                 'the over-cap stamp is deferred, not an error');
select assert_eq((stamp_approved_optins() ->> 'stamped')::int, 0,
                 'and nothing was stamped past the cap');

-- ============================================== 9. the backlog query is sane
select assert_eq(
  (select count(*)::int from proofs_awaiting_triage(50)), 0,
  'nothing fresh is in the triage backlog yet — it only picks up proofs over two minutes old');

\echo ''
\echo '================= PROOF INTAKE TESTS PASSED ================='
