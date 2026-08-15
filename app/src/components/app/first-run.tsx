/**
 * The first screen a new developer sees.
 *
 * This is the only moment where we can explain the whole idea before they
 * decide whether to bother. Three constraints shaped it:
 *
 *  1. The core concept has to land without reading a paragraph. The exchange
 *     diagram does that work; the words support it.
 *  2. It has to be honest about the deal up front. A developer who arrives
 *     wanting testers and discovers that credits only move — that receiving
 *     work means doing work — will feel tricked and leave. Saying it here is
 *     cheaper than a stalled listing later.
 *  3. It must not become a wall. Everything below the fold is optional.
 */
import Link from 'next/link';
import { Card, CreditChip, cx } from '@/components/ui';
import { EARN, CHARGE } from '@/lib/economy';

/** What one tester's full run is worth, from both sides of the trade. */
const RUN = CHARGE.install + CHARGE.review;

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

/** One side of the trade, drawn as a labelled amount. */
function Side({
  label, amount, detail, tone,
}: {
  label: string;
  amount: number;
  detail: string;
  tone: 'earn' | 'spend';
}) {
  const color = tone === 'earn' ? 'var(--color-accent)' : 'var(--color-credit)';
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)]/60 p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
        {label}
      </div>
      <div className="num mt-1 text-xl font-bold" style={{ color }}>
        {tone === 'earn' ? '+' : '−'}{amount}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-dim)]">{detail}</p>
    </div>
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
              You need testers.
              <br />
              <span className="text-[var(--color-accent)]">So does everyone else here.</span>
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--color-dim)]">
              List your app and it goes into the feed. Other developers pick it up, install it and
              send you a written report. You do the same for theirs — and that is what pays for it.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/onboarding" className="btn btn-primary">
                List your app
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/market" className="btn btn-secondary">Browse the feed</Link>
              <span className="text-xs text-[var(--color-mute)]">Takes about two minutes.</span>
            </div>
          </div>

          {/* The trade, drawn. One tester's run, both directions. */}
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/60 p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                One tester, one app
              </span>
              <span className="num text-[11px] text-[var(--color-mute)]">{RUN} credits</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Side
                label="You test"
                amount={RUN}
                detail={`${EARN.optInVerified} for the confirmed install, ${EARN.feedbackApproved} for the report.`}
                tone="earn"
              />
              <Side
                label="You are tested"
                amount={RUN}
                detail="The same amounts, out of your balance, to the developer who did the work."
                tone="spend"
              />
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[var(--color-dim)]">
              Credits only ever move between developers — nothing here mints them. Test one app for
              every tester you take, and it costs you nothing.
            </p>
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
            title: 'Pick one off the feed',
            body: 'Any app that is open. Join its closed test, use it properly, file one report.',
          },
          {
            n: 3,
            title: 'Get paid, and pay out',
            body: 'What you earn testing funds the testers who come to your listing. No queue, no waiting for a cohort.',
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
              This is a trade, not a service. Take an app on and abandon it and you have held a
              developer&apos;s balance against work that never arrived. That is why reliability is
              public here, and why a report has to be specific to be paid.
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
              Enough to pay for your first testers. Testing other apps earns it back.
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
          Testing happens inside closed testing tracks, which do not affect store rankings,
          ratings or public install counts, and your report is private to the developer. Some
          publishers also ask for a public store install and review — that is public activity
          on your own store account, it is always labelled on the listing, and it is yours to
          turn down.
        </span>
      </div>

      <p className="px-1 text-xs text-[var(--color-mute)]">
        Credits, in short: you earn <span className="num">{EARN.optInVerified}</span> for a confirmed
        install and <span className="num">{EARN.feedbackApproved}</span> for a confirmed report — paid by
        the developer whose app it is. Yours pays your testers the same way.
      </p>
    </div>
  );
}
