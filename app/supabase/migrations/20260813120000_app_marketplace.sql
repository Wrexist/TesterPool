-- ============================================================================
-- APP MARKETPLACE
--
-- A browsable directory of the apps in the pool: what needs testers, what is
-- mid-cycle, what graduated, and where the signed-in member already stands with
-- each one. Everything here is discovery. Nothing here moves a credit.
--
-- Three things this deliberately does NOT do, each for a specific reason:
--
--  1. It never exposes `opt_in_url`, `google_group`, `package_name` or
--     `tester_instructions` to a member who does not own the app or hold an
--     assignment against it. For an Android app in closed testing the package
--     name IS the opt-in link (play.google.com/apps/testing/<pkg>), so leaking
--     it lets a stranger consume a seat in someone's closed track without an
--     assignment, outside the escrow, outside the pod. Legitimate access
--     arrives with the assignment; it is not browsable.
--
--  2. It surfaces no scores and no averages. `feedback` carries three 1-5
--     scores, and an average of them rendered next to an app icon in a public
--     directory is a rating board — the one shape this product's schema is
--     built to be incapable of. Members see activity (testers holding, days
--     held, reports delivered), never a verdict. The report itself stays
--     private between the tester and the developer, as `feedback` RLS enforces.
--
--  3. It cannot create an assignment. Testing is allocated by pod matching so
--     that the install and report charges stay escrowed and symmetric; a
--     "start testing this" button in a directory would be a way to earn against
--     an owner who never agreed to pay. The marketplace links to the pod, and
--     the pod does the seating.
--
-- The one piece of state it adds is a watchlist, which pays nothing and costs
-- nothing. It exists so "I want to test that when it comes up" survives a page
-- refresh.
--
-- Every function here is `security definer` because it reads across rows the
-- caller's RLS deliberately hides, and projects only the safe columns back. Per
-- the standing rule for that pattern: execute is revoked from anon and public,
-- granted only to authenticated, and none of them takes an amount, a user id,
-- or anything else a client could use to decide a payment.
-- ============================================================================

/* ------------------------------------------------------------- watchlist */

