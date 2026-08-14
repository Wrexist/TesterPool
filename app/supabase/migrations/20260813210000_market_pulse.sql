-- ============================================================================
-- MARKET PULSE
--
-- Three numbers for the top of the marketplace: testers who did something in
-- the last 24 hours, installs confirmed, reports approved.
--
-- It exists because an empty-looking marketplace is one nobody joins. A
-- developer landing here for the first time has no way to tell whether this
-- network has fifteen members or fifteen hundred, and the honest answer —
-- whatever it is — is better than the silence, because silence reads as zero.
--
-- Deliberately network-wide and deliberately un-personalised: no names, no app
-- titles, nothing that identifies who tested what. Three counts.
-- ============================================================================

create or replace function market_pulse()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    -- Anyone whose opt-in was confirmed or whose report landed in the window.
    'active_testers', (
      select count(distinct t) from (
        select tester_id as t from assignments
         where opt_in_verified_at > now() - interval '24 hours'
        union all
        select tester_id from feedback
         where submitted_at > now() - interval '24 hours'
        union all
        select a.tester_id from checkins c
          join assignments a on a.id = c.assignment_id
         where c.created_at > now() - interval '24 hours'
      ) s
    ),
    'installs', (
      select count(*) from assignments
       where opt_in_verified_at > now() - interval '24 hours'
    ),
    'reports', (
      select count(*) from feedback
       where status in ('approved', 'arbitrated')
         and reviewed_at > now() - interval '24 hours'
    ),
    -- Not a 24h number, and labelled as such in the UI: how much work is
    -- available right now. It is the one figure a browsing tester acts on.
    'open_apps', (
      select count(*) from apps a
        join profiles p on p.id = a.owner_id
       where not p.is_banned
         and not a.credits_paused
         and a.status in ('queued', 'in_pod')
    )
  );
$$;

revoke execute on function market_pulse() from anon, public;
grant  execute on function market_pulse() to authenticated;

/* ------------------------------------------------------ joined, or not yet */

-- The app screen shows the job as three steps, and step one is "are you in the
-- closed track". Nothing in the listing answered that: `report_due` is false
-- both before you join and after you have already reported, which would draw a
-- finished activity as an unstarted one.
--
-- Added to `market_app` rather than to `market_apps` because this RPC returns
-- jsonb — one more key costs nothing, where the listing would need its return
-- type rebuilt for a field only the detail screen reads.
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
    'opt_in_verified',
      coalesce((select s.opt_in_verified_at is not null
                  from assignments s
                 where s.id = one.assignment_id), false),
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
