\set ON_ERROR_STOP on
\pset pager off

-- ===========================================================================
-- Public showcase — what an anonymous caller is allowed to see.
--
-- `market_showcase` is the only `security definer` function in this schema
-- granted to `anon`. Everything else behind the marketplace at least knows who
-- is asking; this one answers strangers. That makes its projection the entire
-- access control, and the projection is what gets asserted here.
--
-- The half that matters most is negative: an anonymous caller must not come
-- away with a package name, an opt-in link, a Google Group, tester
-- instructions, an owner, an id, or any score. For an Android app in closed
-- testing the package name is the way into the track, so a leak here is a
-- stranger consuming a seat in somebody's closed test with no account at all.
--
-- Runs after 04, and reuses that file's four `Market %` fixtures.
-- ===========================================================================

-- --------------------------------------------------- who is actually listed

-- 04 leaves: Market Queued (android/queued), Market Draft (draft),
-- Market Apple (ios/queued), Market Banned (queued, banned owner).
select assert_eq(
  (select count(*)::int from jsonb_array_elements(market_showcase() -> 'apps') a
    where a ->> 'name' = 'Market Queued'),
  1,
  'an open app is shown to an anonymous visitor');

select assert_eq(
  (select count(*)::int from jsonb_array_elements(market_showcase() -> 'apps') a
    where a ->> 'name' = 'Market Draft'),
  0,
  'a draft is not shown — it has no track to join yet');

select assert_eq(
  (select count(*)::int from jsonb_array_elements(market_showcase() -> 'apps') a
    where a ->> 'name' = 'Market Banned'),
  0,
  'an app owned by a banned profile is not shown');

-- --------------------------------------------------------------- the opt-out

update apps set public_preview = false where name = 'Market Queued';

select assert_eq(
  (select count(*)::int from jsonb_array_elements(market_showcase() -> 'apps') a
    where a ->> 'name' = 'Market Queued'),
  0,
  'public_preview = false withdraws an app from the anonymous showcase');

update apps set public_preview = true where name = 'Market Queued';

select assert_eq(
  (select count(*)::int from jsonb_array_elements(market_showcase() -> 'apps') a
    where a ->> 'name' = 'Market Queued'),
  1,
  'and turning it back on restores it');

-- The catalog, not the rows. `bool_and(public_preview) from apps` passes for as
-- long as no fixture sets it false, which is a fact about the fixtures rather
-- than about the schema, and would keep passing if the default were dropped.
select assert_eq(
  (select column_default from information_schema.columns
    where table_name = 'apps' and column_name = 'public_preview'),
  'true',
  'the column defaults to true, so listing is opt-out rather than opt-in');

-- ------------------------------------------------------- cannot pay, not shown

-- The RPC also excludes credits_paused apps. Nothing asserted it, so a later
-- edit could drop that predicate and the suite would stay green — and an app
-- whose owner cannot pay for a review should not be recruiting testers.
update apps set credits_paused = true where name = 'Market Queued';

select assert_eq(
  (select count(*)::int from jsonb_array_elements(market_showcase() -> 'apps') a
    where a ->> 'name' = 'Market Queued'),
  0,
  'a credits-paused app is not shown — it cannot pay for the review it would get');

update apps set credits_paused = false where name = 'Market Queued';

-- ------------------------------------------------- the projection, exactly

-- Every key, pinned. A column added to `apps` must not reach this function by
-- accident: the test fails on a new key, not just on a known-dangerous one.
select assert_eq(
  (select array_agg(k order by k)
     from jsonb_array_elements(market_showcase() -> 'apps') a,
          lateral jsonb_object_keys(a) k
    where a ->> 'name' = 'Market Queued'),
  array['category', 'created_at', 'icon_url', 'name', 'platform', 'tagline'],
  'the showcase hands back exactly six columns and no others');

-- Said again as the thing we actually care about, so a failure reads as the
-- security problem it is rather than as a schema diff.
select assert_eq(
  (select count(*)::int
     from jsonb_array_elements(market_showcase() -> 'apps') a,
          lateral jsonb_object_keys(a) k
    where k in ('package_name', 'opt_in_url', 'google_group',
                'tester_instructions', 'id', 'owner_id', 'owner_handle')),
  0,
  'no track-entry field, no id and no owner reaches an anonymous caller');

