-- ============================================================================
-- LIVE APPS CAN BE TESTED AGAIN
--
-- A `graduated` app is currently a dead listing. `rewardFor()` returns null,
-- `start_activity` refuses it, and the detail page says "there is nothing left
-- to test here". The reasoning was sound when the only product was the pod: an
-- app that has cleared Google's twelve-testers-for-fourteen-days gate has no
-- gate left to clear, so a pod seat on it buys the owner nothing.
--
-- But that reasoning was about the *gate*, and it silently threw away the
-- larger market. A developer with a game already on Play does not need
-- production access — they need people to actually play it and tell them what
-- is wrong with it, which is the other half of what this network does and the
-- half that never expires. Today they have no reason to be here at all.
--
-- So: a live app may take activities. One condition carries the whole thing,
-- and it is the condition that was already there —
--
--     `start_activity` still refuses without `opt_in_url` or `google_group`.
--
-- The tester joins a closed testing track, not a store listing. A published app
-- runs a closed track alongside production routinely; that track is what the
-- link points at, and it is where the install happens. The Play install counter,
-- the store ranking and the public rating are untouched, because nothing in this
-- path ever reaches them.
--
-- What this migration deliberately does NOT do, and what no migration in this
-- repository will do: pay for an install from a public store listing, or pay
-- for a review left on one. That is the OnTopRank model, it is an incentivised
-- install and an incentivised review under Google Play's Ratings, Reviews and
-- Installs policy and App Store Review guideline 1.1.6 / 3.1, and it is
-- independently unlawful under the FTC's Rule on Consumer Reviews and
-- Testimonials (16 CFR Part 465) and the EU Omnibus Directive. Adding a
-- screenshot step does not change it — a screenshot of a store page is proof
-- that the store action happened, which is the thing that must not be paid for.
-- Invariant 1 in CLAUDE.md stands, and the schema still holds no column that
-- could represent a public review, a public rating or a production install.
-- ============================================================================

/* ------------------------------------------------- 1. the RPC takes a live app */

create or replace function start_activity(p_app uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_app record;
  v_cost integer;
  v_balance integer;
  v_taken integer;
  v_id uuid;
begin
  if v_me is null then raise exception 'not signed in'; end if;

  if not coalesce(
       (select enabled from feature_flags where key = 'activities'), true) then
    return jsonb_build_object('ok', false, 'error', 'activities_closed');
  end if;

  if exists (select 1 from profiles where id = v_me and is_banned) then
    raise exception 'account suspended';
  end if;

  select a.id, a.owner_id, a.status, a.platform, a.credits_paused,
         a.accepting_activities, a.activity_target, a.opt_in_url, a.google_group
    into v_app
    from apps a where a.id = p_app for update;

  if v_app.id is null then return jsonb_build_object('ok', false, 'error', 'unknown_app'); end if;
  if v_app.owner_id = v_me then return jsonb_build_object('ok', false, 'error', 'your_own_app'); end if;
  if v_app.platform <> 'android' then return jsonb_build_object('ok', false, 'error', 'listing_only'); end if;

  -- 'graduated' is the change. A shipped app has no production-access gate left
  -- to clear, which is why it takes no pod seat — but it still has users, bugs
  -- and a developer who wants to hear about both.
  if v_app.status not in ('queued', 'in_pod', 'graduated') then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;
  if not v_app.accepting_activities then
    return jsonb_build_object('ok', false, 'error', 'not_accepting');
  end if;
  if v_app.credits_paused then
    return jsonb_build_object('ok', false, 'error', 'owner_out_of_credits');
  end if;

  -- LOAD-BEARING, and more so now than before this migration.
  --
  -- For a queued app this only checked that there was somewhere to send the
  -- tester. For a live app it is the entire boundary of the product: without
  -- it, "test this app" on a published listing means "go to the store page",
  -- and the install we pay for becomes a public store install. The closed track
  -- is the thing being joined, and an app that has not got one cannot be taken.
  if v_app.opt_in_url is null and v_app.google_group is null then
    return jsonb_build_object('ok', false, 'error', 'no_opt_in_route');
  end if;

  if exists (select 1 from assignments s where s.app_id = p_app and s.tester_id = v_me) then
    return jsonb_build_object('ok', false, 'error', 'already_testing');
  end if;

  select count(*) into v_taken
    from assignments s
   where s.app_id = p_app and s.pod_id is null
     and s.status not in ('dropped', 'removed');

  if v_taken >= v_app.activity_target then
    return jsonb_build_object('ok', false, 'error', 'no_seats');
  end if;

  v_cost := cfg('install_charge') + cfg('review_charge');
  select credits into v_balance from profiles where id = v_app.owner_id for update;

  if coalesce(v_balance, 0) < v_cost then
    update apps set credits_paused = true where id = p_app and not credits_paused;
    insert into notifications (user_id, kind, payload, dedupe_key)
    values (v_app.owner_id, 'credits_exhausted',
            jsonb_build_object('app_id', p_app, 'short_by', v_cost - coalesce(v_balance, 0)),
            'credits_exhausted:' || p_app)
    on conflict do nothing;
    return jsonb_build_object('ok', false, 'error', 'owner_out_of_credits');
  end if;

  insert into assignments (pod_id, app_id, tester_id, credits_escrowed, status)
  values (null, p_app, v_me, cfg('opt_in_verified'), 'opt_in_pending')
  returning id into v_id;

  insert into notifications (user_id, kind, payload, dedupe_key)
  values (v_app.owner_id, 'tester_joined',
          jsonb_build_object('app_id', p_app, 'assignment_id', v_id),
          'activity_joined:' || v_id)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'assignment_id', v_id,
                            'reward', cfg('opt_in_verified') + cfg('feedback_approved'));
