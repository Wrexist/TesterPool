-- ============================================================================
-- RLS PERFORMANCE PASS
--
-- The advisor flagged 85 multiple_permissive_policies and 12 auth_rls_initplan
-- warnings. Two distinct costs:
--
--  1. `auth.uid()` written bare is re-evaluated ONCE PER ROW. Wrapping it as
--     `(select auth.uid())` turns it into an InitPlan evaluated once per query.
--     On a 200-row assignments scan that is 200 function calls saved.
--  2. Multiple permissive policies for the same role+action are ALL evaluated
--     and OR'd. Collapsing them into one policy per table+action is strictly
--     cheaper, and it makes the security model readable in one place.
--
--  Also: every policy here now targets `to authenticated` explicitly. Without
--  it Postgres also plans them for `anon`, which is both wasted work and a
--  wider surface than intended.
-- ============================================================================

-- ---------------------------------------------------------------- profiles --
drop policy if exists "profiles readable"     on profiles;
drop policy if exists "own profile update"    on profiles;
drop policy if exists "profiles admin write"  on profiles;

-- Public: needed for leaderboards and public tester profiles.
create policy "profiles select" on profiles for select using (true);
create policy "profiles update" on profiles for update to authenticated
  using (id = (select auth.uid()) or is_admin())
  with check (id = (select auth.uid()) or is_admin());

-- -------------------------------------------------------------------- apps --
drop policy if exists "apps own"                        on apps;
drop policy if exists "apps visible to assigned testers" on apps;
drop policy if exists "apps visible to mods"            on apps;
drop policy if exists "graduated apps public"           on apps;
drop policy if exists "apps admin read"                 on apps;

create policy "apps select" on apps for select
  using (status = 'graduated'                       -- public launch feed
      or owner_id = (select auth.uid())
      or tests_app(id)
      or is_mod());
create policy "apps insert" on apps for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "apps update" on apps for update to authenticated
  using (owner_id = (select auth.uid()) or is_admin())
  with check (owner_id = (select auth.uid()) or is_admin());
create policy "apps delete" on apps for delete to authenticated
  using (owner_id = (select auth.uid()) or is_admin());

-- -------------------------------------------------------------------- pods --
drop policy if exists "pods readable"  on pods;
drop policy if exists "pods mod write" on pods;
create policy "pods select" on pods for select using (true);
create policy "pods write"  on pods for all to authenticated
  using (is_mod()) with check (is_mod());

drop policy if exists "pod members readable" on pod_members;
drop policy if exists "pod members own row"  on pod_members;
create policy "pod members select" on pod_members for select using (true);
create policy "pod members update" on pod_members for update to authenticated
  using (user_id = (select auth.uid()) or is_mod())
  with check (user_id = (select auth.uid()) or is_mod());

-- ------------------------------------------------------------- assignments --
drop policy if exists "assignments visible to tester"    on assignments;
drop policy if exists "assignments visible to app owner" on assignments;
drop policy if exists "assignments mod"                  on assignments;
drop policy if exists "assignments tester update"        on assignments;
drop policy if exists "assignments admin read"           on assignments;

create policy "assignments select" on assignments for select to authenticated
  using (tester_id = (select auth.uid()) or owns_app(app_id) or is_mod());
create policy "assignments update" on assignments for update to authenticated
  using (tester_id = (select auth.uid()) or is_mod())
  with check (tester_id = (select auth.uid()) or is_mod());

-- ------------------------------------------------------------------ proofs --
drop policy if exists "proofs own"                  on proofs;
drop policy if exists "proofs visible to app owner"  on proofs;
drop policy if exists "proofs mod"                   on proofs;

create policy "proofs select" on proofs for select to authenticated
  using (uploader_id = (select auth.uid())
      or (assignment_id is not null and owns_assignment_app(assignment_id))
      or is_mod());
create policy "proofs insert" on proofs for insert to authenticated
  with check (uploader_id = (select auth.uid()));
create policy "proofs update" on proofs for update to authenticated
  using (uploader_id = (select auth.uid()) or is_mod())
  with check (uploader_id = (select auth.uid()) or is_mod());
create policy "proofs delete" on proofs for delete to authenticated
  using (uploader_id = (select auth.uid()) or is_mod());

-- ---------------------------------------------------------------- checkins --
drop policy if exists "checkins visible to tester"    on checkins;
drop policy if exists "checkins visible to app owner" on checkins;
drop policy if exists "checkins mod"                  on checkins;
create policy "checkins select" on checkins for select to authenticated
  using (is_assignment_tester(assignment_id) or owns_assignment_app(assignment_id) or is_mod());

