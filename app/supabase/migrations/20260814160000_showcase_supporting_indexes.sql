-- ============================================================================
-- SUPPORTING INDEXES FOR THE ANONYMOUS SHOWCASE
--
-- `market_showcase` is the only function in this schema an anonymous caller can
-- reach, and it computes four aggregates on every call: three 24-hour range
-- scans unioned into a count(distinct), and an unfiltered count over `apps`.
--
-- Behind the `authenticated` grant on `market_pulse` that cost was bounded by
-- having an account. It is not any more. The `/pool` page revalidates every 60
-- seconds so the page itself is cheap, but nothing rate-limits a caller hitting
-- /rest/v1/rpc/market_showcase directly with the publishable key, and every one
-- of those calls is a sequential scan without these.
--
-- Partial where the predicate allows it, so the indexes stay small: the count
-- only ever asks about rows inside a 24-hour window, and `feedback` is only
-- counted once it has been approved or arbitrated.
--
-- Not solved here: the aggregates are still computed per call. If the anon RPC
-- ever shows up in the logs as a load source, the next step is a cached
-- projection refreshed on a schedule with only the app list left live — see
-- docs/GROWTH-BETS.md. Indexes first, because they are reversible and cheap.
-- ============================================================================

create index if not exists assignments_optin_verified_at_idx
  on assignments (opt_in_verified_at desc)
  where opt_in_verified_at is not null;

create index if not exists feedback_submitted_at_idx
  on feedback (submitted_at desc)
  where submitted_at is not null;

create index if not exists feedback_reviewed_at_approved_idx
  on feedback (reviewed_at desc)
  where status in ('approved', 'arbitrated');

create index if not exists checkins_created_at_idx
  on checkins (created_at desc);

-- `apps (status)` already exists from core.sql; the showcase also orders the
-- graduated count and the listing by status together with created_at.
create index if not exists apps_status_created_at_idx
  on apps (status, created_at desc);
