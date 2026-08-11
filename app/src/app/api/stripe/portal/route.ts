/**
 * POST /api/stripe/portal
 *
 * Opens the Stripe Customer Portal, which is where a buyer sees their receipts,
 * updates a card, and — if the portal is configured to allow it — requests a
 * refund. Everything a support email would otherwise have to do by hand.
 *
 * A user with no Stripe customer record has never bought anything, so there is
 * nothing to manage; that is a plain sentence, not an error page.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { siteUrl } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST() {
  const stripe = getStripe();
  if (!stripe) {
    return fail('Payments are not configured on this deployment.', 503);
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return fail('Sign in first.', 401);

  const { data: customer } = await supabase
    .from('customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle<{ stripe_customer_id: string }>();

  if (!customer?.stripe_customer_id) {
    return fail('You have not bought anything yet, so there is nothing to manage.', 404);
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${siteUrl()}/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe refused the request.';
    return fail(message.slice(0, 240), 502);
  }
}
