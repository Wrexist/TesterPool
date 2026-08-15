/**
 * TESTERPOOL — the SKU catalogue.
 *
 * Every purchasable thing in the product is defined once, here, and both the
 * billing page and the Stripe routes read the same rows. Prices are inlined
 * into the Checkout Session as `price_data` rather than referencing Price IDs
 * created in the Stripe Dashboard. That is deliberate: it means a fresh Stripe
 * account needs no product setup to work, and it makes this file — which is in
 * version control and reviewable — the single source of truth for what a thing
 * costs. The trade-off is that Stripe's own product reporting is thinner; see
 * docs/PAYMENTS.md for how to switch to Price IDs if that ever matters.
 *
 * The cash tiers mirror `PLANS` in economy.ts. The credit packs are separate:
 * they are for the developer who would rather pay than test, and they are
 * priced above the effective cash cost of the equivalent tier on purpose. A
 * Fast Track at 19 dollars gives eighteen testers and a free replacement; 500
 * credits at 15 dollars buys priority placement and change. Paying cash should
 * always be the better deal, or the tiers are decoration.
 */

import { PLANS } from '@/lib/economy';

export type EntitlementKind = 'fast_pod' | 'pro' | 'rescue' | 'unlimited';

export interface Sku {
  /** Stable identifier. Written to `purchases.sku`; never renumber these. */
  id: string;
  kind: 'plan' | 'credits';
  name: string;
  /** One line, shown on the Stripe Checkout page. */
  description: string;
  amountCents: number;
  currency: 'usd';
  /** Which `PLANS` entry this SKU sells, for the cash tiers. */
  planKey?: (typeof PLANS)[number]['key'];
  /** What the fulfilment writes into `entitlements.kind`. */
  entitlement?: EntitlementKind;
  /** Null means the entitlement never expires. */
  expiresDays?: number;
  /** Credits granted through `award_credits(..., 'purchase', ...)`. */
  credits?: number;
  /** A plan is bought for one app; a credit pack is not. */
  requiresApp: boolean;
}

function plan(key: (typeof PLANS)[number]['key']) {
  const found = PLANS.find((p) => p.key === key);
  if (!found) throw new Error(`billing: no plan named ${key}`);
  return found;
}

const UNLIMITED = plan('unlimited');
const FAST = plan('fast');
const PRO = plan('pro');
const RESCUE = plan('rescue');

export const SKUS: Sku[] = [
  {
    // Sold as a 30-day pass through the same one-off Checkout the other SKUs
    // use, so it needs no new webhook handling. Real auto-renewing billing is a
    // follow-up: it means `mode: 'subscription'` plus an `invoice.paid` handler
    // to extend the entitlement, and until that exists the honest word for this
    // is a pass you re-buy, which is what the billing page calls it.
    id: 'unlimited_monthly',
    kind: 'plan',
    name: UNLIMITED.name,
    description: 'No daily testing limit for 30 days.',
    amountCents: UNLIMITED.price * 100,
    currency: 'usd',
    planKey: 'unlimited',
    entitlement: 'unlimited',
    expiresDays: 30,
    requiresApp: false,
  },
  {
    id: 'fast_pod',
    kind: 'plan',
    name: FAST.name,
    description: 'Priority placement in the feed, 18 testers, free replacement.',
    amountCents: FAST.price * 100,
    currency: 'usd',
    planKey: 'fast',
    entitlement: 'fast_pod',
    expiresDays: 60,
    requiresApp: true,
  },
  {
    id: 'pro',
    kind: 'plan',
    name: PRO.name,
    description: '20 seats at reliability 85+, expert testers, reviewed evidence pack.',
    amountCents: PRO.price * 100,
    currency: 'usd',
    planKey: 'pro',
    entitlement: 'pro',
    expiresDays: 60,
    requiresApp: true,
  },
  {
    id: 'rescue',
    kind: 'plan',
    name: RESCUE.name,
    description: 'One verified replacement tester, matched within six hours.',
    amountCents: RESCUE.price * 100,
    currency: 'usd',
    planKey: 'rescue',
    entitlement: 'rescue',
    expiresDays: 30,
    requiresApp: true,
  },
  {
    id: 'credits_500',
    kind: 'credits',
    name: '500 credits',
    description: 'Priority placement and a buffer seat, without testing for them.',
    amountCents: 1500,
    currency: 'usd',
    credits: 500,
    requiresApp: false,
  },
  {
    id: 'credits_1500',
    kind: 'credits',
    name: '1,500 credits',
    description: 'Roughly eleven cycles of tester work, bought instead of earned.',
    amountCents: 3900,
    currency: 'usd',
    credits: 1500,
    requiresApp: false,
  },
  {
    id: 'credits_4000',
    kind: 'credits',
    name: '4,000 credits',
    description: 'Enough buffer and rescue capacity for a year of shipping.',
    amountCents: 8900,
    currency: 'usd',
    credits: 4000,
    requiresApp: false,
  },
];

export function getSku(id: string | null | undefined): Sku | null {
  if (!id) return null;
  return SKUS.find((s) => s.id === id) ?? null;
}

export function skuForPlan(planKey: string): Sku | null {
  return SKUS.find((s) => s.planKey === planKey) ?? null;
}

export const CREDIT_PACKS: Sku[] = SKUS.filter((s) => s.kind === 'credits');
export const PLAN_SKUS: Sku[] = SKUS.filter((s) => s.kind === 'plan');

/** "$19", "$8.50". Whole dollars stay whole — no decorative ".00". */
export function fmtPrice(cents: number, currency = 'usd'): string {
  const symbol = currency.toLowerCase() === 'usd' ? '$' : '';
  const whole = cents % 100 === 0;
  const value = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${value}` : `${value} ${currency.toUpperCase()}`;
}

/** Value per credit, for honest "best value" labelling on the packs. */
export function centsPerCredit(sku: Sku): number {
  return sku.credits ? sku.amountCents / sku.credits : 0;
}

/** Human label for `purchases.status`. */
export const PURCHASE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid, fulfilling',
  fulfilled: 'Fulfilled',
  refunded: 'Refunded',
  failed: 'Failed',
};

/** Row shape the billing page reads. Partial, like the rest of lib/types.ts. */
export interface PurchaseRow {
  id: string;
  app_id: string | null;
  sku: string;
  amount_cents: number;
  currency: string;
  status: string;
  credits_granted: number;
  created_at: string;
  fulfilled_at: string | null;
  refunded_at: string | null;
}

export interface EntitlementRow {
  id: string;
  app_id: string | null;
  kind: EntitlementKind;
  consumed_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

/** The absolute base URL Checkout returns the buyer to. */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}
