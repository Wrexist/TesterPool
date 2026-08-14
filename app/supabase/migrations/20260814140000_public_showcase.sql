-- ============================================================================
-- PUBLIC SHOWCASE
--
-- One `anon`-callable projection behind the public `/pool` page, so a stranger
-- can see what is in the network before deciding whether to join it.
--
-- Why this exists at all: `market_pulse` already computes the right numbers and
-- is granted only to `authenticated`, which means the marketing site — the one
-- surface where "is anyone actually here" decides whether someone signs up —
-- is the one surface that cannot ask. The alternative on the landing page was
-- hardcoded figures, and inventing traffic numbers on a page whose entire pitch
-- is that we are the honest option costs the argument.
--
-- What it is allowed to hand an anonymous caller, and nothing else:
--
--   name, tagline, category, platform, icon_url, created_at
--
-- Specifically absent, each for the reason `market_apps` gives at length:
--
--  * `package_name`, `opt_in_url`, `google_group`, `tester_instructions`. For an
--    Android app in closed testing the package name IS the way into the track
--    (play.google.com/apps/testing/<pkg>), and the way in is granted by a pod,
--    not by a directory — least of all a directory that needs no account.
--
--  * Any score, any average, any aggregate over `feedback`. A number rendered
--    beside an app name in a public directory is a rating board, which is the
--    one shape this schema is built to be incapable of representing.
--
--  * The app's `id`. Nothing an anonymous visitor can reach takes one, so
--    handing one over would only create an enumeration surface for a detail
--    page that requires authentication anyway.
--
--  * Owner identity of any kind. A public list of who is shipping what, keyed
--    to a handle, is a different product with different consent attached.
--
-- The four counts are network-wide and un-personalised, exactly as in
-- `market_pulse`: no names, no app titles, nothing about who tested what.
-- ============================================================================

/* --------------------------------------------------------- the opt-out */

-- Defaults to true, because an invisible marketplace recruits nobody and a name
-- plus a tagline leaks nothing that gets anyone into a closed track. It is a
-- column rather than a policy decision baked into the RPC because some people
-- genuinely are building in stealth, and "my app's name is not public yet" is a
-- reasonable thing to want without also having to stay out of the pool.
alter table apps
  add column if not exists public_preview boolean not null default true;

comment on column apps.public_preview is
  'Owner opt-out from the anonymous /pool showcase. Never affects the '
  'authenticated marketplace, which is gated by membership rather than by this.';

-- The showcase filters on it alongside status, so the two travel together.
create index if not exists apps_showcase_idx
  on apps (status, created_at desc)
  where public_preview;

/* ----------------------------------------------------------- the reader */

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
    -- How much work is available right now. The one figure a browsing developer
    -- acts on, and the only one here that is not a 24-hour window.
    'open_apps', (select count(*) from listable),

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

    -- Not a 24-hour number and labelled as such in the UI. It is an outcome
    -- claim, which is exactly why it has to be counted rather than asserted.
    'graduated', (select count(*) from apps where status = 'graduated'),

    'apps', coalesce(
      (
        select jsonb_agg(to_jsonb(x) order by x.created_at desc)
          from (
            select * from listable
             order by created_at desc
             -- Clamped, because `p_limit` arrives from an anonymous caller and
             -- an unbounded one turns a showcase into a bulk export.
             limit least(greatest(coalesce(p_limit, 12), 1), 24)
          ) x
      ),
      '[]'::jsonb
    )
  );
$$;

-- Supabase exposes every `public` function over REST, so the grant is the whole
-- access control. Both roles need it: the page is public, and a signed-in
-- visitor still renders it server-side before being redirected to /market.
revoke execute on function market_showcase(int) from anon, authenticated, public;
grant  execute on function market_showcase(int) to anon, authenticated;

comment on function market_showcase(int) is
  'Anonymous-safe projection of the pool for the public /pool page. Returns '
  'four network-wide counts and a clamped list of open apps carrying no '
  'track-entry field, no owner identity, no id, and no score.';
