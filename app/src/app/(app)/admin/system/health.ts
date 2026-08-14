/**
 * TESTERPOOL — the rules that turn scheduler rows into a verdict.
 *
 * Pure functions, no I/O, so the thresholds are readable in one place rather
 * than scattered through JSX. Everything here is null-tolerant: this page is
 * opened precisely when the data is missing, and a health page that throws on
 * a missing row is worse than no health page.
 */

/* ------------------------------------------------------------------ types */

export type JobKey = 'pod_lifecycle' | 'clock_watch' | 'nightly' | 'send_notifications';

export interface JobRunRow {
  id: number;
  job: string;
  ok: boolean;
  detail: Record<string, unknown> | null;
  ran_at: string;
  duration_ms: number | null;
}

export interface CronStatusRow {
  jobname: string;
  schedule: string;
  active: boolean;
  last_status: string | null;
  last_start: string | null;
  last_end: string | null;
}

export interface SecretRow {
  name: string;
  present: boolean;
  created_at: string | null;
}

export interface LedgerDriftRow {
  user_id: string;
  handle: string;
  projected: number;
  ledger: number;
  drift: number;
}

export interface JobSpec {
  /** The value written into `job_runs.job`. */
  key: JobKey;
  /** The `cron.job.jobname`. Deliberately different: hyphens there, underscores in job_runs. */
  cronName: string;
  schedule: string;
  cronExpr: string;
  /** What it does, in one line. */
  does: string;
  /** What stops happening while it is down. This is the sentence that matters. */
  stops: string;
  /**
   * Late means one whole cycle has been missed plus slack for a slow run.
   * Stale means the job has missed enough cycles that a person has to act now.
   */
  lateAfterMs: number;
  staleAfterMs: number;
}

const MIN = 60_000;
const HOUR = 3_600_000;

export const JOB_SPECS: JobSpec[] = [
  {
    key: 'pod_lifecycle',
    cronName: 'pod-lifecycle',
    schedule: 'Hourly at :07',
    cronExpr: '7 * * * *',
    does: 'Releases escrow on finished work, awards badges and recomputes reliability. The cron name is historical — there are no cohorts left for it to advance.',
    stops:
      'escrowed opt-in credits stay locked, finished testers are not paid, and reliability stops moving.',
    lateAfterMs: 2 * HOUR + 15 * MIN,
    staleAfterMs: 6 * HOUR,
  },
  {
    key: 'clock_watch',
    cronName: 'clock-watch',
    schedule: 'Every 6 hours, on the hour',
    cronExpr: '0 */6 * * *',
    does: 'Enqueues session reminders, warns on seats going stale, and converts a long-abandoned seat into a dropout.',
    stops:
      'nobody is being reminded to finish what they took on, and abandoned seats are not being detected — so owners keep paying for work that is not coming.',
    lateAfterMs: 13 * HOUR,
    staleAfterMs: 25 * HOUR,
  },
  {
    key: 'nightly',
    cronName: 'nightly',
    schedule: 'Daily at 02:20 UTC',
    cronExpr: '20 2 * * *',
    does: 'Reconciles the ledger against cached balances, prunes delivered notifications and old job runs, recomputes shipped counts.',
    stops:
      'ledger drift goes unmeasured, so a credit bug can run for days before anyone sees it.',
    lateAfterMs: 26 * HOUR,
    staleAfterMs: 50 * HOUR,
  },
  {
    key: 'send_notifications',
    cronName: 'send-notifications',
    schedule: 'Every 15 minutes',
    cronExpr: '*/15 * * * *',
    does: 'Drains the notification outbox through the edge function and emails whoever is due a message.',
    stops:
      'the outbox grows and no email leaves the building, which means reminders written by clock-watch never reach anyone.',
    lateAfterMs: 45 * MIN,
    staleAfterMs: 3 * HOUR,
  },
];

/* ------------------------------------------------------------- job health */

export type JobState = 'ok' | 'late' | 'stale' | 'failed' | 'never';

export interface JobHealth {
  spec: JobSpec;
  last: JobRunRow | null;
  cron: CronStatusRow | null;
  state: JobState;
  ageMs: number | null;
  /** One sentence, written for someone reading it at 2am. */
  line: string;
}

export const JOB_STATE_TONE: Record<JobState, 'green' | 'amber' | 'red' | 'neutral'> = {
  ok: 'green',
  late: 'amber',
  stale: 'red',
  failed: 'red',
  never: 'amber',
};

export const JOB_STATE_LABEL: Record<JobState, string> = {
  ok: 'On time',
  late: 'Late',
  stale: 'Not running',
  failed: 'Failed',
  never: 'Never run',
};

