-- ============================================================================
-- SCHEDULING PROOF TRIAGE
--
-- The Server Action fires `triage-proof` inline the moment a screenshot is
-- submitted, so the usual experience is a verdict in a few seconds. That call
-- is allowed to fail — a cold function, a model timeout, a deploy landing
-- mid-request — because the failure mode is a proof sitting at 'pending', which
-- is a human queue rather than a free approval.
--
-- This is what stops "sitting at pending" from meaning "forgotten". Every five
-- minutes it re-dispatches proofs that were never judged, and stamps opt-ins
-- whose proof was approved but whose credit could not move at the time —
-- almost always because the tester had hit their daily allowance.
--
-- Same secret handling as the notification sender: `cron.job` is a readable
-- table, so neither the URL nor the bearer token is written into the command.
-- Both are read from Vault at fire time.
--
-- OPERATOR SETUP. One secret, once, as the postgres role:
--
--   select vault.create_secret(
--     'https://yudcncvarndslyyajflr.supabase.co/functions/v1/triage-proof',
--     'triage_proof_url',
--     'Endpoint the screenshot analyser is invoked at');
--
-- `cron_secret` is shared with the sender and is probably already set. Until
-- both exist the job runs, logs a skip, and proofs wait for a moderator — which
-- is the same outcome as having no vision model at all, and is safe.
-- ============================================================================

create or replace function triage_proof_tick()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_url     text := _vault_secret('triage_proof_url');
  v_secret  text := _vault_secret('cron_secret');
  v_proof   uuid;
  v_sent    int := 0;
  v_stamp   jsonb;
begin
  -- The stamping half needs no HTTP and no secrets, so it runs first and runs
  -- regardless. A tester who was over their allowance yesterday gets paid this
  -- morning even if the vision model is still unreachable.
  v_stamp := stamp_approved_optins(200);

  if v_url is null or coalesce(length(v_secret), 0) < 16 then
    perform _log_job('triage_proof_dispatch', true, jsonb_build_object(
      'skipped', 'vault not configured',
      'stamped', v_stamp -> 'stamped',
      'deferred', v_stamp -> 'deferred',
      'missing', array_remove(array[
        case when v_url is null then 'triage_proof_url' end,
        case when coalesce(length(v_secret), 0) < 16 then 'cron_secret' end
      ], null)
    ), v_started);
    return jsonb_build_object('skipped', true, 'stamp', v_stamp);
  end if;

  -- One request per proof. pg_net queues them and returns immediately, so a
  -- backlog of twenty dispatches in one tick does not hold the job open.
  -- Twenty at a time is deliberate: it bounds the spend per tick, and anything
  -- left over is picked up five minutes later.
  for v_proof in select * from proofs_awaiting_triage(20) loop
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_secret),
      body    := jsonb_build_object('proof_id', v_proof, 'source', 'cron'),
      timeout_milliseconds := 30000
    );
    v_sent := v_sent + 1;
  end loop;

  perform _log_job('triage_proof_dispatch', true, jsonb_build_object(
    'dispatched', v_sent,
    'stamped',    v_stamp -> 'stamped',
    'deferred',   v_stamp -> 'deferred'
  ), v_started);

  return jsonb_build_object('dispatched', v_sent, 'stamp', v_stamp);
exception when others then
  perform _log_job('triage_proof_dispatch', false,
    jsonb_build_object('error', sqlerrm), v_started);
  return jsonb_build_object('error', sqlerrm);
end $$;

revoke execute on function triage_proof_tick() from anon, authenticated, public;

-- Five minutes. A proof waits at most that long for a retry, which is well
-- inside the "a moderator will look within a few hours" promise the UI makes,
-- and infrequent enough that a persistent model outage costs twelve wasted
-- dispatches an hour rather than hundreds.
select cron.schedule('triage-proofs', '*/5 * * * *', $$select triage_proof_tick()$$);
