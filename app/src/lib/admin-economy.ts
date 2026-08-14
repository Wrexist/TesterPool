/**
 * TESTERPOOL — economy modelling for the live tuning page.
 *
 * The economy hangs on one relationship: a full honest cycle of tester work
 * should be worth roughly one buffer seat. Change `daily_checkin` and you have
 * changed what a buffer seat costs in human effort, whether or not you meant
 * to. This module computes those knock-on effects from the real config rows so
 * the diff preview states the consequence rather than the keystroke.
 */

import { num } from '@/lib/admin';
import { RULES } from '@/lib/economy';

export type ConfigMap = Record<string, number>;

export interface DerivedEconomy {
  /** Credits a tester earns for one complete, honest 14-day cycle. */
  fullCycle: number;
  /** Check-in earnings alone, the bulk of the cycle. */
  checkinTotal: number;
  /** How many full cycles of work one buffer seat costs. */
  cyclesPerBuffer: number;
  /** Ceiling on earnings per 14 days if every concurrent slot is used. */
  maxCycleEarnings: number;
  /** What a brand-new account is handed before doing any work. */
  newAccountGrant: number;
  /** Buffer seats a new account can buy on day one, before testing anything. */
  freeBufferSeats: number;
  /** Dropout penalty as a share of a full cycle. */
  dropoutBite: number;
  /** Rescue premium over a buffer seat. Must stay positive. */
  rescuePremium: number;
  /** Referral payout per activated invite, both halves. */
  referralCost: number;
}

export function deriveEconomy(cfg: ConfigMap): DerivedEconomy {
  const days = RULES.requiredDays;
  const checkinTotal = num(cfg.daily_checkin) * days;
  const fullCycle =
    num(cfg.opt_in_verified) + checkinTotal + num(cfg.feedback_approved) + num(cfg.streak_bonus_full);
  const buffer = num(cfg.cost_buffer_seat);

  return {
    fullCycle,
    checkinTotal,
    cyclesPerBuffer: fullCycle > 0 ? buffer / fullCycle : 0,
    maxCycleEarnings: fullCycle * num(cfg.max_concurrent_assignments, 1),
    newAccountGrant: num(cfg.signup_grant),
    freeBufferSeats: buffer > 0 ? num(cfg.signup_grant) / buffer : 0,
    dropoutBite: fullCycle > 0 ? num(cfg.penalty_dropout) / fullCycle : 0,
    rescuePremium: num(cfg.cost_rescue_seat) - buffer,
    referralCost: num(cfg.referral_referrer) + num(cfg.referral_referee),
  };
}

/* ------------------------------------------------------------ knock-on UI */