export function jobHealth(
  spec: JobSpec,
  last: JobRunRow | null,
  cron: CronStatusRow | null,
  now: number
): JobHealth {
  const ageMs = last ? now - new Date(last.ran_at).getTime() : null;

  let state: JobState;
  if (!last) state = 'never';
  else if (ageMs !== null && ageMs > spec.staleAfterMs) state = 'stale';
  else if (!last.ok) state = 'failed';
  else if (ageMs !== null && ageMs > spec.lateAfterMs) state = 'late';
  else state = 'ok';

  // A disabled schedule outranks everything else: it explains the silence and
  // it is the one cause a person can fix in a single statement.
  const disabled = cron !== null && !cron.active;

  let line: string;
  if (disabled) {
    line = `${spec.cronName} is disabled in cron.job. Until it is re-enabled, ${spec.stops}`;
  } else if (state === 'never') {
    line = `${spec.cronName} has never written a row to job_runs. Either it has not fired yet or it cannot reach the function.`;
  } else if (state === 'stale') {
    line = `${spec.cronName} has not run in ${humanAge(ageMs)} against a ${spec.schedule.toLowerCase()} schedule — ${spec.stops}`;
  } else if (state === 'late') {
    line = `${spec.cronName} is late: last run ${humanAge(ageMs)} ago. If it stays down, ${spec.stops}`;
  } else if (state === 'failed') {
    line = `${spec.cronName} ran ${humanAge(ageMs)} ago and reported a failure. Read the detail below before assuming the work was done.`;
  } else {
    line = spec.does;
  }

  return { spec, last, cron, state, ageMs, line };
}

