-- ============================================================================
-- AUTOMATION
--
-- Everything time-sensitive in this product happens whether or not anyone is
-- looking at a screen: clocks advance, testers go quiet, pods fill, escrow
-- comes due. pg_cron runs it all inside Postgres at no cost.
--
-- Job functions are deliberately separate from the user-facing RPCs because
-- auth.uid() is NULL in a cron session — anything calling it would throw.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Outbox. Jobs enqueue; a sender drains. Keeping them separate means a mail
-- provider outage delays delivery instead of losing the event.
-- ---------------------------------------------------------------------------
create type notification_kind as enum (
  'checkin_due', 'streak_at_risk', 'streak_broken', 'pod_started', 'pod_filling',
  'pod_completed', 'seat_at_risk', 'rescue_needed', 'feedback_due',
  'feedback_reviewed', 'dispute_opened', 'greenlit'
);

create table notifications (
  id          bigserial primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        notification_kind not null,
  payload     jsonb not null default '{}'::jsonb,
  dedupe_key  text,
  send_after  timestamptz not null default now(),
  sent_at     timestamptz,
  failed_at   timestamptz,
  error       text,
  attempts    smallint not null default 0,
  created_at  timestamptz not null default now()
);
-- One notification per user per kind per day, enforced by the database rather
-- than by hoping the job is not run twice.
create unique index notifications_dedupe on notifications (dedupe_key) where dedupe_key is not null;
create index notifications_pending on notifications (send_after) where sent_at is null and failed_at is null;
create index notifications_user_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;
create policy "notifications own" on notifications for select to authenticated
  using (user_id = (select auth.uid()) or is_admin());

-- System health, so the admin dashboard can show whether the machine is running.
create table job_runs (
  id         bigserial primary key,
  job        text not null,
  ok         boolean not null default true,
  detail     jsonb,
  ran_at     timestamptz not null default now(),
  duration_ms integer
);
create index job_runs_job_idx on job_runs (job, ran_at desc);
alter table job_runs enable row level security;
create policy "job runs admin" on job_runs for select to authenticated using (is_admin());

create or replace function _log_job(p_job text, p_ok boolean, p_detail jsonb, p_started timestamptz)
returns void language sql security definer set search_path = public, extensions as $$
  insert into job_runs (job, ok, detail, duration_ms)
  values (p_job, p_ok, p_detail, (extract(epoch from (clock_timestamp() - p_started)) * 1000)::int)
$$;

-- ---------------------------------------------------------------------------
-- Job 1 — pod lifecycle. Hourly.
-- Starts full pods, closes finished ones, releases escrow, awards badges.
-- ---------------------------------------------------------------------------
create or replace function job_pod_lifecycle() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_started timestamptz := clock_timestamp();
  r record; v_started_count int := 0; v_completed int := 0; v_escrow int := 0;
begin
  -- Start any forming pod whose seats are full.
  for r in
    select p.id from pods p
     where p.status = 'forming'
       and (select count(*) from pod_members m where m.pod_id = p.id and m.status <> 'removed') >= p.core_seats
  loop
    insert into assignments (pod_id, app_id, tester_id, credits_escrowed)
    select r.id, o.app_id, t.user_id, cfg('opt_in_verified')
      from pod_members o
      join pod_members t on t.pod_id = o.pod_id and t.user_id <> o.user_id
     where o.pod_id = r.id and o.app_id is not null
       and o.status <> 'removed' and t.status <> 'removed'
    on conflict (pod_id, app_id, tester_id) do nothing;

    update pods set status = 'active', locked_at = now(), starts_at = now(),
           ends_at = now() + (duration_days || ' days')::interval where id = r.id;
    update pod_members set status = 'active' where pod_id = r.id and status = 'joined';
    update apps set status = 'in_pod'
     where id in (select app_id from pod_members where pod_id = r.id and app_id is not null);

    insert into notifications (user_id, kind, payload, dedupe_key)
    select m.user_id, 'pod_started', jsonb_build_object('pod_id', r.id),
           'pod_started:' || r.id || ':' || m.user_id
      from pod_members m where m.pod_id = r.id and m.status = 'active'
    on conflict do nothing;

    v_started_count := v_started_count + 1;
  end loop;

  -- Close pods past their end date and release escrow to testers who stayed.
  for r in select id from pods where status = 'active' and ends_at <= now() loop
    update pods set status = 'completed', completed_at = now() where id = r.id;

    -- Escrowed opt-in credits are only paid to people who actually finished.
    perform award_credits(a.tester_id, a.credits_escrowed, 'opt_in_verified',
                          'assignment', a.id, 'Escrow released on pod completion')
       from assignments a
      where a.pod_id = r.id and a.credits_paid = 0
        and a.credits_escrowed > 0 and a.days_checked_in >= 12;
    update assignments set credits_paid = credits_escrowed
     where pod_id = r.id and credits_escrowed > 0 and days_checked_in >= 12 and credits_paid = 0;
    get diagnostics v_escrow = row_count;

    update pod_members set status = 'graduated' where pod_id = r.id and status = 'active';
    update profiles set pods_completed = pods_completed + 1
     where id in (select user_id from pod_members where pod_id = r.id and status = 'graduated');

    insert into user_badges (user_id, badge_key)
    select user_id, 'first_pod' from pod_members where pod_id = r.id and status = 'graduated'
    on conflict do nothing;
    insert into user_badges (user_id, badge_key)
    select tester_id, 'perfect_14' from assignments where pod_id = r.id and days_checked_in >= 14
    on conflict do nothing;

    insert into notifications (user_id, kind, payload, dedupe_key)
    select m.user_id, 'pod_completed', jsonb_build_object('pod_id', r.id),
           'pod_completed:' || r.id || ':' || m.user_id
      from pod_members m where m.pod_id = r.id
    on conflict do nothing;

    v_completed := v_completed + 1;
  end loop;

  perform recompute_reliability(id) from profiles where not is_banned;

  perform _log_job('pod_lifecycle', true,
    jsonb_build_object('started', v_started_count, 'completed', v_completed, 'escrow_released', v_escrow),
    v_started);
  return jsonb_build_object('started', v_started_count, 'completed', v_completed);