end $$;

revoke execute on function start_activity(uuid) from anon, public;
grant  execute on function start_activity(uuid) to authenticated;

/* ------------------------------------------- 2. the projection agrees with it */

-- `activity_open` mirrors `start_activity` condition for condition, so the two
-- have to move together or the button and the RPC disagree. Only the status
-- list changes; everything else is `20260814181000_market_activities.sql`
-- unaltered, restated because a SQL function body cannot be patched in place.
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
  activity_open       boolean,
  activity_seats_left int,
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
    -- Unchanged: a public store URL only exists once the app is out of closed
    -- testing. It is a link to look at, never a step in the job — nothing in
    -- this product pays for anything that happens on the other side of it.
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
      -- A shipped app keeps taking testers. It has no gate left to clear and
      -- therefore no pod seat, but it still has bugs and a developer who wants
      -- to hear about them.
      and a.status in ('queued', 'in_pod', 'graduated')
      and a.accepting_activities
      and not a.credits_paused
      and a.owner_id <> auth.uid()
      -- The closed track is the thing joined, on a live app as much as on a
      -- queued one. No track, no job.
      and (a.opt_in_url is not null or a.google_group is not null)
      and mine.assignment_id is null
      and act.taken < a.activity_target
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
          or (p_scope = 'open'    and r.activity_open)
          -- Live games open to testers: the shipped half of the marketplace,
          -- which had no way to be browsed because "Shipped" meant "finished".
          or (p_scope = 'live'    and r.status = 'graduated' and r.activity_open))
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

/* ------------------------------------------------------------ the live count */

create or replace function market_counts()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'open',    coalesce((select m.total_count from market_apps('open',    null, null, null, null, 'newest', 1, 0) m), 0),
    'live',    coalesce((select m.total_count from market_apps('live',    null, null, null, null, 'newest', 1, 0) m), 0),
    'testing', coalesce((select m.total_count from market_apps('testing', null, null, null, null, 'newest', 1, 0) m), 0),
    'due',     coalesce((select m.total_count from market_apps('due',     null, null, null, null, 'newest', 1, 0) m), 0),
    'mine',    coalesce((select m.total_count from market_apps('mine',    null, null, null, null, 'newest', 1, 0) m), 0),
    'saved',   coalesce((select m.total_count from market_apps('saved',   null, null, null, null, 'newest', 1, 0) m), 0)
  );
$$;

revoke execute on function market_counts() from anon, public;
grant  execute on function market_counts() to authenticated;