create table if not exists app_watchlist (
  user_id    uuid not null references profiles(id) on delete cascade,
  app_id     uuid not null references apps(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

create index if not exists app_watchlist_app_idx on app_watchlist (app_id);

alter table app_watchlist enable row level security;

-- Single policy, own rows only, referencing no other table — the RLS recursion
-- this schema has already been bitten by comes from cross-table policies, so a
-- watchlist that only ever compares against auth.uid() stays out of that class
-- of bug entirely.
drop policy if exists "watchlist own" on app_watchlist;
create policy "watchlist own" on app_watchlist for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on app_watchlist from anon;
grant select, insert, delete on app_watchlist to authenticated;

/* ------------------------------------------------------- indexes it needs */

create index if not exists assignments_app_tester_idx on assignments (app_id, tester_id);
create index if not exists feedback_app_status_idx    on feedback (app_id, status);
create index if not exists pod_members_app_idx        on pod_members (app_id);
create index if not exists apps_status_created_idx    on apps (status, created_at desc);

/* ------------------------------------------------------------- the listing */

create or replace function market_apps(
  p_scope    text default 'all',
  p_platform text default null,
  p_status   text default null,
  p_category text default null,
  p_q        text default null,
  p_sort     text default 'newest',
  p_limit    int  default 48,
  p_offset   int  default 0,
  -- Set by `market_app` to fetch exactly one row through the same projection,
  -- so the detail page can never see a column the listing hides.
  p_id       uuid default null
)
returns table (
  id                  uuid,
  name                text,
  tagline             text,
  category            text,
  platform            text,
  icon_url            text,
  store_url           text,
  status              text,
  focus_areas         text[],
  min_android_version text,
  created_at          timestamptz,
  graduated_at        timestamptz,
  owner_id            uuid,
  owner_handle        text,
  owner_display_name  text,
  owner_avatar_url    text,
  owner_country_code  text,
  owner_reliability   numeric,
  owner_tier          text,
  testers_active      int,
  testers_full        int,
  reports             int,
  pod_status          text,
  pod_day             int,
  pod_seats_left      int,
  relation            text,
  assignment_id       uuid,
  days_checked_in     int,
  report_due          boolean,
  watching            boolean,
  total_count         int
)
language sql
stable
security definer
set search_path = public, extensions
as $$
with listed as (
  select
    a.id,
    a.name,
    a.tagline,
    a.category,
    a.platform::text                                      as platform,
    a.icon_url,
    -- A public store URL only exists once the app is out of closed testing.
    case when a.status = 'graduated' then a.store_url end as store_url,
    a.status::text                                        as status,
    coalesce(a.focus_areas, '{}')                         as focus_areas,
    a.min_android_version,
    a.created_at,
    a.graduated_at,
    a.owner_id,
    p.handle::text                                        as owner_handle,
    p.display_name                                        as owner_display_name,
    p.avatar_url                                          as owner_avatar_url,
    p.country_code::text                                  as owner_country_code,
    p.reliability                                         as owner_reliability,
    p.tier::text                                          as owner_tier,
    (select count(*) from assignments s
      where s.app_id = a.id and s.status not in ('dropped', 'removed'))::int  as testers_active,
    (select count(*) from assignments s
      where s.app_id = a.id and s.days_checked_in >= 14)::int                 as testers_full,
    (select count(*) from feedback f
      where f.app_id = a.id and f.status in ('approved', 'arbitrated'))::int  as reports,
    pod.pod_status,
    pod.day_index                                         as pod_day,
    case when pod.pod_status = 'forming'
         then greatest(0, pod.core_seats - pod.members) end as pod_seats_left,
    case
      when a.owner_id = auth.uid()   then 'owner'
      when mine.assignment_id is null then 'none'
      when a.status = 'in_pod' and mine.astatus not in ('dropped', 'removed') then 'testing'
      else 'tested'
    end                                                   as relation,
    mine.assignment_id,
    coalesce(mine.days_checked_in, 0)                     as days_checked_in,
    coalesce(
      a.status = 'in_pod'
        and mine.opt_in_verified_at is not null
        and not mine.reported,
      false
    )                                                     as report_due,
    exists (
      select 1 from app_watchlist w
       where w.app_id = a.id and w.user_id = auth.uid()
    )                                                     as watching
  from apps a
  join profiles p on p.id = a.owner_id
  left join lateral (
    select s.id as assignment_id, s.status::text as astatus, s.days_checked_in,
           s.opt_in_verified_at,
           exists (select 1 from feedback f
                    where f.assignment_id = s.id and f.status <> 'draft') as reported
      from assignments s
     where s.app_id = a.id and s.tester_id = auth.uid()
     order by s.created_at desc
     limit 1
  ) mine on true
  left join lateral (
    select pd.status::text as pod_status, pd.core_seats,
           (select count(*) from pod_members m2
             where m2.pod_id = pd.id and m2.status <> 'removed')::int as members,
           -- least()/greatest() ignore NULL, so a pod that has not started has
           -- to be excluded explicitly or it reads as day 14 of 14.
           case when pd.starts_at is null then null else
             greatest(0, least(pd.duration_days,
               (((now() at time zone 'utc')::date - (pd.starts_at at time zone 'utc')::date) + 1)
             ))::int
           end as day_index
      from pod_members m
      join pods pd on pd.id = m.pod_id
     where m.app_id = a.id
     order by m.joined_at desc
     limit 1
  ) pod on true
  where not p.is_banned
    -- Visible: anything in the open part of its life, plus your own drafts and
    -- anything you personally hold an assignment against.
    and (a.status in ('queued', 'in_pod', 'graduated')
         or a.owner_id = auth.uid()
         or mine.assignment_id is not null)
),
filtered as (
  select * from listed r
   where (p_id is null or r.id = p_id)
     and (p_platform is null or p_platform = 'all' or r.platform = p_platform)
     and (p_category is null or p_category = 'all' or r.category = p_category)
     and (p_status is null or p_status = 'all'
          or (p_status = 'needs_testers'
              and (r.status = 'queued'
                   or (r.status = 'in_pod' and coalesce(r.pod_status, 'forming') = 'forming')))
          or (p_status = 'in_testing'
              and r.status = 'in_pod' and coalesce(r.pod_status, 'forming') <> 'forming')
          or (p_status = 'graduated' and r.status = 'graduated'))
     and (p_scope is null or p_scope = 'all'
          or (p_scope = 'mine'    and r.relation = 'owner')
          or (p_scope = 'testing' and r.relation = 'testing')
          or (p_scope = 'tested'  and r.relation in ('testing', 'tested'))
          or (p_scope = 'due'     and r.report_due)
          or (p_scope = 'saved'   and r.watching))
     and (p_q is null or btrim(p_q) = ''
          or r.name ilike '%' || btrim(p_q) || '%'
          or coalesce(r.tagline, '')      ilike '%' || btrim(p_q) || '%'
          or coalesce(r.category, '')     ilike '%' || btrim(p_q) || '%'
          or coalesce(r.owner_handle, '') ilike '%' || btrim(p_q) || '%')
)
select
  f.id, f.name, f.tagline, f.category, f.platform, f.icon_url, f.store_url,
  f.status, f.focus_areas, f.min_android_version, f.created_at, f.graduated_at,
  f.owner_id, f.owner_handle, f.owner_display_name, f.owner_avatar_url,
  f.owner_country_code, f.owner_reliability, f.owner_tier,
  f.testers_active, f.testers_full, f.reports,
  f.pod_status, f.pod_day, f.pod_seats_left,
  f.relation, f.assignment_id, f.days_checked_in, f.report_due, f.watching,
  (count(*) over ())::int as total_count
from filtered f
order by
  case when p_sort = 'name'      then lower(f.name) end asc,
  case when p_sort = 'reports'   then f.reports end desc,
  case when p_sort = 'testers'   then f.testers_active end desc,
  case when p_sort = 'graduated' then f.graduated_at end desc nulls last,
  -- The default, and the tie-break for every other sort.
  f.created_at desc
limit  greatest(1, least(coalesce(p_limit, 48), 96))
offset greatest(0, coalesce(p_offset, 0));
$$;

revoke execute on function market_apps(text, text, text, text, text, text, int, int, uuid)
  from anon, public;
grant  execute on function market_apps(text, text, text, text, text, text, int, int, uuid)
  to authenticated;

/* -------------------------------------------------------------- one app */

-- The detail page. Same projection rules as the listing, plus the two long
-- fields a card has no room for — and the closed-track entry details, which
-- appear ONLY for the owner and for a member who already holds an assignment.
create or replace function market_app(p_app uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select to_jsonb(one) || jsonb_build_object(
    'description', a.description,
    'tester_instructions',
      case when one.relation in ('owner', 'testing', 'tested') then a.tester_instructions end,
    'opt_in_url',
      case when one.relation in ('owner', 'testing') then a.opt_in_url end,
    'package_name',
      case when one.relation in ('owner', 'testing') or a.status = 'graduated'
           then a.package_name end,
    'owner_apps',
      (select count(*) from apps o
        where o.owner_id = a.owner_id
          and o.status in ('queued', 'in_pod', 'graduated'))::int,
    'owner_pods_completed', p.pods_completed,
    'owner_apps_helped_ship', p.apps_helped_ship
  )
  from market_apps('all', null, null, null, null, 'newest', 1, 0, p_app) one
  join apps a     on a.id = one.id
  join profiles p on p.id = a.owner_id;
$$;

revoke execute on function market_app(uuid) from anon, public;
grant  execute on function market_app(uuid) to authenticated;

/* ---------------------------------------------------------- scope counts */

-- The four numbers on the filter chips. One round trip rather than four
-- listing calls, and it reuses the listing itself so a chip can never claim a
-- count the grid then fails to show.
create or replace function market_counts()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  -- Each scope is counted through `total_count`, which counts the whole
  -- filtered result rather than the page. Counting a single 'all' call instead
  -- would silently cap at one page the moment the pool outgrows it.
  select jsonb_build_object(
    'testing', coalesce((select m.total_count from market_apps('testing', null, null, null, null, 'newest', 1, 0) m), 0),
    'due',     coalesce((select m.total_count from market_apps('due',     null, null, null, null, 'newest', 1, 0) m), 0),
    'mine',    coalesce((select m.total_count from market_apps('mine',    null, null, null, null, 'newest', 1, 0) m), 0),
    'saved',   coalesce((select m.total_count from market_apps('saved',   null, null, null, null, 'newest', 1, 0) m), 0)
  );
$$;

revoke execute on function market_counts() from anon, public;
grant  execute on function market_counts() to authenticated;

/* ------------------------------------------------------------ categories */

-- The category filter is built from what is actually listed rather than from a
-- hard-coded taxonomy, so it never offers a filter that returns nothing.
create or replace function market_categories()
returns table (category text, apps int)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select a.category, count(*)::int as apps
    from apps a
    join profiles p on p.id = a.owner_id
   where not p.is_banned
     and a.category is not null
     and btrim(a.category) <> ''
     and (a.status in ('queued', 'in_pod', 'graduated') or a.owner_id = auth.uid())
   group by a.category
   order by count(*) desc, a.category asc
   limit 40;
$$;

revoke execute on function market_categories() from anon, public;
grant  execute on function market_categories() to authenticated;
