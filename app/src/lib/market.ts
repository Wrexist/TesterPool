/**
 * TESTERPOOL — the marketplace: shapes, filters, and the copy each state uses.
 *
 * Two features, kept apart on purpose:
 *
 *   MARKETPLACE (here)  the apps. Find one, open it, install it, report on it.
 *   PODS (/pods)        the 14-day clock. Seats, days, dropouts, escrow.
 *
 * A card in here therefore says nothing about pod mechanics — no seat counts,
 * no "day 6 of 14", no forming/locked. Those are the pod's business and they
 * live on the pod's screen. What a browsing developer needs here is: what is
 * this, which store is it for, is it open to testers, and where do I already
 * stand with it. Four things, so a card shows four things.
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
import { EARN } from '@/lib/economy';

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
  /**
   * Whether this viewer could start an activity on this app right now. Computed
   * in `market_apps()` against every condition `start_activity` enforces —
   * the owner's consent, their remaining seats, their balance, the flag — so a
   * row that offers the work is a row the RPC will accept.
   */
  activity_open: boolean | null;
  activity_seats_left: number | null;
  /**
   * True when the seat you hold here is an activity rather than a pod seat.
   * The two differ in exactly one visible way: an activity is one check-in and
   * has no fourteen-day clock, so nothing should draw a streak strip against it.
   */
  is_activity: boolean | null;
  total_count: number | null;
}

/** `market_app()` — the same row plus what a detail page has room for. */
export interface MarketAppDetail extends MarketApp {
  description: string | null;
  /** Null unless the viewer owns the app or holds an assignment on it. */
  tester_instructions: string | null;
  opt_in_url: string | null;
  package_name: string | null;
  /** True once the viewer's own opt-in screenshot has been accepted. */
  opt_in_verified: boolean | null;
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

export type Scope = 'all' | 'open' | 'testing' | 'due' | 'tested' | 'mine' | 'saved';
export type PlatformFilter = 'all' | 'android' | 'ios';
export type StatusFilter = 'all' | 'needs_testers' | 'in_testing' | 'graduated';
export type Sort = 'newest' | 'testers' | 'reports' | 'graduated' | 'name';

export const SCOPES: FilterOption<Scope>[] = [
  { value: 'all',     label: 'All' },
  // First, and first for a reason: it is the only chip that answers "is there
  // anything here for me to do", which is the question a member arrives with.
  { value: 'open',    label: 'Open to me', hint: 'Apps you can start on right now. Join the closed test, use it, send one report.' },
  { value: 'testing', label: 'Testing' },
  { value: 'due',     label: 'Report due' },
  { value: 'tested',  label: 'Tested' },
  { value: 'mine',    label: 'Mine' },
  { value: 'saved',   label: 'Saved' },
];

// The platform control is the loudest thing in the bar and it is drawn as two
// logos, because a developer recognises the robot and the apple faster than
// they read either word.
export const PLATFORMS: FilterOption<PlatformFilter>[] = [
  { value: 'all',     label: 'All' },
  { value: 'android', label: 'Android' },
  { value: 'ios',     label: 'iOS', hint: 'iOS apps are listings. Pods are Android only.' },
];

export const STATUSES: FilterOption<StatusFilter>[] = [
  { value: 'all',           label: 'Any status' },
  { value: 'needs_testers', label: 'Open to testers' },
  { value: 'in_testing',    label: 'Testing now' },
  { value: 'graduated',     label: 'Shipped' },
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
 * Where the app is in its life, in store language rather than pod language.
 *
 * Deliberately three words at most, and deliberately silent about seats, days
 * and pod status: that is the other feature. A developer browsing for something
 * to test needs one bit — can I get in — and the rest belongs on /pods.
 */
export function stageOf(
  app: Pick<MarketApp, 'status' | 'pod_status' | 'platform'>
): { label: string; tone: Tone } {
  if (app.status === 'graduated') return { label: 'Shipped', tone: 'green' };
  if (app.status === 'paused')    return { label: 'Paused', tone: 'amber' };
  if (app.status === 'rejected')  return { label: 'Removed', tone: 'red' };
  if (app.status === 'draft')     return { label: 'Draft', tone: 'neutral' };

  // iOS is a listing: there is no pod for it to be open to, but it still gets a
  // chip, because a card with an empty chip row reads as a card missing data.
  if (app.platform === 'ios') return { label: 'Listed', tone: 'neutral' };

  // "Open", not "Open to testers": on a 390px row the longer label wrapped to
  // two lines and made that row taller than its neighbours.
  if (app.status === 'queued') return { label: 'Open', tone: 'green' };
  if (app.status === 'in_pod' && coalescePodStatus(app.pod_status) === 'forming') {
    return { label: 'Open', tone: 'green' };
  }
  // Neutral, and worded differently from the tester's own "You're testing":
  // colour carries who a chip is about, and two violet chips a word apart made
  // the app's state and the reader's state look like the same fact.
  return { label: 'In testing', tone: 'neutral' };
}

function coalescePodStatus(status: string | null): string {
  return status ?? 'forming';
}

/**
 * The viewer's own standing, when there is one worth a chip.
 *
 * Short, because it sits next to the status and two long chips wrap the row.
 */
export function relationCopy(app: Pick<MarketApp, 'relation' | 'report_due'>): { label: string; tone: Tone } | null {
  if (app.relation === 'owner') return { label: 'Yours', tone: 'green' };
  if (app.report_due) return { label: 'Report due', tone: 'amber' };
  if (app.relation === 'testing') return { label: 'Your test', tone: 'violet' };
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

/** The three numbers at the top of the marketplace. `market_pulse()`. */
export interface MarketPulse {
  active_testers: number | null;
  installs: number | null;
  reports: number | null;
  open_apps: number | null;
}

/**
 * What testing this app pays, or null when there is nothing to earn on it.
 *
 * A marketplace row that does not say what the work pays is a listing; one that
 * does is a job. The number is the sum of the two transfers a tester earns —
 * the confirmed install and the approved report — and it is read from the
 * economy constants rather than typed into the component, so the day the rate
 * changes there is one place to change it.
 *
 * Null for your own app (you pay it, you do not earn it), for an app you have
 * already finished, and for an iOS listing, which is not seated at all yet.
 */
export function rewardFor(
  app: Pick<MarketApp, 'relation' | 'platform' | 'status'>
): number | null {
  if (app.relation === 'owner' || app.relation === 'tested') return null;
  if (app.platform === 'ios') return null;
  if (app.status === 'graduated' || app.status === 'draft' || app.status === 'paused') return null;
  return EARN.optInVerified + EARN.feedbackApproved;
}

/**
 * The one chip a card shows.
 *
 * Where you stand beats what the app is doing: "Report due" is worth more to
 * you than "Testing now", and printing both produced rows reading
 * "TESTING NOW · TESTING", which is noise wearing two colours.
 */
export function cardChip(
  app: Pick<MarketApp, 'status' | 'pod_status' | 'platform' | 'relation' | 'report_due'>
): { label: string; tone: Tone } {
  return relationCopy(app) ?? stageOf(app);
}
