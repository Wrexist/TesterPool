/**
 * TESTERPOOL — Home.
 *
 * The feed is the product, so the feed is the home screen. Above it sit exactly
 * three things, in the order a member needs them: a greeting with their
 * balance, proof the network is alive, and the one invitation that matters if
 * they have not listed anything yet.
 *
 * Rows, not cards, at every width. The grid of cards this replaced fitted two
 * apps on a phone screen; a row fits six, and six is the difference between
 * browsing and scrolling.
 *
 * Kept apart from the page so that what is on screen depends only on its
 * arguments: the page reads `market_apps` and hands the rows over, and nothing
 * in here knows where they came from.
 */

import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { AppHeader } from '@/components/app/app-header';
import { AppRow } from '@/components/app/app-row';
import { FilterBar, type ScopeCounts } from './filter-bar';
import { IconArrow, IconPlus } from '@/components/app/icons';
import { marketHref, PAGE_SIZE, type MarketApp, type MarketPulse, type MarketQuery } from '@/lib/market';
import { n } from '@/lib/format';

/** Named for why you are looking, not for what the filter is called. */
const SECTION_TITLE: Record<MarketQuery['scope'], string> = {
  all: 'Apps to test',
  open: 'Open to you right now',
  live: 'Live games still taking testers',
  testing: 'Testing now',
  due: 'Reports you owe',
  tested: 'Apps you have tested',
  mine: 'Your apps',
  saved: 'Saved for later',
};

export interface ViewerSummary {
  displayName: string;
  credits: number;
  messages: number;
  alerts: number;
  ownsApps: boolean;
}

export function MarketView({
  query, apps, categories, counts, pulse, viewer, error,
}: {
  query: MarketQuery;
  apps: MarketApp[];
  categories: { category: string; apps: number }[];
  counts: ScopeCounts;
  pulse?: MarketPulse | null;
  viewer: ViewerSummary;
  error?: { message: string } | null;
}) {
  const total = n(apps[0]?.total_count, apps.length);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <AppHeader
        displayName={viewer.displayName}
        credits={viewer.credits}
        messages={viewer.messages}
        alerts={viewer.alerts}
      />

      <PulseStrip pulse={pulse} />

      {/* Shown until they own something. Once they do, the invitation has been
          accepted and the slot belongs to the feed. */}
      {!viewer.ownsApps && <ListYourAppCard />}

      <FilterBar query={query} categories={categories} counts={counts} total={total} />

      {error ? (
        <EmptyState
          title="The feed did not load"
          body={`${error.message}. Reload the page; if it keeps happening the status of every scheduled job is on the system page.`}
          action={<Link href="/market" className="btn btn-secondary">Try again</Link>}
        />
      ) : apps.length === 0 ? (
        <Empty query={query} />
      ) : (
        <section>
          <h2 className="mb-3 text-[19px] font-bold tracking-tight">
            {SECTION_TITLE[query.scope]}
          </h2>

          <div className="flex flex-col gap-3">
            {apps.map((app) => (
              <AppRow key={app.id} app={app} counts={query.scope === 'mine'} />
            ))}
          </div>
        </section>
      )}

      {lastPage > 1 && <Pager query={query} page={query.page} lastPage={lastPage} />}
    </div>
  );
}

/**
 * The dashed invitation.
 *
 * A member who has taken work but listed nothing is only half in the exchange,
 * and they are the half that keeps the feed shallow. This is the one thing on
 * the screen allowed to be an advert, and it disappears the moment it works.
 */
function ListYourAppCard() {
  return (
    <Link href="/onboarding" className="card-dashed flex items-center gap-4 p-5">
      <span
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
      >
        <IconPlus size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold leading-tight">Add your app to this list</span>
        <span className="mt-1 block text-[15px] leading-snug text-[var(--color-dim)]">
          Get installs and written reports from real developers
        </span>
      </span>
      <IconArrow size={18} className="shrink-0 text-[var(--color-mute)]" />
    </Link>
  );
}

/**
 * Three numbers under a 24-hour marker.
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
    { value: n(pulse.active_testers), label: 'Active' },
    { value: n(pulse.installs), label: 'Installs' },
    { value: n(pulse.reports), label: 'Reports' },
  ];
  if (items.every((i) => i.value === 0)) return null;

  return (
    <div className="card flex items-center gap-2.5 overflow-x-auto rounded-full px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-[var(--color-android)]">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: 'var(--color-android)' }}
        />
        24H
      </span>
      <span className="h-4 w-px shrink-0 bg-[var(--color-line)]" />
      {items.map((item, i) => (
        <span key={item.label} className="flex shrink-0 items-baseline gap-1.5 text-[14px]">
          {i > 0 && <span className="mr-1 text-[var(--color-line-hi)]">·</span>}
          <span className="num font-bold text-[var(--color-ink)]">{item.value}</span>
          <span className="text-[var(--color-dim)]">{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function Pager({ query, page, lastPage }: { query: MarketQuery; page: number; lastPage: number }) {
  return (
    <nav className="flex items-center justify-between gap-3 pt-1" aria-label="Pagination">
      {page > 1 ? (
        <Link href={marketHref({ ...query, page: page - 1 })} className="btn btn-secondary">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-[13px] text-[var(--color-mute)]">
        Page <span className="num">{page}</span> of <span className="num">{lastPage}</span>
      </span>
      {page < lastPage ? (
        <Link href={marketHref({ ...query, page: page + 1 })} className="btn btn-secondary">
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function Empty({ query }: { query: MarketQuery }) {
  const cleared = <Link href="/market" className="btn btn-secondary">Clear filters</Link>;

  if (query.scope === 'due') {
    return (
      <EmptyState
        title="You owe nobody a report"
        body="Everything you have installed has been written up. Take another app and the report comes back here."
        action={<Link href={marketHref({ scope: 'open' })} className="btn btn-primary">Find an app to test</Link>}
      />
    );
  }
  if (query.scope === 'testing') {
    return (
      <EmptyState
        title="You are not testing anything"
        body="Pick an app from the feed and it is yours: join the closed track, use it, send one report."
        action={<Link href={marketHref({ scope: 'open' })} className="btn btn-primary">Browse open apps</Link>}
      />
    );
  }
  if (query.scope === 'mine') {
    return (
      <EmptyState
        title="You have not listed an app"
        body="List it and it appears here beside everyone else's. A draft stays private until you open it to testers."
        action={<Link href="/onboarding" className="btn btn-primary">List your app <IconArrow size={15} /></Link>}
      />
    );
  }
  if (query.scope === 'saved') {
    return (
      <EmptyState
        title="Nothing saved yet"
        body="The bookmark on any card keeps it here. Saving is private, pays nothing, and is the fastest way to remember an app you want to test when it next opens up."
        action={<Link href={marketHref({ status: 'needs_testers' })} className="btn btn-secondary">Find apps needing testers</Link>}
      />
    );
  }
  return (
    <EmptyState
      title="No apps match that"
      body="Nothing here fits this combination right now. Widen the filters, or check back — apps are listed daily."
      action={cleared}
    />
  );
}
