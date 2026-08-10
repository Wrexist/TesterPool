-- ============================================================================
-- COHORT — row level security, public views, seed data
-- ============================================================================

alter table profiles       enable row level security;
alter table apps           enable row level security;
alter table pods           enable row level security;
alter table pod_members    enable row level security;
alter table assignments    enable row level security;
alter table proofs         enable row level security;
alter table checkins       enable row level security;
alter table feedback       enable row level security;
alter table disputes       enable row level security;
alter table credit_ledger  enable row level security;
alter table greenlights    enable row level security;
alter table referrals      enable row level security;
alter table badges         enable row level security;
alter table user_badges    enable row level security;
alter table economy_config enable row level security;

create or replace function is_mod() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_moderator from profiles where id = auth.uid()), false) $$;

-- profiles -------------------------------------------------------------------
create policy "profiles readable" on profiles for select using (true);
create policy "own profile update" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- apps -----------------------------------------------------------------------
-- Visible to the owner, to anyone assigned to test it, and to moderators.
create policy "apps own" on apps for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "apps visible to assigned testers" on apps for select
  using (exists (select 1 from assignments a where a.app_id = apps.id and a.tester_id = auth.uid()));
create policy "apps visible to mods" on apps for select using (is_mod());
create policy "graduated apps public" on apps for select using (status = 'graduated');

-- pods -----------------------------------------------------------------------
create policy "pods readable" on pods for select using (true);
create policy "pods mod write" on pods for all using (is_mod()) with check (is_mod());

create policy "pod members readable" on pod_members for select using (true);
create policy "pod members own row" on pod_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- assignments ----------------------------------------------------------------
create policy "assignments visible to tester" on assignments for select
  using (tester_id = auth.uid());
create policy "assignments visible to app owner" on assignments for select
  using (exists (select 1 from apps a where a.id = assignments.app_id and a.owner_id = auth.uid()));
create policy "assignments mod" on assignments for select using (is_mod());
create policy "assignments tester update" on assignments for update
  using (tester_id = auth.uid()) with check (tester_id = auth.uid());

-- proofs ---------------------------------------------------------------------
create policy "proofs own" on proofs for all
  using (uploader_id = auth.uid()) with check (uploader_id = auth.uid());
create policy "proofs visible to app owner" on proofs for select
  using (exists (
    select 1 from assignments a join apps ap on ap.id = a.app_id
     where a.id = proofs.assignment_id and ap.owner_id = auth.uid()));
create policy "proofs mod" on proofs for all using (is_mod()) with check (is_mod());

-- checkins -------------------------------------------------------------------
create policy "checkins visible to tester" on checkins for select
  using (exists (select 1 from assignments a where a.id = checkins.assignment_id and a.tester_id = auth.uid()));
create policy "checkins visible to app owner" on checkins for select
  using (exists (
    select 1 from assignments a join apps ap on ap.id = a.app_id
     where a.id = checkins.assignment_id and ap.owner_id = auth.uid()));
create policy "checkins mod" on checkins for select using (is_mod());

-- feedback -------------------------------------------------------------------
-- Private by construction: only the tester who wrote it, the app owner, and
-- moderators can ever read a feedback row. It is never exposed publicly.
create policy "feedback own" on feedback for all
  using (tester_id = auth.uid()) with check (tester_id = auth.uid());
create policy "feedback visible to app owner" on feedback for select
  using (exists (select 1 from apps a where a.id = feedback.app_id and a.owner_id = auth.uid()));
create policy "feedback mod" on feedback for all using (is_mod()) with check (is_mod());

create policy "disputes party" on disputes for select
  using (raised_by = auth.uid()
      or exists (select 1 from feedback f where f.id = disputes.feedback_id and f.tester_id = auth.uid()));
create policy "disputes mod" on disputes for all using (is_mod()) with check (is_mod());

-- ledger ---------------------------------------------------------------------
create policy "ledger own" on credit_ledger for select using (user_id = auth.uid());
create policy "ledger mod" on credit_ledger for select using (is_mod());

