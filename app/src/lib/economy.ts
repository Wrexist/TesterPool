/**
 * TESTERPOOL — economy constants (mirrors the `economy_config` table).
 *
 * Read the DB at runtime for anything authoritative; this file exists so the
 * UI can render prices without a round-trip, and so the numbers are documented
 * somewhere a human will actually read.
 *
 * The design rule the whole economy hangs on:
 *   one full honest cycle of tester work  ==  one buffer seat
 *   (10 opt-in + 70 check-ins + 40 feedback + 20 streak = 140 ≈ 145)
 * The pod itself is barter and needs no currency. Credits price only the
 * edges — buffers, rescues, priority, expert seats — which is why the currency
 * can be non-inflationary without taking a rake on the core loop.
 */

export const EARN = {
  signupGrant: 150,
  optInVerified: 10,
  dailyCheckin: 5,
  streakBonusFull: 20,
  feedbackApproved: 40,
  bugBountyBlocker: 60,
  rescueBonus: 50,
  referralReferrer: 75,
  referralReferee: 50,
  referralTithePct: 5,
} as const;

export const COST = {
  bufferSeat: 145,
  rescueSeat: 260,
  priorityPod: 400,
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
  /** We seat 15 so three people can vanish and the pod still clears the bar. */
  podSeats: 15,
  maxConcurrentAssignments: 5,
  minReliabilityToJoin: 40,
} as const;

/** A full cycle of tester work, for "here's what you can earn" copy. */
export const FULL_CYCLE_EARNINGS =
  EARN.optInVerified +
  EARN.dailyCheckin * RULES.requiredDays +
  EARN.feedbackApproved +
  EARN.streakBonusFull; // = 140

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
    tagline: 'Earn your seat by testing.',
    features: [
      'Join a forming pod (typically 3–6 days to fill)',
      '15 seats for a 12-tester requirement',
      'Daily check-in tracking + streak proof',
      'Structured feedback from every tester',
      'Production Evidence Pack',
    ],
    cta: 'Start free',
  },
  {
    key: 'fast',
    name: 'Fast Pod',
    price: 19,
    cadence: 'per app',
    tagline: 'Skip the queue. Start tomorrow.',
    highlight: true,
    features: [
      'Guaranteed pod start within 24 hours',
      '18 seats — six spare, not three',
      'Free rescue tester if anyone drops',
      'Priority in the matching pool',
      'Everything in Free',
    ],
    cta: 'Get a Fast Pod',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 39,
    cadence: 'per app',
    tagline: 'For the launch you cannot afford to redo.',
    features: [
      '20 seats, all reliability 85+',
      'Two expert testers who write long-form reports',
      'Unlimited rescue replacements',
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
    tagline: 'Someone dropped on day 10. Fix it in hours.',
    features: [
      'One verified replacement tester',
      'Matched within 6 hours',
      'Opt-in verified before you are charged',
      'Available to any plan, any time',
    ],
    cta: 'Send a rescue',
  },
] as const;
