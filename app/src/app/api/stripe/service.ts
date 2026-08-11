/**
 * TESTERPOOL — the service-role Supabase client, for payment routes only.
 *
 * This key bypasses RLS entirely. It exists because the `purchases`,
 * `entitlements` and `customers` tables have no insert policy for anyone: a
 * user who could write their own purchase row could grant themselves a Pro pod
 * for free. Only Stripe, having verified a signature, gets to write those rows.
 *
 * Never import this from a component, a Server Action, or anything reachable
 * from a page render. It lives under `app/api/stripe/` so that its blast radius
 * is one directory. It returns null when unconfigured, like everything else in
 * the payments layer, so a missing key is a clear 503 rather than a crash.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) return null;

  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
