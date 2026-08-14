import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * TESTERPOOL — session refresh.
 *
 * Supabase access tokens expire after an hour. Refreshing one mints a new
 * refresh token and invalidates the old, so the new pair has to be written back
 * to the browser or the next request presents a token that has already been
 * spent. Reuse detection then treats that as a stolen token and revokes the
 * session: the user is signed out mid-job, on a product whose entire promise is
 * that they check in every day for fourteen consecutive days.
 *
 * A Server Component cannot write cookies — `createClient` in
 * `lib/supabase/server.ts` swallows that failure by design, because the write
 * has to happen somewhere that owns a response. This is that somewhere, and it
 * is the only reason this file exists.
 *
 * `getUser()` is the call that performs the refresh. It must not be removed,
 * and nothing must run before it, or the refreshed cookies miss the response.
 *
 * Authorisation is NOT done here. Every guard stays in the layout that renders
 * the surface it protects — `(app)/layout.tsx` redirects anonymous users,
 * `(app)/admin/layout.tsx` 404s non-admins — and RLS stands behind both. A
 * middleware matcher is a routing convenience, not a security boundary.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // An unconfigured deployment still has to serve the marketing site rather
  // than 500 on every request.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        // Onto the request so this render sees the new session, and onto a
        // fresh response so the browser is told about it too.
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // A Supabase outage must not take the whole site down with it. The layouts
    // below will treat the request as anonymous and send the user to /login.
  }

  return response;
}

export const config = {
  matcher: [
    /**
     * Everything except static assets and image files. The auth callback is
     * deliberately included: it exchanges a code for a session and benefits
     * from the same cookie plumbing.
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)',
  ],
};
