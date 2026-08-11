/**
 * The first screen a new developer sees.
 *
 * This is the only moment where we can explain the whole idea before they
 * decide whether to bother. Three constraints shaped it:
 *
 *  1. The core concept has to land without reading a paragraph. The pod
 *     diagram and the 14-square strip do that work; the words support them.
 *  2. It has to be honest about the deal up front. A developer who arrives
 *     wanting 12 testers and discovers on day three that they owe 14 people
 *     daily attention will feel tricked and drop out — and a dropout resets a
 *     stranger's clock. Saying "about two minutes a day, for fourteen days"
 *     here is cheaper than a broken pod later.
 *  3. It must not become a wall. Everything below the fold is optional.
 */
import Link from 'next/link';
import { Card, StreakStrip, CreditChip, cx } from '@/components/ui';
import { RULES, EARN } from '@/lib/economy';

function Seat({ filled = false, you = false }: { filled?: boolean; you?: boolean }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 18, height: 18,
        background: you ? 'var(--color-accent)' : filled ? 'var(--color-surface-2)' : 'transparent',
        border: you ? 'none' : `1px ${filled ? 'solid' : 'dashed'} var(--color-line-hi)`,
        boxShadow: you ? '0 0 0 3px color-mix(in oklab, var(--color-accent) 22%, transparent)' : undefined,
      }}
    />
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className="num inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
      style={{
        width: 22, height: 22,
        background: 'color-mix(in oklab, var(--color-accent) 14%, transparent)',
        color: 'var(--color-accent)',
      }}
    >
      {n}
    </span>
  );
}

export function FirstRun({ credits }: { credits: number }) {
  return (
    <div className="flex flex-col gap-4">
      {/* ---------------------------------------------------- the whole idea */}
      <Card className="dotgrid overflow-hidden p-7 md:p-9">
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-[26px] font-bold leading-[1.15] tracking-tight md:text-[32px]">
              You need 12 testers for 14 days.
              <br />
              <span className="text-[var(--color-accent)]">So does everyone else here.</span>
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--color-dim)]">
              We seat you with about fifteen developers who all need the same thing. You run the
              fourteen days together.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/onboarding" className="btn btn-primary">
                List your app
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/pods" className="btn btn-secondary">See pods forming</Link>
              <span className="text-xs text-[var(--color-mute)]">Takes about two minutes.</span>
            </div>
          </div>

          {/* A pod, drawn. Fifteen seats, one of them yours. */}
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/60 p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                A pod
              </span>
              <span className="num text-[11px] text-[var(--color-mute)]">
                {RULES.podSeats} seats · {RULES.requiredTesters} required
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Seat you />
              {Array.from({ length: RULES.podSeats - 1 }, (_, i) => (
                <Seat key={i} filled={i < 10} />
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--color-dim)]">
              <span className="text-[var(--color-accent)]">●</span> is you. Everyone tests everyone, so a
              full pod gives you fourteen testers — two spare, on purpose.
            </p>

            <div className="mt-4 border-t border-[var(--color-line)] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  Your 14 days
                </span>
                <span className="num text-[11px] text-[var(--color-mute)]">one check-in a day</span>
              </div>
              <div className="mt-2">
                <StreakStrip days={['done', 'done', 'done', 'done', 'today']} size={14} gap={4} />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------- what happens */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            n: 1,
            title: 'List your app',
            body: 'Paste a Play link or just the package name. We fill in the rest.',
          },
          {
            n: 2,
            title: 'Join a pod',
            body: 'The clock begins the moment the last seat fills.',
          },
          {
            n: 3,
            title: 'Test, and be tested',
            body: 'Open each app once a day, and file one honest report. About two minutes a day.',
          },
        ].map((s) => (
          <Card key={s.n} className="p-5">
            <div className="flex items-center gap-2.5">
              <StepNumber n={s.n} />
              <h3 className="text-[15px] font-semibold">{s.title}</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-dim)]">{s.body}</p>
          </Card>
        ))}
      </div>

      {/* --------------------------------------------- the deal, stated plainly */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-[15px] font-semibold">The part worth knowing before you start</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-dim)]">
              This is a trade, not a service. Stop checking in halfway through and you do not just lose
              your own streak — you reset someone else&apos;s fourteen days. That is why reliability is
              public here.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
              You start with
            </div>
            <div className="mt-1">
              <CreditChip amount={credits} size="lg" />
            </div>
            <div className="mt-1 text-xs text-[var(--color-dim)]">
              Enough to pay for your whole first pod. Testing everyone else&apos;s app earns it back.
            </div>
          </div>
        </div>
      </Card>

      {/* ---------------------------------------------------- the one promise */}
      <div
        className={cx(
          'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-4 py-3 text-xs leading-relaxed'
        )}
        style={{
          borderColor: 'color-mix(in oklab, var(--color-accent) 22%, transparent)',
          background: 'color-mix(in oklab, var(--color-accent) 6%, transparent)',
          color: 'var(--color-dim)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden
             style={{ color: 'var(--color-accent)' }}>
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.8"
                strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                strokeLinejoin="round" />
        </svg>
        <span>
          Everything happens inside closed testing tracks. No public reviews, no ratings, no production
          installs — nothing that affects your store listing.
        </span>
      </div>

      <p className="px-1 text-xs text-[var(--color-mute)]">
        Credits, in short: you earn <span className="num">{EARN.optInVerified}</span> for a confirmed
        install and <span className="num">{EARN.feedbackApproved}</span> for a confirmed report — paid by
        the developer whose app it is. Yours pays your testers the same way, so a pod you carry your
        weight in costs you nothing.
      </p>
    </div>
  );
}
