/**
 * TESTERPOOL — presentation helpers shared by the authenticated surface.
 *
 * Everything here is pure and null-tolerant on purpose: the product is demoed
 * against a partially-populated database, so a missing app or a null timestamp
 * has to render as calm copy rather than a crash.
 */

import type { DayState } from '@/components/ui';
import type { AppStatus, LedgerReason, Tier } from '@/lib/types';
import { RULES } from '@/lib/economy';

function utcDate(input: string | Date): Date {
  const d = typeof input === 'string' ? new Date(input) : input;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isSameUtcDay(a: string | null | undefined, b: Date = new Date()): boolean {
  if (!a) return false;
  return utcDate(a).getTime() === utcDate(b).getTime();
}

/** True when the tester has already checked in for today's UTC date. */
export function checkedInToday(lastCheckinOn: string | null | undefined): boolean {
  return isSameUtcDay(lastCheckinOn);
}

/**
 * A tester's session strip. `days_checked_in` is denormalised on assignments,
 * so we render it against the current day: anything before today that was not
 * logged reads as missed. Every caller now passes a total of 1 — one seat is
 * one session — but the shape is kept general because the strip component is.
 */
export function stripFor(
  daysCheckedIn: number,
  currentDay: number,
  total: number = RULES.requiredDays
): DayState[] {
  return Array.from({ length: total }, (_, i) => {
    const day = i + 1;
    if (day <= daysCheckedIn) return 'done';
    if (currentDay > 0 && day === currentDay) return 'today';
    if (currentDay > 0 && day < currentDay) return 'missed';
    return 'future';
  });
}

/* ------------------------------------------------------------------ labels */

export const LEDGER_LABELS: Record<LedgerReason, string> = {
  signup_grant: 'Welcome grant',
  referral_bonus: 'Referral bonus',
  referral_tithe: 'Referral tithe',
  opt_in_verified: 'Confirmed install',
  daily_checkin: 'Daily check-in',
  streak_bonus: 'Perfect 14-day streak',
  feedback_approved: 'Confirmed report',
  install_charge: 'Paid a tester — install',
  review_charge: 'Paid a tester — report',
  bug_bounty: 'Blocker bug bounty',
  rescue_bonus: 'Rescue tester bonus',
  arbitration_award: 'Arbitration award',
  pod_seat_spend: 'Tester seat',
  buffer_seat_spend: 'Buffer seat',
  rescue_seat_spend: 'Rescue tester',
  priority_spend: 'Priority placement',
  expert_seat_spend: 'Expert seat',
  extra_app_spend: 'Additional app',
  purchase: 'Credit purchase',
  refund: 'Refund',
  admin_adjust: 'Manual adjustment',
  penalty_dropout: 'Dropout penalty',
  penalty_fraud: 'Fraud penalty',
};

export function ledgerLabel(reason: string): string {
  return LEDGER_LABELS[reason as LedgerReason] ?? reason.replace(/_/g, ' ');
}

export const APP_STATUS_COPY: Record<AppStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'violet' | 'neutral' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  queued: { label: 'Listed', tone: 'amber' },
  in_pod: { label: 'Taking testers', tone: 'green' },
  graduated: { label: 'Graduated', tone: 'violet' },
  paused: { label: 'Paused', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'red' },
};


export function tierOf(value: string | null | undefined): Tier {
  return value === 'silver' || value === 'gold' || value === 'platinum' ? value : 'bronze';
}

/* ------------------------------------------------------------ opt-in links */

export interface OptInUrlCheck {
  ok: boolean;
  reason: string;
}

/**
 * A Play closed-testing opt-in link looks like
 *   https://play.google.com/apps/testing/com.example.app
 * or a Google Group / Google Groups invite for group-based tracks. We warn
 * rather than block: Play occasionally hands out other shapes, and a hard
 * block on a valid link is worse than a soft warning on an odd one.
 */
export function checkOptInUrl(raw: string): OptInUrlCheck {
  const url = raw.trim();
  if (!url) return { ok: false, reason: 'Add the opt-in link testers will open.' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'That is not a full URL. Include https:// at the start.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Use the https:// version of the link.' };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (host === 'play.google.com' && path.startsWith('/apps/testing/')) {
    const pkg = path.replace('/apps/testing/', '').replace(/\/$/, '');
    if (/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(pkg)) {
      return { ok: true, reason: 'This is a standard Play closed-testing opt-in link.' };
    }
    return { ok: false, reason: 'The package name in that link does not look valid.' };
  }

  if (host === 'groups.google.com') {
    return { ok: true, reason: 'Group-based track. Testers join the group, then open the track.' };
  }

  return {
    ok: false,
    reason: 'Most opt-in links look like https://play.google.com/apps/testing/your.package.name. Double-check this one before anyone tries to join.',
  };
}

export function checkPackageName(raw: string): boolean {
  return /^[a-z][a-z0-9_]*(\.[a-z0-9_]+){1,}$/i.test(raw.trim());
}

export function checkHandle(raw: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(raw.trim().toLowerCase());
}

export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

/** Google closed tracks are keyed to a Google account, so flag the obvious misses. */
export function isGoogleAccountEmail(raw: string): boolean {
  const domain = raw.trim().toLowerCase().split('@')[1] ?? '';
  return domain === 'gmail.com' || domain === 'googlemail.com';
}

/* ------------------------------------------------------------- formatting */

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
}

export function fmtRelative(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(value);
}

export function n(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}


export function referralLink(code: string, origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://testerpool.dev';
  return `${base.replace(/\/$/, '')}/login?ref=${code}`;
}