/** Coarse on purpose. Nobody triages on seconds. */
export function humanAge(ms: number | null): string {
  if (ms === null) return 'never';
  const mins = Math.max(0, Math.round(ms / MIN));
  if (mins < 1) return 'under a minute';
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

export function fmtDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/* -------------------------------------------------------------- outbox */

export type OutboxState = 'empty' | 'paused' | 'draining' | 'failing';

export interface OutboxHealth {
  state: OutboxState;
  headline: string;
  body: string;
}

export function outboxHealth(input: {
  pending: number;
  sent: number;
  failed: number;
  maxAttempts: number;
  withError: number;
  senderUnconfigured: boolean;
  missingEnv: string[];
}): OutboxHealth {
  const { pending, sent, failed, maxAttempts, withError, senderUnconfigured, missingEnv } = input;

  if (failed > 0 || withError > 0) {
    return {
      state: 'failing',
      headline: 'Delivery is failing',
      body: `${failed} row${failed === 1 ? '' : 's'} gave up after five attempts and ${withError} carr${
        withError === 1 ? 'ies' : 'y'
      } an error string. Attempts have climbed as high as ${maxAttempts}. This is an outage, not a pause: read the grouped errors below, fix the cause, then clear failed_at and attempts on the affected batch.`,
    };
  }

  if (senderUnconfigured) {
    return {
      state: 'paused',
      headline: 'Delivery is paused, not broken',
      body: `The sender is running and claiming batches, but it reports delivery as unconfigured${
        missingEnv.length ? ` and names ${missingEnv.join(' and ')} as missing` : ''
      }. It renders every message, sends none, and hands the rows back unconsumed, so ${pending} pending row${
        pending === 1 ? '' : 's'
      } ${pending === 1 ? 'is' : 'are'} accumulating safely. Nothing here is lost. It will drain on the first tick after the keys are set.`,
    };
  }

  if (pending === 0) {
    return {
      state: 'empty',
      headline: 'Outbox is empty',
      body: `Nothing is queued. ${sent} message${sent === 1 ? ' has' : 's have'} been marked sent, and no row is waiting or failed.`,
    };
  }

  return {
    state: 'draining',
    headline: 'Outbox is draining',
    body: `${pending} row${pending === 1 ? '' : 's'} queued, ${sent} sent, none failed. The sender runs every 15 minutes, so a backlog this size clears within the hour.`,
  };
}

export const OUTBOX_TONE: Record<OutboxState, 'green' | 'amber' | 'red' | 'neutral'> = {
  empty: 'neutral',
  paused: 'amber',
  draining: 'green',
  failing: 'red',
};

/* ------------------------------------------------------------- verdict */

export type Verdict = 'healthy' | 'degraded' | 'broken' | 'unknown';

export interface VerdictResult {
  verdict: Verdict;
  headline: string;
  reasons: string[];
  /** What was actually checked to reach this verdict. Named so the claim is auditable. */
  checked: string[];
}

export const VERDICT_TONE: Record<Verdict, 'green' | 'amber' | 'red' | 'neutral'> = {
  healthy: 'green',
  degraded: 'amber',
  broken: 'red',
  unknown: 'neutral',
};

export function systemVerdict(input: {
  jobs: JobHealth[];
  driftRows: number;
  driftReadable: boolean;
  outbox: OutboxHealth;
}): VerdictResult {
  const { jobs, driftRows, driftReadable, outbox } = input;
  const reasons: string[] = [];

  if (driftRows > 0) {
    reasons.push(
      `${driftRows} account${driftRows === 1 ? '' : 's'} hold${
        driftRows === 1 ? 's' : ''
      } credits the ledger cannot explain.`
    );
  }

  for (const job of jobs) {
    if (job.cron && !job.cron.active) reasons.push(`${job.spec.cronName} is disabled in cron.job.`);
    else if (job.state === 'stale' || job.state === 'never' || job.state === 'failed' || job.state === 'late') {
      reasons.push(job.line);
    }
  }

  if (outbox.state === 'failing') reasons.push('The notification outbox is recording delivery errors.');

  const broken =
    driftRows > 0 ||
    outbox.state === 'failing' ||
    jobs.some((j) => j.state === 'stale' || j.state === 'failed' || (j.cron !== null && !j.cron.active));
  const degraded = jobs.some((j) => j.state === 'late' || j.state === 'never');

  const checked = [
    'the last run of each of the four scheduled jobs against its own schedule',
    'the pg_cron schedule table, for a job that has been switched off',
    'the notification outbox for failed rows, climbing attempts and recorded errors',
    'ledger_drift(), which compares every cached balance against the append-only ledger',
  ];

  if (!driftReadable) {
    return {
      verdict: 'unknown',
      headline: 'Ledger integrity could not be read',
      reasons: [
        'ledger_drift() did not return. Until it does, no claim about the health of this system is worth making, because a credit bug would be invisible.',
        ...reasons,
      ],
      checked,
    };
  }

  if (broken) {
    return {
      verdict: 'broken',
      headline: 'Something that runs on a schedule has stopped',
      reasons,
      checked,
    };
  }
  if (degraded) {
    return {
      verdict: 'degraded',
      headline: 'The machine is running behind',
      reasons,
      checked,
    };
  }
  return {
    verdict: 'healthy',
    headline: 'All four jobs are running on schedule and the ledger reconciles',
    reasons: [],
    checked,
  };
}

/* ------------------------------------------------------- detail rendering */

export interface DetailLine {
  label: string;
  value: string;
}

const DETAIL_SENTENCE_KEYS = ['message', 'note', 'reason'];
const DETAIL_SKIP = new Set(['ok', 'duration_ms']);

function label(key: string): string {
  const cleaned = key.replace(/_/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function value(v: unknown): string {
  if (v === null || v === undefined) return 'not set';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.length === 0 ? 'none' : v.map(value).join(', ');
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return 'none';
    return entries.map(([k, val]) => `${k.replace(/_/g, ' ')} ${value(val)}`).join(', ');
  }
  return String(v);
}

/**
 * A jsonb blob read as sentences. The sender writes a paragraph of prose into
 * `message` explaining a skip, and pasting raw JSON on the screen throws that
 * explanation away.
 */
export function readDetail(detail: Record<string, unknown> | null | undefined): {
  sentence: string | null;
  lines: DetailLine[];
} {
  if (!detail || typeof detail !== 'object') return { sentence: null, lines: [] };

  let sentence: string | null = null;
  for (const key of DETAIL_SENTENCE_KEYS) {
    const v = detail[key];
    if (typeof v === 'string' && v.trim()) {
      sentence = v.trim();
      break;
    }
  }

  const lines: DetailLine[] = [];
  for (const [key, v] of Object.entries(detail)) {
    if (DETAIL_SKIP.has(key)) continue;
    if (sentence !== null && DETAIL_SENTENCE_KEYS.includes(key) && typeof v === 'string') continue;
    lines.push({ label: label(key), value: value(v) });
  }
  lines.sort((a, b) => a.label.localeCompare(b.label));

  return { sentence, lines };
}

/** Reads the sender's own account of whether delivery is configured. */
export function senderDelivery(detail: Record<string, unknown> | null | undefined): {
  unconfigured: boolean;
  missingEnv: string[];
  message: string | null;
} {
  const d = detail ?? {};
  const missing = Array.isArray(d.missing_env)
    ? (d.missing_env as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  return {
    unconfigured: d.delivery === 'unconfigured' || d.dry_run === true,
    missingEnv: missing,
    message: typeof d.message === 'string' ? d.message : null,
  };
}
