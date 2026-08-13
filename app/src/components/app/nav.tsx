'use client';

/**
 * TESTERPOOL — app navigation.
 *
 * One component, two shapes: a fixed left rail on desktop, a bottom tab bar on
 * mobile. The tab bar carries the four surfaces a tester touches daily; the
 * rest live behind a sheet, because a 14-day habit lives or dies on how fast
 * "check in" is reachable with a thumb.
 *
 * The rail is grouped rather than flat. Nine equally-weighted links read as
 * nine equally-important places; two of them — Dashboard and My tests — are
 * where a developer spends every day of the fourteen, and the grouping says so
 * without hiding anything.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx, Avatar, TierBadge, ReliabilityGauge } from '@/components/ui';
import { CreditBalance } from '@/components/app/credit-balance';
import {
  IconDashboard, IconTests, IconPods, IconFeedback, IconCredits,
  IconTrophy, IconShield, IconMenu, IconUser,
} from '@/components/app/icons';
import type { Tier } from '@/lib/types';

export interface NavProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  tier: Tier;
  reliability: number;
  credits: number;
  isModerator: boolean;
  isAdmin?: boolean;
}

type Item = { href: string; label: string; Icon: (p: { size?: number; className?: string }) => React.ReactElement; badge?: number };

/** Local to the rail: billing is the only surface that needs a card glyph. */
const IconBilling = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M2.75 9.75h18.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M6.5 14.75h3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

/** Local to the rail: Launch feed is the only surface that needs a rocket glyph. */
const IconLaunch = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M12 2.5c2.8 1.8 4.5 4.9 4.5 8.5 0 2-.5 3.8-1.5 5.3l-3-1.2-3 1.2C7.9 14.8 7.5 13 7.5 11c0-3.6 1.7-6.7 4.5-8.5Z"
      stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
    />
    <circle cx="12" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.7" />
    <path d="M9 15.5 7 21l3.5-2M15 15.5 17 21l-3.5-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type Group = { label: string | null; items: Item[] };

/**
 * Daily work first, unlabelled — it needs no heading to be found. Everything
 * occasional sits under a heading below it, and staff tools below that.
 */
