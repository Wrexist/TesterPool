/**
 * TESTERPOOL — the Stripe client. Server only.
 *
 * Nothing here throws at import time. The app has to build, boot and run with
 * no Stripe keys at all: the free tier is the product's spine, and a missing
 * payment key must degrade to an honest "payments are not configured yet"
 * rather than a 500 on the dashboard.
 *
 * So: `getStripe()` returns null when unconfigured, and every caller is
 * expected to handle null. There are no placeholder keys in this file.
 */

import Stripe from 'stripe';

/** Set in `.env.local`. Never `NEXT_PUBLIC_`; this key can move money. */
const SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';

/** From `stripe listen` locally, or the endpoint's signing secret in live. */
export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

/**
 * Pin the API version so a Stripe-side upgrade cannot silently reshape the
 * webhook payloads this code reads. It must match the version the installed
 * SDK was generated against, or the responses will not have the shape the
 * TypeScript definitions promise. Bump it and the `stripe` package together.
 */
const API_VERSION: Stripe.LatestApiVersion = '2026-07-29.dahlia';

let client: Stripe | null = null;

/** True when a secret key is present. Cheap enough to call in a render path. */
export function stripeConfigured(): boolean {
  return SECRET_KEY.length > 0;
}

/** True when the webhook can actually verify signatures. */
export function webhookConfigured(): boolean {
  return stripeConfigured() && WEBHOOK_SECRET.length > 0;
}

/**
 * Lazily built, memoised. Returns null rather than throwing when there is no
 * key, because "no key" is a supported state of this application.
 */
export function getStripe(): Stripe | null {
  if (!stripeConfigured()) return null;
  if (!client) {
    client = new Stripe(SECRET_KEY, {
      apiVersion: API_VERSION,
      appInfo: { name: 'TesterPool', url: 'https://testerpool.dev' },
      // Two retries on a network blip. Stripe's SDK attaches an idempotency
      // key to each retried request, so a retried Checkout Session create
      // cannot produce two sessions.
      maxNetworkRetries: 2,
      timeout: 15_000,
    });
  }
  return client;
}

/** Live keys start `sk_live_`. Used only to label the billing page honestly. */
export function isLiveMode(): boolean {
  return SECRET_KEY.startsWith('sk_live_');
}
