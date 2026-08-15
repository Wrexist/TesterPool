-- ============================================================================
-- PACKS — the cohort comes back, as a product rather than as the product.
--
-- `20260814220000_close_pod_matching.sql`, one migration ago, shut cohort
-- matching down: flag false, execute revoked from every role. That was correct
-- for what it was answering — the cohort had been the ONLY route to a tester,
-- so a member with no cohort had no product at all, and the feed replaced it.
--
-- This is a different question. The feed stays the home screen and stays the
-- default way work happens; a pack is now an optional thing a developer opts
-- into on top of it, on its own tab, when what they want is the whole of
-- Google's requirement handled in one go rather than one tester at a time.
--
-- So: same tables, same RPCs, same guards — re-opened. Nothing about the
-- mechanic changed and nothing here rewrites its body. The two lines that were
-- flipped shut get flipped back, and the comments that said "retired" are
-- corrected so the next reader is not told the opposite of the truth by the
-- database itself.
--
-- What did NOT come back: `admin_pod_action`. The admin screen that drove it is
-- gone and is not being rebuilt, and a `security definer` function with no
-- caller is a REST endpoint with no supervision. It stays revoked.
-- ============================================================================

/* --------------------------------------------------- 1. the flag, re-opened */

insert into feature_flags (key, enabled, description)
values (
  'pod_matching',
  true,
  'Opens Packs: a developer may join a forming cohort of 15 and receive its full run of testers. Off closes joining only — packs already running finish, and the feed is unaffected either way.'
)
on conflict (key) do update
  set enabled     = true,
      description = excluded.description,
      updated_at  = now();

/* ------------------------------------------------- 2. the grants, restored */

-- Both functions authorise against `auth.uid()` in their own bodies —
-- `join_pod` refuses an app you do not own, `start_pod` refuses a pod you are
-- not in — so `authenticated` is the correct grant and `anon` is not.
grant execute on function join_pod(uuid)  to authenticated;
grant execute on function start_pod(uuid) to authenticated;

revoke execute on function join_pod(uuid)  from anon, public;
revoke execute on function start_pod(uuid) from anon, public;

comment on function join_pod(uuid) is
  'Packs. Seats one of your apps in a forming cohort of 15, which is 14 testers '
  'for it and 14 apps for you to test back. Enforces the `pod_matching` flag, '
  'app ownership, a reliability floor and the concurrent-assignment cap.';

comment on function start_pod(uuid) is
  'Packs. Starts a forming cohort once it has enough members. Refuses a pod the '
  'caller is not a member of.';

-- `admin_pod_action` stays shut. Stated rather than assumed, so that a future
-- reader grepping for it finds the decision instead of an absence.
comment on function admin_pod_action(uuid, text, int, text) is
  'Retired and revoked from every role: the admin surface that called it was '
  'removed and not rebuilt. Do not grant execute back without a screen to drive it.';
