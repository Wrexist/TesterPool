/**
 * TESTERPOOL — public site chrome. Shared by the landing page, the readiness
 * checker and the launch feed so the marketing surface stays one thing.
 */
import * as React from 'react';
import Link from 'next/link';
import { LogoMark, Wordmark } from '@/components/Logo';

const NAV = [
  { href: '/#how', label: 'How it works' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/readiness', label: 'Readiness check' },
  { href: '/launch', label: 'Launch feed' },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_78%,transparent)] backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="TesterPool home">
          <LogoMark size={22} />
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-[13px] font-medium text-[var(--color-dim)] transition-colors hover:text-[var(--color-ink)]"
            >
              {n.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost hidden sm:inline-flex">
            Log in
          </Link>
          <Link href="/login" className="btn btn-primary">
            Start free
          </Link>
        </div>
      </nav>
    </header>
  );
}

const FOOTER_COLS: Array<{ title: string; links: Array<{ label: string; href: string; external?: boolean }> }> = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/#how' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Credits & economy', href: '/#economy' },
      { label: 'Evidence Pack', href: '/#evidence' },
      { label: 'Launch feed', href: '/launch' },
    ],
  },
  {
    title: 'Free tools',
    links: [
      { label: 'Readiness checker', href: '/readiness' },
      { label: 'Opt-in link tester', href: '/readiness#optin' },
      { label: '14-day clock explainer', href: '/#problem' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { label: 'Why this is compliant', href: '/#compliance' },
      {
        label: 'Google Play policy',
        href: 'https://support.google.com/googleplay/android-developer/answer/9898684',
        external: true,
      },
      { label: 'Reliability Score', href: '/#reliability' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Start free', href: '/login' },
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <LogoMark size={22} />
              <Wordmark />
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--color-dim)]">
              Get your 12. Keep them 14 days. Ship. The tester network that
              won&rsquo;t get your app pulled.
            </p>
            <p className="mt-5 text-xs text-[var(--color-mute)]">
              TesterPool is not affiliated with Google LLC. Android and Google Play
              are trademarks of Google LLC.
            </p>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-[var(--color-dim)] transition-colors hover:text-[var(--color-ink)]"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-sm text-[var(--color-dim)] transition-colors hover:text-[var(--color-ink)]"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-mute)] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} TesterPool Labs</span>
          <span>
            Closed testing only. No store reviews, no ratings, no production
            installs.
          </span>
        </div>
      </div>
    </footer>
  );
}
