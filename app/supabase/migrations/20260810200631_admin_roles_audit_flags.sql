-- ============================================================================
-- TESTERPOOL — admin layer
--
-- Design rules:
--  * Every privileged action goes through a SECURITY DEFINER RPC that checks
--    is_admin() itself. The UI is never the authorisation boundary.
--  * admin_actions is append-only: there is no update or delete policy and no
--    grant that would allow one. An admin cannot erase their own tracks.
--  * profiles.is_moderator is kept in sync from profiles.role by trigger, so
--    existing is_mod() checks and the /mod page keep working unchanged.
-- ============================================================================

create type user_role as enum ('user', 'moderator', 'admin');

alter table profiles add column role user_role not null default 'user';
update profiles set role = 'moderator' where is_moderator;

-- Keep the legacy boolean true for moderators AND admins.
create or replace function sync_moderator_flag()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.is_moderator := new.role in ('moderator', 'admin');
  return new;
end $$;

create trigger profiles_sync_moderator
  before insert or update of role on profiles
  for each row execute function sync_moderator_flag();

update profiles set role = role;  -- fire the trigger once to normalise

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as
$$ select coalesce((select role = 'admin' from profiles where id = auth.uid()), false) $$;
revoke execute on function is_admin() from anon, public;
grant  execute on function is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Audit log — append only, forever.
-- ---------------------------------------------------------------------------
create table admin_actions (
  id          bigserial primary key,
  actor_id    uuid not null references profiles(id) on delete restrict,
  action      text not null,
  target_type text,
  target_id   uuid,
  before      jsonb,
  after       jsonb,
  reason      text,
  created_at  timestamptz not null default now()
);
create index on admin_actions (created_at desc);
create index on admin_actions (actor_id, created_at desc);
create index on admin_actions (target_type, target_id);

alter table admin_actions enable row level security;
create policy "audit readable by admins" on admin_actions for select using (is_admin());
-- Deliberately no insert/update/delete policy. Rows arrive only via the
-- SECURITY DEFINER functions below, which run as the table owner.

create or replace function _audit(
  p_action text, p_target_type text, p_target_id uuid,
  p_before jsonb, p_after jsonb, p_reason text
) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into admin_actions (actor_id, action, target_type, target_id, before, after, reason)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_before, p_after, p_reason);
end $$;
revoke execute on function _audit(text,text,uuid,jsonb,jsonb,text) from anon, authenticated, public;

create or replace function _require_admin() returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
end $$;
revoke execute on function _require_admin() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Feature flags + announcements — change app behaviour without a deploy.
-- ---------------------------------------------------------------------------
create table feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text not null default '',
  updated_at  timestamptz not null default now()
);
alter table feature_flags enable row level security;
create policy "flags readable" on feature_flags for select using (true);

insert into feature_flags (key, enabled, description) values
  ('signups_open',        true,  'Allow new account creation.'),
  ('pod_matching',        true,  'Allow apps to join or start pods. Kill switch for the core loop.'),
  ('checkins_open',       true,  'Allow daily check-ins. Turning this off freezes every clock.'),
  ('paid_tiers',          false, 'Show paid plans and accept payment.'),
  ('apple_login',         true,  'Show the Sign in with Apple button.'),
  ('github_login',        true,  'Show the GitHub login button.'),
  ('auto_approve_proofs', true,  'Let high-confidence vision triage approve proofs without a human.')
on conflict (key) do nothing;

