/**
 * TESTERPOOL — the marketplace: shapes, filters, and the copy each state uses.
 *
 * The directory of apps in the pool. A developer arrives here for one of three
 * reasons and the filters are named after those reasons rather than after the
 * columns underneath them:
 *
 *   "what can I test"      → Needs testers
 *   "what am I mid-way through, what do I owe" → Testing now, Report due
 *   "how is mine doing"    → My apps
 *
 * Everything is a URL parameter. That makes a filtered view linkable, keeps the
 * back button honest, and leaves the reading and sorting in the database where
 * it belongs — the client never holds the full list.
 *
 * Two things that are absent by design, and must stay absent: there are no
 * ratings and no score averages anywhere in this file. Feedback is private
 * between a tester and the developer, and an average rendered beside an app
 * icon is a rating board — the exact shape the schema refuses to be able to
 * represent. Members see activity: testers holding, days held, reports
 * delivered.
 */

import type { Tone } from '@/components/ui';

/* -------------------------------------------------------------- the row */

/** One row of `market_apps()`. Every field the RPC is willing to hand over. */
export interface MarketApp {
  id: string;
  name: string;
  tagline: string | null;
  category: string | null;
  platform: 'android' | 'ios';
  icon_url: string | null;
  /** Only ever set once the app graduated; there is no public page before that. */
  store_url: string | null;
  status: 'draft' | 'queued' | 'in_pod' | 'graduated' | 'paused' | 'rejected';
  focus_areas: string[] | null;
  min_android_version: string | null;
  created_at: string;
  graduated_at: string | null;
  owner_id: string;
  owner_handle: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
  owner_country_code: string | null;
  owner_reliability: number | null;
  owner_tier: string | null;
  testers_active: number | null;
  testers_full: number | null;
  reports: number | null;
  pod_status: string | null;
  pod_day: number | null;
  pod_seats_left: number | null;
  /** Where the viewer stands with this app. Drives every CTA on the surface. */
  relation: 'owner' | 'testing' | 'tested' | 'none';
  assignment_id: string | null;
  days_checked_in: number | null;
  report_due: boolean | null;
  watching: boolean | null;
  total_count: number | null;
}

/** `market_app()` — the same row plus what a detail page has room for. */
export interface MarketAppDetail extends MarketApp {
  description: string | null;
  /** Null unless the viewer owns the app or holds an assignment on it. */
  tester_instructions: string | null;
  opt_in_url: string | null;
  package_name: string | null;
  owner_apps: number | null;
  owner_pods_completed: number | null;
  owner_apps_helped_ship: number | null;
}

/* ------------------------------------------------------------- filters */

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  /** Shown under the chip row once the filter is active. One sentence, plain. */
  hint?: string;
}

export type Scope = 'all' | 'testing' | 'due' | 'tested' | 'mine' | 'saved';
export type PlatformFilter = 'all' | 'android' | 'ios';
export type StatusFilter = 'all' | 'needs_testers' | 'in_testing' | 'graduated';
export type Sort = 'newest' | 'testers' | 'reports' | 'graduated' | 'name';

export const SCOPES: FilterOption<Scope>[] = [
  { value: 'all',     label: 'All apps' },
  { value: 'testing', label: 'Testing now', hint: 'Apps you hold a live seat on.' },
  { value: 'due',     label: 'Report due',  hint: 'You have passed day seven and not written your report yet. Each one pays 30.' },
  { value: 'tested',  label: 'Tested',      hint: 'Everything you have ever been seated on.' },
  { value: 'mine',    label: 'My apps',     hint: 'Your listings, drafts included. Only you see the drafts.' },
  { value: 'saved',   label: 'Saved',       hint: 'Apps you saved to come back to. Saving is private and pays nothing.' },
];

export const PLATFORMS: FilterOption<PlatformFilter>[] = [
  { value: 'all',     label: 'All' },
  { value: 'android', label: 'Android' },
  { value: 'ios',     label: 'iOS', hint: 'iOS is a listing feature on its own: discovery and visibility, separate from pods and credits, and never connected to App Store reviews or ratings.' },
];

export const STATUSES: FilterOption<StatusFilter>[] = [
  { value: 'all',           label: 'Any stage' },
  { value: 'needs_testers', label: 'Needs testers' },
  { value: 'in_testing',    label: 'In testing' },
  { value: 'graduated',     label: 'Graduated' },
];

export const SORTS: FilterOption<Sort>[] = [
  { value: 'newest',    label: 'Newest' },
  { value: 'testers',   label: 'Most testers' },
  { value: 'reports',   label: 'Most reports' },
  { value: 'graduated', label: 'Recently graduated' },
  { value: 'name',      label: 'A–Z' },
];

function pick<T extends string>(options: FilterOption<T>[], raw: string | undefined, fallback: T): T {
  return options.some((o) => o.value === raw) ? (raw as T) : fallback;
}