export interface ImpactLine {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

export type WarningLevel = 'danger' | 'caution' | 'note';

export interface ImpactWarning {
  level: WarningLevel;
  text: string;
}

export interface ConfigImpact {
  lines: ImpactLine[];
  warnings: ImpactWarning[];
  /** One plain sentence stating what the change does. */
  headline: string;
}

const ONE_DP = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const CREDITS = (v: number) => `${Math.round(v)} credits`;

/**
 * Model a single config change against the rest of the live config. Everything
 * here is computed, not written down: change `cost_buffer_seat` and the cycle
 * ratio moves even though the earn rates did not.
 */
export function configImpact(cfg: ConfigMap, key: string, nextValue: number): ConfigImpact {
  const current = num(cfg[key]);
  const before = deriveEconomy(cfg);
  const after = deriveEconomy({ ...cfg, [key]: nextValue });

  const lines: ImpactLine[] = [
    line('Full 14-day cycle earns', CREDITS(before.fullCycle), CREDITS(after.fullCycle)),
    line('Check-ins alone earn', CREDITS(before.checkinTotal), CREDITS(after.checkinTotal)),
    line(
      'Buffer seat costs',
      `${ONE_DP(before.cyclesPerBuffer)} cycles of work`,
      `${ONE_DP(after.cyclesPerBuffer)} cycles of work`
    ),
    line(
      'Ceiling per 14 days',
      CREDITS(before.maxCycleEarnings),
      CREDITS(after.maxCycleEarnings)
    ),
    line(
      'Signup grant buys',
      `${ONE_DP(before.freeBufferSeats)} buffer seats`,
      `${ONE_DP(after.freeBufferSeats)} buffer seats`
    ),
    line(
      'Dropout penalty costs',
      `${ONE_DP(before.dropoutBite)} cycles`,
      `${ONE_DP(after.dropoutBite)} cycles`
    ),
    line(
      'Rescue premium over buffer',
      CREDITS(before.rescuePremium),
      CREDITS(after.rescuePremium)
    ),
  ];

  const warnings: ImpactWarning[] = [];

  if (after.cyclesPerBuffer < 1 && before.cyclesPerBuffer >= 1) {
    warnings.push({
      level: 'danger',
      text: `A buffer seat would drop below one cycle of work (${ONE_DP(after.cyclesPerBuffer)}). Testers earn seats faster than they consume them, which is how a currency inflates.`,
    });
  } else if (after.cyclesPerBuffer > 1.6) {
    warnings.push({
      level: 'caution',
      text: `A buffer seat would cost ${ONE_DP(after.cyclesPerBuffer)} cycles. Above roughly 1.5 the sink stops being reachable and people stop spending.`,
    });
  }

  if (after.freeBufferSeats >= 1.5 && after.freeBufferSeats > before.freeBufferSeats) {
    warnings.push({
      level: 'danger',
      text: `A new account would be handed ${ONE_DP(after.freeBufferSeats)} buffer seats before testing anything. That is a sybil incentive: each throwaway signup pays for itself.`,
    });
  }

  if (after.rescuePremium <= 0) {
    warnings.push({
      level: 'danger',
      text: 'A rescue seat would cost the same as or less than a buffer seat. Rescues are mid-cycle emergencies and must stay the expensive option, or nobody buys buffers.',
    });
  }

  if (after.dropoutBite < 0.5 && key === 'penalty_dropout') {
    warnings.push({
      level: 'caution',
      text: `The dropout penalty would fall to ${ONE_DP(after.dropoutBite)} of a cycle. Below half a cycle it is cheaper to abandon the work than to finish it.`,
    });
  }

  if (key === 'max_concurrent_assignments' && nextValue > num(cfg.max_concurrent_assignments)) {
    warnings.push({
      level: 'caution',
      text: `Raising the concurrency cap raises the earning ceiling to ${CREDITS(after.maxCycleEarnings)} per 14 days. It also raises how much testing attention one person claims to have.`,
    });
  }

  if (key === 'referral_tithe_pct' && nextValue > 10) {
    warnings.push({
      level: 'caution',
      text: 'A tithe above 10 percent makes inviting people more profitable than testing, which is the shape of a referral farm.',
    });
  }

  if (nextValue < 0) {
    warnings.push({ level: 'danger', text: 'Negative values are not meaningful for any economy key.' });
  }

  if (after.fullCycle > 0 && after.fullCycle !== before.fullCycle) {
    const delta = after.fullCycle - before.fullCycle;
    warnings.push({
      level: 'note',
      text: `Every tester currently mid-job finishes on the new rate. This ${delta > 0 ? 'mints' : 'removes'} roughly ${Math.abs(delta)} credits per in-flight cycle.`,
    });
  }

  const headline =
    current === nextValue
      ? 'No change. The value is already set to this.'
      : `${key.replace(/_/g, ' ')} ${current} to ${nextValue}${
          after.fullCycle !== before.fullCycle
            ? `, which moves a full cycle from ${before.fullCycle} to ${after.fullCycle} credits`
            : ''
        }.`;

  return { lines, warnings, headline };
}

function line(label: string, before: string, after: string): ImpactLine {
  return { label, before, after, changed: before !== after };
}

/* ------------------------------------------------------- currency health */

export type InflationVerdict = 'inflating' | 'balanced' | 'deflating' | 'unknown';

export interface CurrencyHealth {
  minted: number;
  burned: number;
  outstanding: number;
  /** Burned as a share of minted. */
  sinkRatio: number;
  verdict: InflationVerdict;
  note: string;
  /**
   * Balances that exist without a matching ledger credit. The ledger is the
   * source of truth and `profiles.credits` is a cached projection, so anything
   * above zero here means the two disagree.
   */
  unbacked: number;
  unbackedNote: string | null;
}

/**
 * Plain-language read on whether the currency is inflating. Minted far above
 * burned means the sinks are too weak: credits pile up, prices stop meaning
 * anything, and the buffer seat stops being a decision.
 */
export function currencyHealth(minted: number, burned: number, outstanding: number): CurrencyHealth {
  const safeMinted = Math.max(0, minted);
  const safeBurned = Math.max(0, burned);
  const sinkRatio = safeMinted > 0 ? safeBurned / safeMinted : 0;

  let verdict: InflationVerdict = 'unknown';
  let note = 'Not enough ledger history to judge the currency yet.';

  if (safeMinted > 0) {
    if (sinkRatio < 0.25) {
      verdict = 'inflating';
      note = `Only ${Math.round(sinkRatio * 100)} percent of minted credits have been spent. The sinks are too weak: balances accumulate faster than buffer seats, rescues and priority can absorb them. Either raise sink prices or lower earn rates.`;
    } else if (sinkRatio < 0.6) {
      verdict = 'balanced';
      note = `${Math.round(sinkRatio * 100)} percent of minted credits have been spent. That is a working economy — enough float for people to feel rich, enough spending for prices to mean something.`;
    } else {
      verdict = 'deflating';
      note = `${Math.round(sinkRatio * 100)} percent of minted credits have been spent. Credits are scarce; check that testers can still reach a buffer seat inside one cycle, or the sinks stop being used at all.`;
    }
  }

  const unbacked = Math.max(0, outstanding - (safeMinted - safeBurned));
  const unbackedNote =
    unbacked > 0
      ? `${unbacked.toLocaleString()} credits sit in balances with no matching ledger entry. The ledger is the source of truth and profiles.credits is a cached projection, so the two disagree — usually because balances were seeded or written directly instead of through award_credits. Treat the inflation reading below as unreliable until that is reconciled.`
      : null;

  return { minted: safeMinted, burned: safeBurned, outstanding, sinkRatio, verdict, note, unbacked, unbackedNote };
}

export const VERDICT_TONE: Record<InflationVerdict, 'red' | 'green' | 'amber' | 'neutral'> = {
  inflating: 'red',
  balanced: 'green',
  deflating: 'amber',
  unknown: 'neutral',
};

/** Human ordering for the tuning page: earn rates, then sinks, then guards. */
export const CONFIG_GROUPS: { title: string; note: string; keys: string[] }[] = [
  {
    title: 'Earn rates',
    note: 'Where credits are minted. Everything here adds to the money supply.',
    keys: [
      'signup_grant',
      'opt_in_verified',
      'daily_checkin',
      'streak_bonus_full',
      'feedback_approved',
      'bug_bounty_blocker',
      'rescue_bonus',
      'referral_referrer',
      'referral_referee',
      'referral_tithe_pct',
    ],
  },
  {
    title: 'Sinks',
    note: 'Where credits are burned. These are the only things holding the currency up.',
    keys: ['cost_buffer_seat', 'cost_rescue_seat', 'cost_priority_pod', 'cost_expert_seat', 'cost_extra_app'],
  },
  {
    title: 'Guards',
    note: 'Limits and penalties. They price the behaviour that breaks other people’s clocks.',
    keys: ['penalty_dropout', 'max_concurrent_assignments'],
  },
];
