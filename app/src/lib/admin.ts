/**
 * TESTERPOOL — admin surface types and pure helpers.
 *
 * Mirrors the admin migration: the `admin_overview` and
 * `admin_user_rows` views, the append-only `admin_actions` log, `feature_flags`
 * and `announcements`. Everything here is null-tolerant, because the admin
 * dashboard is the one screen that has to render when the data is broken —
 * that is usually why someone opened it.
 */

import type { Tier } from '@/lib/types';

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

/* ----------------------------------------------------------- audit labels */

export const AUDIT_ACTION_COPY: Record<string, string> = {
  adjust_credits: 'Adjusted credits',
  set_role: 'Changed role',
  ban: 'Banned account',
  unban: 'Lifted ban',
  set_config: 'Changed economy config',
  set_flag: 'Toggled feature flag',
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
export const KILL_SWITCHES = new Set(['activities', 'checkins_open']);

export const FLAG_CONSEQUENCE: Record<string, string> = {
  signups_open: 'Off means the signup form rejects new accounts. Existing users are unaffected.',
  activities: 'Off closes the feed. Nobody can take a new app on; work already started still finishes.',
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
