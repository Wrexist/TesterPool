import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * OAuth / magic-link landing point. Supabase sends the user back here with a
 * `code`; we exchange it for a session cookie and drop them on the dashboard.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const errorDescription = url.searchParams.get('error_description');

  // Only allow same-origin relative redirects, so `?next=` can never be used
  // to bounce someone off-site with a fresh session.
  const requested = url.searchParams.get('next');
  const next = requested && requested.startsWith('/') && !requested.startsWith('//')
    ? requested
    : '/dashboard';

  if (errorDescription) {
    const back = new URL('/login', url.origin);
    back.searchParams.set('error', errorDescription);
    return NextResponse.redirect(back);
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } catch (err) {
    const back = new URL('/login', url.origin);
    back.searchParams.set(
      'error',
      err instanceof Error ? err.message : 'Could not complete sign-in.'
    );
    return NextResponse.redirect(back);
  }

  const destination = new URL(next, url.origin);
  // Carry the referral code through so onboarding can credit both sides. The
  // magic-link path already has it in user metadata; OAuth does not.
  const ref = url.searchParams.get('ref');
  if (ref) destination.searchParams.set('ref', ref);

  return NextResponse.redirect(destination);
}
