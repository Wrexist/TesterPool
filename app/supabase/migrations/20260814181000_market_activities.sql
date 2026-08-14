-- ============================================================================
-- THE MARKETPLACE LEARNS ABOUT ACTIVITIES
--
-- `market_apps` was written when a seat could only come from a pod, and it says
-- so in three places: `relation` only reaches 'testing' for an app whose status
-- is `in_pod`, `report_due` is gated the same way, and nothing in the row tells
-- a browsing member whether they could start on this app right now.
--
-- An activity app keeps its `queued` status — it is not in a pod and pretending
-- otherwise would corrupt the pod-day maths and the seat counts — so all three
-- read wrong the moment activities exist: a member with a live activity sees
-- 'none', their report never comes due, and the row that pays 40 has no button.
--
-- Two new columns, and the two conditions widened. Nothing here loosens what
-- the projection withholds: `opt_in_url`, `google_group`, `package_name` and
-- `tester_instructions` are decided in `market_app` off `relation`, and an
-- activity earning 'testing' is exactly the case that should see them — it is a
-- seat, granted by an RPC that checked the app was open, not by the directory.
--
-- Still no scores, no averages and no store surface. Invariant 1 is untouched.
-- ============================================================================

-- The return type changes, so this cannot be a `create or replace`. `market_app`
-- and `market_counts` call it by name and SQL-language functions record no
-- dependency on a called function, so they survive the drop and pick up the new
-- shape — `market_app` does `to_jsonb(one)` over the whole row, so both new
-- columns reach the detail page without touching it.
drop function if exists market_apps(text, text, text, text, text, text, int, int, uuid);

create function market_apps(
  p_scope    text default 'all',
  p_platform text default null,
  p_status   text default null,
  p_category text default null,
  p_q        text default null,
  p_sort     text default 'newest',
  p_limit    int  default 48,
  p_offset   int  default 0,
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
  -- New: whether *you* could start an activity on this app this second, and how
  -- many of the owner's activity seats are unclaimed. `activity_open` mirrors
  -- every check in `start_activity`, because a button the RPC then refuses is
  -- worse than no button.
  activity_open       boolean,
  activity_seats_left int,
  -- Whether the seat you hold here is an activity rather than a pod seat. The
  -- two look identical in every other column and behave differently in one
  -- place that matters: an activity has one check-in and no fourteen-day clock,
  -- so a UI that cannot tell them apart draws a 14-day streak strip against a
  -- seat that will never have a second day.
  is_activity         boolean,
  total_count         int
)
language sql
stable
security definer
set search_path = public, extensions
as $$
with cfgv as (
  select cfg('install_charge') + cfg('review_charge') as job_cost,
         coalesce((select enabled from feature_flags where key = 'activities'), true) as activities_on
),
listed as (
  select
    a.id,
    a.name,
    a.tagline,
    a.category,
    a.platform::text                                      as platform,
    a.icon_url,
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
    -- Pod behaviour is unchanged, line for line. The third arm is the new one:
    -- an activity seat (no pod) counts as testing until its report is in, which
    -- is the whole of its life.
    case
      when a.owner_id = auth.uid()                          then 'owner'
      when mine.assignment_id is null                       then 'none'
      when mine.astatus in ('dropped', 'removed')           then 'tested'
      when a.status = 'in_pod'                              then 'testing'
      when mine.pod_id is null and not mine.reported        then 'testing'
      else 'tested'
    end                                                   as relation,
    mine.assignment_id,
    coalesce(mine.days_checked_in, 0)                     as days_checked_in,
    coalesce(
      (a.status = 'in_pod' or mine.pod_id is null)
        and mine.opt_in_verified_at is not null
        and not mine.reported,
      false
    )                                                     as report_due,
    exists (
      select 1 from app_watchlist w
       where w.app_id = a.id and w.user_id = auth.uid()
    )                                                     as watching,
    (
      c.activities_on
      and a.platform = 'android'
      and a.status in ('queued', 'in_pod')
      and a.accepting_activities
      and not a.credits_paused
      and a.owner_id <> auth.uid()
      and (a.opt_in_url is not null or a.google_group is not null)
      and mine.assignment_id is null
      and act.taken < a.activity_target
      -- The owner's own balance, because `start_activity` refuses rather than
      -- seat a tester the owner cannot pay. Showing the button anyway would
      -- send someone to a dead end that is not their fault.
      and coalesce(p.credits, 0) >= c.job_cost
    )                                                     as activity_open,
    greatest(0, a.activity_target - act.taken)            as activity_seats_left,
    (mine.assignment_id is not null and mine.pod_id is null) as is_activity
  from apps a
  join profiles p on p.id = a.owner_id
  cross join cfgv c
  left join lateral (
    select s.id as assignment_id, s.status::text as astatus, s.days_checked_in,
           s.opt_in_verified_at, s.pod_id,
           exists (select 1 from feedback f
                    where f.assignment_id = s.id and f.status <> 'draft') as reported
      from assignments s
     where s.app_id = a.id and s.tester_id = auth.uid()
     order by s.created_at desc
     limit 1
  ) mine on true
  left join lateral (
    select count(*)::int as taken
      from assignments s
     where s.app_id = a.id and s.pod_id is null
       and s.status not in ('dropped', 'removed')
  ) act on true
  left join lateral (
    select pd.status::text as pod_status, pd.core_seats,
           (select count(*) from pod_members m2
             where m2.pod_id = pd.id and m2.status <> 'removed')::int as members,
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
          or (p_scope = 'saved'   and r.watching)
          -- The feed's own scope: work you could pick up right now. It is the
          -- default view of a marketplace whose point is that there is
          -- something to do, and no other scope answers it.
          or (p_scope = 'open'    and r.activity_open))
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
  f.activity_open, f.activity_seats_left, f.is_activity,
  (count(*) over ())::int as total_count
from filtered f
order by
  case when p_sort = 'name'      then lower(f.name) end asc,
  case when p_sort = 'reports'   then f.reports end desc,
  case when p_sort = 'testers'   then f.testers_active end desc,
  case when p_sort = 'graduated' then f.graduated_at end desc nulls last,
  f.created_at desc
limit  greatest(1, least(coalesce(p_limit, 48), 96))
offset greatest(0, coalesce(p_offset, 0));
$$;

revoke execute on function market_apps(text, text, text, text, text, text, int, int, uuid)
  from anon, public;
grant  execute on function market_apps(text, text, text, text, text, text, int, int, uuid)
  to authenticated;

/* ------------------------------------------------------- the open count */

-- `market_counts` gains the chip the feed leads with. Same shape as the others:
-- counted through `total_count` so it can never disagree with the list.
create or replace function market_counts()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'open',    coalesce((select m.total_count from market_apps('open',    null, null, null, null, 'newest', 1, 0) m), 0),
    'testing', coalesce((select m.total_count from market_apps('testing', null, null, null, null, 'newest', 1, 0) m), 0),
    'due',     coalesce((select m.total_count from market_apps('due',     null, null, null, null, 'newest', 1, 0) m), 0),
    'mine',    coalesce((select m.total_count from market_apps('mine',    null, null, null, null, 'newest', 1, 0) m), 0),
    'saved',   coalesce((select m.total_count from market_apps('saved',   null, null, null, null, 'newest', 1, 0) m), 0)
  );
$$;

revoke execute on function market_counts() from anon, public;
grant  execute on function market_counts() to authenticated;
