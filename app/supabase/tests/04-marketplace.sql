\set ON_ERROR_STOP on
\pset pager off

-- ===========================================================================
-- Marketplace — visibility and privacy tests.
--
-- The listing is `security definer`: it reads straight past the RLS on `apps`
-- and hands back a projection. That makes the projection the only thing
-- standing between a browsing member and someone else's closed track, so it is
-- what gets asserted here — what is listed, to whom, and which columns come
-- back empty for a stranger.
--
-- Runs after 01; it reuses that file's `assert_eq` and its three users.
-- ===========================================================================

delete from app_watchlist;
delete from apps where name like 'Market %';
delete from auth.users where email like '%@mkt.test.dev';

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'stranger@mkt.test.dev'),
  ('99999999-9999-9999-9999-999999999999', 'banned@mkt.test.dev');

insert into profiles (id, handle, display_name) values
  ('88888888-8888-8888-8888-888888888888', 'stranger', 'Stranger'),
  ('99999999-9999-9999-9999-999999999999', 'banned',   'Banned')
on conflict (id) do update set handle = excluded.handle, display_name = excluded.display_name;

update profiles set is_banned = true  where handle = 'banned';
update profiles set is_banned = false where handle = 'stranger';

insert into apps (id, owner_id, name, platform, package_name, opt_in_url, category, status) values
  ('ffffffff-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888',
   'Market Queued', 'android', 'com.market.queued',
   'https://play.google.com/apps/testing/com.market.queued', 'Tools', 'queued'),
  ('ffffffff-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888',
   'Market Draft', 'android', 'com.market.draft', null, 'Tools', 'draft'),
  ('ffffffff-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888',
   'Market Apple', 'ios', 'com.market.apple',
   'https://apps.apple.com/app/id123', 'Games', 'queued'),
  ('ffffffff-0000-0000-0000-000000000004', '99999999-9999-9999-9999-999999999999',
   'Market Banned', 'android', 'com.market.banned',
   'https://play.google.com/apps/testing/com.market.banned', 'Tools', 'queued');

-- Browsing as the tester from 01.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

-- ------------------------------------------------------------- visibility
select assert_eq(
  (select count(*)::int from market_apps() m where m.name = 'Market Queued'), 1,
  'a queued app is listed to everyone');

select assert_eq(
  (select count(*)::int from market_apps() m where m.name = 'Market Draft'), 0,
  'someone else''s draft is not listed');

select assert_eq(
  (select count(*)::int from market_apps() m where m.name = 'Market Banned'), 0,
  'a banned owner''s app is not listed');

-- ----------------------------------------------------------------- privacy
-- The package name of an app in closed testing IS its opt-in link. A stranger
-- browsing the directory must get neither.
select assert_eq(
  (market_app('ffffffff-0000-0000-0000-000000000001') ->> 'opt_in_url'), null::text,
  'a stranger cannot read the opt-in link');

select assert_eq(
  (market_app('ffffffff-0000-0000-0000-000000000001') ->> 'package_name'), null::text,
  'a stranger cannot read the package name of an app in closed testing');

select assert_eq(
  (market_app('ffffffff-0000-0000-0000-000000000001') ->> 'store_url'), null::text,
  'no store URL before the app graduates');

select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
select assert_eq(
  (market_app('ffffffff-0000-0000-0000-000000000001') ->> 'opt_in_url'),
  'https://play.google.com/apps/testing/com.market.queued',
  'the owner reads their own opt-in link');

select assert_eq(
  (select count(*)::int from market_apps('mine') m), 3,
  'the owner sees all three of their own apps, drafts included');

-- ------------------------------------------------------------ the filters
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

select assert_eq(
  (select count(*)::int from market_apps('all', 'ios') m where m.name = 'Market Apple'), 1,
  'the iOS filter finds the iOS app');

select assert_eq(
  (select count(*)::int from market_apps('all', 'android') m where m.name = 'Market Apple'), 0,
  'the Android filter excludes it');

select assert_eq(
  (select count(*)::int from market_apps('all', null, null, 'Games') m where m.name = 'Market Apple'), 1,
  'the category filter works');

select assert_eq(
  (select count(*)::int from market_apps('all', null, null, null, 'queued') m
    where m.name = 'Market Queued'), 1,
  'search matches on name');

select assert_eq(
  (select count(*)::int from market_apps('all', null, 'needs_testers') m
    where m.name = 'Market Queued'), 1,
  'a queued app counts as needing testers');

select assert_eq(
  (select count(*)::int from market_apps('all', null, 'graduated') m
    where m.name = 'Market Queued'), 0,
  'and is not in the graduated filter');

-- --------------------------------------------------------- the relation
-- The tester holds an assignment on Ledgerly from 01, whose app row is still a
-- draft; put it in a pod so the relation reads as live testing.
update apps set status = 'in_pod' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select assert_eq(
  (select m.relation from market_apps() m where m.id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'testing', 'an app you hold an assignment on reads as testing');

select assert_eq(
  (select m.relation from market_apps() m where m.id = 'ffffffff-0000-0000-0000-000000000001'),
  'none', 'an app you have no assignment on reads as none');

select assert_eq(
  (select count(*)::int from market_apps('testing') m), 1,
  'the testing scope returns exactly that one');

-- A tester who already reported is not chased for another report.
select assert_eq(
  (select m.report_due from market_apps() m where m.id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  false, 'no report is due once one has been submitted');

-- ---------------------------------------------------------- the watchlist
insert into app_watchlist (user_id, app_id)
values ('22222222-2222-2222-2222-222222222222', 'ffffffff-0000-0000-0000-000000000001');

select assert_eq(
  (select m.watching from market_apps() m where m.id = 'ffffffff-0000-0000-0000-000000000001'),
  true, 'a saved app reads as watched');

select assert_eq(
  (select count(*)::int from market_apps('saved') m), 1,
  'the saved scope returns it');

select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', false);
select assert_eq(
  (select count(*)::int from market_apps('saved') m), 0,
  'and nobody else''s watchlist leaks into theirs');

-- Put 01's fixture back: 05 shares it, and a status this file changed would
-- surface there as a failure in the wrong file.
update apps set status = 'draft' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- The chip counts have to agree with the grid, or a chip promises a page that
-- comes back empty.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select assert_eq(
  (market_counts() ->> 'saved')::int,
  (select count(*)::int from market_apps('saved') m),
  'the saved chip counts what the saved scope returns');
select assert_eq(
  (market_counts() ->> 'testing')::int,
  (select count(*)::int from market_apps('testing') m),
  'the testing chip counts what the testing scope returns');

-- --------------------------------------------------------------- paging
select assert_eq(
  (select distinct m.total_count from market_apps('all', null, null, null, null, 'newest', 1, 0) m),
  (select count(*)::int from market_apps('all', null, null, null, null, 'newest', 96, 0) m),
  'total_count counts the whole result, not the page');

select '================= MARKETPLACE TESTS PASSED =================' as result;
