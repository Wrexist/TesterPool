import * as React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Stat, EmptyState } from '@/components/ui';
import { Section, RowList, Row, WarnBox } from '@/components/admin/parts';
import { fmtDateTime, fmtRelative } from '@/lib/pods';
import { num } from '@/lib/admin';
import { stripeConfigured, webhookConfigured, isLiveMode } from '@/lib/stripe';
import {
  JOB_SPECS,
  JOB_STATE_LABEL,
  JOB_STATE_TONE,
  OUTBOX_TONE,
  VERDICT_TONE,
  fmtDuration,
  humanAge,
  jobHealth,
  outboxHealth,
  readDetail,
  senderDelivery,
  systemVerdict,
  type CronStatusRow,
  type JobRunRow,
  type LedgerDriftRow,
  type SecretRow,
} from './health';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System health — Admin — TesterPool' };

/** PostgREST caps a row read at 1,000. Say so when we hit it rather than lying by omission. */
const SAMPLE = 1000;

/** Kept outside the component so the clock read is not a render-time side effect. */
function readClock(): number {
  return new Date().getTime();
}

export default async function AdminSystemPage() {
  const supabase = await createClient();
  const now = readClock();

  const [
    cronRes,
    secretRes,
    driftRes,
    recentRes,
    latestPerJob,
    failuresPerJob,
    dispatchRes,
    triageRes,
    pendingRes,
    sentRes,
    failedRes,
    oldestRes,
    attemptsRes,
    errorRes,
    kindRes,
    proofTotalRes,
    proofPendingRes,
    proofAutoRes,
    proofEscalatedRes,
    proofApprovedRes,
    proofRejectedRes,
    proofConfidenceRes,
    proofVerdictRes,
  ] = await Promise.all([
    supabase.rpc('admin_cron_status'),
    supabase.rpc('admin_secret_presence'),
    supabase.rpc('ledger_drift'),
    supabase.from('job_runs').select('*').order('ran_at', { ascending: false }).limit(50),
    Promise.all(
      JOB_SPECS.map((spec) =>
        supabase
          .from('job_runs')
          .select('*')
          .eq('job', spec.key)
          .order('ran_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((res) => (res.data ?? null) as JobRunRow | null)
      )
    ),
    Promise.all(
      JOB_SPECS.map((spec) =>
        supabase
          .from('job_runs')
          .select('id', { count: 'exact', head: true })
          .eq('job', spec.key)
          .eq('ok', false)
          .gte('ran_at', new Date(now - 7 * 86_400_000).toISOString())
          .then((res) => res.count ?? 0)
      )
    ),
    supabase
      .from('job_runs')
      .select('*')
      .eq('job', 'send_notifications_dispatch')
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('job_runs')
      .select('*')
      .eq('job', 'triage_proof')
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('sent_at', null)
      .is('failed_at', null),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).not('sent_at', 'is', null),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).not('failed_at', 'is', null),
    supabase
      .from('notifications')
      .select('created_at')
      .is('sent_at', null)
      .is('failed_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('notifications')
      .select('attempts')
      .order('attempts', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('notifications')
      .select('kind, error, attempts, failed_at')
      .not('error', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('notifications')
      .select('kind, sent_at, failed_at')
      .order('created_at', { ascending: false })
      .limit(SAMPLE),
    supabase.from('proofs').select('id', { count: 'exact', head: true }),
    supabase.from('proofs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('proofs').select('id', { count: 'exact', head: true }).eq('status', 'auto_approved'),
    supabase.from('proofs').select('id', { count: 'exact', head: true }).eq('status', 'escalated'),
    supabase.from('proofs').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('proofs').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('proofs').select('ai_confidence').not('ai_confidence', 'is', null).limit(SAMPLE),
    supabase.from('proofs').select('ai_verdict').eq('status', 'escalated').limit(SAMPLE),
  ]);

  /* ------------------------------------------------------------- scheduler */

  const cronRows = ((cronRes.data ?? []) as CronStatusRow[]) ?? [];
  const cronReadable = !cronRes.error;
  const cronByName = new Map(cronRows.map((r) => [r.jobname, r]));

  const jobs = JOB_SPECS.map((spec, i) =>
    jobHealth(spec, latestPerJob[i], cronByName.get(spec.cronName) ?? null, now)
  );
  const failures = failuresPerJob;

  const dispatch = (dispatchRes.data ?? null) as JobRunRow | null;
  const triage = (triageRes.data ?? null) as JobRunRow | null;
  const recentRuns = ((recentRes.data ?? []) as JobRunRow[]) ?? [];

  /* ---------------------------------------------------------------- outbox */

  const pending = pendingRes.count ?? 0;
  const sent = sentRes.count ?? 0;
  const failed = failedRes.count ?? 0;
  const oldestUnsent = (oldestRes.data as { created_at: string } | null)?.created_at ?? null;
  const maxAttempts = num((attemptsRes.data as { attempts: number } | null)?.attempts);

  const errorRows = ((errorRes.data ?? []) as { kind: string; error: string | null; attempts: number | null; failed_at: string | null }[]) ?? [];
  const errorGroups = [...groupBy(errorRows, (r) => (r.error ?? '').slice(0, 160) || 'empty error string')]
    .map(([message, rows]) => ({ message, count: rows.length, kinds: [...new Set(rows.map((r) => r.kind))] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const kindRows = ((kindRes.data ?? []) as { kind: string; sent_at: string | null; failed_at: string | null }[]) ?? [];
  const kindSampleTruncated = kindRows.length >= SAMPLE;
  const kindBreakdown = [...groupBy(kindRows.filter((r) => !r.sent_at && !r.failed_at), (r) => r.kind)]
    .map(([kind, rows]) => ({ kind, count: rows.length }))
    .sort((a, b) => b.count - a.count);

  const senderLatest = jobs.find((j) => j.spec.key === 'send_notifications')?.last ?? null;
  const delivery = senderDelivery(senderLatest?.detail);

  const outbox = outboxHealth({
    pending,
    sent,
    failed,
    maxAttempts,
    withError: errorRows.length,
    senderUnconfigured: delivery.unconfigured,
    missingEnv: delivery.missingEnv,
  });

  /* ----------------------------------------------------------------- proofs */

  const proofTotal = proofTotalRes.count ?? 0;
  const proofPending = proofPendingRes.count ?? 0;
  const proofAuto = proofAutoRes.count ?? 0;
  const proofEscalated = proofEscalatedRes.count ?? 0;
  const proofApproved = proofApprovedRes.count ?? 0;
  const proofRejected = proofRejectedRes.count ?? 0;

  const confidences = ((proofConfidenceRes.data ?? []) as { ai_confidence: number | string | null }[])
    .map((r) => num(r.ai_confidence, NaN))
    .filter((v) => Number.isFinite(v));
  const avgConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null;

  const escalatedVerdicts = ((proofVerdictRes.data ?? []) as { ai_verdict: Record<string, unknown> | null }[]) ?? [];
  const duplicateEscalations = escalatedVerdicts.filter((r) => {
    const dupes = r.ai_verdict?.duplicate_of;
    return Array.isArray(dupes) && dupes.length > 0;
  }).length;

  const triageDetail = (triage?.detail ?? null) as Record<string, unknown> | null;
  const triageUnconfigured = triageDetail?.triage === 'unconfigured';

  /* ----------------------------------------------------------------- ledger */

  const driftReadable = !driftRes.error;
  const driftRows = ((driftRes.data ?? []) as LedgerDriftRow[]) ?? [];

  /* ---------------------------------------------------------------- secrets */

  const secrets = ((secretRes.data ?? []) as SecretRow[]) ?? [];
  const secretsReadable = !secretRes.error;
  const missingSecrets = secrets.filter((s) => !s.present).map((s) => s.name);

  /* ---------------------------------------------------------------- verdict */

  const verdict = systemVerdict({ jobs, driftRows: driftRows.length, driftReadable, outbox });

  return (
    <div className="flex flex-col gap-8">
      {/* ------------------------------------------------------- the verdict */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={VERDICT_TONE[verdict.verdict]}>
            <span className="font-semibold uppercase tracking-wide">{verdict.verdict}</span>
          </Pill>
          <h2 className="text-lg font-semibold">{verdict.headline}</h2>
          <span className="ml-auto text-xs text-[var(--color-mute)]">
            Read at {fmtDateTime(new Date(now).toISOString())} UTC
          </span>
        </div>

        {verdict.reasons.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {verdict.reasons.map((reason, i) => (
              <li key={i} className="flex gap-2 text-sm text-[var(--color-dim)]">
                <span aria-hidden className="text-[var(--color-mute)]">
                  &bull;
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}

        {(outbox.state === 'paused' || triageUnconfigured) && (
          <p className="mt-3 max-w-3xl text-sm text-[var(--color-dim)]">
            Known and intentional, so it does not count against the verdict:{' '}
            {[
              outbox.state === 'paused' &&
                `email delivery is paused by configuration rather than broken, with ${pending} row${
                  pending === 1 ? '' : 's'
                } queued and nothing lost`,
              triageUnconfigured && 'proof scoring is running without a vision key and records no opinion',
            ]
              .filter(Boolean)
              .join('; ')}
            . Both are covered under Configuration below.
          </p>
        )}

        <div className="mt-4 border-t border-[var(--color-line)] pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
            What that verdict is based on
          </div>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-[var(--color-mute)]">
            {verdict.checked.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          {!cronReadable && (
            <p className="mt-2 text-xs text-[var(--color-credit)]">
              admin_cron_status() did not return, so schedules and the active flag below are unknown. The
              last-run times still come from job_runs and are unaffected.
            </p>
          )}
        </div>
      </Card>

      {/* --------------------------------------------------------- the jobs */}
      <Section
        title="Scheduled jobs"
        note="Four jobs carry the 14-day clock. Each is judged late against its own schedule, not a shared one, because a sender that is an hour behind is an outage and a nightly reconcile that is an hour behind is nothing."
      >
        <RowList>
          {jobs.map((job, i) => (
            <Row key={job.spec.key} className="items-start">
              <Pill tone={JOB_STATE_TONE[job.state]}>{JOB_STATE_LABEL[job.state]}</Pill>
              <code className="text-sm font-semibold">{job.spec.cronName}</code>
              <span className="text-xs text-[var(--color-mute)]">
                {job.spec.schedule} · <code>{job.cron?.schedule ?? job.spec.cronExpr}</code>
              </span>
              {job.cron && !job.cron.active && <Pill tone="red">Disabled in cron</Pill>}
              <span className="ml-auto text-xs text-[var(--color-dim)]">
                last run <span className="num">{fmtRelative(job.last?.ran_at)}</span>
                {job.last && (
                  <>
                    {' · '}
                    <span className="num">{fmtDateTime(job.last.ran_at)}</span> UTC
                    {' · '}
                    <span className="num">{fmtDuration(job.last.duration_ms)}</span>
                  </>
                )}
              </span>
              <p className="basis-full text-xs text-[var(--color-dim)]">{job.line}</p>
              <div className="basis-full text-[11px] text-[var(--color-mute)]">
                {failures[i] > 0 ? (
                  <span className="text-[var(--color-danger)]">
                    <span className="num">{failures[i]}</span> failed run
                    {failures[i] === 1 ? '' : 's'} in the last 7 days.
                  </span>
                ) : (
                  <span>No failed run in the last 7 days.</span>
                )}
                {job.cron?.last_start && (
                  <>
                    {' '}
                    pg_cron last fired it <span className="num">{fmtRelative(job.cron.last_start)}</span> and
                    reported <span className="num">{job.cron.last_status ?? 'no status'}</span>.
                  </>
                )}
                {job.cron === null && cronReadable && ' No matching row in cron.job — this job has no schedule.'}
              </div>
            </Row>
          ))}
        </RowList>

        {dispatch && (
          <p className="mt-2 text-xs text-[var(--color-mute)]">
            Postgres records its own half of the sender separately. The last{' '}
            <code>send_notifications_dispatch</code> row was written{' '}
            <span className="num">{fmtRelative(dispatch.ran_at)}</span>; the edge function answered{' '}
            <span className="num">{fmtRelative(senderLatest?.ran_at)}</span>. A dispatch with no answer after
            it means Postgres is reaching out and the function is not replying.
          </p>
        )}
      </Section>

      {/* -------------------------------------------------------- the outbox */}
      <Section
        title="Notification outbox"
        note="Rows written by clock-watch and pod-lifecycle, drained by the sender every 15 minutes. A queue that grows is only a problem if delivery is configured."
        right={<Pill tone={OUTBOX_TONE[outbox.state]}>{outbox.headline}</Pill>}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Pending"
            value={pending}
            sub={oldestUnsent ? `oldest queued ${humanAge(now - new Date(oldestUnsent).getTime())} ago` : 'nothing queued'}
            tone={outbox.state === 'failing' ? 'var(--color-danger)' : undefined}
          />
          <Stat label="Sent" value={sent} sub={sent === 0 ? 'no row has ever been marked sent' : 'marked delivered by the sender'} />
          <Stat
            label="Failed"
            value={failed}
            sub={failed === 0 ? 'nothing gave up after five attempts' : 'stopped retrying, kept for replay'}
            tone={failed > 0 ? 'var(--color-danger)' : undefined}
          />
          <Stat
            label="Max attempts"
            value={maxAttempts}
            sub={maxAttempts === 0 ? 'no row has been retried' : 'five is the give-up point'}
            tone={maxAttempts > 0 ? 'var(--color-credit)' : undefined}
          />
        </div>

        <div className="mt-3">
          <WarnBox tone={outbox.state === 'failing' ? 'red' : outbox.state === 'paused' ? 'amber' : 'neutral'}>
            {outbox.body}
          </WarnBox>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
              Queued by kind
            </div>
            {kindBreakdown.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--color-mute)]">
                No unsent rows in the sample. Nothing is waiting to go out.
              </p>
            ) : (
              <>
                <ul className="mt-2 flex flex-col gap-1">
                  {kindBreakdown.map((row) => (
                    <li key={row.kind} className="flex items-baseline justify-between gap-3 text-xs">
                      <code className="text-[var(--color-dim)]">{row.kind}</code>
                      <span className="num font-semibold">{row.count}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[var(--color-mute)]">
                  {kindSampleTruncated
                    ? `Counted across the most recent ${SAMPLE} notification rows, which is the read limit — the true queue is larger.`
                    : 'Counted across every notification row.'}
                </p>
              </>
            )}
          </Card>

          <Card className="p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
              Recent errors, grouped
            </div>
            {errorGroups.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--color-mute)]">
                No row carries an error string. Nothing has been attempted and rejected by a provider.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {errorGroups.map((group) => (
                  <li key={group.message} className="text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className="num font-semibold text-[var(--color-danger)]">{group.count}</span>
                      <span className="text-[var(--color-dim)]">{group.message}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--color-mute)]">
                      affecting {group.kinds.join(', ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Section>

      {/* --------------------------------------------------------- proof triage */}
      <Section
        title="Proof triage"
        note="Screenshots are hashed on arrival and, when the vision key is present, scored by a model. The perceptual hash runs either way, and it is what catches a reused screenshot."
        right={triageUnconfigured ? <Pill tone="amber">Scoring unconfigured</Pill> : undefined}
      >
        {proofTotal === 0 ? (
          <EmptyState
            title="No proofs have been uploaded"
            body="The proofs table is empty, so there is nothing to triage and no confidence to average. This section becomes meaningful the first time a tester uploads an opt-in screenshot."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat
                label="Pending"
                value={proofPending}
                sub={proofPending > 0 ? 'opt-in credit is escrowed until reviewed' : 'nothing waiting on a human'}
                tone={proofPending > 0 ? 'var(--color-credit)' : undefined}
              />
              <Stat label="Auto-approved" value={proofAuto} sub="cleared the confidence bar" />
              <Stat
                label="Escalated"
                value={proofEscalated}
                sub={`${duplicateEscalations} for a duplicate hash`}
                tone={proofEscalated > 0 ? 'var(--color-danger)' : undefined}
              />
              <Stat label="Approved by hand" value={proofApproved} sub="reviewed in moderation" />
              <Stat label="Rejected" value={proofRejected} sub="did not show an opt-in" />
            </div>
            <p className="mt-2 text-xs text-[var(--color-dim)]">
              {avgConfidence === null ? (
                <>
                  No proof carries a confidence score yet
                  {triageUnconfigured
                    ? ', which follows from the vision key being absent: triage still hashes every image and still escalates duplicates, but it records no opinion.'
                    : '.'}
                </>
              ) : (
                <>
                  Average confidence across <span className="num">{confidences.length}</span> scored proofs is{' '}
                  <span className="num">{avgConfidence.toFixed(2)}</span>.
                </>
              )}
            </p>
          </>
        )}
      </Section>

      {/* ------------------------------------------------------------- ledger */}
      <Section
        title="Ledger integrity"
        note="ledger_drift() compares every cached profiles.credits against the sum of that account's append-only ledger. The ledger is the source of truth; the cached balance is a projection that must agree with it."
      >
        {!driftReadable ? (
          <WarnBox tone="red">
            ledger_drift() did not return{driftRes.error?.message ? `: ${driftRes.error.message}` : '.'} Nothing
            on this page should be read as reassurance until it does, because a credit bug would be invisible.
          </WarnBox>
        ) : driftRows.length === 0 ? (
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Pill tone="green">Reconciled</Pill>
              <span className="text-sm">
                Every account&apos;s cached balance matches the sum of its ledger entries.
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-xs text-[var(--color-dim)]">
              Checked just now, not read from a cache. The nightly job runs the same comparison at 02:20 UTC
              and reports itself unhealthy when it finds anything.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <WarnBox tone="red">
              <span className="num">{driftRows.length}</span> account
              {driftRows.length === 1 ? '' : 's'} hold credits the ledger cannot explain. Credits were written
              to profiles.credits without a matching credit_ledger row, which means either a direct update or a
              failed award. Do not adjust balances until the cause is found — an adjustment writes a ledger row
              and hides the evidence.
            </WarnBox>
            <RowList>
              {driftRows.slice(0, 25).map((row) => (
                <Row key={row.user_id} href={`/admin/users?q=${encodeURIComponent(row.handle)}`}>
                  <Pill tone="red">
                    <span className="num">
                      {row.drift > 0 ? '+' : ''}
                      {row.drift}
                    </span>
                  </Pill>
                  <span className="text-sm font-medium">@{row.handle}</span>
                  <span className="text-xs text-[var(--color-mute)]">
                    balance <span className="num">{row.projected}</span> against a ledger sum of{' '}
                    <span className="num">{row.ledger}</span>
                  </span>
                </Row>
              ))}
            </RowList>
            {driftRows.length > 25 && (
              <p className="text-xs text-[var(--color-mute)]">
                Showing the first <span className="num">25</span> of{' '}
                <span className="num">{driftRows.length}</span>.
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------ configuration */}
      <Section
        title="Configuration"
        note="Edge-function secrets cannot be read from the database, so everything below except Stripe and the Vault names is inferred from what the jobs report about themselves. Treat it as evidence, not as a settings screen."
      >
        <RowList>
          <ConfigRow
            name="Resend — email delivery"
            live={!delivery.unconfigured && sent > 0}
            state={
              delivery.unconfigured
                ? 'Not configured'
                : sent > 0
                  ? 'Live'
                  : 'No evidence either way'
            }
            evidence={
              delivery.message ??
              (senderLatest
                ? `The sender's last run reported delivery as ${String(
                    (senderLatest.detail as Record<string, unknown> | null)?.delivery ?? 'nothing in particular'
                  )}.`
                : 'The sender has not written a run to job_runs, so there is nothing to infer from.')
            }
            action={
              delivery.unconfigured
                ? `Set ${
                    delivery.missingEnv.length ? delivery.missingEnv.join(' and ') : 'RESEND_API_KEY and NOTIFICATION_FROM'
                  } on the send-notifications edge function, then check SITE_URL before the first real send.`
                : 'Confirm the sending domain is still verified with Resend.'
            }
          />
          <ConfigRow
            name="Anthropic — proof vision"
            live={!triageUnconfigured && triage !== null && avgConfidence !== null}
            state={triage === null ? 'No evidence either way' : triageUnconfigured ? 'Not configured' : 'Live'}
            evidence={
              triage === null
                ? 'triage-proof has never written a run to job_runs, so nothing can be inferred about the key.'
                : triageUnconfigured
                  ? `The last triage run, ${fmtRelative(triage.ran_at)}, recorded a verdict of unconfigured: it fetched the image and computed the perceptual hash, then stopped short of the model.`
                  : `The last triage run, ${fmtRelative(triage.ran_at)}, reached the model.`
            }
            action={
              triageUnconfigured
                ? 'Set ANTHROPIC_API_KEY on the triage-proof edge function. Duplicate detection works without it; scoring does not.'
                : 'Nothing to do.'
            }
          />
          <ConfigRow
            name="Stripe — payments"
            live={stripeConfigured()}
            state={
              !stripeConfigured()
                ? 'Not configured'
                : webhookConfigured()
                  ? `Live (${isLiveMode() ? 'live keys' : 'test keys'})`
                  : 'Key set, webhook secret missing'
            }
            evidence={
              stripeConfigured()
                ? 'Read directly from this server process, not inferred: STRIPE_SECRET_KEY is present.'
                : 'Read directly from this server process, not inferred: STRIPE_SECRET_KEY is absent, so paid tiers degrade to an honest unavailable state rather than a 500.'
            }
            action={
              !stripeConfigured()
                ? 'Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET when payments go live. The free tier does not depend on them.'
                : webhookConfigured()
                  ? 'Nothing to do.'
                  : 'Set STRIPE_WEBHOOK_SECRET, or fulfilment cannot verify that a webhook came from Stripe.'
            }
          />
          <ConfigRow
            name="Vault — cron secrets"
            live={secretsReadable && missingSecrets.length === 0}
            state={
              !secretsReadable
                ? 'Could not read'
                : missingSecrets.length === 0
                  ? 'Both present'
                  : `${missingSecrets.length} missing`
            }
            evidence={
              !secretsReadable
                ? 'admin_secret_presence() did not return, so the presence of the two Vault secrets is unknown.'
                : missingSecrets.length === 0
                  ? `send_notifications_url and cron_secret both exist in Vault. Names only — this page never reads a secret value.`
                  : `Missing: ${missingSecrets.join(', ')}. Without both, the 15-minute tick is a deliberate no-op that logs a skip and sends nothing.`
            }
            action={
              missingSecrets.length === 0
                ? 'Rotate with vault.update_secret; the change takes effect on the next tick.'
                : 'Create them with vault.create_secret(value, name, description). Nothing else has to change.'
            }
          />
        </RowList>
      </Section>

      {/* ----------------------------------------------------- recent job runs */}
      <Section
        title="Recent job runs"
        note="The last 50 rows from job_runs, newest first. The detail column is what each job said about its own work."
        right={
          <Link href="/admin" className="btn btn-ghost">
            Back to overview
          </Link>
        }
      >
        {recentRuns.length === 0 ? (
          <EmptyState
            title="job_runs is empty"
            body="No scheduled job has recorded a run. Either nothing has fired yet or this account cannot read job_runs, and the two look identical from here."
          />
        ) : (
          <RowList>
            {recentRuns.map((run) => {
              const { sentence, lines } = readDetail(run.detail);
              return (
                <Row key={run.id} className="items-start">
                  <Pill tone={run.ok ? 'green' : 'red'}>{run.ok ? 'ok' : 'failed'}</Pill>
                  <code className="text-xs font-semibold">{run.job}</code>
                  <span className="num text-xs text-[var(--color-mute)]">{fmtDateTime(run.ran_at)} UTC</span>
                  <span className="num text-xs text-[var(--color-mute)]">{fmtDuration(run.duration_ms)}</span>
                  <span className="ml-auto text-xs text-[var(--color-mute)]">{fmtRelative(run.ran_at)}</span>
                  {sentence && <p className="basis-full text-xs text-[var(--color-dim)]">{sentence}</p>}
                  {lines.length > 0 && (
                    <dl className="flex basis-full flex-wrap gap-x-4 gap-y-0.5">
                      {lines.map((line) => (
                        <div key={line.label} className="flex items-baseline gap-1.5 text-[11px]">
                          <dt className="text-[var(--color-mute)]">{line.label}</dt>
                          <dd className="num text-[var(--color-dim)]">{line.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </Row>
              );
            })}
          </RowList>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ parts */

function ConfigRow({
  name,
  live,
  state,
  evidence,
  action,
}: {
  name: string;
  live: boolean;
  state: string;
  evidence: string;
  action: string;
}) {
  return (
    <Row className="items-start">
      <Pill tone={live ? 'green' : 'amber'}>{state}</Pill>
      <span className="text-sm font-medium">{name}</span>
      <p className="basis-full text-xs text-[var(--color-dim)]">{evidence}</p>
      <p className="basis-full text-[11px] text-[var(--color-mute)]">{action}</p>
    </Row>
  );
}

/* -------------------------------------------------------------- utilities */

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}
