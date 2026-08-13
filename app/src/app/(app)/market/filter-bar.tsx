'use client';

/**
 * TESTERPOOL — the marketplace filter bar.
 *
 * Two rows, in the order a developer actually thinks:
 *
 *   1. WHY am I here — all apps, what I'm testing, what I owe a report on,
 *      my own listings, my saved list. These are links, so they are
 *      right-clickable, shareable, and survive the back button.
 *   2. NARROW it — search, platform, stage, category, order.
 *
 * Every control writes to the URL and lets the server re-query. Nothing here
 * holds a copy of the list, so there is no way for the chips and the grid to
 * disagree about what is on screen.
 *
 * The search box is debounced rather than submit-on-enter: a developer typing
 * "puzzle" wants the grid to answer while they type, and 300ms is long enough
 * that it is one query, not six.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cx } from '@/components/ui';
import { IconSearch, IconAndroid, IconApple } from '@/components/app/icons';
import {
  SCOPES, PLATFORMS, STATUSES, SORTS, marketHref, isFiltered,
  type MarketQuery, type PlatformFilter,
} from '@/lib/market';

const COUNT_KEYS = ['testing', 'due', 'mine', 'saved'] as const;
export type ScopeCounts = Partial<Record<(typeof COUNT_KEYS)[number], number>>;

function Chip({
  href, active, children, badge, tone = 'accent',
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  badge?: number;
  tone?: 'accent' | 'credit';
}) {
  const colour = tone === 'credit' ? 'var(--color-credit)' : 'var(--color-accent)';
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
        !active && 'border-[var(--color-line)] text-[var(--color-dim)] hover:border-[var(--color-line-hi)] hover:text-[var(--color-ink)]'
      )}
      style={
        active
          ? {
              color: colour,
              borderColor: `color-mix(in oklab, ${colour} 38%, transparent)`,
              background: `color-mix(in oklab, ${colour} 12%, transparent)`,
            }
          : undefined
      }
    >
      {children}
      {badge != null && badge > 0 && (
        <span
          className="num rounded-full px-1.5 text-[10px] font-bold"
          style={{
            background: active ? `color-mix(in oklab, ${colour} 22%, transparent)` : 'var(--color-surface-2)',
            color: active ? colour : 'var(--color-mute)',
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function Select({
  label, value, onChange, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--color-mute)]">
      <span className="hidden sm:inline">{label}</span>
      <select
        className="input h-9 w-auto min-w-[9.5rem] py-0 text-[13px] font-medium text-[var(--color-ink)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

const PLATFORM_MARK: Record<PlatformFilter, React.ReactNode> = {
  all: null,
  android: <IconAndroid size={13} />,
  ios: <IconApple size={13} />,
};

export function FilterBar({
  query, categories, counts, total,
}: {
  query: MarketQuery;
  categories: { category: string; apps: number }[];
  counts: ScopeCounts;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [term, setTerm] = React.useState(query.q);

  // A navigation that changes the query — a chip, the back button — has to win
  // over whatever is sitting in the box.
  const [lastQ, setLastQ] = React.useState(query.q);
  if (lastQ !== query.q) {
    setLastQ(query.q);
    setTerm(query.q);
  }

  const go = React.useCallback(
    (next: Partial<MarketQuery>) => {
      startTransition(() => {
        router.push(marketHref({ ...query, page: 1, ...next }), { scroll: false });
      });
    },
    [query, router]
  );

  React.useEffect(() => {
    if (term === query.q) return;
    const timer = setTimeout(() => go({ q: term }), 300);
    return () => clearTimeout(timer);
  }, [term, query.q, go]);

  const active = isFiltered(query);
  const scopeHint = SCOPES.find((s) => s.value === query.scope)?.hint;
  const platformHint = PLATFORMS.find((p) => p.value === query.platform)?.hint;

  return (
    <div className="flex flex-col gap-3">
      {/* ---------------------------------------------------------- why */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SCOPES.map((scope) => (
          <Chip
            key={scope.value}
            href={marketHref({ ...query, scope: scope.value, page: 1 })}
            active={query.scope === scope.value}
            badge={COUNT_KEYS.includes(scope.value as never) ? counts[scope.value as keyof ScopeCounts] : undefined}
            tone={scope.value === 'due' ? 'credit' : 'accent'}
          >
            {scope.label}
          </Chip>
        ))}
      </div>

      {/* ------------------------------------------------------- narrow it */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[13rem] flex-1">
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)]"
          />
          <input
            className="input h-9 pl-9 text-[13px]"
            type="search"
            value={term}
            placeholder="Search apps or developers"
            aria-label="Search the marketplace"
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center rounded-lg border border-[var(--color-line)] p-0.5">
          {PLATFORMS.map((p) => {
            const on = query.platform === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => go({ platform: p.value })}
                aria-pressed={on}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[13px] font-semibold transition-colors',
                  on ? 'text-[var(--color-ink)]' : 'text-[var(--color-mute)] hover:text-[var(--color-dim)]'
                )}
                style={on ? { background: 'var(--color-surface-2)' } : undefined}
              >
                {PLATFORM_MARK[p.value]}
                {p.label}
              </button>
            );
          })}
        </div>

        <Select label="Stage" value={query.status} onChange={(v) => go({ status: v as MarketQuery['status'] })}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>

        {categories.length > 0 && (
          <Select label="Category" value={query.category} onChange={(v) => go({ category: v })}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category} ({c.apps})
              </option>
            ))}
          </Select>
        )}

        <Select label="Sort" value={query.sort} onChange={(v) => go({ sort: v as MarketQuery['sort'] })}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>

      </div>

      {/* ------------------------------------------------------ what this is */}
      <div className="flex flex-col gap-1 text-xs text-[var(--color-mute)]">
        <div className="flex items-baseline gap-3">
          <span aria-live="polite">
            {pending ? 'Updating…' : <><span className="num font-semibold text-[var(--color-dim)]">{total}</span> {total === 1 ? 'app' : 'apps'}</>}
          </span>
          {active && (
            <Link href="/market" className="font-semibold text-[var(--color-dim)] underline decoration-[var(--color-line-hi)] underline-offset-2 hover:text-[var(--color-ink)]">
              Clear filters
            </Link>
          )}
        </div>
        {/* One hint per line. Two of them side by side ran the width of the
            page and stopped reading as help. */}
        {scopeHint && <p>{scopeHint}</p>}
        {platformHint && <p>{platformHint}</p>}
      </div>
    </div>
  );
}
