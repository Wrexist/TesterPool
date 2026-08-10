import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Pill, StreakStrip, Avatar, cx } from '@/components/ui';
import { SiteFooter } from '@/components/SiteChrome';
import { LogoMark, Wordmark } from '@/components/Logo';
import { RULES } from '@/lib/economy';
import { getGreenlight, type GreenlightView } from './greenlight';
import { ShareButtons } from './ShareButtons';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function summaryLine(g: GreenlightView) {
  const bits = [
    `${g.days} days`,
    `${g.testers} testers`,
    g.feedback ? `${g.feedback} feedback reports` : null,
    g.firstTry ? 'approved first try' : null,
  ].filter(Boolean);
  return bits.join(' · ');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGreenlight(slug);

  const title = `${g.appName} is approved for production`;
  const description = g.found
    ? `${g.appName} cleared Google Play production access with ${summaryLine(g)}. Greenlit through a TesterPool pod.`
    : `Greenlit on TesterPool — ${RULES.requiredTesters} testers, ${RULES.requiredDays} consecutive days, production access approved.`;
  const url = `${SITE_URL}/g/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: `/g/${slug}` },
    openGraph: {
      type: 'article',
      url,
      siteName: 'TesterPool',
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

function Check({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function GreenlightPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = await getGreenlight(slug);
  const url = `${SITE_URL}/g/${slug}`;

  const shareText = g.found
    ? `${g.appName} is approved for production on Google Play — ${summaryLine(g)}.`
    : 'Approved for production on Google Play, via a TesterPool pod.';

  const stats: Array<{ label: string; value: string }> = [
    { label: 'Days held', value: String(g.days) },
    { label: 'Testers', value: String(g.testers) },
    { label: 'Feedback reports', value: g.feedback ? String(g.feedback) : '—' },
    { label: 'Engagement', value: g.engagement ? `${g.engagement}%` : '—' },
  ];

  const approved = g.approvedAt
    ? new Date(g.approvedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <>
      <header className="border-b border-[var(--color-line)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="TesterPool home">
            <LogoMark size={22} />
            <Wordmark />
          </Link>
          <Link href="/login" className="btn btn-secondary">
            Get your 12
          </Link>
        </div>
      </header>

      <main className="dotgrid relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute left-1/2 top-[-14rem] h-[34rem] w-[54rem] -translate-x-1/2"
          style={{
            background:
              'radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--color-accent) 15%, transparent), transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <Card className="overflow-hidden p-8 text-center sm:p-12">
            <span
              className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: 'color-mix(in oklab, var(--color-accent) 14%, transparent)',
                color: 'var(--color-accent)',
                boxShadow: '0 0 0 1px color-mix(in oklab, var(--color-accent) 30%, transparent)',
              }}
            >
              <Check size={28} />
            </span>

            <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
              Approved for production
            </div>

            <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              {g.appName}
            </h1>

            {g.tagline && (
              <p className="mt-3 text-base text-[var(--color-dim)]">{g.tagline}</p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {g.firstTry && <Pill tone="green">First try ✓</Pill>}
              <Pill tone="neutral">Google Play</Pill>
              {approved && <Pill tone="neutral">{approved}</Pill>}
            </div>

            <div className="mt-9 flex justify-center">
              <StreakStrip
                days={Array.from({ length: RULES.requiredDays }, () => 'done' as const)}
                size={14}
                gap={5}
              />
            </div>

            <dl className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="bg-[var(--color-bg)] px-3 py-4">
                  <dd className="num text-2xl font-bold leading-none">{s.value}</dd>
                  <dt className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>

            <div className="mt-9 flex items-center justify-center gap-3 border-t border-[var(--color-line)] pt-7">
              <Avatar name={g.devName} size={34} />
              <div className="text-left">
                <div className="text-sm font-medium leading-tight">{g.devName}</div>
                {g.devHandle && (
                  <div className="text-xs text-[var(--color-mute)]">@{g.devHandle}</div>
                )}
              </div>
            </div>
          </Card>

          <div className="mt-6">
            <ShareButtons url={url} text={shareText} />
          </div>

          <Card className={cx('mt-8 p-7 text-center')}>
            <h2 className="text-lg font-semibold tracking-tight">
              {RULES.requiredTesters} testers. {RULES.requiredDays} consecutive days.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--color-dim)]">
              That is what Google Play asks for before you can publish, and it is
              the reason most first apps stall. TesterPool puts you in a pod of{' '}
              {RULES.podSeats} developers who test each other for the same{' '}
              {RULES.requiredDays} days. No money, no store reviews, no policy risk.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/login" className="btn btn-primary">
                Start free
              </Link>
              <Link href="/launch" className="btn btn-secondary">
                See who else shipped
              </Link>
            </div>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