create table announcements (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  tone       text not null default 'info' check (tone in ('info','warning','critical')),
  active     boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table announcements enable row level security;
create policy "announcements readable" on announcements for select using (active);
create policy "announcements admin" on announcements for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Admin actions
-- ---------------------------------------------------------------------------
create or replace function admin_adjust_credits(p_user uuid, p_delta integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_before int; v_after int;
begin
  perform _require_admin();
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'a reason of at least 5 characters is required';
  end if;
  select credits into v_before from profiles where id = p_user;
  if v_before is null then raise exception 'no such user'; end if;

  v_after := award_credits(p_user, p_delta, 'admin_adjust', 'admin', p_user, p_reason);
  perform _audit('adjust_credits', 'profile', p_user,
                 jsonb_build_object('credits', v_before),
                 jsonb_build_object('credits', v_after), p_reason);
  return jsonb_build_object('ok', true, 'before', v_before, 'after', v_after);
end $$;

create or replace function admin_set_role(p_user uuid, p_role user_role, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_before user_role;
begin
  perform _require_admin();
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'you cannot demote yourself';   -- prevents locking everyone out
  end if;
  select role into v_before from profiles where id = p_user;
  if v_before is null then raise exception 'no such user'; end if;

  update profiles set role = p_role, updated_at = now() where id = p_user;
  perform _audit('set_role', 'profile', p_user,
                 jsonb_build_object('role', v_before),
                 jsonb_build_object('role', p_role), p_reason);
  return jsonb_build_object('ok', true, 'role', p_role);
end $$;

create or replace function admin_set_ban(p_user uuid, p_banned boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_before boolean;
begin
  perform _require_admin();
  if p_user = auth.uid() then raise exception 'you cannot ban yourself'; end if;
  if p_banned and (p_reason is null or length(trim(p_reason)) < 5) then
    raise exception 'a reason of at least 5 characters is required to ban';
  end if;
  select is_banned into v_before from profiles where id = p_user;
  if v_before is null then raise exception 'no such user'; end if;

  update profiles set is_banned = p_banned, ban_reason = case when p_banned then p_reason end,
         updated_at = now() where id = p_user;
  -- A banned user must not keep holding other people's clocks hostage.
  if p_banned then
    update pod_members set status = 'removed' where user_id = p_user and status in ('joined','active');
    update assignments  set status = 'dropped' where tester_id = p_user and status in ('opt_in_pending','active');
  end if;
  perform _audit(case when p_banned then 'ban' else 'unban' end, 'profile', p_user,
                 jsonb_build_object('is_banned', v_before),
                 jsonb_build_object('is_banned', p_banned), p_reason);
  return jsonb_build_object('ok', true, 'banned', p_banned);
end $$;

create or replace function admin_set_config(p_key text, p_value integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_before int;
begin
  perform _require_admin();
  select value into v_before from economy_config where key = p_key;
  if v_before is null then raise exception 'unknown config key %', p_key; end if;
  if p_value < 0 then raise exception 'value must not be negative'; end if;

  update economy_config set value = p_value where key = p_key;
  perform _audit('set_config', 'economy_config', null,
                 jsonb_build_object('key', p_key, 'value', v_before),
                 jsonb_build_object('key', p_key, 'value', p_value), p_reason);
  return jsonb_build_object('ok', true, 'key', p_key, 'before', v_before, 'after', p_value);
end $$;

create or replace function admin_set_flag(p_key text, p_enabled boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_before boolean;
begin
  perform _require_admin();
  select enabled into v_before from feature_flags where key = p_key;
  if v_before is null then raise exception 'unknown flag %', p_key; end if;

  update feature_flags set enabled = p_enabled, updated_at = now() where key = p_key;
  perform _audit('set_flag', 'feature_flag', null,
                 jsonb_build_object('key', p_key, 'enabled', v_before),
                 jsonb_build_object('key', p_key, 'enabled', p_enabled), p_reason);
  return jsonb_build_object('ok', true, 'key', p_key, 'enabled', p_enabled);
end $$;

create or replace function admin_pod_action(p_pod uuid, p_action text, p_days integer default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_before jsonb; v_res jsonb;
begin
  perform _require_admin();
  select to_jsonb(p) - 'created_at' into v_before from pods p where id = p_pod;
  if v_before is null then raise exception 'no such pod'; end if;

  if p_action = 'force_start' then
    -- Bypasses start_pod's membership check; admins start pods they are not in.
    insert into assignments (pod_id, app_id, tester_id, credits_escrowed)
    select p_pod, o.app_id, t.user_id, cfg('opt_in_verified')
      from pod_members o
      join pod_members t on t.pod_id = o.pod_id and t.user_id <> o.user_id
     where o.pod_id = p_pod and o.app_id is not null
       and o.status <> 'removed' and t.status <> 'removed'
    on conflict (pod_id, app_id, tester_id) do nothing;

    update pods set status = 'active', locked_at = now(), starts_at = now(),
           ends_at = now() + (duration_days || ' days')::interval where id = p_pod;
    update pod_members set status = 'active' where pod_id = p_pod and status = 'joined';
    update apps set status = 'in_pod'
     where id in (select app_id from pod_members where pod_id = p_pod and app_id is not null);

  elsif p_action = 'extend' then
    if coalesce(p_days, 0) <= 0 then raise exception 'days must be positive'; end if;
    update pods set duration_days = duration_days + p_days,
           ends_at = ends_at + (p_days || ' days')::interval where id = p_pod;

  elsif p_action = 'complete' then
    update pods set status = 'completed', completed_at = now() where id = p_pod;
    update pod_members set status = 'graduated' where pod_id = p_pod and status = 'active';
    update profiles set pods_completed = pods_completed + 1
     where id in (select user_id from pod_members where pod_id = p_pod and status = 'graduated');

  elsif p_action = 'cancel' then
    update pods set status = 'failed', completed_at = now() where id = p_pod;
    update apps set status = 'queued'
     where id in (select app_id from pod_members where pod_id = p_pod and app_id is not null);

  else
    raise exception 'unknown action %', p_action;
  end if;

  select to_jsonb(p) - 'created_at' into v_res from pods p where id = p_pod;
  perform _audit('pod_' || p_action, 'pod', p_pod, v_before, v_res, p_reason);
  return jsonb_build_object('ok', true, 'action', p_action);
end $$;

create or replace function admin_review_proof(p_proof uuid, p_approve boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_assignment uuid; v_kind proof_kind;
begin
  perform _require_admin();
  select assignment_id, kind into v_assignment, v_kind from proofs where id = p_proof;
  if not found then raise exception 'no such proof'; end if;

  update proofs set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(),
         reject_reason = case when p_approve then null else p_reason end
   where id = p_proof;

  if p_approve and v_kind = 'opt_in' and v_assignment is not null then
    update assignments set opt_in_verified_at = coalesce(opt_in_verified_at, now()),
           status = 'active' where id = v_assignment;
  end if;

  perform _audit(case when p_approve then 'proof_approve' else 'proof_reject' end,
                 'proof', p_proof, null, null, p_reason);
  return jsonb_build_object('ok', true, 'approved', p_approve);
end $$;

-- ---------------------------------------------------------------------------
-- Metrics
-- ---------------------------------------------------------------------------
create or replace view admin_overview with (security_invoker = on) as
select
  (select count(*) from profiles where not is_banned)                      as users,
  (select count(*) from profiles where created_at > now() - interval '7 days') as users_7d,
  (select count(*) from profiles where is_banned)                          as banned,
  (select count(*) from apps)                                              as apps,
  (select count(*) from apps where status = 'graduated')                   as apps_graduated,
  (select count(*) from pods where status = 'forming')                     as pods_forming,
  (select count(*) from pods where status = 'active')                      as pods_active,
  (select count(*) from assignments where status = 'active')               as assignments_active,
  (select count(*) from assignments where status = 'dropped')              as assignments_dropped,
  (select coalesce(round(avg(days_checked_in), 2), 0) from assignments)    as avg_days,
  (select count(*) from checkins where checkin_date = (now() at time zone 'utc')::date) as checkins_today,
  (select count(*) from proofs where status = 'pending')                   as proofs_pending,
  (select count(*) from disputes where status = 'open')                    as disputes_open,
  (select count(*) from feedback where status = 'submitted')               as feedback_unreviewed,
  (select coalesce(sum(credits), 0) from profiles)                         as credits_outstanding,
  (select coalesce(sum(delta) filter (where delta > 0), 0) from credit_ledger) as credits_minted,
  (select coalesce(-sum(delta) filter (where delta < 0), 0) from credit_ledger) as credits_burned;

-- Pods that need a human before someone's clock breaks.
create or replace view admin_pod_watch with (security_invoker = on) as
select p.id, p.code, p.name, p.status, p.core_seats, p.required_testers,
       p.starts_at, p.ends_at,
       greatest(0, ((now() at time zone 'utc')::date - (p.starts_at at time zone 'utc')::date) + 1) as day_index,
       (select count(*) from pod_members m where m.pod_id = p.id and m.status <> 'removed') as members,
       (select count(*) from pod_members m where m.pod_id = p.id and m.status = 'dropped')  as dropouts,
       (select count(*) from assignments a where a.pod_id = p.id and a.status = 'active')   as active_assignments,
       (select coalesce(round(avg(a.days_checked_in), 1), 0) from assignments a where a.pod_id = p.id) as avg_days,
       (select count(distinct a.app_id) from assignments a
         where a.pod_id = p.id and a.days_checked_in >= 12) as apps_on_track
  from pods p;

create or replace view admin_user_rows with (security_invoker = on) as
select pr.id, pr.handle, pr.display_name, pr.avatar_url, pr.country_code, pr.tester_email,
       pr.role, pr.is_banned, pr.ban_reason, pr.credits, pr.reliability, pr.tier,
       pr.pods_completed, pr.pods_dropped, pr.current_streak, pr.created_at, pr.referred_by,
       (select count(*) from apps a where a.owner_id = pr.id)                             as apps,
       (select count(*) from assignments a where a.tester_id = pr.id and a.status = 'active') as active_tests,
       (select count(*) from feedback f where f.tester_id = pr.id and f.status = 'rejected')  as rejected_reports,
       (select max(c.created_at) from checkins c
          join assignments a on a.id = c.assignment_id where a.tester_id = pr.id)         as last_checkin_at
  from profiles pr;

-- ---------------------------------------------------------------------------
-- Grants: callable by signed-in users; each function gates on is_admin() itself.
-- ---------------------------------------------------------------------------
revoke execute on function admin_adjust_credits(uuid,integer,text),
  admin_set_role(uuid,user_role,text), admin_set_ban(uuid,boolean,text),
  admin_set_config(text,integer,text), admin_set_flag(text,boolean,text),
  admin_pod_action(uuid,text,integer,text), admin_review_proof(uuid,boolean,text)
  from anon, public;

grant execute on function admin_adjust_credits(uuid,integer,text),
  admin_set_role(uuid,user_role,text), admin_set_ban(uuid,boolean,text),
  admin_set_config(text,integer,text), admin_set_flag(text,boolean,text),
  admin_pod_action(uuid,text,integer,text), admin_review_proof(uuid,boolean,text)
  to authenticated;

-- Admins can read everything the dashboard needs.
create policy "profiles admin write" on profiles for update using (is_admin()) with check (is_admin());
create policy "apps admin read"      on apps        for select using (is_admin());
create policy "ledger admin read"    on credit_ledger for select using (is_admin());
create policy "assignments admin read" on assignments for select using (is_admin());

-- Seed the first admin.
update profiles set role = 'admin' where handle = 'isacm';

select (select role from profiles where handle='isacm') as first_admin,
       (select count(*) from feature_flags) as flags;