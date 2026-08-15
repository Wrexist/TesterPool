import * as React from 'react';
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
 * The shell owns the navigation and nothing else. There is no global page
 * header: Home opens with a greeting, My Apps with its own title, an app detail
 * with a back arrow — three different headers, and a shared one would have to
 * be blanked out on two of the three screens to get there. Each screen brings
 * its own.
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

  return (
    <div className="flex min-h-screen flex-1 flex-col md:pl-[232px]">
      <AppNav
        profile={nav}
        counts={{ tests: assignments.length, feedback: inboxCount ?? 0 }}
      />

      <main
        className="mx-auto w-full max-w-[860px] flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-14 md:pt-6"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
    </div>
  );
}
