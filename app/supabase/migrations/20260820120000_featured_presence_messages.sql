-- ============================================================================
-- FEATURED LISTINGS, PRESENCE, AND DEVELOPER MESSAGING.
--
-- Three additions the feed and the app-detail screen need, and nothing else.
--
--   `apps.featured`        a badge on a listing. A badge only: it does NOT
--                          change what an activity pays. Credits move rather
--                          than being minted, so a listing that paid more than
--                          it charged would either break the balance or charge
--                          the publisher extra without asking them.
--   `profiles.last_seen_at` when this member last loaded an authenticated page,
--                          so "Active 9m ago" is a fact rather than a decoration.
--   `messages`             a tester and a publisher, talking about one app.
--
-- Messaging is the one with teeth, so it is worth saying what stops it being a
-- way to reach strangers. A row is only insertable through `send_message`,
-- which requires the sender to be either the app's owner or the holder of an
-- assignment on it, and pins the recipient to the other side of that pair. You
-- cannot message a developer whose app you have not taken, you cannot message a
-- tester who has not taken yours, and you cannot address a third party at all.
-- ============================================================================

/* --------------------------------------------------------------- featured */

alter table apps add column if not exists featured boolean not null default false;

comment on column apps.featured is
  'Editorial badge shown on the listing. Carries no economic weight: the reward '
  'for an activity is computed from economy_config, never from this flag.';

create index if not exists apps_featured_idx on apps (featured) where featured;

-- Which apps wear the badge. `market_apps` is the projection that decides what
-- a browsing member may see, and its return type is long and defined across
-- three migrations; widening it for one boolean would mean reproducing the
-- whole body here and risking drift against what is actually deployed. This is
-- the smaller thing: one definer function, returning the ids and nothing else.
-- Being featured is already public to anyone who scrolls the feed, so this
-- leaks nothing the row itself does not.
create or replace function featured_app_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(array_agg(a.id), '{}'::uuid[])
    from apps a
   where a.featured
     and a.status in ('queued', 'in_pod', 'graduated');
$$;

revoke execute on function featured_app_ids() from anon, public;
grant  execute on function featured_app_ids() to authenticated;

/* --------------------------------------------------------------- presence */

alter table profiles add column if not exists last_seen_at timestamptz;

comment on column profiles.last_seen_at is
  'Last time this member loaded an authenticated page. Written by touch_presence '
  'at a one-minute granularity; only ever about the caller.';

-- Deliberately takes no argument. An id parameter would make this "set anybody
-- seen", and presence is exactly the sort of harmless-looking field that is
-- worth not letting one account write on another's behalf.
--
-- The one-minute floor keeps a page load from writing a row every navigation.
create or replace function touch_presence()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
end;
$$;

revoke execute on function touch_presence() from anon, public;
grant  execute on function touch_presence() to authenticated;

/* --------------------------------------------------------------- messages */

create table if not exists messages (
  id           uuid primary key default extensions.gen_random_uuid(),
  app_id       uuid not null references apps(id) on delete cascade,
  sender_id    uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  body         text not null check (length(btrim(body)) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  constraint messages_not_self check (sender_id <> recipient_id)
);

create index if not exists messages_thread_idx
  on messages (app_id, created_at desc);
create index if not exists messages_unread_idx
  on messages (recipient_id) where read_at is null;

alter table messages enable row level security;

-- Read-only over REST. Every write goes through `send_message`, which is what
-- enforces that the two parties are actually connected by this app; a plain
-- insert policy could only check that you are the sender, which is the half
-- that does not matter.
--
-- The predicate is deliberately about the row's own columns rather than about
-- `apps` or `assignments`. Cross-table RLS is what produced the 42P17
-- recursion this schema has already been bitten by once.
drop policy if exists "messages read own" on messages;
create policy "messages read own" on messages
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "messages moderate" on messages;
create policy "messages moderate" on messages
  for select using (is_mod());

revoke all on messages from anon, authenticated;
grant select on messages to authenticated;

-- Earlier drafts of this pair keyed a thread on the app alone. Postgres treats
-- the added parameter as an overload rather than a replacement, so both would
-- resolve and `send_message(uuid, text)` would stay callable — a second door
-- into the same table with the weaker rule behind it.
drop function if exists send_message(uuid, text);
drop function if exists thread_messages(uuid);

/**
 * Post one message about one app, to the other side of one seat.
 *
 * The counterpart is derived, never supplied by name: a tester writes to the
 * app's owner, and an owner writes to a tester who actually holds a seat on it.
 * `p_tester` only selects WHICH seat when the owner has several, and is still
 * checked against `assignments` — so it can name a tester of this app and
 * nobody else.
 *
 * A thread is therefore per (app, pair) rather than per app. Per app was wrong
 * the moment two testers took the same listing: the owner's reply would have
 * gone to whoever seated most recently, which is the wrong person and a private
 * message delivered to a stranger.
 */
create or replace function send_message(p_app uuid, p_body text, p_tester uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me        uuid := auth.uid();
  v_owner     uuid;
  v_recipient uuid;
  v_seats     int;
  v_body      text := btrim(coalesce(p_body, ''));
  v_row       messages;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if length(v_body) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty');
  end if;
  if length(v_body) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'too_long');
  end if;

  select owner_id into v_owner from apps where id = p_app;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'no_such_app');
  end if;

  if v_owner = v_me then
    if p_tester is not null then
      if not exists (select 1 from assignments a
                      where a.app_id = p_app and a.tester_id = p_tester) then
        return jsonb_build_object('ok', false, 'error', 'not_connected');
      end if;
      v_recipient := p_tester;
    else
      -- No tester named. Unambiguous only when there is exactly one seat;
      -- otherwise refuse rather than guess, because guessing here delivers a
      -- private message to the wrong member.
      select count(distinct tester_id) into v_seats
        from assignments where app_id = p_app;
      if v_seats = 0 then
        return jsonb_build_object('ok', false, 'error', 'no_tester');
      elsif v_seats > 1 then
        return jsonb_build_object('ok', false, 'error', 'pick_tester');
      end if;
      select distinct tester_id into v_recipient
        from assignments where app_id = p_app;
    end if;
  else
    if not exists (select 1 from assignments a
                    where a.app_id = p_app and a.tester_id = v_me) then
      return jsonb_build_object('ok', false, 'error', 'not_connected');
    end if;
    v_recipient := v_owner;
  end if;

  insert into messages (app_id, sender_id, recipient_id, body)
  values (p_app, v_me, v_recipient, v_body)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'message', to_jsonb(v_row));
