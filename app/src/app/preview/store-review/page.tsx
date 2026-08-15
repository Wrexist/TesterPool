import Link from 'next/link';
import { StoreReviewFlow } from './flow';
import { AppIcon } from '@/components/app/app-card';
import { PlatformChip } from '@/components/app/app-row';

export const metadata = {
  title: 'Store review flow — prototype',
  robots: { index: false, follow: false },
};

/**
 * PROTOTYPE ROUTE — the public-store install-and-review flow, to look at.
 *
 * Deliberately outside `(app)/`, so it needs no session and can be opened on a
 * phone from a plain link. Deliberately `noindex`, and deliberately not linked
 * from any navigation: it exists to be evaluated, not to be found.
 *
 * Read the header comment in `flow.tsx` before wiring any of this up. The short
 * version: the live product installs from a CLOSED testing track and keeps the
 * report private, and this installs from the PUBLIC listing and pays for a
 * published review. That is the entire difference between the two, and it is
 * the whole of what Google's Ratings, Reviews and Installs policy is about.
 */
export default function StoreReviewPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-5">
      {/* ------------------------------------------------------------ head */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-2)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="flex-1 text-center text-[17px] font-bold tracking-tight">App Details</span>
        <span className="w-10" />
      </div>

      <div className="mt-5 flex items-start gap-4">
        <AppIcon name="Ledgerly" size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight">Ledgerly</h1>
          <p className="mt-1 text-[15px] text-[var(--color-dim)]">Isac Molin</p>
          <div className="mt-2.5 flex items-center gap-2">
            <PlatformChip ios={false} />
            <span className="text-[13px] text-[var(--color-mute)]">Finance</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-dim)]">
        Offline-first budgeting that does not ask for your bank login. Import a CSV, set your
        envelopes, and the widget keeps the month in front of you.
      </p>

      <div className="mt-6">
        <StoreReviewFlow />
      </div>

      {/* --------------------------------------------------------- the note */}
      <div
        className="mt-6 rounded-2xl border px-4 py-3.5"
        style={{
          borderColor: 'color-mix(in oklab, var(--color-credit) 45%, transparent)',
          background: 'var(--color-credit-soft)',
        }}
      >
        <div className="text-[14px] font-bold" style={{ color: '#9A6510' }}>
          Prototype — not wired to anything
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: '#9A6510' }}>
          Nothing on this screen writes to the database, pays a credit or stores a proof, and the
          schema still has no column that could hold a public store review. It is here so the flow
          can be judged on how it looks and works before deciding whether to build it.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: '#9A6510' }}>
          The live flow at <span className="font-semibold">/market/[id]</span> is the same three
          steps against a closed testing track, with the report private to the developer.
        </p>
      </div>
    </main>
  );
}
