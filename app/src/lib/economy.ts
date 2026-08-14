/**
 * TESTERPOOL — economy constants (mirrors the `economy_config` table).
 *
 * Read the DB at runtime for anything authoritative; this file exists so the
 * UI can render prices without a round-trip, and so the numbers are documented
 * somewhere a human will actually read.
 *
 * The design rule the whole economy hangs on: credits MOVE, they are not
 * minted. Every credit a tester earns comes out of the balance of the developer
 * whose app they tested.
 *
 *   confirmed install (closed-track opt-in)   tester +10   app owner -10
 *   confirmed report  (private feedback)      tester +30   app owner -30
 *
 * A full cycle is 14 testers on your app and 14 apps tested back, so 14 x 40 =
 * 560 out as a developer and 560 in as a tester. Anyone who does their share
 * breaks exactly even; slacking costs, and doing more than your share earns.
 * Conserved currency cannot inflate.
 *
 * The report charge is FLAT. A blocker report costs the developer exactly what
 * a glowing one costs. If critical feedback were dearer, developers would learn
 * to dispute it — the positivity machine this product was built against. The
 * blocker bounty is funded by the platform for the same reason.
 *
 * "Install" is a closed testing track opt-in; "report" is a private structured
 * report. Neither is, or may become, a public store install, rating or review.
 */

export const EARN = {
  /** Covers one full cycle (14 x 40 = 560) so a new developer is never stuck. */
  signupGrant: 600,
  optInVerified: 10,
  /**
   * Zero, deliberately. If a check-in still minted 5, testing one app would pay
   * 130 while costing its developer 40 — 90 credits from nothing per app, and a
   * full cycle inflating the supply by 1,260. Actually opening the app is still
   * the most important thing a tester does; it is enforced through reliability,
   * which gates how much work you can hold, rather than bribed through the
   * balance.
   */
  dailyCheckin: 0,
  streakBonusFull: 0,
  feedbackApproved: 30,
  /** Funded by us, never the developer: finding the worst bug must not cost them most. */
  bugBountyBlocker: 15,
  rescueBonus: 50,
  referralReferrer: 75,
  referralReferee: 50,
  referralTithePct: 5,
} as const;

/** What a developer pays for the work done on their app. Mirrors EARN exactly. */
export const CHARGE = {
  install: 10,
  review: 30,
} as const;

/** Free-tier throttle. Resets at midnight UTC; the paid pass removes it. */
export const CAPS = {
  dailyInstalls: 10,
  dailyReviews: 10,
} as const;

export const COST = {
  bufferSeat: 145,
  rescueSeat: 260,
  /** economy_config key is still `cost_priority_pod`. */
  priorityMatch: 400,
  expertSeat: 300,
  extraApp: 200,
} as const;

export const PENALTY = {
  dropout: 120,
} as const;

export const RULES = {
  /** Google's requirement: 12 testers, 14 consecutive days. */
  requiredTesters: 12,
  requiredDays: 14,
  /**
   * The reference cycle: 15 developers, so you test 14 apps and 14 test yours.
   * Nothing schedules this any more — there is no cohort — but it is still the
   * unit the economy balances on, and the number the evidence pack aims at.
   */
  cycleSize: 15,
  /** The daily cap is the real throttle now; 5 made ten installs a day unreachable. */
  maxConcurrentAssignments: 20,
  minReliabilityToJoin: 40,
} as const;

/** What one tested app pays a tester, and costs its developer. */
export const PER_APP_EARNINGS = EARN.optInVerified + EARN.feedbackApproved; // = 40

/** Testing a full cycle of apps: what you earn back as a tester. */
export const FULL_CYCLE_EARNINGS = PER_APP_EARNINGS * (RULES.cycleSize - 1); // = 560

/** What a full cycle of testers costs the developer. Equal, by design. */
export const FULL_CYCLE_COST = (CHARGE.install + CHARGE.review) * (RULES.cycleSize - 1); // = 560

export const TIERS = {
  bronze:   { label: 'Bronze',   min: 0,  color: '#B08D57', ring: 'rgba(176,141,87,.35)' },
  silver:   { label: 'Silver',   min: 75, color: '#C3CAD6', ring: 'rgba(195,202,214,.35)' },
  gold:     { label: 'Gold',     min: 85, color: '#F5B544', ring: 'rgba(245,181,68,.35)' },
  platinum: { label: 'Platinum', min: 92, color: '#7C6CFF', ring: 'rgba(124,108,255,.35)' },
} as const;

export type TierKey = keyof typeof TIERS;

export function reliabilityBand(score: number) {
  if (score >= 75) return { label: 'Trusted',  color: 'var(--color-accent)' };
  if (score >= 40) return { label: 'Building', color: 'var(--color-credit)' };
  return { label: 'At risk', color: 'var(--color-danger)' };
}

/** Cash pricing. Sits inside the validated $15–$40 band competitors occupy. */
export const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    cadence: '',
    tagline: 'Earn your testers by testing.',
    features: [
      'List an app and take testers straight off the feed',
      'No queue and no cohort to wait for',
      `${EARN.signupGrant} credits to start — a full cycle, on us`,
      `Up to ${CAPS.dailyInstalls} installs and ${CAPS.dailyReviews} reports a day`,
      'Production Evidence Pack',
    ],
    cta: 'Start free',
  },
  {
    key: 'unlimited',
    name: 'Unlimited',
    price: 6,
    cadence: 'per month',
    tagline: 'Test as much as you like. Earn as fast as you can.',
    features: [
      `No daily limit — free members bank ${CAPS.dailyInstalls} installs and ${CAPS.dailyReviews} reports a day`,
      'Clear a full cycle in an afternoon instead of two days',
      'Earn credits faster than you spend them',
      'A 30-day pass, bought once — no auto-renewal to cancel',
      'Everything in Free',
    ],
    cta: 'Remove the limit',
  },
  {
    key: 'fast',
    name: 'Fast Track',
    price: 19,
    cadence: 'per app',
    tagline: 'Top of the feed until you are full.',
    highlight: true,
    features: [
      'Priority placement in the feed while you are collecting',
      '18 testers — six spare, not three',
      'Free replacement if anyone abandons a seat',
      'Everything in Free',
    ],
    cta: 'Get Fast Track',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 39,
    cadence: 'per app',
    tagline: 'For the launch you cannot afford to redo.',
    features: [
      '20 testers, all reliability 85+',
      'Two expert testers who write long-form reports',
      'Unlimited replacements',
      'Reviewed Evidence Pack + application draft',
      'Priority arbitration and support',
    ],
    cta: 'Go Pro',
  },
  {
    key: 'rescue',
    name: 'Rescue',
    price: 9,
    cadence: 'one-off',
    tagline: 'Someone took a seat and vanished. Fix it in hours.',
    features: [
      'One verified replacement tester',
      'Found within 6 hours',
      'Opt-in verified before you are charged',
      'Available to any plan, any time',
    ],
    cta: 'Send a rescue',
  },
] as const;
