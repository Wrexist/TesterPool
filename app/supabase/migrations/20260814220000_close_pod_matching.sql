-- ============================================================================
-- CLOSE POD MATCHING — the cohort is gone from the product.
--
-- Every screen that could form or join a cohort has been deleted: /pods,
-- /admin/pods, the Pods nav entry, `joinPod`, `startPod` and `adminPodAction`.
-- The RPCs behind them are still `security definer` functions granted to
-- `authenticated`, and Supabase exposes every one of those over REST — so
-- removing the buttons removed the UI and nothing else. Anyone with a session
-- and curl could still seat themselves in a cohort, which would escrow credits
-- against a developer through a code path the app no longer renders, monitors
-- or has a screen to unwind.
--
-- This migration shuts the door properly, and does it twice.
--
-- WHAT THIS DOES NOT DO: drop `pods`, `pod_members`, `admin_pod_watch` or
-- `pod_health`. Cohorts that were run are real history — assignments,
-- check-ins, proofs and ledger rows still reference them, and the ledger is
-- append-only for a reason. The tables stay readable; they simply stop being
-- writable through a public endpoint.
-- ============================================================================

/* --------------------------------------------------- 1. the flag, set false */

-- Belt. `join_pod` and `start_pod` both read this flag and refuse when it is
-- off, so this alone closes the loop for anyone calling them. It is set rather
-- than deleted so /admin/flags still shows an operator why matching is shut.
insert into feature_flags (key, enabled, description)
values (
  'pod_matching',
  false,
  'Permanently off. Cohorts were removed from the product; testers come off the feed one app at a time. Turning this on re-opens an RPC no screen renders.'
)
on conflict (key) do update
  set enabled     = false,
      description = excluded.description,
      updated_at  = now();

/* ------------------------------------------------- 2. the grants, revoked */

-- Braces. A flag is a check inside a function body, and a future migration
-- that recreates either function with `create or replace` would keep the grant
-- while silently dropping the check. Revoking execute means the endpoint 404s
-- for a session regardless of what the body says.
revoke execute on function join_pod(uuid)  from anon, authenticated, public;
revoke execute on function start_pod(uuid) from anon, authenticated, public;

-- `admin_pod_action` was already admin-gated inside its own body, but the admin
-- surface that called it is gone too, so nothing should reach it either.
do $$
begin
  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'admin_pod_action'
  ) then
    execute 'revoke execute on function admin_pod_action(uuid, text, int, text) from anon, authenticated, public';
  end if;
end $$;

comment on function join_pod(uuid) is
  'Retired. Cohort matching was removed from the product; execute is revoked '
  'from every role and `pod_matching` is permanently false. Kept so the '
  'existing pods/pod_members history stays interpretable.';

comment on function start_pod(uuid) is
  'Retired. See the comment on join_pod(uuid).';