end;
$$;

revoke execute on function send_message(uuid, text, uuid) from anon, public;
grant  execute on function send_message(uuid, text, uuid) to authenticated;

/**
 * One pair's conversation about one app, oldest first, marked read on the way out.
 *
 * Filtered on the pair rather than on the app, for the reason `send_message`
 * gives: two testers on one listing are two conversations, and showing either
 * of them the other's would be the same leak by a different route.
 */
create or replace function thread_messages(p_app uuid, p_tester uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me    uuid := auth.uid();
  v_owner uuid;
  v_other uuid;
  v_rows  jsonb;
begin
  if v_me is null then
    return '[]'::jsonb;
  end if;

  select owner_id into v_owner from apps where id = p_app;
  if v_owner is null then
    return '[]'::jsonb;
  end if;

  if v_owner = v_me then
    v_other := p_tester;
    if v_other is null then
      select distinct tester_id into v_other
        from assignments where app_id = p_app;
    end if;
    if v_other is null then
      return '[]'::jsonb;
    end if;
  else
    v_other := v_owner;
  end if;

  update messages
     set read_at = now()
   where app_id = p_app
     and recipient_id = v_me
     and sender_id = v_other
     and read_at is null;

  select coalesce(jsonb_agg(t order by t.created_at), '[]'::jsonb) into v_rows
    from (
      select m.id, m.body, m.created_at, m.read_at,
             (m.sender_id = v_me) as mine,
             p.handle       as sender_handle,
             p.display_name as sender_display_name,
             p.avatar_url   as sender_avatar_url
        from messages m
        join profiles p on p.id = m.sender_id
       where m.app_id = p_app
         and ((m.sender_id = v_me    and m.recipient_id = v_other)
           or (m.sender_id = v_other and m.recipient_id = v_me))
    ) t;

  return v_rows;
end;
$$;

revoke execute on function thread_messages(uuid, uuid) from anon, public;
grant  execute on function thread_messages(uuid, uuid) to authenticated;

/** How many messages are waiting, for the envelope in the header. */
create or replace function unread_messages()
returns int
language sql
stable
security definer
set search_path = public, extensions
as $$
  select count(*)::int from messages
   where recipient_id = auth.uid() and read_at is null;
$$;

revoke execute on function unread_messages() from anon, public;
grant  execute on function unread_messages() to authenticated;

/* ------------------------------------- what the detail screen needs to know */

-- `market_app` composes over `market_apps` and returns jsonb, so widening it is
-- additive and needs no drop. The three new keys are the badge, the publisher's
-- presence, and whether this viewer may open a thread at all.
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
    'owner_apps_helped_ship', p.apps_helped_ship,
    'featured', a.featured,
    'owner_last_seen_at', p.last_seen_at,
    -- Mirrors send_message's own rule, so a thread that opens is a thread the
    -- RPC will accept a message into.
    'can_message', (one.relation in ('owner', 'testing', 'tested')),
    'unread', (select count(*) from messages m
                where m.app_id = a.id
                  and m.recipient_id = auth.uid()
                  and m.read_at is null)::int
  )
  from market_apps('all', null, null, null, null, 'newest', 1, 0, p_app) one
  join apps a     on a.id = one.id
  join profiles p on p.id = a.owner_id;
$$;

/** Every conversation this member is part of, newest activity first.

    Grouped by (app, counterpart) rather than by app, for the reason
    `send_message` gives: a publisher with two testers on one listing is holding
    two conversations, and collapsing them into one row would open whichever the
    database happened to return first. */
create or replace function message_threads()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.last_at desc), '[]'::jsonb)
    from (
      select
        g.app_id,
        a.name           as app_name,
        a.icon_url       as app_icon_url,
        a.platform::text as platform,
        g.other_id,
        p.handle         as other_handle,
        p.display_name   as other_display_name,
        p.avatar_url     as other_avatar_url,
        p.last_seen_at   as other_last_seen_at,
        g.last_at,
        g.last_body,
        g.unread
      from (
        select
          m.app_id,
          case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as other_id,
          max(m.created_at) as last_at,
          (array_agg(m.body order by m.created_at desc))[1] as last_body,
          count(*) filter (where m.recipient_id = auth.uid() and m.read_at is null)::int as unread
        from messages m
       where m.sender_id = auth.uid() or m.recipient_id = auth.uid()
       group by m.app_id,
                case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end
      ) g
      join apps a     on a.id = g.app_id
      join profiles p on p.id = g.other_id
    ) t;
$$;

revoke execute on function message_threads() from anon, public;
grant  execute on function message_threads() to authenticated;
