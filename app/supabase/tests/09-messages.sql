\set ON_ERROR_STOP on
\pset pager off

-- ===========================================================================
-- MESSAGES — a tester and a publisher, and nobody else.
--
-- Messaging is the first thing in this product that lets one member put text in
-- front of another, so the question it has to answer is not "does it send" but
-- "who can it reach". `send_message` derives the recipient from the app rather
-- than taking one, which is what makes the answer short: you can reach the
-- owner of an app you hold a seat on, or the tester of an app you own. There is
-- no third case, and there is no parameter that could express one.
--
-- What is asserted here, in order:
--   1. a seated tester can write to the publisher, and the row is addressed to
--      the publisher rather than to whoever the sender named
--   2. the publisher can write back
--   3. a stranger with no seat is refused — this is the whole access rule
--   4. an empty or oversized body is refused
--   5. the thread is visible to both parties and to neither's neighbours
--   6. reading a thread marks only your own side read, so the unread count is
--      about you rather than about the conversation
--   7. RLS refuses a direct insert, because a client that can write its own
--      message row does not need `send_message` and is not bound by its rule
--
-- Run after 01 (it uses 01's fixtures and its assert_eq).
-- ===========================================================================

do $$ begin
  if to_regprocedure('assert_eq(anyelement,anyelement,text)') is null then
    raise exception 'run 01-economy.sql first';
  end if;
end $$;

delete from messages;

-- 01's app aaaa...0001 is owned by creator (1111) and tested by tester (2222).
-- A seat is what connects them, so make sure one exists.
insert into assignments (app_id, tester_id, pod_id)
select 'aaaaaaaa-0000-0000-0000-000000000001',
       '22222222-2222-2222-2222-222222222222', null
where not exists (
  select 1 from assignments
   where app_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and tester_id = '22222222-2222-2222-2222-222222222222');

/* ------------------------------------------- 1. the tester writes to the dev */

do $$
declare v jsonb;
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

  v := send_message('aaaaaaaa-0000-0000-0000-000000000001', 'The onboarding hangs on step two.');
  perform assert_eq((v->>'ok')::boolean, true, 'a seated tester can message the publisher');

  perform assert_eq(
    (select recipient_id from messages where id = (v->'message'->>'id')::uuid),
    '11111111-1111-1111-1111-111111111111'::uuid,
    'the recipient is the app owner, derived rather than supplied');

  perform assert_eq(
    (select sender_id from messages where id = (v->'message'->>'id')::uuid),
    '22222222-2222-2222-2222-222222222222'::uuid,
    'the sender is the caller');
end $$;

/* ----------------------------------------------- 2. the publisher writes back */

-- 07 leaves other testers seated on this same app, which is the case that
-- matters: "reply to the tester" is ambiguous the moment there are two, and an
-- earlier version of send_message resolved it as "the newest seat" — delivering
-- the publisher's private reply to whichever stranger happened to seat last.
do $$
declare v jsonb; v_seats int;
begin
  select count(distinct tester_id) into v_seats
    from assignments where app_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  perform assert_eq(v_seats > 1, true, 'more than one tester holds a seat on this app');

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  -- Unaddressed, it must refuse rather than pick one.
  v := send_message('aaaaaaaa-0000-0000-0000-000000000001', 'Which device?');
  perform assert_eq((v->>'ok')::boolean, false, 'an unaddressed reply is refused when several testers hold seats');
  perform assert_eq(v->>'error', 'pick_tester', 'and says which decision is missing');

  -- Addressed, it goes exactly where it was addressed.
  v := send_message('aaaaaaaa-0000-0000-0000-000000000001', 'Which device? I cannot reproduce it.',
                    '22222222-2222-2222-2222-222222222222');
  perform assert_eq((v->>'ok')::boolean, true, 'the publisher can reply to a named tester');
  perform assert_eq(
    (select recipient_id from messages where id = (v->'message'->>'id')::uuid),
    '22222222-2222-2222-2222-222222222222'::uuid,
    'the reply reaches the tester it was addressed to');

  -- And it cannot be addressed to somebody with no seat on this app.
  v := send_message('aaaaaaaa-0000-0000-0000-000000000001', 'psst',
                    '33333333-3333-3333-3333-333333333333');
  perform assert_eq((v->>'ok')::boolean, false, 'the publisher cannot address a member with no seat');
  perform assert_eq(v->>'error', 'not_connected', 'and is told why');
end $$;

/* ------------------------------------------------- 3. a stranger is refused */

do $$
declare v jsonb;
begin
  -- 3333 owns a different app and holds no seat on this one.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

  v := send_message('aaaaaaaa-0000-0000-0000-000000000001', 'Buy my SEO services.');
  perform assert_eq((v->>'ok')::boolean, false, 'a member with no seat cannot message the publisher');
  perform assert_eq(v->>'error', 'not_connected', 'and is told why');

  perform assert_eq(
    (select count(*)::int from messages
      where sender_id = '33333333-3333-3333-3333-333333333333'),
    0, 'nothing was written for the stranger');
end $$;

/* --------------------------------------------------- 4. the body is bounded */

do $$
declare v jsonb;
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

  v := send_message('aaaaaaaa-0000-0000-0000-000000000001', '   ');
  perform assert_eq(v->>'error', 'empty', 'an empty body is refused');

  v := send_message('aaaaaaaa-0000-0000-0000-000000000001', repeat('x', 2001));
  perform assert_eq(v->>'error', 'too_long', 'an oversized body is refused');
end $$;

/* ----------------------------------------- 5 & 6. the thread, and unread state */

do $$
declare v jsonb;
begin
  -- Before either side reads, the tester has exactly the publisher's reply waiting.
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  perform assert_eq(unread_messages(), 1, 'the tester has one message waiting');

  v := thread_messages('aaaaaaaa-0000-0000-0000-000000000001');
  perform assert_eq(jsonb_array_length(v), 2, 'the thread carries both sides of this pair and no more');
  perform assert_eq((v->0->>'mine')::boolean, true, 'oldest first, and the tester sent it');

  perform assert_eq(unread_messages(), 0, 'reading the thread clears the tester''s unread');

  -- The publisher's own unread is untouched by the tester having read theirs.
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  perform assert_eq(unread_messages(), 1, 'the publisher still has theirs waiting');

  -- A third member's thread on the same app is a different conversation, and
  -- empty, rather than a view onto this one.
  perform assert_eq(
    jsonb_array_length(thread_messages('aaaaaaaa-0000-0000-0000-000000000001',
                                       '55555555-5555-5555-5555-555555555555')),
    0, 'another tester''s thread on the same app is separate and empty');
end $$;

/* ------------------------------------------ 7. the table itself stays shut */

-- As `authenticated`, because that is the role a signed-in browser holds. Run
-- as the table owner this would pass against a schema with no policy at all.
set role authenticated;

do $$
declare failed boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  begin
    insert into messages (app_id, sender_id, recipient_id, body)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333',
            '11111111-1111-1111-1111-111111111111',
            'Straight into the table.');
  exception when others then
    failed := true;
  end;
  perform assert_eq(failed, true, 'a direct insert into messages is refused');
end $$;

do $$
begin
  -- And a stranger cannot read somebody else's thread.
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  perform assert_eq(
    (select count(*)::int from messages),
    0, 'a member outside the pair sees none of it');
end $$;

reset role;

select '================= MESSAGE TESTS PASSED =================' as result;