function groups(
  isModerator: boolean,
  isAdmin: boolean,
  counts: { tests?: number; feedback?: number }
): Group[] {
  const out: Group[] = [
    {
      label: null,
      items: [
        { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
        { href: '/tests', label: 'My tests', Icon: IconTests, badge: counts.tests },
        { href: '/pods', label: 'Pods', Icon: IconPods },
        { href: '/feedback', label: 'Feedback', Icon: IconFeedback, badge: counts.feedback },
      ],
    },
    {
      label: 'Account',
      items: [
        { href: '/credits', label: 'Credits', Icon: IconCredits },
        { href: '/billing', label: 'Billing', Icon: IconBilling },
        { href: '/leaderboard', label: 'Leaderboard', Icon: IconTrophy },
        { href: '/launch', label: 'Launch feed', Icon: IconLaunch },
      ],
    },
  ];

  const staff: Item[] = [];
  if (isModerator) staff.push({ href: '/mod', label: 'Moderation', Icon: IconShield });
  if (isAdmin) staff.push({ href: '/admin', label: 'Admin', Icon: IconShield });
  if (staff.length) out.push({ label: 'Staff', items: staff });

  return out;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Badge({ value }: { value?: number }) {
  if (!value) return null;
  return (
    <span
      className="num ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold"
      style={{
        background: 'color-mix(in oklab, var(--color-accent) 16%, transparent)',
        color: 'var(--color-accent)',
      }}
    >
      {value}
    </span>
  );
}

export function AppNav({
  profile,
  counts = {},
}: {
  profile: NavProfile;
  counts?: { tests?: number; feedback?: number };
}) {
  const pathname = usePathname() || '';
  const [sheet, setSheet] = React.useState(false);
  const sections = groups(profile.isModerator, !!profile.isAdmin, counts);
  const [daily, ...rest] = sections;
  const primary = daily.items;

  // Navigating closes the sheet. Reconciled during render: an effect here
  // would leave the overlay on screen for a frame after the route changed.
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (sheet) setSheet(false);
  }

  return (
    <>
      {/* ------------------------------------------------------ desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[238px] flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] md:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: 'color-mix(in oklab, var(--color-accent) 16%, transparent)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" stroke="var(--color-accent)" strokeWidth="1.9" strokeLinejoin="round" />
                <path d="M8.5 12.2l2.4 2.4 4.6-5" stroke="var(--color-accent)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight">TesterPool</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {sections.map((group, i) => (
            <div key={group.label ?? 'daily'} className={cx(i > 0 && 'mt-5')}>
              {group.label && (
                <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                  {group.label}
                </div>
              )}
              <ul className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, Icon, badge }) => {
                  const active = isActive(pathname, href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={cx(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)]'
                            : 'text-[var(--color-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]'
                        )}
                        style={active ? { boxShadow: 'inset 2px 0 0 var(--color-accent)' } : undefined}
                      >
                        <Icon size={17} />
                        {label}
                        <Badge value={badge} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <ProfileFooter profile={profile} />
      </aside>

      {/* ------------------------------------------------------- mobile bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-line)] bg-[var(--color-surface)]/95 backdrop-blur md:hidden">
        <ul className="flex items-stretch">
          {primary.map(({ href, label, Icon, badge }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold"
                  style={{ color: active ? 'var(--color-accent)' : 'var(--color-mute)' }}
                >
                  <Icon size={19} />
                  {label}
                  {!!badge && (
                    <span
                      className="absolute right-1/2 top-1.5 translate-x-3.5 rounded-full px-1 text-[9px] font-bold"
                      style={{ background: 'var(--color-accent)', color: '#04150C' }}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setSheet((v) => !v)}
              aria-expanded={sheet}
              className="flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-semibold"
              style={{ color: sheet ? 'var(--color-accent)' : 'var(--color-mute)' }}
            >
              <IconMenu size={19} />
              More
            </button>
          </li>
        </ul>
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-label="More navigation">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setSheet(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--color-line)] bg-[var(--color-surface)] p-4 pb-24">
            {rest.map((group) => (
              <div key={group.label ?? 'more'} className="mb-2">
                {group.label && (
                  <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mute)]">
                    {group.label}
                  </div>
                )}
                <ul className="flex flex-col gap-1">
                  {group.items.map(({ href, label, Icon }) => (
                    <li key={href}>
                      <Link href={href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-[var(--color-dim)]">
                        <Icon size={18} />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <ul className="flex flex-col gap-1">
              <li>
                <Link href={`/u/${profile.handle}`} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-[var(--color-dim)]">
                  <IconUser size={18} />
                  My public profile
                </Link>
              </li>
            </ul>
            <div className="mt-3 border-t border-[var(--color-line)] pt-3">
              <ProfileFooter profile={profile} compact />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProfileFooter({ profile, compact = false }: { profile: NavProfile; compact?: boolean }) {
  return (
    <div className={cx('px-3 py-3', !compact && 'border-t border-[var(--color-line)]')}>
      <Link
        href={`/u/${profile.handle}`}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--color-surface-2)]"
      >
        <Avatar name={profile.displayName || profile.handle} src={profile.avatarUrl} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{profile.displayName || profile.handle}</div>
          <div className="truncate text-xs text-[var(--color-mute)]">@{profile.handle}</div>
        </div>
        <ReliabilityGauge score={profile.reliability} size={38} label={false} />
      </Link>
      <div className="mt-1 flex items-center justify-between px-2">
        <TierBadge tier={profile.tier} size="sm" />
        <Link href="/credits" className="transition-opacity hover:opacity-80">
          <CreditBalance userId={profile.id} initial={profile.credits} />
        </Link>
      </div>
    </div>
  );
}
