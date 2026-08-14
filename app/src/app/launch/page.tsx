import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Pill, Avatar, EmptyState, cx } from '@/components/ui';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { createClient } from '@/lib/supabase/server';
import { RULES } from '@/lib/economy';

export const metadata: Metadata = {
  title: 'The Launch Feed',
  description:
    'Apps that cleared Google Play production access this month, with the numbers behind each one: days held, testers kept, feedback reports collected.',
  alternates: { canonical: '/launch' },
  openGraph: {
    title: 'The Launch Feed · TesterPool',
    description:
      'Apps that cleared Google Play production access, with the numbers behind each one.',
    url: '/launch',
  },
};

/* --------------------------------------------------------------- shapes */

type Greenlight = {
  slug: string;
  days: number;
  testers_count: number;
  feedback_count: number;
  engagement_pct: number;
  first_try: boolean;
  approved_at: string;
  app: {
    name: string;
    tagline: string | null;
    icon_url: string | null;
    category: string | null;
  } | null;
  dev: { handle: string; display_name: string; country_code: string | null } | null;
};


/* ------------------------------------------------------------- fetching */

type Row = {
  slug: string;
  days: number | null;
  testers_count: number | null;
  feedback_count: number | null;
  engagement_pct: number | null;
  first_try: boolean | null;
  approved_at: string;
  apps: { name: string; tagline: string | null; icon_url: string | null; category: string | null; status: string } | null;
  profiles: { handle: string; display_name: string; country_code: string | null } | null;
};

/**
 * Returns nothing rather than something invented.
 *
 * This used to fall back to five fictional greenlights — named apps, named
 * developers, invented tester counts — rendered under "Showing a recent
 * selection", which reads as a claim that these apps really cleared production
 * access. None had. On a site whose whole argument is that we are the honest
 * option in a category built on lying to developers, a fabricated outcome is
 * the one thing that ends the argument the moment a reader checks.
 *
 * An empty feed is a true statement about a new network. It is also temporary.
 */
async function loadGreenlights(): Promise<{ rows: Greenlight[]; ok: boolean }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('greenlights')
      .select(
        'slug, days, testers_count, feedback_count, engagement_pct, first_try, approved_at,' +
          ' apps!inner(name, tagline, icon_url, category, status),' +
          ' profiles(handle, display_name, country_code)'
      )
      .eq('is_public', true)
      .eq('apps.status', 'graduated')
      .order('approved_at', { ascending: false })
      .limit(48);

    if (error) return { rows: [], ok: false };
    if (!data || data.length === 0) return { rows: [], ok: true };

    const rows = (data as unknown as Row[]).map((r) => ({
      slug: r.slug,
      days: r.days ?? RULES.requiredDays,
      testers_count: r.testers_count ?? 0,
      feedback_count: r.feedback_count ?? 0,
      engagement_pct: r.engagement_pct ?? 0,
      first_try: r.first_try ?? false,
      approved_at: r.approved_at,
      app: r.apps
        ? {
            name: r.apps.name,
            tagline: r.apps.tagline,
            icon_url: r.apps.icon_url,
            category: r.apps.category,
          }
        : null,
      dev: r.profiles,
    }));

    return { rows, ok: true };
  } catch {
    // No database configured yet, or the network is unavailable. The feed is
    // marketing surface; it should never be the thing that 500s.
    return { rows: [], ok: false };
  }
}

/* ---------------------------------------------------------------- pieces */

