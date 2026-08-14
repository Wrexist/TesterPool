import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppNav, type NavProfile } from '@/components/app/nav';
import { tierOf, n } from '@/lib/format';
import type { Assignment, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The app shell. Everything behind this layout assumes a session and a profile,
 * so both are resolved once here and nothing downstream has to defend against
 * an anonymous request.
 *
 * There is no cohort in the header any more. The exchange is one app at a time:
 * you take a listing off the feed, install it, file the report, get paid. What
 * belongs at the top of every screen is therefore the count of work you have
 * open, not the day-number of a fourteen-day clock nobody is on.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const profile = profileRow as Profile | null;

  if (!profile) {
    // The signup trigger creates this row. If it is genuinely missing, the only
    // honest thing to do is send the user back through sign-in rather than
    // render a shell with no identity in it.
    redirect('/login');
  }

  const nav: NavProfile = {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.display_name || profile.handle,
    avatarUrl: profile.avatar_url,
    tier: tierOf(profile.tier),
    reliability: n(profile.reliability, 0),
    credits: n(profile.credits, 0),
    isModerator: !!profile.is_moderator,
    isAdmin: (profile as Profile & { role?: string }).role === 'admin',
  };

  const [{ data: assignmentRows }, { count: inboxCount }] = await Promise.all([
    supabase
      .from('assignments')
      .select('id, status, opt_in_verified_at')
      .eq('tester_id', user.id)
      .in('status', ['opt_in_pending', 'active']),
    supabase
      .from('feedback')
      .select('id, apps!inner(owner_id)', { count: 'exact', head: true })
      .eq('status', 'submitted')
      .eq('apps.owner_id', user.id),
  ]);

  // Every open seat is a piece of work: either the install is unconfirmed or
  // the report is unwritten. Both are one tap from /tests, so both count.
  const assignments = (assignmentRows ?? []) as Assignment[];
  const openWork = assignments.length;
  const toInstall = assignments.filter((a) => !a.opt_in_verified_at).length;

  return (
    <div className="flex min-h-screen flex-1 flex-col md:pl-[238px]">
      <AppNav profile={nav} counts={{ tests: openWork, feedback: inboxCount ?? 0 }} />

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-bg)]/90 px-4 backdrop-blur md:h-16 md:px-8">
        <Link href="/market" className="flex items-center gap-2 md:hidden">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" stroke="var(--color-accent)" strokeWidth="1.9" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-semibold tracking-tight">TesterPool</span>
        </Link>

        <span className="truncate text-xs text-[var(--color-dim)]">
          {openWork === 0 ? (
            <>Nothing open. Pick an app from the feed.</>
          ) : toInstall > 0 ? (
            <>
              <span className="num">{openWork}</span> open — <span className="num">{toInstall}</span> waiting on an install
            </>
          ) : (
            <>
              <span className="num">{openWork}</span> open — reports left to write
            </>
          )}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {nav.isAdmin && (
            <Link href="/admin" className="btn btn-ghost hidden sm:inline-flex">Admin</Link>
          )}
          {openWork > 0 ? (
            <Link href="/tests" className="btn btn-primary hidden sm:inline-flex">
              <span className="num">{openWork}</span> to finish
            </Link>
          ) : (
            <Link href="/market" className="btn btn-primary hidden sm:inline-flex">
              Browse the feed
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-14">
        {children}
      </main>
    </div>
  );
}
