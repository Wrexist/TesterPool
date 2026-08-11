'use client';

/**
 * TESTERPOOL — secondary navigation for the admin surface.
 *
 * A client island only because it needs the current path. Counts are passed in
 * from the server so the queue sizes are true at render, not guessed.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/ui';

export interface AdminTab {
  href: string;
  label: string;
  badge?: number;
}

export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname() || '';

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--color-line)]" aria-label="Admin sections">
      {tabs.map((tab) => {
        const active =
          tab.href === '/admin' ? pathname === '/admin' : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors',
              active ? 'text-[var(--color-ink)]' : 'text-[var(--color-mute)] hover:text-[var(--color-dim)]'
            )}
            style={active ? { boxShadow: 'inset 0 -2px 0 var(--color-accent)' } : undefined}
          >
            {tab.label}
            {!!tab.badge && (
              <span
                className="num rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  background: 'color-mix(in oklab, var(--color-credit) 18%, transparent)',
                  color: 'var(--color-credit)',
                }}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