-- growth surfaces ------------------------------------------------------------
create policy "greenlights public" on greenlights for select using (is_public or user_id = auth.uid());
create policy "greenlights own" on greenlights for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "referrals own" on referrals for select
  using (referrer_id = auth.uid() or referee_id = auth.uid());
create policy "badges public" on badges for select using (true);
create policy "user badges public" on user_badges for select using (true);
create policy "economy config public" on economy_config for select using (true);

-- ---------------------------------------------------------------------------
-- Public views (safe projections — no private feedback, no store surfaces)
-- ---------------------------------------------------------------------------
create or replace view leaderboard
with (security_invoker = on) as
select p.id, p.handle, p.display_name, p.avatar_url, p.country_code,
       p.reliability, p.tier, p.pods_completed, p.apps_helped_ship,
       p.longest_streak,
       (select count(*) from feedback f where f.tester_id = p.id and f.status in ('approved','arbitrated')) as approved_reports
  from profiles p
 where not p.is_banned
 order by p.reliability desc, p.pods_completed desc;

create or replace view pod_health
with (security_invoker = on) as
select
  pd.id, pd.code, pd.name, pd.status, pd.core_seats, pd.required_testers,
  pd.starts_at, pd.ends_at,
  greatest(0, least(pd.duration_days,
    (((now() at time zone 'utc')::date - (pd.starts_at at time zone 'utc')::date) + 1))) as day_index,
  (select count(*) from pod_members m where m.pod_id = pd.id and m.status <> 'removed') as members,
  (select count(*) from pod_members m where m.pod_id = pd.id and m.status = 'dropped')  as dropouts,
  (select count(*) from assignments a where a.pod_id = pd.id and a.opt_in_verified_at is not null) as verified_optins,
  (select coalesce(avg(a.days_checked_in),0) from assignments a where a.pod_id = pd.id) as avg_days
from pods pd;

-- The evidence pack: exactly the numbers Google's production-access form asks
-- for. This is the artefact competitors do not ship, and it is why a Cohort
-- application reads as a real test rather than twelve warm bodies.
create or replace view production_evidence
with (security_invoker = on) as
select
  ap.id as app_id, ap.owner_id, ap.name,
  count(distinct a.id)                                             as testers_assigned,
  count(distinct a.id) filter (where a.opt_in_verified_at is not null) as testers_opted_in,
  count(distinct a.id) filter (where a.days_checked_in >= 14)      as testers_full_14,
  coalesce(round(avg(a.days_checked_in), 1), 0)                    as avg_days_active,
  count(distinct f.id) filter (where f.status in ('approved','arbitrated')) as feedback_reports,
  count(distinct f.id) filter (where f.severity >= 2)               as significant_issues,
  min(pd.starts_at)                                                as test_started,
  max(pd.ends_at)                                                  as test_ends
from apps ap
left join assignments a on a.app_id = ap.id
left join pods pd       on pd.id = a.pod_id
left join feedback f    on f.assignment_id = a.id
group by ap.id, ap.owner_id, ap.name;

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------
insert into badges (key, label, description, icon) values
  ('first_pod',     'First Pod',        'Completed your first 14-day cohort.',                 'seedling'),
  ('perfect_14',    'Perfect 14',       'Checked in every single day of a pod.',               'flame'),
  ('rescuer',       'Rescuer',          'Joined a pod mid-cycle to save someone''s clock.',    'life-buoy'),
  ('bug_hunter',    'Bug Hunter',       'Reported a blocker with reproduction steps.',         'bug'),
  ('greenlit',      'Greenlit',         'Got production access approved.',                     'check-circle'),
  ('first_try',     'First Try',        'Approved on the first application.',                  'target'),
  ('ten_apps',      'Ten Apps Shipped', 'Helped ten different apps reach production.',         'rocket'),
  ('never_dropped', 'Never Dropped',    'Five pods, zero dropouts.',                           'shield')
on conflict (key) do nothing;
