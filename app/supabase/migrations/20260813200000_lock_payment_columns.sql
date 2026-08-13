-- ============================================================================
-- LOCK THE COLUMNS THAT DECIDE A PAYMENT
--
-- Two live money printers, found by asking what a signed-in member can PATCH.
-- Supabase exposes every table over REST, so an RLS policy that says "you may
-- update your own row" says "you may write every column of your own row" — and
-- three of those columns move credits.
--
--  1. `assignments`. Policy: `for update ... using (tester_id = auth.uid())`.
--     A tester could send
--
--       PATCH /rest/v1/assignments?id=eq.<their own row>
--       { "opt_in_verified_at": "now", "status": "active" }
--
--     which fires `trg_optin_confirmed`, charges the app owner 10 and pays the
--     tester 10. No screenshot, no vision pass, no moderator. Reproduced
--     against a replay of this schema: owner 320 → 310, tester 50 → 60, proofs
--     uploaded: zero. Capped at ten a day by the install trigger, so 100
--     credits a day per account, drawn from real developers' balances.
--
--  2. `proofs`. Policy: `for insert with check (uploader_id = auth.uid())` and
--     the same for update. A tester could insert — or update — their own proof
--     row with `status = 'approved'`, and `stamp_approved_optins`, the sweep
--     that runs as a trusted job, would then stamp the assignment and pay them
--     through the same trigger. Slower, identical outcome, and it survives
--     fixing (1) alone.
--
-- This is the trap `CLAUDE.md` already records once — "a SECURITY DEFINER
-- function taking a user id and an amount is a money printer if `authenticated`
-- can call it" — arriving by the other door: not a function anyone can call,
-- but a table anyone can write. The rule generalises, and this migration is the
-- generalisation: **the client may never write a column that a trigger, a job
-- or an RPC reads when deciding to move credits.**
--
-- Two layers, because one is a policy edit that a future migration could
-- casually widen again:
--
--   Layer 1  RLS: testers lose UPDATE on assignments and INSERT/UPDATE on
--            proofs. Nothing in the product needs them — every legitimate
--            write already goes through `submit_proof`, `submit_checkin`,
--            `join_pod`, the triage function or the moderator queue, all of
--            which are SECURITY DEFINER and therefore unaffected.
--   Layer 2  A guard trigger that refuses the write anyway. It fires only for
--            sessions whose `current_user` is `authenticated` or `anon` — a
--            SECURITY DEFINER function runs as its owner and a job runs as
--            postgres, so the trusted paths pass through untouched.
--
-- `feedback` keeps its tester INSERT and UPDATE, because `submitFeedback`
-- genuinely upserts as the tester. It gets the column guard instead: a tester
-- may write their own report, and may not write the verdict on it, the credits
-- for it, or an assignment that is not theirs.
-- ============================================================================

/* ------------------------------------------------- 1. assignments: no write */

drop policy if exists "assignments update" on assignments;

-- Moderators only. A tester's assignment advances through submit_checkin,
-- submit_proof + triage, the pod lifecycle job and the moderator queue.
create policy "assignments update" on assignments for update to authenticated
  using (is_mod())
  with check (is_mod());

/* ------------------------------------------------------ 2. proofs: no write */

drop policy if exists "proofs insert" on proofs;
drop policy if exists "proofs update" on proofs;
drop policy if exists "proofs delete" on proofs;

-- No INSERT policy at all: `submit_proof` is the only way in, and it checks the
-- assignment is yours, the storage object exists under your own prefix, the
-- hourly flood limit, and the daily allowance — none of which a direct insert
-- would have done. It also forces status 'pending', which is the point.
create policy "proofs update" on proofs for update to authenticated
  using (is_mod()) with check (is_mod());
create policy "proofs delete" on proofs for delete to authenticated
  using (is_mod());

/* ------------------------------------------- 3. the guard, for all three */

-- Which session is writing is read from `current_user`, inline in each guard
-- and never through a helper: these triggers must stay SECURITY INVOKER, since
-- a SECURITY DEFINER guard would see its own owner in `current_user` and wave
-- every write through. A definer RPC, a pg_cron job and the edge functions'
-- service role all report something other than `authenticated`/`anon`, which is
-- exactly the trusted/untrusted line.

create or replace function guard_assignment_columns()
returns trigger language plpgsql
set search_path = public, extensions as $$
begin
  if current_user not in ('authenticated', 'anon') or is_mod() then
    return new;
  end if;

  if new.opt_in_verified_at is distinct from old.opt_in_verified_at
     or new.days_checked_in is distinct from old.days_checked_in
     or new.credits_paid    is distinct from old.credits_paid
     or new.credits_escrowed is distinct from old.credits_escrowed
     or new.status          is distinct from old.status
     or new.tester_id       is distinct from old.tester_id
     or new.app_id          is distinct from old.app_id then
    raise exception 'assignment_locked'
      using hint = 'Opt-ins are verified from a screenshot, not from the client.';
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_assignment_columns on assignments;
-- Fires before trg_optin_confirmed (alphabetical order within BEFORE UPDATE:
-- guard_... sorts before optin_...), so a blocked write never reaches the
-- transfer. Both are BEFORE UPDATE and Postgres runs them by trigger name.
create trigger trg_guard_assignment_columns
  before update on assignments
  for each row execute function guard_assignment_columns();

create or replace function guard_proof_columns()
returns trigger language plpgsql
set search_path = public, extensions as $$
begin
  if current_user not in ('authenticated', 'anon') or is_mod() then
    return new;
  end if;
  raise exception 'proof_locked'
    using hint = 'Upload through the app; a proof is graded, never self-graded.';
end $$;

drop trigger if exists trg_guard_proof_columns on proofs;
create trigger trg_guard_proof_columns
  before insert or update on proofs
  for each row execute function guard_proof_columns();

/* -------------------------------------------------- 4. feedback: the verdict */

create or replace function guard_feedback_columns()
returns trigger language plpgsql
set search_path = public, extensions as $$
declare v_assignment_tester uuid;
begin
  if current_user not in ('authenticated', 'anon') or is_mod() then
    return new;
  end if;

  -- A report may only ever be filed against your own assignment. Without this a
  -- member could write approved-looking reports against any app, inflating the
  -- production_evidence pack its owner shows Google.
  select tester_id into v_assignment_tester
    from assignments where id = new.assignment_id;
  if v_assignment_tester is null or v_assignment_tester <> auth.uid() then
    raise exception 'feedback_not_yours'
      using hint = 'You can only report on a test assigned to you.';
  end if;

  -- The tester writes the report. The developer's verdict, the arbitration
  -- outcome and the credits are written by review_feedback and
  -- arbitrate_dispute, both SECURITY DEFINER, and by nothing else.
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

drop trigger if exists trg_guard_feedback_columns on feedback;
create trigger trg_guard_feedback_columns
  before insert or update on feedback
  for each row execute function guard_feedback_columns();
