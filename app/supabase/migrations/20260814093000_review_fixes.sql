-- ============================================================================
-- REVIEW FIXES
--
-- Three findings from the review of #7, verified against a replay of this
-- schema before being acted on.
--
-- 1. CONFIRMED, and the serious one. `guard_feedback_columns` checked that the
--    assignment belonged to the caller, and never that `new.app_id` was the
--    assignment's app. A tester could file a report on their own assignment
--    while pointing `app_id` at any other app in the pool. Reproduced: one row
--    written against an app the tester was never assigned to.
--
--    The damage is not credits — `review_feedback` pays against the assignment,
--    and the app owner would have to approve a report they never received. It
--    is the counts: `market_apps.reports` and `production_evidence` both count
--    feedback by `app_id`, so a stranger could inflate the evidence pack a
--    developer submits to Google. That is the one number in this product that
--    has to be true.
--
-- 2. NOT REPRODUCIBLE, but it found something else. The review said saving an
--    app was impossible because the client sends a merging upsert and this
--    schema granted only select/insert/delete. In practice Supabase's default
--    privileges already grant `authenticated` everything on a new public table,
--    so the write succeeds — but that also means the narrow grant in
--    `20260813120000` was cosmetic. It says what was intended, so it is made
--    true here. RLS was and remains the real control; this is the grant
--    matching the intent, and the client now sends `on conflict do nothing`,
--    which is the correct semantic for a bookmark that is its own key.
--
-- 3. The pod gate. `pods_open` was a presentation flag: `/pods` hid the join
--    button, and `join_pod` — reachable over REST like every RPC — did not
--    check it. That is the same shape as the money bugs closed yesterday: a
--    rule the client is asked to keep. There is already a server-side kill
--    switch for this exact purpose, `pod_matching`, which `join_pod` and
--    `start_pod` both enforce, so the fix is to use it rather than to add a
--    second, weaker one. `pods_open` is gone; the pods screen reads
--    `pod_matching`, and flipping that one row in /admin/flags now moves the
--    button and the RPC together.
-- ============================================================================

/* ------------------------------------- 1. a report belongs to its own app */

create or replace function guard_feedback_columns()
returns trigger language plpgsql
set search_path = public, extensions as $$
declare
  v_assignment_tester uuid;
  v_assignment_app    uuid;
begin
  if current_user not in ('authenticated', 'anon') or is_mod() then
    return new;
  end if;

  -- Both halves matter. The tester check stops you reporting through somebody
  -- else's seat; the app check stops you reporting through your own seat but
  -- crediting the report to an app you were never assigned.
  select tester_id, app_id into v_assignment_tester, v_assignment_app
    from assignments where id = new.assignment_id;

  if v_assignment_tester is null
     or v_assignment_tester <> auth.uid()
     or new.app_id is distinct from v_assignment_app then
    raise exception 'feedback_not_yours'
      using hint = 'A report belongs to the app it was assigned against.';
  end if;

  if new.status not in ('draft', 'submitted') then
    raise exception 'feedback_status_locked'
      using hint = 'A report is approved by the developer, not by its author.';
  end if;

  if tg_op = 'UPDATE' and old.status not in ('draft', 'submitted') then
    raise exception 'feedback_settled'
      using hint = 'That report has already been reviewed.';
  end if;

  if tg_op = 'UPDATE' then
    new.credits_awarded := old.credits_awarded;
    new.creator_verdict := old.creator_verdict;
    new.creator_note    := old.creator_note;
    new.reviewed_at     := old.reviewed_at;
  else
    new.credits_awarded := 0;
    new.creator_verdict := null;
    new.creator_note    := null;
    new.reviewed_at     := null;
  end if;
  new.tester_id := auth.uid();

  return new;
end $$;

/* ------------------------------ 2. make the watchlist grant mean something */

-- Supabase's default privileges granted the rest of these on creation. A
-- bookmark row is its own key: there is nothing to update, nothing to truncate,
-- and no reason for a foreign key to point at it.
revoke update, truncate, references, trigger on app_watchlist from authenticated;

/* ------------------------------------------- 3. indexes for the 24h pulse */

-- `market_pulse` runs on every marketplace load and each count filters on a
-- timestamp. Without these the counts scan the whole of each table and grow
-- with total history rather than with the 24-hour window.
create index if not exists assignments_opt_in_verified_idx
  on assignments (opt_in_verified_at desc) where opt_in_verified_at is not null;
create index if not exists feedback_submitted_idx
  on feedback (submitted_at desc) where submitted_at is not null;
create index if not exists feedback_reviewed_status_idx
  on feedback (reviewed_at desc, status) where reviewed_at is not null;
create index if not exists checkins_created_idx
  on checkins (created_at desc);
