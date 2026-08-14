/**
 * TESTERPOOL — the marketplace, as rendered.
 *
 * Kept apart from the page so that what is on screen depends only on its
 * arguments: the page reads `market_apps` and hands the rows over, and nothing
 * in here knows where they came from.
 */

import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { AppCard } from '@/components/app/app-card';
import { AppRow } from '@/components/app/app-row';
import { FilterBar, type ScopeCounts } from './filter-bar';
import { IconArrow, IconPlus } from '@/components/app/icons';
import { EARN } from '@/lib/economy';
import { marketHref, PAGE_SIZE, type MarketApp, type MarketPulse, type MarketQuery } from '@/lib/market';
import { n } from '@/lib/pods';

/** Named for why you are looking, not for what the filter is called. */
const SECTION_TITLE: Record<MarketQuery['scope'], string> = {
  all: 'Apps to test',
  open: 'Open to you right now',
  testing: 'Testing now',
  due: 'Reports you owe',
  tested: 'Apps you have tested',
  mine: 'Your apps',
  saved: 'Saved for later',
};

export function MarketView({
  query, apps, categories, counts, pulse, error,
}: {
  query: MarketQuery;
  apps: MarketApp[];
  categories: { category: string; apps: number }[];
  counts: ScopeCounts;
  pulse?: MarketPulse | null;
  error?: { message: string } | null;
}) {
  const total = n(apps[0]?.total_count, apps.length);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
          {/* One line. The two features are named and separated here, so a
              developer knows which screen owns the 14-day clock. */}
          <p className="mt-1 text-sm text-[var(--color-dim)]">
            Every app in the pool.{' '}
            <Link href="/pods" className="underline decoration-[var(--color-line-hi)] underline-offset-2 hover:text-[var(--color-ink)]">
              Pods
            </Link>{' '}
            handle the 14-day clock.
          </p>
        </div>
        <Link href="/onboarding" className="btn btn-secondary shrink-0">
          <IconPlus size={15} /> List an app
        </Link>
      </header>

      <PulseStrip pulse={pulse} />

      <FilterBar query={query} categories={categories} counts={counts} total={total} />

      {error ? (
        <EmptyState
          title="The marketplace did not load"
          body={`${error.message}. Reload the page; if it keeps happening the status of every scheduled job is on the system page.`}
          action={<Link href="/market" className="btn btn-secondary">Try again</Link>}
        />
      ) : apps.length === 0 ? (
        <Empty query={query} />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-[15px] font-semibold tracking-tight">
              {SECTION_TITLE[query.scope]}
            </h2>

            {/* Rows on a phone, cards from md up. Same data, and the row is not
                a shrunken card — it is the shape that fits six apps on a screen
                instead of two. */}
            <div className="flex flex-col gap-2.5 md:hidden">
              {apps.map((app) => (
                <AppRow key={app.id} app={app} />
              ))}
            </div>
            <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
              {apps.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          </section>

          {lastPage > 1 && (
            <nav className="flex items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
              <PageLink query={query} page={query.page - 1} disabled={query.page <= 1}>
                Previous
              </PageLink>
              <span className="text-xs text-[var(--color-mute)]">
                Page <span className="num">{query.page}</span> of <span className="num">{lastPage}</span>
              </span>
              <PageLink query={query} page={query.page + 1} disabled={query.page >= lastPage}>
                Next
              </PageLink>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function PageLink({
  query, page, disabled, children,
}: {
  query: MarketQuery;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="btn btn-ghost pointer-events-none opacity-40">{children}</span>;
  }
  return (
    <Link href={marketHref({ ...query, page })} className="btn btn-secondary">
      {children}
    </Link>
  );
}

/**
 * An empty grid is a dead end unless it says what to do next, and what to do
 * next is different for each filter. A tester with nothing to report is being
 * congratulated; a developer with no listing is being asked for one.
 */
function Empty({ query }: { query: MarketQuery }) {
  const cleared = (
    <Link href="/market" className="btn btn-secondary">
      Clear the filters
    </Link>
  );

  if (query.scope === 'due') {
    return (
      <EmptyState
        title="Nothing owed"
        body={`You have written a report for every app you are testing. Each approved one pays ${EARN.feedbackApproved}, so this page being empty is the good outcome.`}
        action={<Link href={marketHref({ scope: 'testing' })} className="btn btn-secondary">See what you are testing</Link>}
      />
    );
  }
  if (query.scope === 'testing' || query.scope === 'tested') {
    return (
      <EmptyState
        title="You are not testing anything yet"
        body="Pick an app that is open to testers, join its closed test, use it, and send the developer a report. That is one job, start to finish."
        action={
          <Link href={marketHref({ status: 'needs_testers' })} className="btn btn-primary">
            Find an app to test <IconArrow size={15} />
          </Link>
        }
      />
    );
  }
  if (query.scope === 'mine') {
    return (
      <EmptyState
        title="You have not listed an app"
        body="List it and it appears here beside the rest of the pool. A draft is private until you join a pod with it."
        action={<Link href="/onboarding" className="btn btn-primary">List your app <IconArrow size={15} /></Link>}
      />
    );
  }
  if (query.scope === 'saved') {
    return (
      <EmptyState
        title="Nothing saved yet"
        body="The bookmark on any card keeps it here. Saving is private, pays nothing, and is the fastest way to remember an app you want to test when it next opens a pod."
        action={<Link href={marketHref({ status: 'needs_testers' })} className="btn btn-secondary">Find apps needing testers</Link>}
      />
    );
  }
  return (
    <EmptyState
      title="No apps match that"
      body="Nothing in the pool fits this combination right now. Widen the filters, or check back — apps arrive daily and pods form within a few days."
      action={cleared}
    />
  );
}

/**
 * Three numbers and a count of open work.
 *
 * A first-time visitor cannot tell whether this network has fifteen members or
 * fifteen hundred, and silence reads as zero. Rendering nothing when the pulse
 * is unavailable is deliberate — a strip of zeroes is worse than no strip.
 */
function PulseStrip({ pulse }: { pulse?: MarketPulse | null }) {
  if (!pulse) return null;

  // Only genuine 24-hour counts sit under the 24H marker. `open_apps` is a
  // right-now number and belongs to the filters, not here.
  const items = [
    { value: n(pulse.active_testers), label: 'testers' },
    { value: n(pulse.installs), label: 'installs' },
    { value: n(pulse.reports), label: 'reports' },
  ];
  if (items.every((i) => i.value === 0)) return null;

  return (
    <div className="-mx-1 flex items-center gap-3 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5">
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--color-accent)' }}
        />
        24h
      </span>
      {items.map((item) => (
        <span key={item.label} className="flex shrink-0 items-baseline gap-1.5 text-xs">
          <span className="num font-bold text-[var(--color-ink)]">{item.value}</span>
          <span className="text-[var(--color-mute)]">{item.label}</span>
        </span>
      ))}
    </div>
  );
}
