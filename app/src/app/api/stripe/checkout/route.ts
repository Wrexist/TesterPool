/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for one SKU and returns its URL. The
 * browser then does `window.location.href = url`.
 *
 * Three things are checked before a session is created, in this order, because
 * each produces a different honest message: is the product open for business
 * (the `paid_tiers` flag), is Stripe configured at all, and is this request
 * from a signed-in user who owns the app they named.
 *
 * The buyer's identity is never taken from the request body. `user_id` in the
 * session metadata comes from the session cookie, so a crafted request cannot
 * cause fulfilment against someone else's account.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, stripeConfigured } from '@/lib/stripe';
import { getSku, siteUrl } from '@/lib/billing';
import { getFlag } from '@/lib/flags';
import { serviceClient } from '../service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  // ---------------------------------------------------------------- gating
  if (!(await getFlag('paid_tiers'))) {
    return fail('Paid plans are not open yet. The free tier is fully available.', 403);
  }

  const stripe = getStripe();
  if (!stripe || !stripeConfigured()) {
    return fail(
      'Payments are not configured on this deployment. No card can be charged here.',
      503
    );
  }

  // ------------------------------------------------------------------ auth
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return fail('Sign in before buying anything.', 401);

  // ------------------------------------------------------------------ body
  let body: { sku?: unknown; appId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail('Malformed request.', 400);
  }

  const sku = getSku(typeof body.sku === 'string' ? body.sku : null);
  if (!sku) return fail('That is not something we sell.', 400);

  const appId = typeof body.appId === 'string' && body.appId ? body.appId : null;

  if (sku.requiresApp && !appId) {
    return fail('Choose which app this is for.', 400);
  }

  // Ownership is enforced by RLS on `apps`, but check it explicitly so the
  // buyer gets a sentence rather than an empty result.
  if (appId) {
    const { data: app } = await supabase
      .from('apps')
      .select('id, owner_id')
      .eq('id', appId)
      .maybeSingle<{ id: string; owner_id: string }>();
    if (!app || app.owner_id !== user.id) {
      return fail('That app is not yours.', 403);
    }
  }

  // -------------------------------------------------------------- customer
  // Reuse the Stripe customer if this buyer has one, so their purchase history
  // and the Customer Portal stay in one place.
  let customerId: string | null = null;
  const { data: existing } = await supabase
    .from('customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle<{ stripe_customer_id: string }>();
  customerId = existing?.stripe_customer_id ?? null;

  const admin = serviceClient();
  if (!customerId && admin) {
    try {
      const created = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = created.id;
      await admin
        .from('customers')
        .upsert({ user_id: user.id, stripe_customer_id: created.id }, { onConflict: 'user_id' });
    } catch {
      // A customer record is a convenience, not a requirement. Fall through
      // and let Checkout create one implicitly rather than block the sale.
      customerId = null;
    }
  }

  // --------------------------------------------------------------- session
  const base = siteUrl();
  const metadata: Record<string, string> = {
    user_id: user.id,
    sku: sku.id,
    ...(appId ? { app_id: appId } : {}),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Prices live in `lib/billing.ts`, not in the Stripe Dashboard, so a new
      // Stripe account works with no product setup. See docs/PAYMENTS.md.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: sku.currency,
            unit_amount: sku.amountCents,
            product_data: { name: `TesterPool — ${sku.name}`, description: sku.description },
          },
        },
      ],
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : user.email ?? undefined,
      client_reference_id: user.id,
      metadata,
      // Copied onto the PaymentIntent so a refund event can be traced back to
      // a buyer even if the Checkout Session is not to hand.
      payment_intent_data: { metadata },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${base}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/billing?checkout=cancelled`,
    });

    if (!session.url) return fail('Stripe did not return a checkout URL. Try again.', 502);
    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Stripe refused the request. Try again.';
    return fail(message.slice(0, 240), 502);
  }
}
