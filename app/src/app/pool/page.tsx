/**
 * THE POOL — the public, signed-out view of what is in the network.
 *
 * The landing page argues; this page shows. It exists because the single
 * question a stranger has before joining a two-sided network is "is anyone
 * actually here", and the honest answer — whatever it is — beats silence,
 * because silence reads as zero.
 *
 * Everything on it comes from `market_showcase()`, the one `security definer`
 * function in this schema granted to `anon`. That function decides what a
 * stranger may see; this file only lays it out. In particular there is no app
 * detail link here, because there is no anonymous detail page to link to: for
 * an app in closed testing the way in is granted by a pod, not by a directory.
 *
 * Not `/apps` — `(app)/apps` already owns that URL as the authenticated
 * "my apps" screen.
 */
import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Pill, EmptyState } from '@/components/ui';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { createClient } from '@/lib/supabase/server';
import { RULES } from '@/lib/economy';

export const metadata: Metadata = {
  title: 'The pool',
  description:
    'Every Android app currently open to testers on TesterPool, and what the network did in the last 24 hours. No account needed to look.',
  alternates: { canonical: '/pool' },
  openGraph: {
    title: 'The pool · TesterPool',
    description:
      'Android apps currently open to testers, and what the network did in the last 24 hours.',
    url: '/pool',
  },
};

/** Counts change by the minute; a cached page that says "live" is lying. */
export const revalidate = 60;

/* ---------------------------------------------------------------- shapes */

type ShowcaseApp = {
  name: string;
  tagline: string | null;
  category: string | null;
  platform: string;
  icon_url: string | null;
  created_at: string;
};

type Showcase = {
  open_apps: number;
  active_testers: number;
  reviews: number;
  graduated: number;
  apps: ShowcaseApp[];
};

const EMPTY: Showcase = {
  open_apps: 0,
  active_testers: 0,
  reviews: 0,
  graduated: 0,
  apps: [],
};

/**
 * Never throws and never invents. A failed call renders the empty state, which
 * says the pool could not be read — not a fabricated pool. The whole argument
 * of this page is that our numbers are real.
 */
async function loadShowcase(): Promise<{ data: Showcase; ok: boolean }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('market_showcase', { p_limit: 24 });
    if (error || !data) return { data: EMPTY, ok: false };

    const d = data as Partial<Showcase>;
    return {
      data: {
        open_apps: Number(d.open_apps ?? 0),
        active_testers: Number(d.active_testers ?? 0),
        reviews: Number(d.reviews ?? 0),
        graduated: Number(d.graduated ?? 0),
        apps: Array.isArray(d.apps) ? d.apps : [],
      },
      ok: true,
    };
  } catch {
    return { data: EMPTY, ok: false };
  }
}

/* ----------------------------------------------------------------- parts */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function AppTile({ app }: { app: ShowcaseApp }) {
  return (
    <Card className="flex gap-3 p-4">
      {app.icon_url ? (
        /* `icon_url` is owner-supplied and this page needs no account, so every
           anonymous visitor's browser would otherwise hand its IP and the /pool
           referrer to whatever host an app owner nominated — enough to count and
           fingerprint the people browsing the network. no-referrer is the floor;
           proxying the icons through our own storage would close the IP
           disclosure too. Plain <img> because next/image would fetch through our
           optimiser, which is a different (and costed) decision. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={app.icon_url}
          alt=""
          width={44}
          height={44}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="h-11 w-11 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-dim)' }}
          aria-hidden
        >
          {initials(app.name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-tight">{app.name}</div>
        {app.tagline && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--color-dim)]">
            {app.tagline}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--color-mute)]">
          {app.category && <span>{app.category}</span>}
          {app.category && <span aria-hidden>·</span>}
          <span>{app.platform === 'ios' ? 'iOS' : 'Android'}</span>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ page */

export default async function PoolPage() {
  // A member has a better version of this screen. Send them to it rather than
  // showing them the stranger's view of their own network.
  //
  // The redirect is deliberately OUTSIDE the try/catch. `redirect()` works by
  // throwing NEXT_REDIRECT, so a catch wrapped around it swallows the
  // navigation and silently renders this page to a signed-in member instead —
  // no error, no redirect, just the wrong page. Only the session lookup, which
  // can genuinely fail, is guarded.
  let signedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  } catch {
    // Not signed in, or auth unreachable. Either way, render the public page.
  }
  if (signedIn) redirect('/market');

  const { data, ok } = await loadShowcase();

  const stats: Array<{ v: number; l: string; sub: string }> = [
    { v: data.open_apps, l: 'apps open to testers', sub: 'right now' },
    { v: data.active_testers, l: 'testers active', sub: 'last 24 hours' },
    { v: data.reviews, l: 'reviews delivered', sub: 'last 24 hours' },
    { v: data.graduated, l: 'apps graduated', sub: 'all time' },
  ];

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <section className="dotgrid border-b border-[var(--color-line)] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
                The pool
              </div>
              <h1 className="text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl">
                What is open to testers right now
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-[var(--color-dim)]">
                Every app below is in a closed testing track and looking for
                testers. Install one, use it for the {RULES.requiredDays} days its
                pod runs, send one structured review, and the credits you earn buy
                the same treatment for yours.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-mute)]">
                Names and taglines only. The opt-in link and package name arrive
                with a pod seat, never from a directory &mdash; that is what keeps a
                closed track closed.
              </p>
            </div>

            <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--color-line)] pt-8 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.l}>
                  <dt className="sr-only">{s.l}</dt>
                  <dd className="num text-3xl font-bold leading-none">
                    {ok ? s.v.toLocaleString() : '—'}
                  </dd>
                  <dd className="mt-2 text-sm leading-snug">{s.l}</dd>
                  <dd className="text-xs text-[var(--color-mute)]">{s.sub}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap gap-2">
              <Link href="/login" className="btn btn-primary">
                Start free
              </Link>
              <Link href="/#report" className="btn btn-secondary">
                See what a review looks like
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Open right now</h2>
              {ok && data.apps.length > 0 && (
                <Pill tone="green">
                  Showing {data.apps.length} of {data.open_apps.toLocaleString()}
                </Pill>
              )}
            </div>

            {data.apps.length === 0 ? (
              <EmptyState
                title={ok ? 'Nothing open at this minute' : 'The pool could not be read'}
                body={
                  ok
                    ? 'Every app in the network is mid-cycle. New listings open continuously — sign up and you will be matched with the next pod that forms.'
                    : 'This page reads live from the network and the read failed. Rather than show you invented numbers, it shows you nothing. Try again shortly.'
                }
                action={
                  <Link href="/login" className="btn btn-primary">
                    Start free
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.apps.map((a, i) => (
                  <AppTile key={`${a.name}-${i}`} app={a} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
