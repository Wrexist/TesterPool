'use client';

/**
 * TESTERPOOL — app navigation.
 *
 * Four tabs, and they are the four nouns of the product: the feed you browse,
 * the packs you can buy into, the apps you own, and you. Everything else —
 * credits, billing, the leaderboard, staff tools — hangs off Profile, because a
 * fifth tab would be the one nobody can name from memory.
 *
 * One component, two shapes: a bottom tab bar on a phone and a left rail on
 * desktop, both driven by the same list. The bar is the primary shape; this is
 * a product used on the device the apps are installed on.
 *
 * The active tab is a filled pill behind the icon rather than a colour change
 * alone. At 24px an icon that only changes hue is ambiguous against a light
 * ground, and the pill reads at a glance from across a room.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';
import {
  IconHome, IconPacks, IconDevice, IconUser,
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

type Tab = {
  href: string;
  label: string;
  Icon: (p: { size?: number; className?: string; filled?: boolean }) => React.ReactElement;
  badge?: number;
  /** Extra paths that should light this tab up. */
  also?: string[];
};

function tabs(counts: { tests?: number; feedback?: number }): Tab[] {
  return [
    // Home is the feed. `/tests` lives under it because the work you have taken
    // on is the same object as the listing you took it from, one step later.
    {
      href: '/market',
      label: 'Home',
      Icon: IconHome,
      also: ['/tests'],
      badge: counts.tests,
    },
    { href: '/packs', label: 'Packs', Icon: IconPacks },
    {
      href: '/apps',
      label: 'My Apps',
      Icon: IconDevice,
      also: ['/dashboard', '/feedback'],
      badge: counts.feedback,
    },
    {
      href: '/profile',
      label: 'Profile',
      Icon: IconUser,
      also: ['/credits', '/billing', '/leaderboard', '/u'],
    },
  ];
}

function isActive(pathname: string, tab: Tab): boolean {
  const hit = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return hit(tab.href) || (tab.also ?? []).some(hit);
}

export function AppNav({
  profile,
  counts = {},
}: {
  profile: NavProfile;
  counts?: { tests?: number; feedback?: number };
}) {
  const pathname = usePathname() || '';
  const items = tabs(counts);

  return (
    <>
      {/* ------------------------------------------------------ desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] md:flex">
        <div className="flex h-[72px] items-center px-5">
          <Link href="/market" className="flex items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-accent)' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
                <path d="M8.5 12.2l2.4 2.4 4.6-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[16px] font-bold tracking-tight">TesterPool</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-2">
          <ul className="flex flex-col gap-1">
            {items.map((tab) => {
              const active = isActive(pathname, tab);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors',
                      active
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]'
                    )}
                    style={active ? { background: 'var(--color-accent-soft)' } : undefined}
                  >
                    <tab.Icon size={21} filled={active} />
                    {tab.label}
                    {!!tab.badge && (
                      <span
                        className="num ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: 'var(--color-accent)', color: '#fff' }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border-t border-[var(--color-line)] pt-4">
            <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              More
            </div>
            <ul className="flex flex-col gap-0.5">
              {[
                { href: '/credits', label: 'Credits' },
                { href: '/billing', label: 'Billing' },
                { href: '/leaderboard', label: 'Leaderboard' },
                ...(profile.isModerator ? [{ href: '/mod', label: 'Moderation' }] : []),
                ...(profile.isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-dim)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </aside>

      {/* ------------------------------------------------------- mobile bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-line)] bg-[var(--color-surface)] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="flex items-stretch">
          {items.map((tab) => {
            const active = isActive(pathname, tab);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className="flex flex-col items-center gap-1 pb-2 pt-2.5"
                >
                  <span
                    className="relative inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors"
                    style={active ? { background: 'var(--color-accent-soft)' } : undefined}
                  >
                    <tab.Icon
                      size={22}
                      filled={active}
                      className={active ? 'text-[var(--color-accent)]' : 'text-[var(--color-mute)]'}
                    />
                    {!!tab.badge && (
                      <span
                        className="num absolute right-2 top-0 rounded-full px-1.5 text-[10px] font-bold leading-[15px]"
                        style={{ background: 'var(--color-danger)', color: '#fff' }}
                      >
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                  </span>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: active ? 'var(--color-accent)' : 'var(--color-mute)' }}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
