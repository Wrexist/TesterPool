-- ============================================================================
-- OUTBOX DRAIN
--
-- The jobs in 20260810203246 fill `notifications`. This migration gives the
-- sender (edge function `send-notifications`) the only safe way to take work
-- out of it.
--
-- The hazard is duplicate delivery. Two overlapping invocations — a slow run
-- still going when cron fires the next one, or an operator replaying a batch
-- by hand — must never render the same row into two emails. A plain
-- `select ... where sent_at is null` cannot promise that. `for update skip
-- locked` can: the first transaction locks the rows it took, the second walks
-- straight past them instead of blocking, and neither sees the other's work.
--
-- Claiming is also the moment we count an attempt. A row that gets picked up
-- and never comes back (function timeout, runtime crash) has still burned an
-- attempt, so a poisoned payload cannot be retried forever.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Claim a batch.
--
-- Returns the rows already enriched with everything an email needs — address,
-- display name, app name, pod day — so the sender makes one round trip rather
-- than one per row. Renders nothing and decides nothing; that is the sender's
-- job.
--
-- p_quiet_hours is belt and braces. `dedupe_key` already stops the same event
-- being enqueued twice, but a bug upstream that varies the key would slip
-- past it. This refuses to hand over a row whose (user, kind) pair was
-- already delivered inside the window, whatever the key says.
-- ---------------------------------------------------------------------------
create or replace function claim_notifications(
  p_limit        int default 100,
  p_max_attempts int default 5,
  p_quiet_hours  int default 20
)
returns table (
  id           bigint,
  user_id      uuid,
  kind         notification_kind,
  payload      jsonb,
  attempts     smallint,
  send_after   timestamptz,
  created_at   timestamptz,
  email        text,
  display_name text,
  context      jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with cand as (
    select n.id
      from notifications n
     where n.sent_at is null
       and n.failed_at is null
       and n.send_after <= now()
       and n.attempts < p_max_attempts
       and not exists (
         select 1 from notifications q
          where q.user_id = n.user_id
            and q.kind    = n.kind
            and q.id     <> n.id
            and q.sent_at is not null
            and q.sent_at > now() - make_interval(hours => p_quiet_hours)
       )
     order by n.send_after, n.id
     limit greatest(p_limit, 0)
     for update skip locked
  ),
  claimed as (
    update notifications u
       set attempts = u.attempts + 1
      from cand c
     where u.id = c.id
    returning u.id, u.user_id, u.kind, u.payload, u.attempts, u.send_after, u.created_at
  )
  select
    c.id,
    c.user_id,
    c.kind,
    c.payload,
    c.attempts,
    c.send_after,
    c.created_at,
    -- The login address is the one we can actually reach. tester_email is the
    -- Google account used for opt-in and is only a fallback.
    coalesce(au.email::text, p.tester_email::text)      as email,
    coalesce(p.display_name, p.handle::text, 'there')   as display_name,
    jsonb_strip_nulls(jsonb_build_object(
      'handle',        p.handle::text,
      'assignment_id', asg.id,
      'app_id',        ap.id,
      'app_name',      ap.name,
      'package_name',  ap.package_name,
      'pod_id',        pd.id,
      'pod_code',      pd.code,
      'pod_name',      pd.name,
      'total_days',    pd.duration_days,
      'days_done',     asg.days_checked_in,
      'day',           coalesce(
                         (c.payload ->> 'day')::int,
                         case when pd.starts_at is not null
                              then ((now() at time zone 'utc')::date
                                    - (pd.starts_at at time zone 'utc')::date) + 1 end
                       ),
      'seats_filled',  (select count(*) from pod_members m
                         where m.pod_id = pd.id and m.status <> 'removed'),
      'seats_total',   pd.core_seats
    )) as context
  from claimed c
  join profiles p            on p.id  = c.user_id
  left join auth.users au    on au.id = c.user_id
  left join assignments asg  on asg.id = nullif(c.payload ->> 'assignment_id', '')::uuid
  left join apps ap          on ap.id  = coalesce(nullif(c.payload ->> 'app_id', '')::uuid, asg.app_id)
  left join pods pd          on pd.id  = coalesce(asg.pod_id, nullif(c.payload ->> 'pod_id', '')::uuid)
  where p.is_banned = false
  order by c.send_after, c.id;
end $$;

-- ---------------------------------------------------------------------------
-- Settle a claimed batch. Three outcomes, three functions, all idempotent
-- against rows the caller no longer owns.
-- ---------------------------------------------------------------------------

-- Delivered.
create or replace function mark_notifications_sent(p_ids bigint[])
returns int
language sql security definer set search_path = public, extensions as $$
  with done as (
    update notifications
       set sent_at = now(), error = null
     where id = any(p_ids) and sent_at is null
    returning 1
  ) select count(*)::int from done
$$;

-- Not delivered. Keep the reason, and stop trying once the budget is spent —
-- a permanently bad address should not be retried until the end of time.
create or replace function mark_notifications_failed(
  p_ids          bigint[],
  p_error        text,
  p_max_attempts int default 5,
  p_backoff_mins int default 15
)
returns int
language sql security definer set search_path = public, extensions as $$
  with done as (
    update notifications
       set error      = left(coalesce(p_error, 'unknown error'), 500),
           failed_at  = case when attempts >= p_max_attempts then now() else null end,
           send_after = case when attempts >= p_max_attempts then send_after
                             else now() + make_interval(mins => p_backoff_mins * attempts) end
     where id = any(p_ids) and sent_at is null
    returning 1
  ) select count(*)::int from done
$$;

-- Claimed but deliberately not sent — dry run, or a duplicate collapsed into
-- someone else's digest. Give the attempt back; nothing happened.
create or replace function release_notifications(p_ids bigint[])
returns int
language sql security definer set search_path = public, extensions as $$
  with done as (
    update notifications
       set attempts = greatest(attempts - 1, 0)
     where id = any(p_ids) and sent_at is null
    returning 1
  ) select count(*)::int from done
$$;

-- ---------------------------------------------------------------------------
-- Let the edge functions write to the same health table the cron jobs use, so
-- the admin dashboard shows one story rather than two.
-- ---------------------------------------------------------------------------
create or replace function log_job_run(
  p_job text, p_ok boolean, p_detail jsonb, p_duration_ms int default null
)
returns void
language sql security definer set search_path = public, extensions as $$
  insert into job_runs (job, ok, detail, duration_ms)
  values (p_job, p_ok, coalesce(p_detail, '{}'::jsonb), p_duration_ms)
$$;

-- ---------------------------------------------------------------------------
-- Shared-secret check for the edge functions.
--
-- Returns a boolean, never the secret. The secret lives in Vault so that the
-- cron command and the function verifier read the same value from one place;
-- see 20260810212100 for what the operator has to insert.
-- ---------------------------------------------------------------------------
create or replace function cron_secret_matches(p_token text)
returns boolean
language plpgsql security definer set search_path = public, extensions, vault as $$
declare v_secret text;
begin
  if p_token is null or length(p_token) < 16 then
    return false;
  end if;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if v_secret is null or length(v_secret) < 16 then
    return false;
  end if;
  return v_secret = p_token;
end $$;

-- ---------------------------------------------------------------------------
-- Supabase publishes every public function as a REST endpoint. None of these
-- may be reachable by a logged-in user: claim_notifications hands out other
-- people's email addresses, mark_notifications_sent would let anyone silence
-- their own reminders, and cron_secret_matches is an oracle. Service role
-- only.
-- ---------------------------------------------------------------------------
revoke execute on function
  claim_notifications(int, int, int),
  mark_notifications_sent(bigint[]),
  mark_notifications_failed(bigint[], text, int, int),
  release_notifications(bigint[]),
  log_job_run(text, boolean, jsonb, int),
  cron_secret_matches(text)
from anon, authenticated, public;

grant execute on function
  claim_notifications(int, int, int),
  mark_notifications_sent(bigint[]),
  mark_notifications_failed(bigint[], text, int, int),
  release_notifications(bigint[]),
  log_job_run(text, boolean, jsonb, int),
  cron_secret_matches(text)
to service_role;

-- Claiming scans by send_after among unsent rows; the existing partial index
-- covers it. Settling is by primary key. Nothing further to add.
