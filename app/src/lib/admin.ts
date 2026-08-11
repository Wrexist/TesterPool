/**
 * TESTERPOOL — admin surface types and pure helpers.
 *
 * Mirrors the admin migration: the `admin_overview`, `admin_pod_watch` and
 * `admin_user_rows` views, the append-only `admin_actions` log, `feature_flags`
 * and `announcements`. Everything here is null-tolerant, because the admin
 * dashboard is the one screen that has to render when the data is broken —
 * that is usually why someone opened it.
 */

import type { PodStatus, Tier } from '@/lib/types';

/* ------------------------------------------------------------------ types */

export type UserRole = 'user' | 'moderator' | 'admin';
export type AnnouncementTone = 'info' | 'warning' | 'critical';

export interface AdminOverviewRow {
  users: number | null;
  users_7d: number | null;
  banned: number | null;
  apps: number | null;
  apps_graduated: number | null;
  pods_forming: number | null;
  pods_active: number | null;
  assignments_active: number | null;
  assignments_dropped: number | null;
  avg_days: number | string | null;
  checkins_today: number | null;
  proofs_pending: number | null;
  disputes_open: number | null;
  feedback_unreviewed: number | null;
  credits_outstanding: number | null;
  credits_minted: number | null;
  credits_burned: number | null;
}

export interface AdminPodWatchRow {
  id: string;
  code: string | null;
  name: string | null;
  status: PodStatus;
  core_seats: number | null;
  required_testers: number | null;
  starts_at: string | null;
  ends_at: string | null;
  day_index: number | null;
  members: number | null;
  dropouts: number | null;
  active_assignments: number | null;
  avg_days: number | string | null;
  apps_on_track: number | null;
}

export interface AdminUserRow {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  country_code: string | null;
  tester_email: string | null;
  role: UserRole;
  is_banned: boolean;
  ban_reason: string | null;
  credits: number | null;
  reliability: number | string | null;
  tier: Tier;
  pods_completed: number | null;
  pods_dropped: number | null;
  current_streak: number | null;
  created_at: string;
  referred_by: string | null;
  apps: number | null;
  active_tests: number | null;
  rejected_reports: number | null;
  last_checkin_at: string | null;
}

