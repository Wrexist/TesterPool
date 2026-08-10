import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppNav, type NavProfile } from '@/components/app/nav';
import { Pill } from '@/components/ui';
import { podDay, tierOf, n, checkedInToday } from '@/lib/pods';
import { RULES } from '@/lib/economy';
import type { Assignment, Pod, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The app shell. Everything behind this layout assumes a session and a profile,
 * so both are resolved once here and nothing downstream has to defend against
 * an anonymous request.
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
  };

  const [{ data: membershipRows }, { data: assignmentRows }, { count: inboxCount }] = await Promise.all([
    supabase
      .from('pod_members')
      .select('pod_id, status, pods(id, code, name, status, starts_at, ends_at, duration_days)')
      .eq('user_id', user.id),
    supabase
      .from('assignments')
      .select('id, status, opt_in_verified_at, days_checked_in, last_checkin_on, pod_id')
      .eq('tester_id', user.id)
      .in('status', ['opt_in_pending', 'active']),
    supabase
      .from('feedback')
      .select('id, apps!inner(owner_id)', { count: 'exact', head: true })
      .eq('status', 'submitted')
      .eq('apps.owner_id', user.id),
  ]);

  type Membership = { pod_id: string; status: string; pods: Pod | Pod[] | null };
  const memberships = (membershipRows ?? []) as Membership[];
  const pods = memberships
    .map((m) => (Array.isArray(m.pods) ? m.pods[0] : m.pods))
    .filter((p): p is Pod => !!p);
  const activePod = pods.find((p) => p.status === 'active') ?? null;
  const duration = activePod?.duration_days ?? RULES.requiredDays;
  const day = podDay(activePod?.starts_at, duration);

  const assignments = (assignmentRows ?? []) as Assignment[];
  const activePodIds = new Set(pods.filter((p) => p.status === 'active').map((p) => p.id));
  const todoToday = assignments.filter(
    (a) => activePodIds.has(a.pod_id) && (!a.opt_in_verified_at || !checkedInToday(a.last_checkin_on))
  ).length;

  return (
    <div className="flex min-h-screen flex-1 flex-col md:pl-[238px]">
      <AppNav profile={nav} counts={{ tests: todoToday, feedback: inboxCount ?? 0 }} />

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-bg)]/90 px-4 backdrop-blur md:h-16 md:px-8">
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" stroke="var(--color-accent)" strokeWidth="1.9" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-semibold tracking-tight">TesterPool</span>
        </Link>

        {activePod ? (
          <div className="flex min-w-0 items-center gap-2">
            <Pill tone={day >= duration ? 'violet' : 'green'}>
              <span className="num">Day {Math.max(day, 1)} of {duration}</span>
            </Pill>
            <span className="hidden truncate text-xs text-[var(--color-dim)] sm:inline">
              {activePod.name || `Pod ${activePod.code}`}
            </span>
          </div>
        ) : (
          <span className="truncate text-xs text-[var(--color-dim)]">
            {pods.some((p) => p.status === 'forming')
              ? 'Your pod is filling. The 14-day clock starts when the last seat is taken.'
              : 'No active pod. Join one to start your 14 days.'}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {todoToday > 0 && (
            <Link href="/tests" className="btn btn-primary hidden sm:inline-flex">
              <span className="num">{todoToday}</span> waiting on you today
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