select assert_eq(
  (select count(*)::int
     from jsonb_array_elements(market_showcase() -> 'apps') a,
          lateral jsonb_object_keys(a) k
    where k ilike '%score%' or k ilike '%rating%' or k ilike '%avg%'
       or k ilike '%review%' or k ilike '%star%'),
  0,
  'and no score, rating or average — a number beside a name is a rating board');

-- ------------------------------------------------------------ the clamp

select assert_eq(
  (select jsonb_array_length(market_showcase(10000) -> 'apps') <= 24),
  true,
  'an anonymous caller cannot raise the limit into a bulk export');

select assert_eq(
  (select jsonb_array_length(market_showcase(0) -> 'apps') >= 1),
  true,
  'a zero or negative limit is clamped up, not turned into an empty page');

select assert_eq(
  (select jsonb_array_length(market_showcase(null) -> 'apps') >= 1),
  true,
  'and a null limit falls back to the default rather than returning nothing');

-- ------------------------------------------------------------- the counts

select assert_eq(
  (market_showcase() ->> 'open_apps')::int,
  (select jsonb_array_length(market_showcase(24) -> 'apps')),
  'the open_apps count agrees with the list it heads, at this fixture size');

select assert_eq(
  (market_showcase() ? 'graduated'),
  true,
  'the graduated count is present — an outcome claim has to be counted');

-- ------------------------------------------------------------ the grants

select assert_eq(
  has_function_privilege('anon', 'market_showcase(int)', 'execute'),
  true,
  'anon can call the showcase — that is the entire point of it');

select assert_eq(
  has_function_privilege('anon', 'market_apps(text,text,text,text,text,text,int,int,uuid)', 'execute'),
  false,
  'and still cannot call the authenticated listing');

select assert_eq(
  has_function_privilege('anon', 'market_pulse()', 'execute'),
  false,
  'nor the authenticated pulse');

-- The four trigger functions closed in 20260814150000. `create or replace`
-- preserves privileges, but a later migration that DROPs and recreates any of
-- them restores EXECUTE to PUBLIC — and two of these move credits. Asserted so
-- that regression fails here rather than in production.
select assert_eq(
  has_function_privilege('anon', 'on_optin_confirmed()', 'execute'),
  false,
  'anon cannot call the opt-in payment trigger function');

select assert_eq(
  has_function_privilege('authenticated', 'on_optin_confirmed()', 'execute'),
  false,
  'and neither can a signed-in member');

select assert_eq(
  has_function_privilege('authenticated', 'unpause_on_topup()', 'execute'),
  false,
  'authenticated cannot call the unpause trigger function');

select assert_eq(
  has_function_privilege('authenticated', 'guard_daily_install_cap()', 'execute'),
  false,
  'authenticated cannot call the install-cap guard directly');

select assert_eq(
  has_function_privilege('authenticated', 'guard_daily_review_cap()', 'execute'),
  false,
  'authenticated cannot call the review-cap guard directly');

-- ------------------------------------------- and as anon, for real this time

-- The assertions above run as the table owner, which would pass against a
-- function anon cannot actually reach. This half proves the grant works end to
-- end, and that the underlying table stays shut to the same caller.
set role anon;

select assert_eq(
  (select count(*)::int from jsonb_array_elements(market_showcase() -> 'apps') a
    where a ->> 'name' = 'Market Queued'),
  1,
  'calling as anon returns the same listing');

do $$
declare n int;
begin
  select count(*) into n from apps;
  if n > 0 then
    raise exception 'FAIL anon read % rows straight out of apps — RLS is open', n;
  end if;
  raise notice 'PASS anon cannot read the apps table directly (0 rows)';
exception
  when insufficient_privilege then
    raise notice 'PASS anon cannot read the apps table directly (denied)';
end $$;

reset role;

select '================= SHOWCASE TESTS PASSED =================' as result;