export interface AdminActionRow {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

export interface FeatureFlagRow {
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string | null;
}

export interface AnnouncementRow {
  id: string;
  body: string;
  tone: AnnouncementTone;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface EconomyConfigRow {
  key: string;
  value: number;
  note: string | null;
}

/* ------------------------------------------------------------------ roles */

export const ROLE_COPY: Record<UserRole, { label: string; tone: 'neutral' | 'violet' | 'amber'; note: string }> = {
  user: { label: 'User', tone: 'neutral', note: 'Standard account. No elevated reads.' },
  moderator: {
    label: 'Moderator',
    tone: 'violet',
    note: 'Reads the proof queue and disputes. Cannot move credits or change roles.',
  },
  admin: {
    label: 'Admin',
    tone: 'amber',
    note: 'Full control: credits, roles, bans, economy, flags. Every action is logged.',
  },
};

export function roleOf(value: string | null | undefined): UserRole {
  return value === 'admin' || value === 'moderator' ? value : 'user';
}

/* --------------------------------------------------------------- pod risk */

export type PodRiskLevel = 'critical' | 'warning' | 'steady' | 'idle';

export interface PodRisk {
  level: PodRiskLevel;
  score: number;
  /** Ordered, most severe first. Empty when the pod is healthy. */
  reasons: string[];
}

/**
 * Risk is a sort key, not a verdict. It exists so the pod that is quietly
 * failing sorts above the twelve that are fine, at 2am, without reading.
 */
export function podRisk(pod: AdminPodWatchRow): PodRisk {
  const reasons: string[] = [];
  let score = 0;

  const day = num(pod.day_index);
  const avg = num(pod.avg_days);
  const members = num(pod.members);
  const dropouts = num(pod.dropouts);
  const required = num(pod.required_testers, 12);
  const onTrack = num(pod.apps_on_track);

  if (pod.status !== 'active' && pod.status !== 'forming' && pod.status !== 'locked') {
    return { level: 'idle', score: -1, reasons: [] };
  }

  if (dropouts > 0) {
    score += dropouts * 30;
    reasons.push(
      `${dropouts} ${dropouts === 1 ? 'member has' : 'members have'} dropped. Each one resets someone's 14-day clock.`
    );
  }

  // Falling behind: the average tester is more than a day behind the pod day.
  if (pod.status === 'active' && day > 1) {
    const lag = day - avg;
    if (lag >= 2) {
      score += Math.round(lag * 25);
      reasons.push(`Average tester is ${lag.toFixed(1)} days behind day ${day}. The pod will not clear 14 consecutive days at this rate.`);
    } else if (lag >= 1) {
      score += Math.round(lag * 12);
      reasons.push(`Average tester is ${lag.toFixed(1)} days behind day ${day}.`);
    }
  }

  if (pod.status === 'active' && onTrack > 0 && onTrack < required) {
    score += (required - onTrack) * 8;
    reasons.push(`${onTrack} of ${required} apps are on track for the 12-tester bar.`);
  }

  if (members > 0 && members < required) {
    score += (required - members) * 6;
    reasons.push(`${members} members against a ${required}-tester requirement.`);
  }

  const level: PodRiskLevel = score >= 50 ? 'critical' : score >= 15 ? 'warning' : 'steady';
  return { level, score, reasons };
}

export const RISK_TONE: Record<PodRiskLevel, 'red' | 'amber' | 'green' | 'neutral'> = {
  critical: 'red',
  warning: 'amber',
  steady: 'green',
  idle: 'neutral',
};

export const RISK_LABEL: Record<PodRiskLevel, string> = {
  critical: 'Critical',
  warning: 'Watch',
  steady: 'Steady',
  idle: 'Closed',
};

/* ----------------------------------------------------------- audit labels */

export const AUDIT_ACTION_COPY: Record<string, string> = {
  adjust_credits: 'Adjusted credits',
  set_role: 'Changed role',
  ban: 'Banned account',
  unban: 'Lifted ban',
  set_config: 'Changed economy config',
  set_flag: 'Toggled feature flag',
  pod_force_start: 'Force-started pod',
  pod_extend: 'Extended pod',
  pod_complete: 'Marked pod complete',
  pod_cancel: 'Cancelled pod',
  proof_approve: 'Approved proof',
  proof_reject: 'Rejected proof',
};

export function auditLabel(action: string): string {
  return AUDIT_ACTION_COPY[action] ?? action.replace(/_/g, ' ');
}

export const AUDIT_TONE: Record<string, 'red' | 'amber' | 'green' | 'violet' | 'neutral'> = {
  adjust_credits: 'amber',
  set_role: 'violet',
  ban: 'red',
  unban: 'green',
  set_config: 'amber',
  set_flag: 'violet',
  pod_force_start: 'green',
  pod_extend: 'amber',
  pod_complete: 'green',
  pod_cancel: 'red',
  proof_approve: 'green',
  proof_reject: 'amber',
};

export function auditTone(action: string): 'red' | 'amber' | 'green' | 'violet' | 'neutral' {
  return AUDIT_TONE[action] ?? 'neutral';
}

/* ------------------------------------------------------------------ diffs */

export type DiffKind = 'added' | 'removed' | 'changed' | 'same';

export interface DiffLine {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
  kind: DiffKind;
}

const NOISE_KEYS = new Set(['id', 'created_at', 'updated_at']);

function scalar(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function humanKey(key: string): string {
  const cleaned = key.replace(/_/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Renders a jsonb before/after pair as readable lines. An audit entry nobody
 * can read is a log, not accountability.
 */
export function jsonDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  opts: { includeUnchanged?: boolean } = {}
): DiffLine[] {
  const a = before ?? {};
  const b = after ?? {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => !NOISE_KEYS.has(k))
    .sort();

  const lines: DiffLine[] = [];
  for (const key of keys) {
    const beforeValue = scalar(a[key]);
    const afterValue = scalar(b[key]);
    if (beforeValue === afterValue) {
      if (opts.includeUnchanged) {
        lines.push({ key, label: humanKey(key), before: beforeValue, after: afterValue, kind: 'same' });
      }
      continue;
    }
    const kind: DiffKind =
      beforeValue === null ? 'added' : afterValue === null ? 'removed' : 'changed';
    lines.push({ key, label: humanKey(key), before: beforeValue, after: afterValue, kind });
  }
  return lines;
}

/* ------------------------------------------------------------------ flags */

/** Flags that stop the core loop. Named here so the UI can shout before, not after. */
export const KILL_SWITCHES = new Set(['pod_matching', 'checkins_open']);

export const FLAG_CONSEQUENCE: Record<string, string> = {
  signups_open: 'Off means the signup form rejects new accounts. Existing users are unaffected.',
  pod_matching: 'Off freezes matching. No pod can form or start, and every queued app waits.',
  checkins_open: 'Off blocks every check-in. Streaks break network-wide within a day, and broken streaks cost people a month.',
  paid_tiers: 'Off hides paid plans and blocks purchases. Credit earning continues.',
  apple_login: 'Off removes the Apple sign-in button. Accounts already using it can still sign in.',
  github_login: 'Off removes the GitHub sign-in button. Accounts already using it can still sign in.',
  auto_approve_proofs: 'Off sends every proof to the human queue. Moderation load stops being sublinear.',
};

export const TONE_COPY: Record<AnnouncementTone, { label: string; tone: 'neutral' | 'amber' | 'red' }> = {
  info: { label: 'Info', tone: 'neutral' },
  warning: { label: 'Warning', tone: 'amber' },
  critical: { label: 'Critical', tone: 'red' },
};

export function toneOf(value: string | null | undefined): AnnouncementTone {
  return value === 'warning' || value === 'critical' ? value : 'info';
}

/* -------------------------------------------------------------- utilities */

/** Numeric coercion that survives Postgres numerics arriving as strings. */
export function num(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

/** Reasons under five characters are rejected by the RPCs. Check before the round-trip. */
export const MIN_REASON = 5;

export function reasonTooShort(reason: string): boolean {
  return reason.trim().length < MIN_REASON;
}
