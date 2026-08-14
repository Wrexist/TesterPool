-- ============================================================================
-- CLOSE THE TRIGGER FUNCTIONS
--
-- Four `security definer` trigger functions were left executable by `anon` and
-- `authenticated`, which means PostgREST published them at
-- /rest/v1/rpc/<name> to anyone with the anon key:
--
--   guard_daily_install_cap, guard_daily_review_cap,
--   on_optin_confirmed, unpause_on_topup
--
-- Two of those decide money. `on_optin_confirmed` is the trigger that moves 10
-- credits from an app owner to a tester, and `unpause_on_topup` reopens an app
-- that was paused for an empty balance.
--
-- They are not presently exploitable: PostgreSQL refuses to invoke a function
-- declared `returns trigger` outside a trigger context, so a REST call gets an
-- error rather than a payment. That is a property of the return type, though,
-- not a decision anyone made, and the standing rule in CLAUDE.md is that a
-- `security definer` function is revoked from anon and authenticated unless it
-- genuinely needs to be callable. None of these do — triggers fire them.
--
-- Revoking EXECUTE does not stop a trigger firing. PostgreSQL checks EXECUTE on
-- a trigger function when the trigger is CREATED, not each time it fires, so an
-- insert by a signed-in member still runs all of these. Verified against a
-- throwaway replay of this migration history before shipping: with the grants
-- removed, an assignment insert, an opt-in stamp and a feedback insert all
-- still reached their triggers, and `guard_daily_review_cap` still raised its
-- own cap exception.
--
-- Found by `get_advisors(security)` while adding `market_showcase`.
-- ============================================================================

revoke execute on function guard_daily_install_cap() from anon, authenticated, public;
revoke execute on function guard_daily_review_cap()  from anon, authenticated, public;
revoke execute on function on_optin_confirmed()      from anon, authenticated, public;
revoke execute on function unpause_on_topup()        from anon, authenticated, public;