export interface MarketQuery {
  scope: Scope;
  platform: PlatformFilter;
  status: StatusFilter;
  category: string;
  q: string;
  sort: Sort;
  page: number;
}

export const PAGE_SIZE = 24;

/** Read the query string defensively — a hand-edited URL must never 500. */
export function parseQuery(params: Record<string, string | string[] | undefined>): MarketQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
  };
  const page = Number.parseInt(one('page'), 10);

  return {
    scope: pick(SCOPES, one('scope'), 'all'),
    platform: pick(PLATFORMS, one('platform'), 'all'),
    status: pick(STATUSES, one('status'), 'all'),
    category: one('category').slice(0, 60) || 'all',
    q: one('q').slice(0, 80),
    sort: pick(SORTS, one('sort'), 'newest'),
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 40) : 1,
  };
}

/** Build a marketplace URL, dropping defaults so the common view has a clean one. */
export function marketHref(query: Partial<MarketQuery>): string {
  const search = new URLSearchParams();
  if (query.scope && query.scope !== 'all') search.set('scope', query.scope);
  if (query.platform && query.platform !== 'all') search.set('platform', query.platform);
  if (query.status && query.status !== 'all') search.set('status', query.status);
  if (query.category && query.category !== 'all') search.set('category', query.category);
  if (query.q) search.set('q', query.q);
  if (query.sort && query.sort !== 'newest') search.set('sort', query.sort);
  if (query.page && query.page > 1) search.set('page', String(query.page));
  const qs = search.toString();
  return qs ? `/market?${qs}` : '/market';
}

/** True when anything is narrowing the list — drives the "Clear" affordance. */
export function isFiltered(query: MarketQuery): boolean {
  return (
    query.scope !== 'all' ||
    query.platform !== 'all' ||
    query.status !== 'all' ||
    query.category !== 'all' ||
    query.q !== ''
  );
}

/* ------------------------------------------------------------ presentation */

/**
 * What stage the app is at, said the way a browsing developer would say it.
 * `apps.status` alone is not enough: 'in_pod' means "still filling" or "day 6
 * of 14" depending on the pod, and those are different things to a reader.
 */
export function stageOf(
  app: Pick<MarketApp, 'status' | 'pod_status' | 'pod_day' | 'pod_seats_left' | 'platform'>
): { label: string; tone: Tone } {
  // An iOS app has no pod to be looking for, so it never borrows pod language.
  if (app.platform === 'ios') {
    return app.status === 'graduated'
      ? { label: 'Published', tone: 'green' }
      : { label: 'Listed', tone: 'neutral' };
  }
  if (app.status === 'graduated') return { label: 'Graduated', tone: 'green' };
  if (app.status === 'draft')     return { label: 'Draft', tone: 'neutral' };
  if (app.status === 'paused')    return { label: 'Paused', tone: 'amber' };
  if (app.status === 'rejected')  return { label: 'Rejected', tone: 'red' };
  if (app.status === 'queued')    return { label: 'Looking for a pod', tone: 'amber' };

  // in_pod
  if (!app.pod_status || app.pod_status === 'forming') {
    const left = app.pod_seats_left;
    return {
      label: left && left > 0 ? `${left} seats left` : 'Pod filling',
      tone: 'amber',
    };
  }
  if (app.pod_status === 'active' && app.pod_day) {
    return { label: `Day ${app.pod_day} of 14`, tone: 'violet' };
  }
  if (app.pod_status === 'completed') return { label: 'Pod finished', tone: 'neutral' };
  if (app.pod_status === 'failed')    return { label: 'Pod failed', tone: 'red' };
  return { label: 'In a pod', tone: 'violet' };
}

/** The viewer's own standing with an app, when it is worth saying at all. */
export function relationCopy(app: Pick<MarketApp, 'relation' | 'report_due'>): { label: string; tone: Tone } | null {
  if (app.relation === 'owner') return { label: 'Yours', tone: 'green' };
  if (app.report_due) return { label: 'Report due', tone: 'amber' };
  if (app.relation === 'testing') return { label: 'You are testing this', tone: 'violet' };
  if (app.relation === 'tested') return { label: 'You tested this', tone: 'neutral' };
  return null;
}

/**
 * iOS is a listing feature of its own, deliberately separate.
 *
 * The pod mechanic exists to satisfy Google Play's closed-testing gate — 12
 * testers, 14 consecutive days — before a personal developer account may
 * publish. Apple has no equivalent gate, so there is nothing for an iOS build
 * to clear and no reason to route one through pods, credits or proof.
 *
 * What an iOS listing is: discovery. What it is not, and must never become: a
 * route to an App Store review or rating. That is the same line invariant 1
 * draws for Android, drawn again here.
 */
export function isListingOnly(app: Pick<MarketApp, 'platform'>): boolean {
  return app.platform === 'ios';
}
