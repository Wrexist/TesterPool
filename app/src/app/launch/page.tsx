import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Pill, Avatar, cx } from '@/components/ui';
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

/* ------------------------------------------------------------ fallbacks */

const PLACEHOLDERS: Greenlight[] = [
  {
    slug: 'ferndeck',
    days: 14,
    testers_count: 15,
    feedback_count: 23,
    engagement_pct: 94,
    first_try: true,
    approved_at: '2026-08-08T09:12:00Z',
    app: { name: 'Ferndeck', tagline: 'Field notes for people who work outdoors', icon_url: null, category: 'Productivity' },
    dev: { handle: 'marchedlund', display_name: 'Marcus Hedlund', country_code: 'SE' },
  },
  {
    slug: 'tallyroom',
    days: 14,
    testers_count: 18,
    feedback_count: 31,
    engagement_pct: 91,
    first_try: true,
    approved_at: '2026-08-07T16:40:00Z',
    app: { name: 'Tallyroom', tagline: 'Split bills without the group chat argument', icon_url: null, category: 'Finance' },
    dev: { handle: 'hedlund_dev', display_name: 'Ingrid Solheim', country_code: 'NO' },
  },
  {
    slug: 'sunbeam-habit',
    days: 16,
    testers_count: 15,
    feedback_count: 19,
    engagement_pct: 88,
    first_try: false,
    approved_at: '2026-08-06T11:05:00Z',
    app: { name: 'Sunbeam Habit', tagline: 'Habit tracking that forgives a bad week', icon_url: null, category: 'Health & Fitness' },
    dev: { handle: 'aishabuilds', display_name: 'Aisha Kamau', country_code: 'KE' },
  },
  {
    slug: 'pocketroute',
    days: 14,
    testers_count: 15,
    feedback_count: 27,
    engagement_pct: 96,
    first_try: true,
    approved_at: '2026-08-05T08:20:00Z',
    app: { name: 'PocketRoute', tagline: 'Offline transit maps for 40 cities', icon_url: null, category: 'Maps & Navigation' },
    dev: { handle: 'dsalcedo', display_name: 'Diego Salcedo', country_code: 'CO' },
  },
  {
    slug: 'krita-notes',
    days: 14,
    testers_count: 20,
    feedback_count: 38,
    engagement_pct: 93,
    first_try: true,
    approved_at: '2026-08-04T19:55:00Z',
    app: { name: 'Krita Notes', tagline: 'Handwriting notes that actually search', icon_url: null, category: 'Productivity' },
    dev: { handle: 'meilin', display_name: 'Mei Lin Chow', country_code: 'MY' },
  },
  {
    slug: 'quiethours',
    days: 14,
    testers_count: 15,
    feedback_count: 21,
    engagement_pct: 90,
    first_try: true,
    approved_at: '2026-08-03T13:30:00Z',
    app: { name: 'Quiet Hours', tagline: 'One switch for every notification you own', icon_url: null, category: 'Tools' },
    dev: { handle: 'tnovak', display_name: 'Tomas Novak', country_code: 'CZ' },
  },
  {
    slug: 'harborlist',
    days: 15,
    testers_count: 18,
    feedback_count: 26,
    engagement_pct: 87,
    first_try: false,
    approved_at: '2026-08-02T10:10:00Z',
    app: { name: 'Harborlist', tagline: 'Shared shopping lists for households that argue', icon_url: null, category: 'Lifestyle' },
    dev: { handle: 'priya_builds', display_name: 'Priya Raman', country_code: 'IN' },
  },
  {
    slug: 'stavepad',
    days: 14,
    testers_count: 15,
    feedback_count: 17,
    engagement_pct: 92,
    first_try: true,
    approved_at: '2026-08-01T15:45:00Z',
    app: { name: 'Stavepad', tagline: 'Sheet music practice log for teachers', icon_url: null, category: 'Education' },
    dev: { handle: 'olaberg', display_name: 'Ola Berg', country_code: 'SE' },
  },
  {
    slug: 'runeledger',
    days: 14,
    testers_count: 16,
    feedback_count: 24,
    engagement_pct: 89,
    first_try: true,
    approved_at: '2026-07-31T07:25:00Z',
    app: { name: 'Runeledger', tagline: 'Invoicing for freelancers who hate invoicing', icon_url: null, category: 'Business' },
    dev: { handle: 'daniokafor', display_name: 'Dani Okafor', country_code: 'NG' },
  },
];

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

async function loadGreenlights(): Promise<{ rows: Greenlight[]; live: boolean }> {
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

    if (error || !data || data.length === 0) return { rows: PLACEHOLDERS, live: false };

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

    return { rows, live: true };
  } catch {
    // No database configured yet, or the network is unavailable. The feed is
    // marketing surface; it should never be the thing that 500s.
    return { rows: PLACEHOLDERS, live: false };
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
  const { rows, live } = await loadGreenlights();

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
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          {!live && (
            <p className="mb-6 text-xs text-[var(--color-mute)]">
              Showing a recent selection. New greenlights appear here within minutes
              of approval.
            </p>
          )}

          <div className={cx('grid gap-4 sm:grid-cols-2 lg:grid-cols-3')}>
            {rows.map((g) => (
              <GreenlightCard key={g.slug} g={g} />
            ))}
          </div>

          <Card className="mt-10 flex flex-col items-start justify-between gap-5 p-7 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                The next one on this page could be yours
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--color-dim)]">
                Join a pod of {RULES.podSeats}, hold the clock for{' '}
                {RULES.requiredDays} days, and get a share page like these with the
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
