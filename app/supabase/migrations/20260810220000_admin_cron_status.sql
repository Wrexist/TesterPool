-- TESTERPOOL — read-only windows onto the scheduler, for the admin system page.
--
-- `cron.job` and `cron.job_run_details` live in the `cron` schema, which is not
-- exposed through PostgREST and is owned by `postgres`. The admin dashboard has
-- to be able to say "clock-watch has not fired since Tuesday" without a shell,
-- so these two SECURITY DEFINER functions hand back the minimum needed to say
-- it: schedules, active flags, and the outcome of the most recent run.
--
-- Neither function returns a command string or a secret value. `cron.job.command`
-- is deliberately excluded — it contains the shape of the request the sender
-- makes — and `admin_secret_presence` returns names and a boolean only, never a
-- decrypted secret. Both are gated on `is_admin()` and return zero rows to
-- anybody else, so an accidental grant is a leak of nothing.

/* ------------------------------------------------------------ cron status */

create or replace function admin_cron_status()
returns table (
  jobname     text,
  schedule    text,
  active      boolean,
  last_status text,
  last_start  timestamptz,
  last_end    timestamptz
)
language sql
stable
security definer
set search_path = public, extensions, cron
as $$
  select j.jobname::text,
         j.schedule::text,
         j.active,
         d.status::text,
         d.start_time,
         d.end_time
    from cron.job j
    left join lateral (
      select r.status, r.start_time, r.end_time
        from cron.job_run_details r
       where r.jobid = j.jobid
       order by r.start_time desc
       limit 1
    ) d on true
   where is_admin()
   order by j.jobname
$$;

revoke execute on function admin_cron_status() from anon, public;
grant  execute on function admin_cron_status() to authenticated;

/* -------------------------------------------------------- secret presence */

-- Which Vault secrets exist, by name. The notification tick is a deliberate
-- no-op until both of these are present, and "deliberate no-op" reads exactly
-- like "broken" from the outbox alone, so the page needs to be able to tell
-- them apart.

create or replace function admin_secret_presence()
returns table (name text, present boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = public, extensions, vault
as $$
  select expected.name,
         s.id is not null,
         s.created_at
    from (values ('send_notifications_url'::text), ('cron_secret')) as expected(name)
    left join vault.secrets s on s.name = expected.name
   where is_admin()
   order by expected.name
$$;

revoke execute on function admin_secret_presence() from anon, public;
grant  execute on function admin_secret_presence() to authenticated;
