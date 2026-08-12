import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Card,
  Pill,
  CreditChip,
  StreakStrip,
  streakFromCount,
  ReliabilityGauge,
  ProgressRing,
  Avatar,
  Stat,
  cx,
  type DayState,
} from '@/components/ui';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import {
  EARN, COST, CHARGE, RULES, PENALTY, PLANS,
  PER_APP_EARNINGS, FULL_CYCLE_EARNINGS, FULL_POD_COST,
} from '@/lib/economy';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/** By key, never by index — the plan list gains and loses entries. */
function planPrice(key: (typeof PLANS)[number]['key']): number {
  return PLANS.find((p) => p.key === key)?.price ?? 0;
}

const POLICY_URL =
  'https://support.google.com/googleplay/android-developer/answer/9898684';

/* ------------------------------------------------------------------ icons */

function Check({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cross({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Dash({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Arrow({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------- primitives */

function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cx('scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24', className)}>
      <div className="mx-auto max-w-6xl">
        {(eyebrow || title) && (
          <div className="max-w-2xl">
            {eyebrow && (
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
                {title}
              </h2>
            )}
            {lede && (
              <p className="mt-4 text-base leading-relaxed text-[var(--color-dim)] sm:text-lg">
                {lede}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ hero visual */

type TesterRow = {
  name: string;
  handle: string;
  country: string;
  done: number;
  reliability: number;
};

const HERO_TESTERS: TesterRow[] = [
  { name: 'Priya Raman', handle: 'priya_builds', country: 'IN', done: 9, reliability: 96 },
  { name: 'Tomas Novak', handle: 'tnovak', country: 'CZ', done: 9, reliability: 91 },
  { name: 'Dani Okafor', handle: 'daniokafor', country: 'NG', done: 9, reliability: 88 },
  { name: 'Mei Lin Chow', handle: 'meilin', country: 'MY', done: 8, reliability: 84 },
  { name: 'Ola Berg', handle: 'olaberg', country: 'SE', done: 9, reliability: 97 },
];

function HeroVisual() {
  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full"
        style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 70%)' }}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: 'oklch(0.34 0.07 150)', color: 'oklch(0.9 0.12 150)' }}
            >
              F
            </span>
            <div>
              <div className="text-sm font-semibold leading-tight">Ferndeck</div>
              <div className="text-[11px] text-[var(--color-mute)]">com.ferndeck.app · pod HX-42</div>
            </div>
          </div>
        </div>
        <Pill tone="green">On track</Pill>
      </div>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <ProgressRing value={9} max={14} size={132} stroke={9} caption="Days held" sub="5 days to go" />
        <div className="grid w-full flex-1 grid-cols-2 gap-2">
          <Stat label="Opted in" value={<span className="num">15</span>} sub={`${RULES.requiredTesters} required`} />
          <Stat label="Still active" value={<span className="num">14</span>} sub="1 rescue sent" />
          <Stat label="Feedback" value={<span className="num">23</span>} sub="reports approved" />
          <Stat label="Engagement" value={<span className="num">94%</span>} sub="daily open rate" tone="var(--color-accent)" />
        </div>
      </div>

      <div className="mt-6 border-t border-[var(--color-line)] pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
            Your testers
          </span>
          <span className="num text-[11px] text-[var(--color-mute)]">day 9 / 14</span>
        </div>
        <ul className="space-y-2.5">
          {HERO_TESTERS.map((t) => (
            <li key={t.handle} className="flex items-center gap-3">
              <Avatar name={t.name} size={26} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium leading-tight">{t.name}</div>
                <div className="num text-[11px] text-[var(--color-mute)]">
                  @{t.handle} · {t.country} · {t.reliability} rel
                </div>
              </div>
              <StreakStrip days={streakFromCount(t.done, 9)} size={9} gap={2.5} />
            </li>
          ))}
        </ul>
        <div className="num mt-3 text-[11px] text-[var(--color-mute)]">
          + 10 more testers holding the clock
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- the clock */

function ClockCompare() {
  const intact: DayState[] = Array.from({ length: 14 }, () => 'done');
  const broken: DayState[] = [
    ...Array.from({ length: 8 }, () => 'done' as DayState),
    'missed',
    ...Array.from({ length: 5 }, () => 'future' as DayState),
  ];

  return (
    <div className="mt-12 grid gap-4 lg:grid-cols-2">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Twelve testers hold for 14 days</span>
          <Pill tone="green">Eligible</Pill>
        </div>
        <div className="mt-5">
          <StreakStrip days={intact} size={16} gap={5} />
        </div>
        <p className="mt-5 text-sm leading-relaxed text-[var(--color-dim)]">
          Day 14 arrives with twelve continuous opt-ins on record. You apply for
          production access with real engagement behind you.
        </p>
      </Card>

      <Card className="p-6" style={{ borderColor: 'color-mix(in oklab, var(--color-danger) 28%, var(--color-line))' }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">One tester opts out on day 9</span>
          <Pill tone="red">Clock resets</Pill>
        </div>
        <div className="mt-5">
          <StreakStrip days={broken} size={16} gap={5} />
        </div>
        <p className="mt-5 text-sm leading-relaxed text-[var(--color-dim)]">
          You drop to eleven. The continuous-14-day count starts again from
          zero, and you find out weeks later when the application is rejected.
          This is the single most common way a launch slips a month.
        </p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------- how it works */

const STEPS = [
  {
    n: '01',
    title: 'List your app',
    body:
      'Paste your Play closed-track opt-in link or Google Group, add a one-line brief and the two or three things you want testers to hammer. Two minutes.',
    detail: 'Opt-in link validated before your pod starts — a broken link is the #1 silent killer.',
  },
  {
    n: '02',
    title: `Join a pod of ${RULES.podSeats}`,
    body:
      `Fifteen developers, all shipping in the same window, all matched on device mix and timezone spread. Twelve is the requirement; fifteen is what you get.`,
    detail: 'Free pods typically fill in 3–6 days. Fast Pod starts within 24 hours.',
  },
  {
    n: '03',
    title: 'Everyone tests everyone for 14 days',
    body:
      'One shared clock. Daily check-in with screenshot proof, then one structured feedback report per app at the end. Your dashboard shows exactly who is holding and who is slipping.',
    detail: 'Someone drops? A rescue tester is matched in hours, not days.',
  },
];

/* ------------------------------------------------------------ comparison */

type Verdict = 'good' | 'mixed' | 'bad';

const COLUMNS = ['TesterPool', 'Review-swap sites', '$20 Fiverr gigs', 'Friends & family'] as const;

const COMPARISON: Array<{
  criterion: string;
  note?: string;
  cells: Array<{ verdict: Verdict; text: string }>;
}> = [
  {
    criterion: 'Policy risk',
    note: 'The one that ends your account',
    cells: [
      { verdict: 'good', text: 'None. Closed track only, never a review or rating' },
      { verdict: 'bad', text: 'High. Incentivised reviews and installs are explicitly banned' },
      { verdict: 'mixed', text: 'Depends entirely on the seller; many quietly buy installs' },
      { verdict: 'good', text: 'None' },
    ],
  },
  {
    criterion: 'Testers who actually open the app',
    cells: [
      { verdict: 'good', text: 'Daily check-in with screenshot proof, tracked per tester' },
      { verdict: 'bad', text: 'Opt-in and vanish; engagement is not the product' },
      { verdict: 'bad', text: 'Usually one install, then silence for 14 days' },
      { verdict: 'mixed', text: 'Enthusiastic for four days, then they forget' },
    ],
  },
  {
    criterion: 'Dropout replacement',
    cells: [
      { verdict: 'good', text: 'Rescue tester matched in hours, included on paid plans' },
      { verdict: 'bad', text: 'Not offered' },
      { verdict: 'mixed', text: 'Re-order and wait, if the seller is still online' },
      { verdict: 'bad', text: 'You start asking again' },
    ],
  },
  {
    criterion: 'Written feedback',
    cells: [
      { verdict: 'good', text: 'One structured, on-rubric report per tester, privately' },
      { verdict: 'bad', text: 'A five-star string you did not want' },
      { verdict: 'mixed', text: 'Occasionally a paragraph; rarely actionable' },
      { verdict: 'mixed', text: '“Looks nice”' },
    ],
  },
  {
    criterion: 'Evidence for your application',
    note: 'Google asks for engagement levels and a feedback summary',
    cells: [
      { verdict: 'good', text: 'Production Evidence Pack, generated and formatted' },
      { verdict: 'bad', text: 'Nothing you could paste into the form' },
      { verdict: 'bad', text: 'A screenshot of a chat thread' },
      { verdict: 'bad', text: 'You write it from memory' },
    ],
  },
  {
    criterion: 'Buffer above the 12 required',
    cells: [
      { verdict: 'good', text: '15 seats free, 18 on Fast Pod, 20 on Pro' },
      { verdict: 'mixed', text: 'Sold as an upsell, if at all' },
      { verdict: 'mixed', text: 'Buy 12, pay again for more' },
      { verdict: 'bad', text: 'You are lucky to reach 12' },
    ],
  },
  {
    criterion: 'Time to start',
    note: 'Where money genuinely buys speed',
    cells: [
      { verdict: 'mixed', text: 'Free pods fill in 3–6 days; Fast Pod within 24 hours' },
      { verdict: 'good', text: 'Immediate' },
      { verdict: 'good', text: 'Immediate — the honest advantage of paying a stranger' },
      { verdict: 'mixed', text: 'As fast as people reply' },
    ],
  },
  {
    criterion: 'Cost',
    cells: [
      { verdict: 'good', text: 'Free if you test back, $19 if you would rather not' },
      { verdict: 'mixed', text: '$15–$40, plus the risk premium you cannot price' },
      { verdict: 'mixed', text: '$5–$40 per run, repeat every failed attempt' },
      { verdict: 'good', text: 'Free, paid in favours' },
    ],
  },
];

const VERDICT_STYLE: Record<Verdict, { color: string; icon: React.ReactNode }> = {
  good: { color: 'var(--color-accent)', icon: <Check /> },
  mixed: { color: 'var(--color-credit)', icon: <Dash /> },
  bad: { color: 'var(--color-danger)', icon: <Cross /> },
};

function ComparisonTable() {
  return (
    <div className="mt-12 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th className="w-[190px] pb-3 pr-4 align-bottom text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
              What matters
            </th>
            {COLUMNS.map((c, i) => (
              <th
                key={c}
                className={cx(
                  'pb-3 align-bottom text-sm font-semibold',
                  i === 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-dim)]'
                )}
              >
                <span className="block px-4">{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((row, ri) => (
            <tr key={row.criterion}>
              <th
                scope="row"
                className="border-t border-[var(--color-line)] py-4 pr-4 align-top text-sm font-medium"
              >
                {row.criterion}
                {row.note && (
                  <span className="mt-1 block text-[11px] font-normal leading-snug text-[var(--color-mute)]">
                    {row.note}
                  </span>
                )}
              </th>
              {row.cells.map((cell, ci) => {
                const v = VERDICT_STYLE[cell.verdict];
                return (
                  <td
                    key={ci}
                    className={cx(
                      'border-t border-[var(--color-line)] px-4 py-4 align-top text-[13px] leading-snug text-[var(--color-dim)]',
                      ci === 0 && 'bg-[color-mix(in_oklab,var(--color-accent)_5%,transparent)]',
                      ci === 0 && ri === 0 && 'rounded-t-xl',
                      ci === 0 && ri === COMPARISON.length - 1 && 'rounded-b-xl'
                    )}
                  >
                    <span className="flex gap-2">
                      <span className="mt-px shrink-0" style={{ color: v.color }}>
                        {v.icon}
                      </span>
                      <span>{cell.text}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- economy */

const LEDGER: Array<{ label: string; detail: string; amount: number }> = [
  { label: 'Confirmed install', detail: 'your closed-track opt-in, verified', amount: EARN.optInVerified },
  { label: 'Confirmed report', detail: 'on-rubric, arbitrated', amount: EARN.feedbackApproved },
];

/* ---------------------------------------------------------- testimonials */

const TESTIMONIALS = [
  {
    quote:
      'I had eleven testers twice and got rejected twice. Joined a pod on a Tuesday, applied on day 15 with the evidence pack attached, approved first try. The part that actually mattered was the engagement numbers — I had never been able to prove them before.',
    name: 'Marcus Hedlund',
    handle: '@hedlund_dev',
    app: 'Tallyroom',
    country: 'Sweden',
    outcome: 'Approved first try, day 15',
  },
  {
    quote:
      'Two people went quiet around day 6. On any other service that is a month lost. Here the dashboard flagged it the same morning and both seats were refilled by the next day, and I still had buffer left over. I never dropped below twelve.',
    name: 'Aisha Kamau',
    handle: '@aishabuilds',
    app: 'Sunbeam Habit',
    country: 'Kenya',
    outcome: 'Two rescues, zero days lost',
  },
  {
    quote:
      'I tested four apps while mine was in the pod and it cost me maybe six minutes a day. The feedback I got back was better than the paid QA round I did last year — someone found a crash on a Xiaomi device I do not own.',
    name: 'Diego Salcedo',
    handle: '@dsalcedo',
    app: 'PocketRoute',
    country: 'Colombia',
    outcome: 'Free tier, 3 blockers found',
  },
];

/* ------------------------------------------------------------------- faq */

const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'Is this against Google Play policy?',
    a: (
      <>
        <p>
          No, and the distinction is worth being precise about. Google prohibits
          incentivised <em>ratings, reviews and installs</em> — paying or
          rewarding someone to leave a five-star review or to install from the
          production store listing. TesterPool has no mechanism for any of those. There
          is no field in our system that can hold a store review or a public
          rating, by design.
        </p>
        <p className="mt-3">
          Everything on TesterPool happens inside your closed testing track. Closed
          track installs do not affect your store ranking, your public rating, or
          your public install count. Google&rsquo;s own developer community
          guidance is that using a third-party testing service to find testers
          does not violate policy; what violates policy is buying engagement
          signals that reach the public store. We deliberately do not sell those.
        </p>
        <p className="mt-3">
          <a href={POLICY_URL} target="_blank" rel="noreferrer" className="font-medium text-[var(--color-accent)] hover:underline">
            Read Google&rsquo;s ratings, reviews and installs policy
          </a>
        </p>
      </>
    ),
  },
  {
    q: 'What if someone drops out?',
    a: (
      <>
        <p>
          First, it usually does not matter. You get {RULES.podSeats} seats for a{' '}
          {RULES.requiredTesters}-tester requirement, so three people can vanish
          and you still clear the bar. Competitors sell that buffer as an upsell;
          it is our default.
        </p>
        <p className="mt-3">
          Second, we replace them. If a tester goes quiet, your dashboard flags it
          the same day and you can send a rescue request — a verified replacement
          matched from the rescue pool, typically within six hours. Rescue testers
          earn a bonus of {EARN.rescueBonus} credits, which is why the pool is
          staffed. On Fast Pod and Pro, rescues are included.
        </p>
        <p className="mt-3">
          Third, dropping out is expensive for the person who does it: it costs{' '}
          {PENALTY.dropout} credits and a serious hit to their Reliability Score,
          which locks them out of pods below {RULES.minReliabilityToJoin}. Nobody
          ghosts a pod twice.
        </p>
      </>
    ),
  },
  {
    q: 'Do I have to test other people’s apps?',
    a: (
      <p>
        On the free tier, yes — that is the trade, and it is what makes the
        network honest. Testing one app costs roughly five minutes a day: open
        it, do the thing, tap check-in. Testing every app in a full pod earns{' '}
        {FULL_CYCLE_EARNINGS} credits — exactly what your own pod costs you, so
        doing your share breaks even. If you would rather not, Fast Pod at $
        {planPrice('fast')} buys you a seat without reciprocating.
      </p>
    ),
  },
  {
    q: 'How long until my pod starts?',
    a: (
      <p>
        Free pods fill in three to six days depending on your device
        requirements and how many pods are forming that week. Fast Pod guarantees
        a start within 24 hours. We will be blunt: if you need testers this
        afternoon, a Fiverr gig is faster than our free tier. It is also the one
        most likely to get your account flagged.
      </p>
    ),
  },
  {
    q: 'What exactly is in the Production Evidence Pack?',
    a: (
      <p>
        The numbers Google&rsquo;s production access form actually asks for:
        how many testers you had, how many completed all {RULES.requiredDays}{' '}
        days, average days active, daily engagement rate, the number of approved
        feedback reports, how many raised significant issues, and a written
        digest of what testers said and what you changed in response. It exports
        as a document you can paste from. Pro plans get it reviewed by a human
        before you submit.
      </p>
    ),
  },
  {
    q: 'Can I use TesterPool for iOS TestFlight?',
    a: (
      <p>
        Android closed testing is what we do properly today, because the 12/14
        rule is the specific bottleneck we were built to break. TestFlight pods
        are in limited beta — the same pod mechanics, the same reliability
        system, no 14-day requirement to satisfy. Ask for access when you sign
        up.
      </p>
    ),
  },
];

/* ------------------------------------------------------------------ page */

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="dotgrid relative overflow-hidden border-b border-[var(--color-line)]">
          <div
            className="pointer-events-none absolute left-1/2 top-[-18rem] h-[38rem] w-[68rem] -translate-x-1/2"
            style={{
              background:
                'radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--color-accent) 13%, transparent), transparent 70%)',
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
            <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] py-1 pl-1 pr-3">
                  <Pill tone="green">New</Pill>
                  <span className="text-xs text-[var(--color-dim)]">
                    Rescue testers now matched in under 6 hours
                  </span>
                </div>

                <h1 className="mt-6 text-[2.6rem] font-bold leading-[1.04] tracking-tight sm:text-6xl">
                  Get your 12.
                  <br />
                  Keep them 14 days.
                  <br />
                  <span style={{ color: 'var(--color-accent)' }}>Ship.</span>
                </h1>

                <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-dim)]">
                  Google Play will not let you publish until{' '}
                  {RULES.requiredTesters} testers stay opted in for{' '}
                  {RULES.requiredDays} consecutive days. TesterPool puts you in a pod
                  of {RULES.podSeats} developers who test each other for the same{' '}
                  {RULES.requiredDays} days. Everyone gets their twelve. Everyone
                  graduates together.
                </p>

                <p className="mt-3 text-base text-[var(--color-mute)]">
                  The tester network that won&rsquo;t get your app pulled.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/login" className="btn btn-primary h-11 px-5 text-[15px]">
                    Start free <Arrow />
                  </Link>
                  <Link href="/readiness" className="btn btn-secondary h-11 px-5 text-[15px]">
                    Check if you&rsquo;re ready
                  </Link>
                </div>

                <dl className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--color-line)] pt-6">
                  {[
                    { v: '1,247', l: 'developers' },
                    { v: '38', l: 'pods forming' },
                    { v: '9,318', l: 'apps greenlit' },
                  ].map((s, i) => (
                    <React.Fragment key={s.l}>
                      {i > 0 && (
                        <div className="hidden h-4 w-px bg-[var(--color-line)] sm:block" aria-hidden />
                      )}
                      <div className="flex items-baseline gap-2">
                        <dt className="sr-only">{s.l}</dt>
                        <dd className="num text-xl font-bold leading-none">{s.v}</dd>
                        <dd className="text-sm text-[var(--color-mute)]">{s.l}</dd>
                      </div>
                    </React.Fragment>
                  ))}
                  <div className="flex items-center gap-2 text-sm text-[var(--color-dim)]">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: 'var(--color-accent)', boxShadow: '0 0 8px var(--color-accent)' }}
                    />
                    live
                  </div>
                </dl>
              </div>

              <div className="lg:pt-4">
                <HeroVisual />
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- problem */}
        <Section
          id="problem"
          eyebrow="The bottleneck"
          title={
            <>
              Twelve testers. Fourteen consecutive days.
              <br className="hidden sm:block" /> No exceptions.
            </>
          }
          lede={
            <>
              Every personal developer account created after 13 November 2023 has
              to run a closed test with at least {RULES.requiredTesters} testers
              opted in continuously for {RULES.requiredDays} days before Google
              will even consider production access. Miss it by one tester on one
              day and the count starts over.
            </>
          }
        >
          <ClockCompare />

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: 'It is not just twelve bodies',
                b: 'Applications get rejected for low engagement. Google asks how active your testers were and what feedback you acted on. Twelve silent installs is a rejection with extra steps.',
              },
              {
                t: 'The clock is invisible',
                b: 'The Play Console does not show you a live 14-day counter per tester. Most developers discover a broken streak only when the rejection email arrives.',
              },
              {
                t: 'A reset costs a month',
                b: 'Fourteen more days of testing, plus review time, plus the fixes you now have to squeeze in. Indie launch windows do not survive that twice.',
              },
            ].map((c) => (
              <Card key={c.t} className="p-5" hover>
                <h3 className="text-sm font-semibold">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-dim)]">{c.b}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------------- how */}
        <Section
          id="how"
          eyebrow="How it works"
          title="Three steps, then you stop thinking about it"
          lede="TesterPool is barter, not a marketplace. You are not buying testers; you are joining fifteen people who all need the same thing in the same fortnight."
          className="border-y border-[var(--color-line)] bg-[var(--color-surface)]"
        >
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {STEPS.map((s) => (
              <Card key={s.n} className="flex flex-col p-6" hover>
                <span className="num text-[11px] font-bold tracking-widest text-[var(--color-accent)]">
                  {s.n}
                </span>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-dim)]">
                  {s.body}
                </p>
                <p className="mt-4 border-t border-[var(--color-line)] pt-4 text-xs leading-relaxed text-[var(--color-mute)]">
                  {s.detail}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-bg)] p-6 sm:flex-row">
            <div className="flex items-center gap-4">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: 'color-mix(in oklab, var(--color-accent) 14%, transparent)',
                  color: 'var(--color-accent)',
                }}
              >
                <Check />
              </span>
              <div>
                <div className="text-base font-semibold">Get greenlit</div>
                <p className="mt-0.5 text-sm text-[var(--color-dim)]">
                  Day 15: your Evidence Pack is ready, your app is on the Launch
                  Feed, and you apply with numbers instead of hope.
                </p>
              </div>
            </div>
            <Link href="/launch" className="btn btn-secondary shrink-0">
              See who shipped this week <Arrow />
            </Link>
          </div>
        </Section>

        {/* ------------------------------------------------------ comparison */}
        <Section
          id="compare"
          eyebrow="The alternatives"
          title="What you would otherwise be choosing between"
          lede="We are not going to pretend the free tier is faster than paying a stranger $20. It is not. Everything else on this table, we win outright."
        >
          <ComparisonTable />
          <p className="mt-4 text-xs text-[var(--color-mute)]">
            Prices observed across public tester-service listings, 2025. Review-swap
            behaviour describes services that exchange store ratings or reviews —
            the category Google&rsquo;s policy names directly.
          </p>
        </Section>

        {/* ------------------------------------------------------ compliance */}
        <section
          id="compliance"
          className="scroll-mt-20 border-y border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-20 sm:px-6 sm:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-14">
              <div>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
                  Why this is safe
                </div>
                <h2 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
                  Nothing TesterPool does ever touches the public store
                </h2>
                <div className="mt-6 space-y-4 text-base leading-relaxed text-[var(--color-dim)]">
                  <p>
                    All activity happens inside your closed testing track. Closed
                    track installs and usage do not affect store rankings, public
                    ratings, or public install counts — they are invisible to the
                    store surface entirely. There is nothing here for Google&rsquo;s
                    anti-manipulation systems to object to, because there is no
                    public signal being manufactured.
                  </p>
                  <p>
                    Google&rsquo;s developer community guidance is explicit that
                    using a third-party service to find testers for a closed test
                    does not violate policy. What Google prohibits is incentivising{' '}
                    <strong className="font-semibold text-[var(--color-ink)]">
                      ratings, reviews and installs
                    </strong>{' '}
                    — and that is precisely the thing TesterPool refuses to sell. We
                    have no product to offer you there. The database schema behind
                    this site has no column that can hold a store review or a public
                    rating; it was designed that way on purpose.
                  </p>
                  <p>
                    Feedback on TesterPool is private, structured and delivered to you
                    — never posted anywhere public. If a tester tried to trade a
                    five-star review for credits, there would be no mechanism to
                    pay them.
                  </p>
                </div>
                <a
                  href={POLICY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary mt-7"
                >
                  Read the Google Play policy yourself <Arrow />
                </a>
              </div>

              <div className="space-y-3">
                {[
                  { ok: true, t: 'Closed testing track activity', s: 'Invisible to store rankings and ratings' },
                  { ok: true, t: 'Private structured feedback', s: 'On a rubric, arbitrated, never published' },
                  { ok: true, t: 'Daily engagement proof', s: 'Screenshot-backed, for your own application' },
                  { ok: false, t: 'Public store reviews', s: 'No mechanism exists in the product' },
                  { ok: false, t: 'Public ratings', s: 'No mechanism exists in the product' },
                  { ok: false, t: 'Production installs', s: 'Not part of any pod, ever' },
                ].map((r) => (
                  <div
                    key={r.t}
                    className="flex items-start gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3"
                  >
                    <span
                      className="mt-0.5 shrink-0"
                      style={{ color: r.ok ? 'var(--color-accent)' : 'var(--color-mute)' }}
                    >
                      {r.ok ? <Check /> : <Cross />}
                    </span>
                    <div>
                      <div className="text-sm font-medium leading-tight">{r.t}</div>
                      <div className="mt-0.5 text-xs text-[var(--color-mute)]">{r.s}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- reliability */}
        <Section
          id="reliability"
          eyebrow="Why nobody ghosts"
          title="The Reliability Score is the whole trick"
          lede="Every other free tester scheme dies the same way: people opt in, collect what they need, and disappear on day four. TesterPool makes disappearing the most expensive thing you can do."
        >
          <div className="mt-12 grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card className="flex flex-col items-center justify-center gap-4 p-8">
              <ReliabilityGauge score={94} size={132} />
              <div className="text-center">
                <div className="text-sm font-semibold">Public, 0&ndash;100</div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-mute)]">
                  Shown on every profile, every pod roster and the leaderboard.
                  Below {RULES.minReliabilityToJoin} you cannot join a pod at all.
                </p>
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { t: 'Check in every day', s: 'Your score climbs, and your seat stays clean', tone: 'up' },
                { t: 'Finish a perfect streak', s: 'A Perfect 14 badge and your best score bump', tone: 'up' },
                { t: 'Rescue someone mid-pod', s: `+${EARN.rescueBonus} credits and a lasting score bump`, tone: 'up' },
                { t: 'Drop out mid-pod', s: `−${PENALTY.dropout} credits, a score collapse, and a lockout from pods`, tone: 'down' },
              ].map((r) => (
                <Card key={r.t} className="p-5" hover>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: r.tone === 'up' ? 'var(--color-accent)' : 'var(--color-danger)' }}
                    />
                    <h3 className="text-sm font-semibold">{r.t}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-dim)]">{r.s}</p>
                </Card>
              ))}
              <Card className="p-5 sm:col-span-2">
                <p className="text-sm leading-relaxed text-[var(--color-dim)]">
                  You are testing alongside people whose next launch depends on the
                  same system working. That is a much stronger incentive than $20
                  ever was, and it is why pods finish at rates a marketplace cannot
                  reach.
                </p>
              </Card>
            </div>
          </div>
        </Section>

        {/* -------------------------------------------------------- evidence */}
        <Section
          id="evidence"
          eyebrow="Production Evidence Pack"
          title="Answer the application with numbers, not adjectives"
          lede="Google's production access form asks how engaged your testers were and what feedback you collected. Most developers answer from memory. You will answer from a generated document."
          className="border-y border-[var(--color-line)] bg-[var(--color-surface)]"
        >
          <Card className="mt-12 overflow-hidden bg-[var(--color-bg)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3">
              <div className="text-sm font-semibold">Ferndeck — production access evidence</div>
              <Pill tone="green">Ready to submit</Pill>
            </div>
            <div className="grid gap-px bg-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
              {[
                { l: 'Testers opted in', v: '15', s: 'requirement: 12' },
                { l: 'Completed all 14 days', v: '14', s: '1 replaced on day 6' },
                { l: 'Avg days active', v: '13.6', s: 'across all testers' },
                { l: 'Daily engagement', v: '94%', s: 'sessions with proof' },
                { l: 'Feedback reports', v: '23', s: 'approved, on-rubric' },
                { l: 'Significant issues', v: '6', s: '2 blockers, 4 major' },
                { l: 'Changes shipped', v: '9', s: 'in response to testing' },
                { l: 'Devices covered', v: '11', s: 'Android 10 → 15' },
              ].map((m) => (
                <div key={m.l} className="bg-[var(--color-bg)] px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                    {m.l}
                  </div>
                  <div className="num mt-1 text-2xl font-bold leading-none">{m.v}</div>
                  <div className="mt-1 text-xs text-[var(--color-dim)]">{m.s}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--color-line)] px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                Feedback digest (extract)
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-dim)]">
                &ldquo;Testers reported the onboarding flow stalling on Android 12
                when notification permission was declined (4 reports). Fixed in
                1.4.2 and confirmed by three testers. Offline sync was the most
                requested improvement (7 reports); partial sync shipped in 1.4.3.
                Two testers on low-end devices flagged a 2.8s cold start, reduced
                to 1.1s.&rdquo;
              </p>
            </div>
          </Card>
        </Section>

        {/* --------------------------------------------------------- economy */}
        <Section
          id="economy"
          eyebrow="The economy"
          title="Credits price the edges, never the core"
          lede="Credits move between developers, they are never minted. What a tester earns comes out of the balance of the developer whose app they tested — so doing your share costs nothing, and skipping it costs exactly what it should."
        >
          <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card className="p-6">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                One app you test, start to finish
              </div>
              <ul className="mt-4 divide-y divide-[var(--color-line)]">
                {LEDGER.map((l) => (
                  <li key={l.label} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{l.label}</div>
                      <div className="text-xs text-[var(--color-mute)]">{l.detail}</div>
                    </div>
                    <CreditChip amount={l.amount} signed />
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3">
                <span className="text-sm font-semibold">You earn</span>
                <CreditChip amount={PER_APP_EARNINGS} size="lg" />
              </div>
              <div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3">
                <span className="text-sm font-semibold">Its developer pays</span>
                <CreditChip amount={-(CHARGE.install + CHARGE.review)} size="lg" signed />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-dim)]">
                The same number, because it is the same number. Credits move between
                developers; nothing here mints them. A full pod earns you{' '}
                {FULL_CYCLE_EARNINGS} and costs you {FULL_POD_COST}, so doing your
                share breaks exactly even — and the currency cannot inflate, because
                every credit anyone earns came out of somebody&rsquo;s balance.
              </p>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Card className="p-6">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  What credits buy
                </div>
                <ul className="mt-4 space-y-3">
                  {[
                    { l: 'Buffer seat', v: COST.bufferSeat, s: 'One more tester above the 15 you already have' },
                    { l: 'Rescue seat', v: COST.rescueSeat, s: 'A verified replacement, matched within hours' },
                    { l: 'Priority pod', v: COST.priorityPod, s: 'Front of the matching queue' },
                    { l: 'Expert seat', v: COST.expertSeat, s: 'A long-form report from a senior tester' },
                    { l: 'Second app', v: COST.extraApp, s: 'Run two apps through pods at once' },
                  ].map((c) => (
                    <li key={c.l} className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium">{c.l}</div>
                        <div className="text-xs text-[var(--color-mute)]">{c.s}</div>
                      </div>
                      <CreditChip amount={c.v} size="sm" />
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-3">
                  <CreditChip amount={EARN.signupGrant} size="lg" />
                  <span className="text-sm font-semibold">on the house when you sign up</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-dim)]">
                  Enough for a buffer seat before you have tested anything. Invite
                  another developer and you both benefit: {EARN.referralReferrer}{' '}
                  credits for you, {EARN.referralReferee} for them.
                </p>
              </Card>
            </div>
          </div>
        </Section>

        {/* --------------------------------------------------------- pricing */}
        <Section
          id="pricing"
          eyebrow="Pricing"
          title="Free if you test back. Cheap if you would rather not."
          lede="Every plan includes the buffer seats, the engagement tracking, the structured feedback and the Evidence Pack. Paying only ever buys you speed and insurance."
          className="border-y border-[var(--color-line)] bg-[var(--color-surface)]"
        >
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => {
              const highlight = 'highlight' in p && p.highlight;
              return (
                <div
                  key={p.key}
                  className={cx(
                    'relative flex flex-col rounded-[var(--radius-card)] border p-6',
                    highlight
                      ? 'bg-[var(--color-bg)]'
                      : 'border-[var(--color-line)] bg-[var(--color-bg)]'
                  )}
                  style={
                    highlight
                      ? {
                          borderColor: 'color-mix(in oklab, var(--color-accent) 45%, transparent)',
                          boxShadow: '0 0 0 1px color-mix(in oklab, var(--color-accent) 18%, transparent)',
                        }
                      : undefined
                  }
                >
                  {highlight && (
                    <span className="absolute -top-2.5 left-6">
                      <Pill tone="green">Most popular</Pill>
                    </span>
                  )}
                  <h3 className="text-base font-semibold">{p.name}</h3>
                  <p className="mt-1 text-xs leading-snug text-[var(--color-dim)]">{p.tagline}</p>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="num text-4xl font-bold leading-none">
                      {p.price === 0 ? 'Free' : `$${p.price}`}
                    </span>
                    {p.cadence && (
                      <span className="text-xs text-[var(--color-mute)]">{p.cadence}</span>
                    )}
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2 text-[13px] leading-snug text-[var(--color-dim)]">
                        <span className="mt-px shrink-0" style={{ color: 'var(--color-accent)' }}>
                          <Check />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login"
                    className={cx('btn mt-6 w-full', highlight ? 'btn-primary' : 'btn-secondary')}
                  >
                    {p.cta}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-[var(--color-mute)]">
            One-off pricing per app, not a subscription. If your pod fails to reach{' '}
            {RULES.requiredTesters} verified testers, a paid plan is refunded in full.
          </p>
        </Section>

        {/* ---------------------------------------------------- testimonials */}
        <Section
          eyebrow="From the pods"
          title="Developers who stopped restarting the clock"
        >
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Card key={t.handle} className="flex flex-col p-6" hover>
                <Pill tone="green">{t.outcome}</Pill>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-[var(--color-dim)]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-line)] pt-4">
                  <Avatar name={t.name} size={34} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium leading-tight">{t.name}</div>
                    <div className="truncate text-xs text-[var(--color-mute)]">
                      {t.handle} · {t.app} · {t.country}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------------- faq */}
        <Section
          id="faq"
          eyebrow="Questions"
          title="The ones that decide it"
          className="border-y border-[var(--color-line)] bg-[var(--color-surface)]"
        >
          <div className="mt-10 max-w-3xl divide-y divide-[var(--color-line)] rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-bg)]">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4 open:pb-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <span className="shrink-0 text-[var(--color-mute)] transition-transform duration-150 group-open:rotate-45">
                    <Plus />
                  </span>
                </summary>
                <div className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-dim)]">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------- final CTA */}
        <section className="dotgrid relative overflow-hidden px-4 py-24 sm:px-6 sm:py-28">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[52rem] -translate-x-1/2 -translate-y-1/2"
            style={{
              background:
                'radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--color-accent) 12%, transparent), transparent 70%)',
            }}
          />
          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Your fourteen days start whenever you do
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-[var(--color-dim)]">
              {EARN.signupGrant} credits when you sign up, {RULES.podSeats} seats
              for a {RULES.requiredTesters}-tester requirement, and an Evidence
              Pack waiting on day 15.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/login" className="btn btn-primary h-11 px-6 text-[15px]">
                Start free <Arrow />
              </Link>
              <Link href="/readiness" className="btn btn-secondary h-11 px-6 text-[15px]">
                Run the readiness check first
              </Link>
            </div>
            <p className="mt-5 text-xs text-[var(--color-mute)]">
              No card required. No store reviews. No policy risk.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
