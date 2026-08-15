\set ON_ERROR_STOP on
\pset pager off

-- ===========================================================================
-- STORE REVIEWS — paying for a published public review.
--
-- This is the feature that ends invariant 1, on the product owner's explicit
-- instruction, so it gets more assertions than anything else in this suite
-- rather than fewer. The things that must hold:
--
--   1. it is OFF by default, and start_store_activity refuses while it is
--   2. it stays off per app until the publisher opts that app in
--   3. a store seat needs a public store listing to exist at all
--   4. store columns cannot be attached to a closed-track report
--   5. the tester cannot pay themselves — status is not theirs to write
--   6. the publisher's verdict moves exactly 30, and 10 came from the install,
--      the same amounts the private route moves — no arbitrage between them
--   7. a disputed review still reaches a moderator and is still paid if upheld,
--      because invariant 2 has to survive a feature that ignores invariant 1
--   8. the audit view sees every one of them
--
-- Run after 01 (fixtures and assert_eq) and 07.
-- ===========================================================================

do $$ begin
  if to_regprocedure('assert_eq(anyelement,anyelement,text)') is null then
    raise exception 'run 01-economy.sql first';
  end if;
end $$;

-- A clean slate for this file only.
--
-- Every seat on the app under test goes, not just the store-listing ones: 07
-- leaves a closed-track activity on this same pair, and `start_store_activity`
-- refuses a second seat for a tester who already holds ANY seat on the app —
-- which is correct behaviour and would otherwise read here as a broken feature.
delete from feedback where tester_id in (
  '22222222-2222-2222-2222-222222222222',
  '55555555-5555-5555-5555-555555555555');
delete from checkins where assignment_id in (
  select id from assignments where app_id = 'aaaaaaaa-0000-0000-0000-000000000001');
delete from assignments where app_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- The creator's app, given a public listing so the store route is possible.
update apps
   set store_url = 'https://play.google.com/store/apps/details?id=com.test.one',
       accepting_store_reviews = false,
       credits_paused = false,
       activity_target = 5
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Top the publisher up so they can cover the runs below. Through
-- `award_credits`, never a direct write: `profiles.credits` is a projection of
-- the ledger and a trigger refuses anything else — which is itself one of the
-- things this suite exists to keep true.
do $$
declare v_have int;
begin
  select credits into v_have from profiles where id = '11111111-1111-1111-1111-111111111111';
  if v_have < 500 then
    perform award_credits('11111111-1111-1111-1111-111111111111', 500 - v_have,
                          'admin_adjust', null, null, 'test fixture top-up');
  end if;
end $$;

/* ------------------------------------------------- 1. off by default */

do $$
declare v jsonb;
begin
  if coalesce((select enabled from feature_flags where key = 'store_reviews'), false) then
    raise exception 'FAIL store_reviews must ship disabled';
  end if;
  raise notice 'PASS store_reviews ships disabled';
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

do $$
declare v jsonb;
begin
  v := start_store_activity('aaaaaaaa-0000-0000-0000-000000000001');
  perform assert_eq(v ->> 'error', 'store_reviews_closed',
                    'the flag refuses a store activity while it is off');
end $$;

-- Turn it on for the rest of the file.
update feature_flags set enabled = true where key = 'store_reviews';

/* --------------------------------- 2. still off until the publisher opts in */

do $$
declare v jsonb;
begin
  v := start_store_activity('aaaaaaaa-0000-0000-0000-000000000001');
  perform assert_eq(v ->> 'error', 'not_accepting',
                    'an app is opted out until its publisher says otherwise');
end $$;

-- Only the owner may opt an app in.
do $$
declare v jsonb;
begin
  begin
    v := set_store_review_intake('aaaaaaaa-0000-0000-0000-000000000001', true);
    raise exception 'FAIL a stranger opted somebody else''s app into store reviews';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS only the publisher can opt their app in';
  end;
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select set_store_review_intake('aaaaaaaa-0000-0000-0000-000000000001', true);

/* ------------------------------------------ 3. a listing is required */

update apps set store_url = null where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

do $$
declare v jsonb;
begin
  v := start_store_activity('aaaaaaaa-0000-0000-0000-000000000001');
  perform assert_eq(v ->> 'error', 'no_store_listing',
                    'no public listing means nothing to install or review');
end $$;

update apps
   set store_url = 'https://play.google.com/store/apps/details?id=com.test.one'
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

/* ------------------------------------------------- 4. the happy path */

do $$
declare v jsonb; v_id uuid; v_kind activity_kind;
begin
  v := start_store_activity('aaaaaaaa-0000-0000-0000-000000000001');
  perform assert_eq((v ->> 'ok')::boolean, true, 'a store activity starts');

  v_id := (v ->> 'assignment_id')::uuid;
  select kind into v_kind from assignments where id = v_id;
  perform assert_eq(v_kind::text, 'store_listing', 'the seat records the route it came in on');
  perform assert_eq((select pod_id is null from assignments where id = v_id), true,
                    'a store seat has no cohort');
