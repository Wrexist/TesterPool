-- ============================================================================
-- MEMBER COUNT ON THE PUBLIC SHOWCASE
--
-- `/pool` had nothing to say on the day the network is new: an empty grid and a
-- row of zeroes, which reads as "abandoned" rather than "not started". The
-- honest alternative to inventing listings is to show the one number that is
-- both true and rising — how many developers have joined so far, against the
-- size of the first group.
--
-- A count against a target converts better than a catalogue anyway, because it
-- gives a reason to act now rather than browse. It just has to be real.
--
-- Deliberately a plain count of people, not "active" anything: any adjective
-- here would need defending, and the number is doing enough work as it is.
-- Banned profiles are excluded for the same reason `market_showcase` excludes
-- their apps.
-- ============================================================================

create or replace function market_showcase(p_limit int default 12)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with listable as (
    select a.name, a.tagline, a.category, a.platform::text as platform,
           a.icon_url, a.created_at
      from apps a
      join profiles p on p.id = a.owner_id
     where a.public_preview
       and not p.is_banned
       and not a.credits_paused
       and a.status in ('queued', 'in_pod')
  )
  select jsonb_build_object(
    'open_apps', (select count(*) from listable),

    -- New. Everyone who has signed up and not been banned.
    'members', (select count(*) from profiles where not is_banned),

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

    'reviews', (
      select count(*) from feedback
       where status in ('approved', 'arbitrated')
         and reviewed_at > now() - interval '24 hours'
    ),

    'graduated', (select count(*) from apps where status = 'graduated'),

    'apps', coalesce(
      (
        select jsonb_agg(to_jsonb(x) order by x.created_at desc)
          from (
            select * from listable
             order by created_at desc
             limit least(greatest(coalesce(p_limit, 12), 1), 24)
          ) x
      ),
      '[]'::jsonb
    )
  );
$$;

-- `create or replace` keeps the existing grants, but state them anyway so a
-- future drop-and-recreate does not silently reopen the function to `public`.
revoke execute on function market_showcase(int) from anon, authenticated, public;
grant  execute on function market_showcase(int) to anon, authenticated;
