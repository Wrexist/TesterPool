'use client';

/**
 * TESTERPOOL — the feed's filters, as one row of chips.
 *
 * The previous version had five separate controls stacked — scope, platform,
 * status, category, sort — which is a desktop admin filter panel wearing a
 * phone's clothes. On a 390px screen it occupied the whole first viewport, so
 * the first thing a member saw on opening the product was its filter UI.
 *
 * This is one horizontally-scrollable row, and search is a button that opens a
 * field rather than a field that is always there. Everything the old bar could
 * express is still reachable — the URL grammar is unchanged and `marketHref`
 * still builds it — the chips just surface the six a member actually uses.
 *
 * The search button is pinned outside the scroll area on purpose. A control
 * that scrolls off the end of a row is a control most people never find.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cx } from '@/components/ui';
import { IconSearch, IconAndroid, IconApple, IconCheck } from '@/components/app/icons';
import {
  marketHref, isFiltered,
  type MarketQuery, type PlatformFilter, type Scope,
} from '@/lib/market';

/**
 * The scopes "My Activity" stands for. Kept as a list rather than as a check
 * against `'all'` so that a scope added later has to be placed deliberately —
 * on this chip or beside it — instead of falling into it by default.
 */
const MY_SCOPES: Scope[] = ['testing', 'due', 'tested', 'open', 'mine', 'saved'];

export type ScopeCounts = Partial<
  Record<'open' | 'live' | 'testing' | 'due' | 'mine' | 'saved', number>
>;

type ChipDef = {
  key: string;
  label: string;
  href: string;
  active: boolean;
  Icon?: (p: { size?: number; className?: string }) => React.ReactElement;
  badge?: number;
};

function Chip({ chip }: { chip: ChipDef }) {
  return (
    <Link
      href={chip.href}
      aria-current={chip.active ? 'true' : undefined}
      className={cx('chip shrink-0', chip.active && 'chip-on')}
    >
      {chip.Icon && <chip.Icon size={16} />}
      {chip.label}
      {!!chip.badge && (
        <span
          className="num rounded-full px-1.5 text-[11px] font-bold"
          style={
            chip.active
              ? { background: 'rgba(255,255,255,.24)', color: '#fff' }
              : { background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }
          }
        >
          {chip.badge}
        </span>
      )}
    </Link>
  );
}

export function FilterBar({
  query, categories, counts, total,
}: {
  query: MarketQuery;
  categories: { category: string; apps: number }[];
  counts: ScopeCounts;
  total: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(!!query.q);
  const [term, setTerm] = React.useState(query.q);
  const [pending, startTransition] = React.useTransition();
  const box = React.useRef<HTMLInputElement>(null);

  // A navigation that changes the query — a chip, the back button — has to win
  // over whatever is sitting in the box.
  const [lastQ, setLastQ] = React.useState(query.q);
  if (lastQ !== query.q) {
    setLastQ(query.q);
    setTerm(query.q);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => router.push(marketHref({ ...query, q: term.trim(), page: 1 })));
  }

  const platformChip = (value: PlatformFilter, label: string, Icon?: ChipDef['Icon']): ChipDef => ({
    key: `p:${value}`,
    label,
    Icon,
    href: marketHref({ ...query, platform: value, page: 1 }),
    active: query.platform === value && query.scope === 'all',
  });

  const scopeChip = (value: Scope, label: string, badge?: number): ChipDef => ({
    key: `s:${value}`,
    label,
    href: marketHref({ ...query, scope: value, page: 1 }),
    active: query.scope === value,
    badge,
  });

  /*
   * Four chips, and the order is the order a thumb travels: the default, the
   * two stores everybody recognises by their logo, and then everything that is
   * about you.
   *
   * The personal scopes used to be five separate chips — Open to me, Testing,
   * Report due, My apps, Saved — which pushed the two store filters off the
   * visible part of the row on a phone and made the first thing a member saw on
   * opening the product a horizontal scrollbar of filter names.
   *
   * They are one chip now, and the five open underneath it when it is active.
   * Nothing became unreachable: the URL grammar is unchanged, `marketHref`
   * still builds every one of them, and a link to /market?scope=due still lands
   * where it always did.
   */
  const mine = MY_SCOPES.includes(query.scope);
  const owed = (counts.due ?? 0) + (counts.testing ?? 0);

  const chips: ChipDef[] = [
    {
      key: 'all',
      label: 'All',
      href: marketHref({ sort: query.sort }),
      active: query.scope === 'all' && query.platform === 'all' && !query.q && query.category === 'all',
    },
    platformChip('android', 'Android', IconAndroid),
    platformChip('ios', 'iOS', IconApple),
    {
      key: 'mine',
      label: 'My Activity',
      Icon: IconCheck,
      // Lands on the work in hand rather than on the whole history, because the
      // reason to tap this is almost always "what do I still owe".
      href: marketHref({ ...query, scope: 'testing', page: 1 }),
      active: mine,
      badge: owed || undefined,
    },
  ];

  // Shown only while one of them is active, so the row above stays four wide.
  const sub: ChipDef[] = mine
    ? [
        scopeChip('testing', 'Testing', counts.testing),
        scopeChip('due', 'Report due', counts.due),
        scopeChip('tested', 'Tested'),
        scopeChip('open', 'Open to me', counts.open),
        scopeChip('mine', 'My apps', counts.mine),
        scopeChip('saved', 'Saved', counts.saved),
      ]
    : [];

  const filtered = isFiltered(query);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {/* The row bleeds to both screen edges so the last chip is visibly cut
            off rather than sitting flush — a chip row that ends neatly at the
            margin does not look scrollable. */}
        <div className="-mx-4 flex-1 overflow-x-auto px-4 md:-mx-8 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-2 pr-2">
            {chips.map((chip) => (
              <Chip key={chip.key} chip={chip} />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            requestAnimationFrame(() => box.current?.focus());
          }}
          aria-expanded={open}
          aria-label="Search apps"
          className={cx(
            'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors',
            open || query.q
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-surface-2)] text-[var(--color-dim)] hover:text-[var(--color-ink)]'
          )}
        >
          <IconSearch size={19} />
        </button>
      </div>

      {sub.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 md:-mx-8 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-2 pr-2">
            {sub.map((chip) => (
              <Chip key={chip.key} chip={chip} />
            ))}
          </div>
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            ref={box}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by name, developer or category"
            className="input"
            aria-label="Search apps"
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={pending}>
            {pending ? 'Searching' : 'Search'}
          </button>
        </form>
      )}

      {(filtered || categories.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-[var(--color-mute)]">
          <span>
            <span className="num font-semibold text-[var(--color-dim)]">{total}</span>{' '}
            {total === 1 ? 'app' : 'apps'}
          </span>

          {/* Categories are a long tail, so they are a select rather than more
              chips: fifteen category chips would bury the six above. */}
          {categories.length > 0 && (
            <select
              value={query.category}
              onChange={(e) =>
                startTransition(() =>
                  router.push(marketHref({ ...query, category: e.target.value, page: 1 }))
                )
              }
              aria-label="Category"
              className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1 text-[13px] font-medium text-[var(--color-dim)]"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category} ({c.apps})
                </option>
              ))}
            </select>
          )}

          {filtered && (
            <Link href="/market" className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)]">
              <IconCheck size={13} /> Clear filters
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