end $$;

-- Twice is refused, or a tester could review one app for every credit in it.
do $$
declare v jsonb;
begin
  v := start_store_activity('aaaaaaaa-0000-0000-0000-000000000001');
  perform assert_eq(v ->> 'error', 'already_seated', 'one seat per tester per app');
end $$;

/* -------------------------- 5. store columns belong to store seats only */

do $$
declare v_closed uuid;
begin
  -- 07 left a closed-track seat on the same tester; make one if not.
  select id into v_closed from assignments
   where tester_id = '22222222-2222-2222-2222-222222222222' and kind = 'closed_track'
   limit 1;

  if v_closed is null then
    insert into assignments (pod_id, app_id, tester_id, status, kind)
    values (null, 'aaaaaaaa-0000-0000-0000-000000000002',
            '22222222-2222-2222-2222-222222222222', 'opt_in_pending', 'closed_track')
    returning id into v_closed;
  end if;

  begin
    insert into feedback (assignment_id, tester_id, app_id, first_impression,
                          severity, status, store_rating, store_review_text)
    values (v_closed, '22222222-2222-2222-2222-222222222222',
            'aaaaaaaa-0000-0000-0000-000000000002',
            'a private report that should not carry a star rating', 0, 'submitted',
            5, 'five stars');
    raise exception 'FAIL a closed-track report accepted a public star rating';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS store columns are refused on a closed-track report';
  end;
end $$;

/* ------------------------------- 6. the tester cannot pay themselves */

-- As `authenticated`, not as the owner. `guard_feedback_columns` returns early
-- for any other role, so run as postgres this would pass against a completely
-- unprotected table — the same trap 05-payment-locks documents.
set role authenticated;

do $$
declare v_seat uuid;
begin
  select id into v_seat from assignments
   where tester_id = '22222222-2222-2222-2222-222222222222' and kind = 'store_listing';

  begin
    insert into feedback (assignment_id, tester_id, app_id, first_impression, severity,
                          status, credits_awarded, store_rating, store_review_text)
    values (v_seat, '22222222-2222-2222-2222-222222222222',
            'aaaaaaaa-0000-0000-0000-000000000001',
            'a review that pays itself', 0, 'approved', 30, 5, 'a review that pays itself');
    raise exception 'FAIL a tester filed a pre-approved store review';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS a tester cannot file a pre-approved store review';
  end;
end $$;

-- And the same insert with an honest status still cannot smuggle credits in.
do $$
declare v_seat uuid; v_awarded int;
begin
  select id into v_seat from assignments
   where tester_id = '22222222-2222-2222-2222-222222222222' and kind = 'store_listing';

  insert into feedback (assignment_id, tester_id, app_id, first_impression, severity,
                        status, credits_awarded, store_rating, store_review_text, submitted_at)
  values (v_seat, '22222222-2222-2222-2222-222222222222',
          'aaaaaaaa-0000-0000-0000-000000000001',
          'A submitted review that tried to carry its own payment.', 0, 'submitted', 30,
          5, 'A submitted review that tried to carry its own payment.', now());

  select credits_awarded into v_awarded from feedback where assignment_id = v_seat;
  perform assert_eq(v_awarded, 0, 'credits_awarded is stripped from a client insert');
end $$;

reset role;

-- Cleared as the owner, not as `authenticated`: there is no DELETE policy on
-- feedback for a member, so this would silently affect zero rows and the real
-- review below would collide with the row left behind.
delete from feedback where assignment_id in (
  select id from assignments where app_id = 'aaaaaaaa-0000-0000-0000-000000000001');

/* ---------------------------------- 7. the install pays 10, once */

do $$
declare v_seat uuid; v_before int; v_after int;
begin
  select id into v_seat from assignments
   where tester_id = '22222222-2222-2222-2222-222222222222' and kind = 'store_listing';
  select credits into v_before from profiles where id = '22222222-2222-2222-2222-222222222222';

  -- The install confirmation is the same trigger the closed-track route uses.
  update assignments set opt_in_verified_at = now(), status = 'active' where id = v_seat;

  select credits into v_after from profiles where id = '22222222-2222-2222-2222-222222222222';
  perform assert_eq(v_after - v_before, 10, 'a confirmed store install pays the same 10');
end $$;

/* ----------------------- 8. the review is filed, and the publisher pays */

