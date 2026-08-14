'use client';

/**
 * TESTERPOOL — the marketplace filter bar.
 *
 * One row of chips for WHY you are here, one row of controls to narrow it, and
 * no explanatory prose at all. An earlier draft printed a sentence under the
 * bar for whichever filter was active; six of those sentences, one at a time,
 * is a paragraph the eye has to re-read on every click. The chips say what they
 * do.
 *
 * The platform control is drawn as the two store logos. It is the filter people
 * reach for first and the one that needs no reading.
 *
 * Every control writes to the URL and lets the server re-query, so the chips
 * and the grid cannot disagree about what is on screen. Search is debounced
 * rather than submit-on-enter: typing "puzzle" should answer as you type, and
 * 300ms makes it one query rather than six.
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

const COUNT_KEYS = ['open', 'testing', 'due', 'mine', 'saved'] as const;
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
    <select
      aria-label={label}
      className="input h-9 w-auto shrink-0 py-0 text-[13px] font-medium text-[var(--color-ink)]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

// Logos at a size you can actually identify, not 13px decorations beside a word.
const PLATFORM_MARK: Record<PlatformFilter, React.ReactNode> = {
  all: null,
  android: <IconAndroid size={17} />,
  ios: <IconApple size={17} />,
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

  // Every navigation carries the box's current text with it. `query.q` only
  // catches up once the server render lands, so typing and then clicking a
  // platform within the debounce window used to fire two navigations that each
  // dropped the other's change. Sending `q` along makes the click a superset of
  // the pending search, and the timer below then finds nothing left to do.
  const go = React.useCallback(
    (next: Partial<MarketQuery>) => {
      startTransition(() => {
        router.push(marketHref({ ...query, q: term, page: 1, ...next }), { scroll: false });
      });
    },
    [query, term, router]
  );

  React.useEffect(() => {
    if (term === query.q) return;
    const timer = setTimeout(() => go({ q: term }), 300);
    return () => clearTimeout(timer);
  }, [term, query.q, go]);

  const active = isFiltered(query);
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
      {/* Search on its own line on a phone, sharing one from md up. Every other
          control lives in a single sideways-scrolling row: an earlier pass let
          them wrap and a phone got five stacked rows of chrome above the first
          app, which is more furniture than content. */}
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <div className="relative md:min-w-[13rem] md:flex-1">
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

        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 md:mx-0 md:contents md:overflow-visible md:px-0 md:pb-0">
          <div className="flex shrink-0 items-center rounded-lg border border-[var(--color-line)] p-0.5">
            {PLATFORMS.map((p) => {
              const on = query.platform === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => go({ platform: p.value })}
                  aria-pressed={on}
                  aria-label={p.label}
                  title={p.label}
                  className={cx(
                    'inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-semibold transition-colors',
                    on ? 'text-[var(--color-ink)]' : 'text-[var(--color-mute)] hover:text-[var(--color-dim)]'
                  )}
                  style={on ? { background: 'var(--color-surface-2)' } : undefined}
                >
                  {PLATFORM_MARK[p.value] ?? p.label}
                </button>
              );
            })}
          </div>

          <Select label="Status" value={query.status} onChange={(v) => go({ status: v as MarketQuery['status'] })}>
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
      </div>

      {/* --------------------------------------------------- what you are seeing */}
      <div className="flex items-baseline gap-3 text-xs text-[var(--color-mute)]">
        <span aria-live="polite">
          {pending ? 'Updating…' : <><span className="num font-semibold text-[var(--color-dim)]">{total}</span> {total === 1 ? 'app' : 'apps'}</>}
        </span>
        {/* The only surviving hint. It is a policy, not a description of a
            filter, and a developer who picks iOS deserves to know why the pod
            machinery is absent. */}
        {platformHint && <span>{platformHint}</span>}
        {active && (
          <Link href="/market" className="ml-auto font-semibold text-[var(--color-dim)] underline decoration-[var(--color-line-hi)] underline-offset-2 hover:text-[var(--color-ink)]">
            Clear
          </Link>
        )}
      </div>
    </div>
  );
}