end $$;

-- ---------------------------------------------------------------------------
-- Job 2 — the clock watchdog. Every 6 hours.
-- Nobody should ever discover a broken streak from a rejection email.
-- ---------------------------------------------------------------------------
create or replace function job_clock_watch() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_started timestamptz := clock_timestamp();
  v_today date := (now() at time zone 'utc')::date;
  v_due int := 0; v_risk int := 0; v_dropped int := 0;
begin
  -- Check-in due today, not yet done.
  insert into notifications (user_id, kind, payload, dedupe_key)
  select a.tester_id, 'checkin_due',
         jsonb_build_object('assignment_id', a.id, 'app_id', a.app_id,
                            'day', (v_today - (p.starts_at at time zone 'utc')::date) + 1),
         'checkin_due:' || a.id || ':' || v_today
    from assignments a join pods p on p.id = a.pod_id
   where a.status = 'active' and p.status = 'active'
     and (a.last_checkin_on is null or a.last_checkin_on < v_today)
  on conflict do nothing;
  get diagnostics v_due = row_count;

  -- Two consecutive misses: warn the tester and the app owner, before it matters.
  insert into notifications (user_id, kind, payload, dedupe_key)
  select a.tester_id, 'streak_at_risk',
         jsonb_build_object('assignment_id', a.id, 'missed', v_today - a.last_checkin_on),
         'streak_at_risk:' || a.id || ':' || v_today
    from assignments a
   where a.status = 'active' and a.last_checkin_on is not null
     and v_today - a.last_checkin_on between 2 and 3
  on conflict do nothing;
  get diagnostics v_risk = row_count;

  insert into notifications (user_id, kind, payload, dedupe_key)
  select ap.owner_id, 'seat_at_risk',
         jsonb_build_object('app_id', ap.id, 'tester_id', a.tester_id,
                            'missed', v_today - a.last_checkin_on),
         'seat_at_risk:' || a.id || ':' || v_today
    from assignments a join apps ap on ap.id = a.app_id
   where a.status = 'active' and a.last_checkin_on is not null
     and v_today - a.last_checkin_on >= 2
  on conflict do nothing;

  -- Four consecutive misses is a dropout. It costs the pod, so it costs them.
  with gone as (
    update assignments a set status = 'dropped', streak_broken = true
     where a.status = 'active' and a.last_checkin_on is not null
       and v_today - a.last_checkin_on >= 4
    returning a.id, a.tester_id, a.app_id
  )
  insert into notifications (user_id, kind, payload, dedupe_key)
  select ap.owner_id, 'rescue_needed',
         jsonb_build_object('app_id', g.app_id, 'tester_id', g.tester_id),
         'rescue_needed:' || g.id
    from gone g join apps ap on ap.id = g.app_id
  on conflict do nothing;
  get diagnostics v_dropped = row_count;

  -- Feedback is due from day 7; ask once.
  insert into notifications (user_id, kind, payload, dedupe_key)
  select a.tester_id, 'feedback_due', jsonb_build_object('assignment_id', a.id),
         'feedback_due:' || a.id
    from assignments a join pods p on p.id = a.pod_id
   where a.status = 'active' and a.days_checked_in >= 7
     and not exists (select 1 from feedback f where f.assignment_id = a.id)
  on conflict do nothing;

  perform _log_job('clock_watch', true,
    jsonb_build_object('checkin_due', v_due, 'at_risk', v_risk, 'dropped', v_dropped), v_started);
  return jsonb_build_object('checkin_due', v_due, 'at_risk', v_risk, 'dropped', v_dropped);
end $$;

-- ---------------------------------------------------------------------------
-- Job 3 — nightly maintenance and self-audit.
-- ---------------------------------------------------------------------------
create or replace function job_nightly() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_started timestamptz := clock_timestamp(); v_drift int; v_pruned int;
begin
  select count(*) into v_drift from ledger_drift();

  -- Sent notifications older than 30 days have served their purpose.
  delete from notifications where sent_at is not null and sent_at < now() - interval '30 days';
  get diagnostics v_pruned = row_count;

  delete from job_runs where ran_at < now() - interval '90 days';

  update profiles p set apps_helped_ship = (
    select count(distinct a.app_id) from assignments a
     join apps ap on ap.id = a.app_id
    where a.tester_id = p.id and ap.status = 'graduated')
   where not p.is_banned;

  analyze;

  perform _log_job('nightly', v_drift = 0,
    jsonb_build_object('ledger_drift_users', v_drift, 'notifications_pruned', v_pruned), v_started);
  return jsonb_build_object('ledger_drift_users', v_drift, 'pruned', v_pruned);
end $$;

revoke execute on function job_pod_lifecycle(), job_clock_watch(), job_nightly(),
  _log_job(text,boolean,jsonb,timestamptz) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Schedule. All times UTC.
-- ---------------------------------------------------------------------------
select cron.schedule('pod-lifecycle', '7 * * * *',    $$select job_pod_lifecycle()$$);
select cron.schedule('clock-watch',   '0 */6 * * *',  $$select job_clock_watch()$$);
select cron.schedule('nightly',       '20 2 * * *',   $$select job_nightly()$$);

select jobname, schedule, active from cron.job order by jobname;