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
import { FilterBar, type ScopeCounts } from './filter-bar';
import { IconArrow, IconPlus } from '@/components/app/icons';
import { EARN, RULES } from '@/lib/economy';
import { marketHref, PAGE_SIZE, type MarketApp, type MarketQuery } from '@/lib/market';
import { n } from '@/lib/pods';

export function MarketView({
  query, apps, categories, counts, error,
}: {
  query: MarketQuery;
  apps: MarketApp[];
  categories: { category: string; apps: number }[];
  counts: ScopeCounts;
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>

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
        body={`Join a pod with your own app and you are seated as a tester for everyone else in it. ${RULES.podSeats} developers, fourteen days, each holding the clock for the others.`}
        action={<Link href="/pods" className="btn btn-primary">Browse forming pods <IconArrow size={15} /></Link>}
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
