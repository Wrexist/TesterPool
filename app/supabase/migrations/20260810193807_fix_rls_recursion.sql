-- ============================================================================
-- FIX: infinite recursion in RLS.
--
-- "apps visible to assigned testers" subqueried `assignments`, and
-- "assignments visible to app owner" subqueried `apps`. Postgres evaluates the
-- other table's policies while evaluating each, so every read of either table
-- failed with 42P17. Every authenticated query against apps/assignments/feedback
-- was returning zero rows.
--
-- Fix: move the cross-table lookups into SECURITY DEFINER helpers, which run as
-- the owner and therefore do not re-enter RLS.
-- ============================================================================

create or replace function owns_app(p_app uuid) returns boolean
language sql stable security definer set search_path = public, extensions as
$$ select exists (select 1 from apps where id = p_app and owner_id = auth.uid()) $$;

create or replace function tests_app(p_app uuid) returns boolean
language sql stable security definer set search_path = public, extensions as
$$ select exists (select 1 from assignments where app_id = p_app and tester_id = auth.uid()) $$;

create or replace function owns_assignment_app(p_assignment uuid) returns boolean
language sql stable security definer set search_path = public, extensions as
$$ select exists (
     select 1 from assignments a join apps ap on ap.id = a.app_id
      where a.id = p_assignment and ap.owner_id = auth.uid()) $$;

create or replace function is_assignment_tester(p_assignment uuid) returns boolean
language sql stable security definer set search_path = public, extensions as
$$ select exists (select 1 from assignments where id = p_assignment and tester_id = auth.uid()) $$;

revoke execute on function owns_app(uuid), tests_app(uuid),
  owns_assignment_app(uuid), is_assignment_tester(uuid) from anon, public;
grant execute on function owns_app(uuid), tests_app(uuid),
  owns_assignment_app(uuid), is_assignment_tester(uuid) to authenticated;

-- apps -----------------------------------------------------------------------
drop policy if exists "apps visible to assigned testers" on apps;
create policy "apps visible to assigned testers" on apps for select using (tests_app(id));

-- assignments ----------------------------------------------------------------
drop policy if exists "assignments visible to app owner" on assignments;
create policy "assignments visible to app owner" on assignments for select using (owns_app(app_id));

-- proofs ---------------------------------------------------------------------
drop policy if exists "proofs visible to app owner" on proofs;
create policy "proofs visible to app owner" on proofs for select
  using (assignment_id is not null and owns_assignment_app(assignment_id));

-- checkins -------------------------------------------------------------------
drop policy if exists "checkins visible to tester" on checkins;
create policy "checkins visible to tester" on checkins for select
  using (is_assignment_tester(assignment_id));
drop policy if exists "checkins visible to app owner" on checkins;
create policy "checkins visible to app owner" on checkins for select
  using (owns_assignment_app(assignment_id));

-- feedback -------------------------------------------------------------------
drop policy if exists "feedback visible to app owner" on feedback;
create policy "feedback visible to app owner" on feedback for select using (owns_app(app_id));

-- disputes -------------------------------------------------------------------
create or replace function is_feedback_tester(p_feedback uuid) returns boolean
language sql stable security definer set search_path = public, extensions as
$$ select exists (select 1 from feedback where id = p_feedback and tester_id = auth.uid()) $$;
revoke execute on function is_feedback_tester(uuid) from anon, public;
grant  execute on function is_feedback_tester(uuid) to authenticated;

drop policy if exists "disputes party" on disputes;
create policy "disputes party" on disputes for select
  using (raised_by = auth.uid() or is_feedback_tester(feedback_id));