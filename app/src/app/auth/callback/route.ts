import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * OAuth / magic-link landing point. Supabase sends the user back here with a
 * `code`; we exchange it for a session cookie and drop them on the dashboard.
 *
 * Everything that can go wrong here ends at `/login` with something a person
 * can act on. The one exception is a cancelled provider dialog, which is a
 * decision rather than a fault and gets no message at all.
 */

const BANNED_MESSAGE =
  'This account is suspended. Email support@testerpool.dev if you think that is wrong.';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  // Providers report failure as `error` plus a human-readable
  // `error_description`; Supabase adds its own `error_code`.
  const errorParam = url.searchParams.get('error');
  const errorCode = url.searchParams.get('error_code');
  const errorDescription = url.searchParams.get('error_description');

  // Carry the referral code through so onboarding can credit both sides. The
  // magic-link path already has it in user metadata; OAuth does not.
  const ref = url.searchParams.get('ref');

  /** Back to the login screen, referral intact, message optional. */
  const backToLogin = (message?: string) => {
    const back = new URL('/login', url.origin);
    if (ref) back.searchParams.set('ref', ref);
    if (message) back.searchParams.set('error', message);
    return NextResponse.redirect(back);
  };

  // Only allow same-origin relative redirects, so `?next=` can never be used
  // to bounce someone off-site with a fresh session.
  const requested = url.searchParams.get('next');
  const next =
    requested && requested.startsWith('/') && !requested.startsWith('//')
      ? requested
      : '/dashboard';

  // The user closed the Apple, Google or GitHub dialog, or declined to share
  // their details. Nothing broke. Send them back without an alarm.
  if (errorParam === 'access_denied' || errorCode === 'access_denied') {
    return backToLogin();
  }

  if (errorParam || errorDescription) {
    // `error_description` arrives URL-encoded with `+` for spaces.
    const readable = (errorDescription ?? errorParam ?? '')
      .replace(/\+/g, ' ')
      .trim()
      .slice(0, 240);
    return backToLogin(readable || 'Sign-in did not complete. Try again.');
  }

  if (!code) {
    // A bare visit to the callback URL. No session to build, no error to show.
    return backToLogin();
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } catch (err) {
    return backToLogin(
      err instanceof Error
        ? err.message.slice(0, 240)
        : 'Could not complete sign-in. Try again, or use the email link.'
    );
  }

  // A banned account must not reach an authenticated surface, even for the
  // instant it would take the dashboard to bounce them. Check, then sign out.
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;

    if (userId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_banned')
        .eq('id', userId)
        .maybeSingle<{ is_banned: boolean | null }>();

      // A missing profile is normal — onboarding creates it. Only an explicit
      // `true` locks the door, so a read failure never strands a good user.
      if (!profileError && profile?.is_banned === true) {
        await supabase.auth.signOut();
        return backToLogin(BANNED_MESSAGE);
      }
    }
  } catch {
    // The ban check is a guard, not a gate. If it cannot run, the session is
    // already valid and RLS still applies on every authenticated page.
  }

  const destination = new URL(next, url.origin);
  if (ref) destination.searchParams.set('ref', ref);

  return NextResponse.redirect(destination);
}
