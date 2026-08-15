import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Avatar, TierBadge, ReliabilityGauge } from '@/components/ui';
import { StarGlyph } from '@/components/app/app-row';
import { IconArrow } from '@/components/app/icons';
import { SignOutButton } from './sign-out';
import { n, tierOf, fmtDate } from '@/lib/format';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Profile — TesterPool' };

/**
 * Profile.
 *
 * The fourth tab, and the drawer for everything that is neither the feed, a
 * pack, nor an app you own. That is a real category — credits, billing, the
 * leaderboard, your public page, signing out — and the alternative was a fifth
 * tab nobody could name or a hamburger nobody opens.
 *
 * Identity first and large, because the reliability score is the thing a member
 * is judged on here and burying it under a settings list would say it does not
 * matter.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const [{ data: profileRow }, { count: testedCount }, { count: ownedCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('tester_id', user.id)
      .in('status', ['approved', 'arbitrated']),
    supabase.from('apps').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
  ]);

  const profile = profileRow as Profile | null;
  if (!profile) redirect('/login');

  const name = profile.display_name || profile.handle;
  const credits = n(profile.credits, 0);

  const links: { href: string; label: string; sub: string }[] = [
    { href: '/credits', label: 'Credits', sub: 'Every credit in and out, and what they buy' },
    { href: '/billing', label: 'Billing', sub: 'Plans, credit packs and purchase history' },
    { href: '/tests', label: 'My tests', sub: 'Everything you have taken off the feed' },
    { href: '/feedback', label: 'Reports on your apps', sub: 'Approve or dispute what testers sent you' },
    { href: '/leaderboard', label: 'Leaderboard', sub: 'Who is carrying the network this month' },
    { href: `/u/${profile.handle}`, label: 'Public profile', sub: 'What other developers see' },
    ...(profile.is_moderator ? [{ href: '/mod', label: 'Moderation', sub: 'Proof queue and open disputes' }] : []),
    ...((profile as Profile & { role?: string }).role === 'admin'
      ? [{ href: '/admin', label: 'Admin', sub: 'Overview, economy, fraud and system health' }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">Profile</h1>
      </header>

      {/* -------------------------------------------------------- identity */}
      <Card className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={name} src={profile.avatar_url} size={64} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[20px] font-bold leading-tight">{name}</div>
            <div className="mt-0.5 truncate text-[14px] text-[var(--color-dim)]">@{profile.handle}</div>
            <div className="mt-2">
              <TierBadge tier={tierOf(profile.tier)} size="sm" />
            </div>
          </div>
          <ReliabilityGauge score={n(profile.reliability)} size={64} />
        </div>

        <Link
          href="/credits"
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-90"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          <StarGlyph size={20} />
          <span className="num text-[22px] font-bold leading-none">{credits}</span>
          <span className="text-[15px]" style={{ color: 'rgba(255,255,255,.85)' }}>credits</span>
          <IconArrow size={17} className="ml-auto" />
        </Link>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { v: n(profile.pods_completed), l: 'jobs done' },
            { v: testedCount ?? 0, l: 'reports paid' },
            { v: ownedCount ?? 0, l: 'apps listed' },
          ].map((s, i) => (
            <div
              key={s.l}
              style={i > 0 ? { borderLeft: '1px solid var(--color-line)' } : undefined}
            >
              <div className="num text-[22px] font-bold leading-none">{s.v}</div>
              <div className="mt-1.5 text-[12px] text-[var(--color-mute)]">{s.l}</div>
            </div>
          ))}
        </div>

        <p className="text-center text-[12px] text-[var(--color-mute)]">
          Member since {fmtDate(profile.created_at)}
        </p>
      </Card>

      {/* ----------------------------------------------------------- links */}
      <Card className="overflow-hidden p-0">
        <ul>
          {links.map((l, i) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={cx(
                  'flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--color-surface-2)]',
                  i > 0 && 'border-t border-[var(--color-line)]'
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">{l.label}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-[var(--color-mute)]">{l.sub}</span>
                </span>
                <IconArrow size={16} className="shrink-0 text-[var(--color-mute)]" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <SignOutButton />

      <p className="px-1 pb-2 text-center text-[12px] leading-relaxed text-[var(--color-mute)]">
        Closed-track testing does not affect store rankings, ratings or public install counts.
        Store activities are public and are labelled as such before you take one.{' '}
        <Link href="/terms" className="underline underline-offset-2">Terms</Link>
        {' · '}
        <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
      </p>
    </div>
  );
}

/** Local: one class-merge, not worth an import cycle through the UI barrel. */
function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}
