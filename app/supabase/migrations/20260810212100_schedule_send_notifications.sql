-- ============================================================================
-- SCHEDULING THE SENDER
--
-- The three jobs in 20260810203246 run entirely inside Postgres, so cron can
-- call them directly. The sender cannot: it talks to a mail provider, so it
-- lives in an edge function and Postgres has to reach it over HTTP with pg_net.
--
-- That means the cron command holds a URL and a bearer token, and `cron.job`
-- is a readable table — anyone with database access, including a future
-- read-only analytics role, can select the command text out of it. So neither
-- value is written here. Both are read at fire time from Vault, where they are
-- encrypted at rest and only `vault.decrypted_secrets` can reveal them.
--
-- OPERATOR SETUP. Until these two secrets exist the job runs and does nothing,
-- logging a skip to job_runs every fifteen minutes. To turn delivery on, run
-- once as the postgres role:
--
--   select vault.create_secret(
--     'https://yudcncvarndslyyajflr.supabase.co/functions/v1/send-notifications',
--     'send_notifications_url',
--     'Endpoint the notification sender is invoked at');
--
--   select vault.create_secret(
--     '<a random string of at least 32 characters>',
--     'cron_secret',
--     'Shared bearer between cron and the edge functions');
--
-- The same random string must also be set as the CRON_SECRET environment
-- variable on the edge functions, or left unset — `cron_secret_matches` reads
-- the Vault copy directly, so Vault alone is enough. To rotate, use
-- vault.update_secret with the same name; nothing else has to change.
-- ============================================================================

-- Read one secret by name. Returns null rather than throwing when it is
-- missing, because "not configured yet" is a normal state for this system and
-- must not turn into a failing cron job.
create or replace function _vault_secret(p_name text)
returns text
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare v text;
begin
  select decrypted_secret into v
    from vault.decrypted_secrets where name = p_name limit 1;
  return v;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Job 4 — the sender tick. Every 15 minutes.
--
-- Fifteen minutes is chosen against the unit of urgency. A check-in reminder
-- is about a day; being a quarter of an hour late costs nothing, and the
-- shorter interval means a mail provider outage drains within the hour once
-- it clears rather than waiting for the next six-hourly sweep.
--
-- pg_net is asynchronous: http_post queues the request and returns an id
-- immediately. This function therefore reports that it dispatched, not that
-- anything was delivered. Delivery is recorded by the edge function itself,
-- under the job name `send_notifications`.
-- ---------------------------------------------------------------------------
create or replace function send_notifications_tick()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_url     text := _vault_secret('send_notifications_url');
  v_secret  text := _vault_secret('cron_secret');
  v_req     bigint;
begin
  if v_url is null or coalesce(length(v_secret), 0) < 16 then
    perform _log_job('send_notifications_dispatch', true, jsonb_build_object(
      'skipped', 'vault not configured',
      'missing', array_remove(array[
        case when v_url is null then 'send_notifications_url' end,
        case when coalesce(length(v_secret), 0) < 16 then 'cron_secret' end
      ], null)
    ), v_started);
    return jsonb_build_object('skipped', true, 'reason', 'vault not configured');
  end if;

  select net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_secret),
    body    := jsonb_build_object('source', 'cron', 'limit', 100),
    timeout_milliseconds := 30000
  ) into v_req;

  perform _log_job('send_notifications_dispatch', true,
    jsonb_build_object('request_id', v_req), v_started);
  return jsonb_build_object('request_id', v_req);
exception when others then
  perform _log_job('send_notifications_dispatch', false,
    jsonb_build_object('error', sqlerrm), v_started);
  return jsonb_build_object('error', sqlerrm);
end $$;

revoke execute on function send_notifications_tick(), _vault_secret(text)
  from anon, authenticated, public;

-- Re-scheduling by the same name replaces the existing entry, so this
-- migration is safe to re-run.
select cron.schedule('send-notifications', '*/15 * * * *', $$select send_notifications_tick()$$);
