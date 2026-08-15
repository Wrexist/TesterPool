-- ============================================================================
-- ENABLE STORE REVIEWS.
--
-- `20260814240000_store_reviews.sql` shipped the feature switched off behind
-- three gates. This turns the first one on, on the product owner's instruction.
-- The other two are untouched and still do their job:
--
--   ON  now   `store_reviews` — the network-wide switch, flipped here
--   off       `apps.accepting_store_reviews` — per app, still defaults false,
--             still the publisher's own decision to make on their own listing
--   n/a       a public `store_url` — no listing, no seat, nothing to install
--
-- So this does not start paying anybody for anything by itself. What it does is
-- make the per-app switch appear in My Apps, and make `start_store_activity`
-- stop refusing with `store_reviews_closed`. A publisher still has to opt each
-- app in one at a time.
--
-- Everything in the header of the original migration still applies, including
-- what this is under Google Play's and Apple's policies. Flipping this row back
-- to false stops new work immediately and retracts nothing already published.
-- ============================================================================

update feature_flags
   set enabled = true,
       updated_at = now()
 where key = 'store_reviews';

-- Belt and braces: if the row is somehow missing, the flag reads as false
-- everywhere (`start_store_activity` coalesces to false), and the feature would
-- silently stay shut with no way to see why.
insert into feature_flags (key, enabled, description)
select
  'store_reviews',
  true,
  'Allows paying for installs from the public store listing and for published store reviews. Per-app opt-in is still required.'
where not exists (select 1 from feature_flags where key = 'store_reviews');

/* ---------------------------------------------- what a browsing member sees */

-- `market_apps` is the projection that decides what a stranger may see about an
-- app, and it does not carry `accepting_store_reviews`. RLS on `apps` hides
-- every row you neither own nor hold a seat on, so the detail page cannot read
-- the column directly either — which is the whole reason that projection exists.
--
-- Rather than rewrite the projection for one boolean, this is the same shape as
-- the other read helpers: `security definer`, takes an id, returns one bit, and
-- leaks nothing else. It answers exactly the question the button needs — may I
-- start a store activity on this app right now — and it answers it with the
-- same three conditions `start_store_activity` enforces, so the button and the
-- RPC cannot disagree.
create or replace function store_review_open(p_app uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    coalesce((select enabled from feature_flags where key = 'store_reviews'), false)
    and exists (
      select 1 from apps a
       where a.id = p_app
         and a.accepting_store_reviews
         and a.store_url is not null
         and not a.credits_paused
    );
$$;

revoke execute on function store_review_open(uuid) from anon, public;
grant  execute on function store_review_open(uuid) to authenticated;

comment on function store_review_open(uuid) is
  'True when a signed-in member could start a store activity on this app: the '
  'network flag is on, the publisher opted this app in, it has a public '
  'listing, and their balance is not paused. Mirrors start_store_activity so a '
  'button that appears is a button the RPC will honour.';
