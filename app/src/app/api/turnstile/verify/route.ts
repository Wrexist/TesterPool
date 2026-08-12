/**
 * POST /api/turnstile/verify
 *
 * Verifies a Cloudflare Turnstile token server-side before the magic-link
 * form is allowed to call Supabase. `TURNSTILE_SECRET_KEY` is a server-only
 * secret — it must never become NEXT_PUBLIC_.
 *
 * Mirrors the fail-safe-default philosophy used everywhere else in this
 * codebase (see src/lib/flags.ts, src/lib/stripe.ts): a deployment that has
 * not set up Turnstile yet gets an honest "not configured" pass-through
 * rather than a 500 that blocks every signup.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function POST(request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Not configured on this deployment: say so honestly and let the caller
  // decide whether to proceed, rather than hard-failing every signup.
  if (!secret) {
    return NextResponse.json({ ok: true, configured: false });
  }

  let token: string | undefined;
  try {
    const body = (await request.json()) as { token?: string };
    token = body.token;
  } catch {
    return NextResponse.json({ ok: false, configured: true, error: 'Malformed request.' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json(
      { ok: false, configured: true, error: 'Complete the verification challenge first.' },
      { status: 400 }
    );
  }

  try {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const remoteip = forwardedFor ? forwardedFor.split(',')[0].trim() : undefined;

    const params = new URLSearchParams({ secret, response: token });
    if (remoteip) params.set('remoteip', remoteip);

    const verifyRes = await fetch(VERIFY_URL, { method: 'POST', body: params });
    const verifyJson = (await verifyRes.json()) as { success: boolean; 'error-codes'?: string[] };

    if (!verifyJson.success) {
      return NextResponse.json(
        { ok: false, configured: true, error: 'Verification failed. Refresh and try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, configured: true });
  } catch {
    // Cloudflare unreachable: fail closed on a real network error rather
    // than silently letting an unverified request through.
    return NextResponse.json(
      { ok: false, configured: true, error: 'Verification service is unreachable. Try again shortly.' },
      { status: 503 }
    );
  }
}