function AppIcon({ name, src }: { name: string; src?: string | null }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={44} height={44} className="h-11 w-11 rounded-xl object-cover" />;
  }
  return (
    <span
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
      style={{ background: `oklch(0.33 0.07 ${hue})`, color: `oklch(0.9 0.12 ${hue})` }}
    >
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

function relativeDay(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function GreenlightCard({ g }: { g: Greenlight }) {
  const name = g.app?.name ?? 'Untitled app';
  return (
    <Card className="flex flex-col p-5" hover>
      <div className="flex items-start gap-3">
        <AppIcon name={name} src={g.app?.icon_url} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate text-[15px] font-semibold leading-tight">{name}</h2>
            {g.first_try && <Pill tone="green">First try</Pill>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-[var(--color-dim)]">
            {g.app?.tagline ?? 'Approved for production access.'}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)]">
        {[
          { l: 'Days', v: g.days },
          { l: 'Testers', v: g.testers_count },
          { l: 'Feedback', v: g.feedback_count },
        ].map((s) => (
          <div key={s.l} className="bg-[var(--color-bg)] px-3 py-2.5 text-center">
            <dd className="num text-lg font-bold leading-none">{s.v}</dd>
            <dt className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
              {s.l}
            </dt>
          </div>
        ))}
      </dl>

      <div className="mt-auto flex items-center gap-2 pt-5">
        <Avatar name={g.dev?.display_name || g.dev?.handle || name} size={24} />
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-dim)]">
          @{g.dev?.handle ?? 'anonymous'}
          {g.dev?.country_code ? ` · ${g.dev.country_code}` : ''}
        </span>
        <span className="num shrink-0 text-xs text-[var(--color-mute)]">
          {relativeDay(g.approved_at)}
        </span>
      </div>

      <Link
        href={`/g/${g.slug}`}
        className="mt-4 text-xs font-semibold text-[var(--color-accent)] hover:underline"
      >
        See the greenlight →
      </Link>
    </Card>
  );
}

/* ------------------------------------------------------------------ page */

export default async function LaunchPage() {
  const { rows, ok } = await loadGreenlights();

  const totalTesters = rows.reduce((s, r) => s + r.testers_count, 0);
  const totalFeedback = rows.reduce((s, r) => s + r.feedback_count, 0);
  const firstTry = rows.filter((r) => r.first_try).length;
  const firstTryPct = rows.length ? Math.round((firstTry / rows.length) * 100) : 0;

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <section className="dotgrid relative overflow-hidden border-b border-[var(--color-line)]">
          <div
            className="pointer-events-none absolute left-1/2 top-[-16rem] h-[32rem] w-[56rem] -translate-x-1/2"
            style={{
              background:
                'radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--color-accent) 11%, transparent), transparent 70%)',
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <Pill tone="green">Greenlit</Pill>
            <h1 className="mt-5 text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl">
              The Launch Feed
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-dim)]">
              Every app here held {RULES.requiredTesters} or more testers for the
              full {RULES.requiredDays} days and cleared Google Play production
              access. These are the numbers each one applied with.
            </p>

            {rows.length === 0 && (
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-mute)]">
                There are none yet. TesterPool is new, the first pods are still
                running, and this page stays empty until an app actually clears.
                Nothing on it will ever be an illustration.
              </p>
            )}

            {rows.length > 0 && (
            <dl className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
              {[
                { l: 'apps greenlit', v: rows.length.toLocaleString() },
                { l: 'tester seats held', v: totalTesters.toLocaleString() },
                { l: 'feedback reports', v: totalFeedback.toLocaleString() },
                { l: 'approved first try', v: `${firstTryPct}%` },
              ].map((s) => (
                <div key={s.l} className="flex items-baseline gap-2">
                  <dt className="sr-only">{s.l}</dt>
                  <dd className="num text-2xl font-bold leading-none">{s.v}</dd>
                  <span className="text-sm text-[var(--color-mute)]">{s.l}</span>
                </div>
              ))}
            </dl>
            )}
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          {rows.length === 0 ? (
            <EmptyState
              title={ok ? 'No apps have cleared yet' : 'The feed could not be read'}
              body={
                ok
                  ? 'A greenlight appears here within minutes of an app being approved for production. Until one is, there is nothing to show — and a page like this filled with examples would be worth less than an empty one.'
                  : 'This page reads live from the network and the read failed. Rather than show you something invented, it shows you nothing. Try again shortly.'
              }
              action={
                <Link href="/pool" className="btn btn-primary">
                  See what is open to testers
                </Link>
              }
            />
          ) : (
            <div className={cx('grid gap-4 sm:grid-cols-2 lg:grid-cols-3')}>
              {rows.map((g) => (
                <GreenlightCard key={g.slug} g={g} />
              ))}
            </div>
          )}

          <Card className="mt-10 flex flex-col items-start justify-between gap-5 p-7 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                The next one on this page could be yours
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--color-dim)]">
                Join a pod of {RULES.podSeats}, hold the clock for{' '}
                {RULES.requiredDays} days, and get a share page here with the
                evidence attached.
              </p>
            </div>
            <Link href="/login" className="btn btn-primary shrink-0">
              Start free
            </Link>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