do $$
declare v_seat uuid;
begin
  select id into v_seat from assignments
   where tester_id = '22222222-2222-2222-2222-222222222222' and kind = 'store_listing';

  insert into feedback (assignment_id, tester_id, app_id, first_impression, severity,
                        status, store_rating, store_review_text, store_review_url, submitted_at)
  values (v_seat, '22222222-2222-2222-2222-222222222222',
          'aaaaaaaa-0000-0000-0000-000000000001',
          'Imported two years of CSV without a mangled row and the widget actually works.',
          0, 'submitted', 5,
          'Imported two years of CSV without a mangled row and the widget actually works.',
          'https://play.google.com/store/apps/details?id=com.test.one', now());
  raise notice 'PASS a store review files as submitted';
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

do $$
declare v_fb uuid; v_t_before int; v_o_before int; v_t_after int; v_o_after int; v jsonb;
begin
  select f.id into v_fb from feedback f
    join assignments a on a.id = f.assignment_id
   where a.kind = 'store_listing' and f.status = 'submitted';

  select credits into v_t_before from profiles where id = '22222222-2222-2222-2222-222222222222';
  select credits into v_o_before from profiles where id = '11111111-1111-1111-1111-111111111111';

  v := review_feedback(v_fb, 'useful');
  perform assert_eq((v ->> 'ok')::boolean, true, 'the publisher can approve a store review');

  select credits into v_t_after from profiles where id = '22222222-2222-2222-2222-222222222222';
  select credits into v_o_after from profiles where id = '11111111-1111-1111-1111-111111111111';

  perform assert_eq(v_t_after - v_t_before, 30, 'an approved store review pays the tester 30');
  perform assert_eq(v_o_before - v_o_after, 30, 'and costs the publisher exactly the same 30');
end $$;

/* --------------- 9. a disputed review still reaches a moderator */

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

do $$
declare v_seat uuid;
begin
  -- No `opt_in_verified_at`: stamping it fires the install payment, and this
  -- tester has already spent their daily install allowance in an earlier file.
  -- The dispute path being asserted below needs the review, not the install.
  insert into assignments (pod_id, app_id, tester_id, status, kind)
  values (null, 'aaaaaaaa-0000-0000-0000-000000000001',
          '55555555-5555-5555-5555-555555555555', 'active', 'store_listing')
  returning id into v_seat;

  insert into feedback (assignment_id, tester_id, app_id, first_impression, severity,
                        status, store_rating, store_review_text, submitted_at)
  values (v_seat, '55555555-5555-5555-5555-555555555555',
          'aaaaaaaa-0000-0000-0000-000000000001',
          'Two stars: the CSV import dropped every row with a comma in the payee field.',
          0, 'submitted', 2,
          'Two stars: the CSV import dropped every row with a comma in the payee field.', now());
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

do $$
declare v_fb uuid; v jsonb; v_d uuid;
begin
  select f.id into v_fb from feedback f
    join assignments a on a.id = f.assignment_id
   where a.kind = 'store_listing' and f.status = 'submitted'
     and f.tester_id = '55555555-5555-5555-5555-555555555555';

  -- Invariant 2, on a feature that ignores invariant 1: a publisher who
  -- dislikes a two-star review cannot simply refuse to pay for it.
  v := review_feedback(v_fb, 'low_effort', 'harsh');
  perform assert_eq((v ->> 'disputed')::boolean, true,
                    'a critical store review opens a dispute rather than being rejected');

  select id into v_d from disputes where feedback_id = v_fb and status = 'open';
  perform assert_eq(v_d is not null, true, 'the dispute reaches a moderator');
end $$;

do $$
declare v_d uuid; v_before int; v_after int; v jsonb;
begin
  select d.id into v_d from disputes d
    join feedback f on f.id = d.feedback_id
   where d.status = 'open' and f.tester_id = '55555555-5555-5555-5555-555555555555';

  select credits into v_before from profiles where id = '55555555-5555-5555-5555-555555555555';

  -- A moderator overturns it: the review was specific, so it is paid.
  perform set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
  v := arbitrate_dispute(v_d, false, 'specific and reproducible');
  perform assert_eq((v ->> 'ok')::boolean, true, 'a moderator can settle a store-review dispute');

  select credits into v_after from profiles where id = '55555555-5555-5555-5555-555555555555';
  perform assert_eq(v_after - v_before, 30,
                    'a critical store review upheld on arbitration is paid the same 30');
end $$;

/* --------------------------------------- 10. the audit view sees them */

select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);

do $$
declare v_count int;
begin
  select count(*) into v_count from store_review_audit;
  perform assert_eq(v_count >= 2, true, 'the audit view lists every published store review');

  select count(*) into v_count from store_review_audit where store_rating is null;
  perform assert_eq(v_count, 0, 'every row in the audit has a rating — no closed-track leakage');
end $$;

/* ----------------------------------------------- 11. leave it as found */

update feature_flags set enabled = false where key = 'store_reviews';
update apps set accepting_store_reviews = false
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$ begin raise notice 'PASS store_reviews left disabled'; end $$;