-- ---------------------------------------------------------------- feedback --
drop policy if exists "feedback own"                  on feedback;
drop policy if exists "feedback visible to app owner" on feedback;
drop policy if exists "feedback mod"                  on feedback;

create policy "feedback select" on feedback for select to authenticated
  using (tester_id = (select auth.uid()) or owns_app(app_id) or is_mod());
create policy "feedback insert" on feedback for insert to authenticated
  with check (tester_id = (select auth.uid()));
create policy "feedback update" on feedback for update to authenticated
  using (tester_id = (select auth.uid()) or is_mod())
  with check (tester_id = (select auth.uid()) or is_mod());

-- ---------------------------------------------------------------- disputes --
drop policy if exists "disputes party" on disputes;
drop policy if exists "disputes mod"   on disputes;
create policy "disputes select" on disputes for select to authenticated
  using (raised_by = (select auth.uid()) or is_feedback_tester(feedback_id) or is_mod());
create policy "disputes write" on disputes for all to authenticated
  using (is_mod()) with check (is_mod());

-- ----------------------------------------------------------------- ledger ---
drop policy if exists "ledger own"        on credit_ledger;
drop policy if exists "ledger mod"        on credit_ledger;
drop policy if exists "ledger admin read" on credit_ledger;
create policy "ledger select" on credit_ledger for select to authenticated
  using (user_id = (select auth.uid()) or is_admin());

-- ------------------------------------------------------------- greenlights --
drop policy if exists "greenlights public" on greenlights;
drop policy if exists "greenlights own"    on greenlights;
create policy "greenlights select" on greenlights for select
  using (is_public or user_id = (select auth.uid()));
create policy "greenlights write" on greenlights for all to authenticated
  using (user_id = (select auth.uid()) or is_admin())
  with check (user_id = (select auth.uid()) or is_admin());

drop policy if exists "referrals own" on referrals;
create policy "referrals select" on referrals for select to authenticated
  using (referrer_id = (select auth.uid()) or referee_id = (select auth.uid()) or is_admin());

-- --------------------------------------------------------- announcements ----
drop policy if exists "announcements readable" on announcements;
drop policy if exists "announcements admin"    on announcements;
create policy "announcements select" on announcements for select
  using (active or is_admin());
create policy "announcements write" on announcements for all to authenticated
  using (is_admin()) with check (is_admin());

-- Feature flags are readable by everyone (login needs them before auth) but
-- written only through admin_set_flag, which audits.
drop policy if exists "flags readable" on feature_flags;
create policy "flags select" on feature_flags for select using (true);

-- -------------------------------------------------- covering FK indexes -----
create index if not exists announcements_created_by_idx on announcements (created_by);
create index if not exists admin_actions_actor_idx      on admin_actions (actor_id);
create index if not exists apps_owner_idx               on apps (owner_id);
create index if not exists assignments_pod_idx          on assignments (pod_id);
create index if not exists assignments_app_idx          on assignments (app_id);
create index if not exists checkins_proof_idx           on checkins (proof_id);
create index if not exists disputes_feedback_idx        on disputes (feedback_id);
create index if not exists disputes_raised_by_idx       on disputes (raised_by);
create index if not exists disputes_resolver_idx        on disputes (resolver_id);
create index if not exists feedback_assignment_idx      on feedback (assignment_id);
create index if not exists greenlights_app_idx          on greenlights (app_id);
create index if not exists greenlights_user_idx         on greenlights (user_id);
create index if not exists pod_members_app_idx          on pod_members (app_id);
create index if not exists proofs_uploader_idx          on proofs (uploader_id);
create index if not exists proofs_reviewed_by_idx       on proofs (reviewed_by);
create index if not exists referrals_referee_idx        on referrals (referee_id);
create index if not exists user_badges_badge_idx        on user_badges (badge_key);

-- Hot paths the dashboard hits on every load.
create index if not exists assignments_tester_active_idx on assignments (tester_id)
  where status in ('opt_in_pending', 'active');
create index if not exists checkins_date_idx             on checkins (checkin_date desc);
create index if not exists feedback_status_idx           on feedback (status) where status = 'submitted';
create index if not exists profiles_role_idx             on profiles (role) where role <> 'user';

-- Trigram search for the admin user table.
create extension if not exists pg_trgm with schema extensions;
create index if not exists profiles_handle_trgm on profiles using gin (handle extensions.gin_trgm_ops);
create index if not exists profiles_name_trgm   on profiles using gin (display_name extensions.gin_trgm_ops);

analyze;