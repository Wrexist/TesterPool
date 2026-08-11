/**
 * POST /api/stripe/webhook
 *
 * The only thing in this application that is allowed to grant a paid benefit.
 *
 * THE RAW BODY. Signature verification hashes the exact bytes Stripe sent. In
 * the App Router the correct way to get them is `await request.text()` before
 * anything else touches the request — `request.json()` reparses and reserialises
 * and the signature will never match. There is no body parser to disable here,
 * unlike the Pages Router, but there is also nothing that will warn you: a
 * mistake shows up as a permanent 400 on every event in the Stripe dashboard.
 *
 * IDEMPOTENCE. Stripe retries for up to three days with exponential backoff,
 * can deliver the same event twice, and does not guarantee ordering. So this
 * route does no bookkeeping of its own: it calls `fulfil_purchase`, which is
 * keyed on the unique `stripe_session_id` and is a no-op the second time. Two
 * concurrent deliveries of the same event race on a unique index and one of
 * them loses harmlessly.
 *
 * Credits are granted inside that function through `award_credits(...,
 * 'purchase', ...)`, never by writing `profiles.credits`, which a trigger
 * refuses. The ledger stays the source of truth even for money that arrived
 * from outside the system.
 *
 * Everything here uses the service-role key. The anon key would be subject to
 * RLS and there is deliberately no insert policy on any payments table.
 */

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, WEBHOOK_SECRET } from '@/lib/stripe';
import { getSku } from '@/lib/billing';
import { serviceClient } from '../service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Stripe treats any 2xx as delivered. Anything else is retried. */
const OK = () => NextResponse.json({ received: true });

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || !WEBHOOK_SECRET) {
    // Unconfigured deployment. 503 rather than 200: if a real Stripe account
    // is somehow pointed here, it should keep retrying, not consider the
    // event delivered and drop it.
    return NextResponse.json(
      { error: 'Stripe is not configured on this deployment.' },
      { status: 503 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });

  // Raw bytes, read once, before anything else. Do not replace with .json().
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    // Async variant: it works under both the Node and Web Crypto providers, so
    // moving this route to the edge runtime later will not silently break it.
    event = await stripe.webhooks.constructEventAsync(payload, signature, WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed.';
    return NextResponse.json({ error: message.slice(0, 200) }, { status: 400 });
  }

  const admin = serviceClient();
  if (!admin) {
    // Signature was good but we cannot write. Retry is the right outcome.
    return NextResponse.json({ error: 'Fulfilment backend unavailable.' }, { status: 503 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;

        // Delayed payment methods complete the session before the money
        // arrives. `unpaid` means wait for async_payment_succeeded.
        if (session.payment_status === 'unpaid') return OK();

        const userId = session.metadata?.user_id ?? session.client_reference_id ?? null;
        const sku = getSku(session.metadata?.sku);
        const appId = session.metadata?.app_id ?? null;

        // Metadata we wrote ourselves is missing, or the SKU has been retired.
        // Retrying cannot fix either, so acknowledge and leave it in the
        // Stripe dashboard for a human.
        if (!userId || !sku) return OK();

        const paymentIntent =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null;

        const { error } = await admin.rpc('fulfil_purchase', {
          p_user: userId,
          p_sku: sku.id,
          p_session: session.id,
          p_amount_cents: session.amount_total ?? sku.amountCents,
          p_currency: session.currency ?? sku.currency,
          p_payment_intent: paymentIntent,
          p_app: appId,
          p_credits: sku.credits ?? 0,
          p_entitlement: sku.entitlement ?? null,
          p_expires_days: sku.expiresDays ?? null,
        });

        // A database failure must not be acknowledged. Stripe will redeliver,
        // and fulfil_purchase is safe to run again.
        if (error) {
          return NextResponse.json({ error: 'Fulfilment failed.' }, { status: 500 });
        }

        // Remember the Stripe customer so the portal has something to open.
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
        if (customerId) {
          await admin
            .from('customers')
            .upsert(
              { user_id: userId, stripe_customer_id: customerId },
              { onConflict: 'user_id' }
            );
        }

        return OK();
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntent =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id ?? null;

        if (!paymentIntent) return OK();

        const { error } = await admin.rpc('refund_purchase', {
          p_payment_intent: paymentIntent,
          p_session: null,
        });
        if (error) {
          return NextResponse.json({ error: 'Refund handling failed.' }, { status: 500 });
        }
        return OK();
      }

      case 'checkout.session.async_payment_failed':
        // Nothing was granted, so nothing needs revoking. Acknowledged so the
        // event stops being retried; the buyer sees the failure from Stripe.
        return OK();

      default:
        // Subscribe to fewer events rather than growing this switch.
        return OK();
    }
  } catch {
    return NextResponse.json({ error: 'Unhandled webhook error.' }, { status: 500 });
  }
}
