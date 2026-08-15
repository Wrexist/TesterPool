import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Card,
  Pill,
  CreditChip,
  StreakStrip,
  ReliabilityGauge,
  Avatar,
  TierBadge,
  cx,
  type DayState,
} from '@/components/ui';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import {
  EARN, COST, CHARGE, RULES, PENALTY, PLANS,
  PER_APP_EARNINGS, FULL_CYCLE_EARNINGS, FULL_CYCLE_COST,
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

/**
 * The offer, in one card: the reviews landing on your app.
 *
 * This replaced a cohort progress ring at day 9 of 14, and then a picture of the
 * work you do to earn them. Both were the price of the product drawn before the
 * product. What a developer wants is the inbox — fourteen people who ship for a
 * living, telling them what is wrong with their app before their users do.
 *
 * Three things it deliberately does not draw, all for invariant 1:
 *
 *   - No package name. For an app in closed testing the package name is the way
 *     into the track, and the way in is granted by taking the job, not by a picture on
 *     the marketing site.
 *   - No 1-5 rubric scores, even though the real review form collects them.
 *     Those scores are private between a tester and a developer. Rendered on a
 *     public page beside an app name they read as a star rating, which is the
 *     exact shape the schema refuses to be able to represent. Severity is drawn
 *     instead: it classifies a defect, it does not rate an app.
 *   - No stars, no average, no aggregate of any kind. Fourteen reviews with a
 *     number over them is a rating, however the number was computed.
 *
 * Server-rendered. The stagger is CSS only (`animate-pop` + delay), and the
 * reduced-motion block in globals.css zeroes both duration and delay, so the
 * whole card is simply present for anyone who asked for less movement.
 */
const INBOX: Array<{ name: string; handle: string; device: string; line: string; sev: 0 | 2 | 3 }> = [
  {
    name: 'Dani Okafor',
    handle: 'daniokafor',
    device: 'Pixel 6a · A13',
    line: 'Export to Markdown silently does nothing when the note has an attachment. No error, no file.',
    sev: 2,
  },
  {
    name: 'Priya Raman',
    handle: 'priya_builds',
    device: 'Redmi Note 12',
    line: 'Hard crash on rotate while the sync sheet is open. Repro steps attached, twice on two devices.',
    sev: 3,
  },
  {
    name: 'Ola Berg',
    handle: 'olaberg',
    device: 'Galaxy S21',
    line: 'Offline editing held up on the underground. Move the attachment button out of the overflow menu.',
    sev: 0,
  },
];

function ReviewsVisual() {
  const inCount = 11;
  const total = RULES.cycleSize - 1;

  return (
    <Card className="relative overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full"
        style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 70%)' }}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold leading-tight">Reviews on Vellum Notes</div>
          <div className="num mt-1 text-[11px] text-[var(--color-mute)]">
            {inCount} of {total} in · day 11 of {RULES.requiredDays}
          </div>
        </div>
        <Pill tone="green">Closed track</Pill>
      </div>

      <ul className="relative mt-5 space-y-2.5">
        {INBOX.map((r, i) => (
          <li
            key={r.handle}
            className="animate-pop rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-3"
            style={{ animationDelay: `${120 * i}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <Avatar name={r.name} size={24} />
              <div className="min-w-0 flex-1">
                <div className="num truncate text-[11px] text-[var(--color-mute)]">
                  @{r.handle} · {r.device}
                </div>
              </div>
              {r.sev > 0 ? (
                <Pill tone={r.sev >= 3 ? 'red' : 'amber'}>Severity {r.sev}</Pill>
              ) : (
                <CreditChip amount={EARN.feedbackApproved} signed size="sm" />
              )}
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-dim)]">{r.line}</p>
          </li>
        ))}
      </ul>

      <p className="mt-5 border-t border-[var(--color-line)] pt-4 text-[12px] leading-relaxed text-[var(--color-mute)]">
        Every one of them private, structured, and written by someone who has
        shipped an Android app. None of them anywhere near your store listing.
      </p>
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

/* --------------------------------------------------------------- the job */

/**
 * What a tester is actually being asked to do, priced. Two of the three steps
 * pay, and the middle one does not: showing up daily is the most important
 * thing a tester does, and it is enforced through the Reliability Score rather
 * than bribed through the balance. A check-in that minted credits would pay
 * more for testing an app than testing it costs its developer — a money
 * printer. `EARN.dailyCheckin` is 0 for that reason, so this reads it rather
 * than hardcoding the gap.
 */
const JOB: Array<{ title: string; body: string; detail: string; pays: number | null }> = [
  {
    title: 'Opt in',
    pays: EARN.optInVerified,
    body:
      'One tap on the developer’s closed-track link. You are in their testing track, which is the only place any of this happens.',
    detail:
      'Confirmed by screenshot proof reviewed on our side, never by your own word — that is why the credits are worth something.',
  },
  {
    title: 'Use it',
    pays: EARN.dailyCheckin || null,
    body:
      'Actually use the app, then log the session. Ten seconds. Staying opted in is the part Google measures, so it is the part that counts.',
    detail:
      'Logging a session pays nothing on purpose. It builds your Reliability Score, which is what lets you hold more work at once.',
  },
  {
    title: 'Review',
    pays: EARN.feedbackApproved,
    body:
      'One structured review against the two or three things the developer asked you to hammer: what broke, what confused you, what you would change.',
    detail:
      `A blocker pays the same as a compliment, plus a ${EARN.bugBountyBlocker}-credit bounty we fund ourselves. Finding the worst bug must never cost the developer most.`,
  },
];

/* ------------------------------------------------------------ the report */

/**
 * A redacted report, drawn the way `(app)/feedback` draws a real one: same
 * fields, same order, same severity and status pills, same paid chip.
 *
 * One difference, and it is deliberate. The real card renders the three rubric
 * scores out of five; this one does not. Those scores are private between a
 * tester and a developer, and three numbers out of five sitting beside an app
 * name on a public page is a rating board — the shape invariant 1 keeps the
 * schema unable to represent. The written fields are what makes the argument
 * anyway: nobody was ever persuaded by "Usability 4/5".
 */
function ReportField({
  label, value, tone, mono,
}: { label: string; value: string; tone?: 'danger'; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
        {label}
      </div>
      <p
        className={cx('text-[13px] leading-relaxed', mono && 'num whitespace-pre-line')}
        style={{ color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-dim)' }}
      >
        {value}
      </p>
    </div>
  );
}

function SampleReport() {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name="Dani Okafor" size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">@daniokafor</span>
            <TierBadge tier="gold" size="sm" />
            <span className="text-xs text-[var(--color-mute)]">on Vellum Notes</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-mute)]">
            <span>Day 11</span>
            <span>Pixel 6a · Android 13</span>
            <span className="inline-flex items-center gap-1">
              paid <CreditChip amount={EARN.feedbackApproved} size="sm" />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="amber">Severity 2</Pill>
          <Pill tone="green">Approved</Pill>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <ReportField
          label="First impression"
          value="Understood what it was for from the first screen, which is rarer than it sounds. Started a note within about fifteen seconds of opening it."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ReportField
            label="What worked"
            value="Offline editing held up on the underground with no sync errors when I came back up. Undo across app restarts is genuinely good."
          />
          <ReportField
            label="What broke"
            tone="danger"
            value="Export to Markdown silently does nothing when the note has an attachment. No error, no file, no toast."
          />
        </div>
        <ReportField
          label="Reproduction steps"
          mono
          value={'1. New note, type anything\n2. Attach any image\n3. Menu → Export → Markdown\n4. Nothing happens. Repeats on a second device.'}
        />
        <ReportField
          label="One change they would make"
          value="Move the attachment button out of the overflow menu. I found it by accident on day four and I was looking for it on day one."
        />
      </div>
    </Card>
  );
}

const REPORT_CLAIMS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: 'Written against your rubric, not theirs',
    body: (
      <>
        You name the two or three things you want hammered when you list the app.
        The review answers those. A review that ignores them does not get paid,
        which is why nobody sends you &ldquo;looks nice&rdquo;.
      </>
    ),
  },
  {
    title: 'A blocker costs you exactly what a compliment costs',
    body: (
      <>
        Every approved review charges the same {CHARGE.review} credits whatever it
        says. If critical feedback were dearer you would learn to dispute it, and
        the bounty on a blocker is funded by us for the same reason: finding your
        worst bug must never cost you most.
      </>
    ),
  },
  {
    title: 'You cannot quietly refuse to pay for it',
    body: (
      <>
        Flagging a review as low-effort opens a moderator dispute. It does not
        reject the review and it does not withhold the tester&rsquo;s credits &mdash;
        a human decides. Creator approval without that step is a positivity
        machine, which is the exact failure this was built against.
      </>
    ),
  },
];

/* ---------------------------------------------------------- how it works */

const STEPS = [
  {
    n: '01',
    title: 'List your app',
    body:
      'Paste your Play closed-track opt-in link or Google Group, add a one-line brief and the two or three things you want testers to hammer. Two minutes.',
    detail: 'Opt-in link validated before anyone can join — a broken link is the #1 silent killer.',
  },
  {
    n: '02',
    title: 'Developers pick it up from the feed',
    body:
      'Your listing sits in front of every developer here. They take it one at a time, join your closed track and stay opted in — no cohort to fill, no start date to wait for.',
    detail: 'You set how many testers you want. Most listings see their first the same day.',
  },
  {
    n: '03',
    title: 'Each one installs, uses it, and reports',
    body:
      'Screenshot proof on the way in, then one structured review written against your brief. Your dashboard shows who has installed, who has reported and what it cost.',
    detail: 'Someone takes a seat and vanishes? It frees up and goes back in the feed.',
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
    criterion: 'Written reviews you can act on',
    note: 'The reason you came',
    cells: [
      { verdict: 'good', text: `One structured, on-rubric review per tester, privately — ${RULES.cycleSize - 1} of them` },
      { verdict: 'bad', text: 'A five-star string you did not want, and cannot use' },
      { verdict: 'mixed', text: 'Occasionally a paragraph; rarely actionable' },
      { verdict: 'mixed', text: '“Looks nice”' },
    ],
  },
  {
    // The row a review-swap site cannot answer. Enforcement against traded
    // public reviews does not stop at deleting the review: reporting through
    // early 2026 describes risk travelling between linked accounts — shared
    // device fingerprints, IP subnets, payment methods. A network built on
    // trading public reviews is a graph of exactly those signals, so its
    // downside is correlated across everyone in it. Deliberately unnamed; we
    // win the row on the mechanism without picking a fight with anyone.
    criterion: 'What happens if it works too well',
    note: 'The downside nobody prices',
    cells: [
      { verdict: 'good', text: 'Nothing, on the closed-track work that is the default. Store activity is opt-in and carries the risk below' },
      { verdict: 'bad', text: 'A cluster of accounts trading public reviews is the pattern enforcement looks for, and termination travels between linked accounts' },
      { verdict: 'bad', text: 'You are one of many buyers of the same seller’s accounts' },
      { verdict: 'good', text: 'Nothing' },
    ],
  },
  {
    criterion: 'Policy risk',
    note: 'The one that ends your account',
    cells: [
      { verdict: 'mixed', text: 'None if you stay on closed tracks, which is the default. Real if you opt an app into store reviews' },
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
      { verdict: 'bad', text: 'Usually one install, then silence' },
      { verdict: 'mixed', text: 'Enthusiastic for four days, then they forget' },
    ],
  },
  {
    criterion: 'Dropout replacement',
    cells: [
      { verdict: 'good', text: 'The seat frees up and goes straight back in the feed' },
      { verdict: 'bad', text: 'Not offered' },
      { verdict: 'mixed', text: 'Re-order and wait, if the seller is still online' },
      { verdict: 'bad', text: 'You start asking again' },
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
      { verdict: 'good', text: 'Ask for as many as you can fund; 18 on Fast Track, 20 on Pro' },
      { verdict: 'mixed', text: 'Sold as an upsell, if at all' },
      { verdict: 'mixed', text: 'Buy 12, pay again for more' },
      { verdict: 'bad', text: 'You are lucky to reach 12' },
    ],
  },
  {
    criterion: 'Time to start',
    note: 'Where money genuinely buys speed',
    cells: [
      { verdict: 'good', text: 'Listed in two minutes; testers arrive as they browse' },
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
  { label: 'Confirmed review', detail: 'on-rubric, arbitrated, private', amount: EARN.feedbackApproved },
];

/* ------------------------------------------------------ founding members */

/*
 * This replaced three testimonials from developers who do not exist — named,
 * quoted, with countries and outcomes attached. They were the most persuasive
 * thing on the page and the only thing on it that could not survive one reader
 * checking. A product whose entire pitch is "we are the honest option in a
 * category built on lying to developers" cannot open with invented people.
 *
 * The slot is worth more used for the truth: this network is new, the feed is
 * still thin, and the people reading this are exactly who it needs. That is
 * also the only ask that matters right now.
 */
const FOUNDING: Array<{ t: string; b: string }> = [
  {
    t: 'What you get',
    b: `Your app in front of every developer here: ${RULES.cycleSize - 1} of them installing it, holding your track for ${RULES.requiredDays} days, and each sending one structured review. Nothing is reserved for later members.`,
  },
  {
    t: 'What we get',
    b: 'The exchange run end to end by people who will tell us what broke. Founding members set the standard the reviews are held to, and we would rather hear it from fifteen developers than from a launch.',
  },
  {
    t: 'What is not here yet',
    b: 'No apps have shipped yet, because none has finished collecting. The launch feed is empty and stays empty until one clears. Everything on this page describes how it works, not how well it has worked.',
  },
];

/* ------------------------------------------------------------------- faq */

const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    // Most-asked, so it goes first. A good share of the people who find this
    // site searched for store reviews. Pretending otherwise loses them at the
    // headline; serving it would lose them their developer account. The honest
    // answer is the conversion: name what they came for, say plainly that we do
    // not do it, and show what solves the underlying problem instead.
    q: 'I came here to get reviews for my app. Is that what this is?',
    a: (
      <>
        <p>
          Partly, and the difference matters more than it sounds. You get{' '}
          {RULES.cycleSize - 1} written reviews of your app from developers who
          ship Android apps themselves — what broke, on which device, what they
          would change. Detailed, private, and yours to act on.
        </p>
        <p className="mt-3">
          What you do not get is Play Store reviews or star ratings, and no
          service can honestly sell you those. A review traded for anything —
          money, credits, a review back — is an incentivised review under{' '}
          <a href={POLICY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Google&rsquo;s Ratings, Reviews and Installs policy
          </a>
          . Apps get removed for it and developer accounts get terminated for
          it, and the sites that offer it are selling you that risk without
          pricing it in.
        </p>
        <p className="mt-3">
          The reason people want store reviews is almost always one of two
          things: they cannot publish yet, or the app is not good enough to earn
          reviews on its own. TesterPool is built for both. The first is the{' '}
          {RULES.requiredTesters}-tester requirement, which the feed clears. The
          second is what {RULES.cycleSize - 1} critical reviews are for.
        </p>
      </>
    ),
  },
  {
    q: 'Is this against Google Play policy?',
    a: (
      <>
        <p>
          Closed testing is not, and that is the whole of what TesterPool does by
          default. Your listing, the testers who take it, the fourteen-day clock and
          the private reports all happen inside your closed testing track. Closed
          track installs do not affect your store ranking, your public rating or your
          public install count. Google&rsquo;s own developer community guidance is
          that using a third-party service to find testers for a closed test does not
          violate policy.
        </p>
        <p className="mt-3">
          <strong className="font-semibold text-[var(--color-ink)]">
            Store activities are a different answer, and it is yes.
          </strong>{' '}
          A publisher can opt one of their own apps into asking for a public store
          install and a published review, paid in credits. Google prohibits
          incentivised <em>ratings, reviews and installs</em>, and that is what this
          is — the closed-track argument above does not stretch to cover it, because a
          public listing is not a closed track. Enforcement risk sits with the
          developer account that opted in.
        </p>
        <p className="mt-3">
          It is off for every app until its publisher turns it on, one app at a time,
          and it can be turned off again for the whole network. If you want the part
          of TesterPool that carries no policy risk, simply do not enable it: closed
          testing works exactly as described above on its own.
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
          First, ask for more than twelve. You set the number of testers you want
          and you can raise it any time, so aiming at {RULES.cycleSize} for a{' '}
          {RULES.requiredTesters}-tester requirement means three people can vanish
          and you still clear the bar. Competitors sell that buffer as an upsell;
          here it is just a number you choose.
        </p>
        <p className="mt-3">
          Second, the seat comes back. A tester who takes your app on and goes
          quiet is flagged on your dashboard, and their seat returns to the feed
          for someone else — no waiting on a match, because there is no cohort to
          rebuild. On Fast Track and Pro a replacement is found for you.
        </p>
        <p className="mt-3">
          Third, walking away is expensive for the person who does it: it costs{' '}
          {PENALTY.dropout} credits and a serious hit to their Reliability Score,
          which throttles how much work they can hold below{' '}
          {RULES.minReliabilityToJoin}. Nobody ghosts twice.
        </p>
      </>
    ),
  },
  {
    q: 'Do I have to test other people’s apps?',
    a: (
      <p>
        On the free tier, yes — that is the trade, and it is what makes the
        network honest. Testing one app costs about ten minutes: install it, use
        it properly, write what you found. Testing a full cycle of apps earns{' '}
        {FULL_CYCLE_EARNINGS} credits — exactly what a full cycle of testers costs
        you, so doing your share breaks even. If you would rather not, Fast Track
        at ${planPrice('fast')} buys the testers without reciprocating.
      </p>
    ),
  },
  {
    q: 'How long until reviewing starts?',
    a: (
      <p>
        There is nothing to wait for — your listing is live the moment you save
        it, and testers take it whenever they browse. How fast they arrive
        depends on how deep the feed is that week and how clear your brief is.
        Fast Track puts you at the top of it. We will be blunt: while the network
        is still small, a listing can sit for a day or two before anyone picks it
        up.
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
        reviews, how many raised significant issues, and a written
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
        rule is the specific bottleneck we were built to break. TestFlight rounds
        are in limited beta — the same mechanics, the same reliability
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
            {/*
              min-w-0 on both columns is load-bearing, not tidiness. A grid item
              defaults to min-width:auto, so a child with a wide min-content —
              the loop card's truncating app row — pushes the item past its
              track instead of shrinking inside it. The hero section clips with
              overflow-hidden, so the failure mode is not a scrollbar you would
              notice: it is copy quietly cut off the right edge on a phone,
              which is the device most of this audience is reading on.
            */}
            <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] py-1 pl-1 pr-3">
                  <Pill tone="green">New</Pill>
                  <span className="text-xs text-[var(--color-dim)]">
                    Rescue testers now matched in under 6 hours
                  </span>
                </div>

                {/*
                  Three lines, and the size is set so it stays three at every
                  width. A headline that wraps to four owns the whole first
                  screen and pushes the proof card below the fold.
                */}
                <h1 className="mt-6 text-[2.4rem] font-bold leading-[1.06] tracking-tight sm:text-5xl">
                  Get your app reviewed
                  <br />
                  by <span className="num">{RULES.cycleSize - 1}</span> developers.
                  <br />
                  <span style={{ color: 'var(--color-accent)' }}>Then ship it.</span>
                </h1>

                <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-dim)]">
                  List your app and {RULES.cycleSize - 1} indie developers install it,
                  use it for {RULES.requiredDays} days, and each send you one
                  structured review &mdash; what broke, on which device, what they
                  would change. You hear it from people who ship Android apps before
                  you hear it from your users, and Google Play&rsquo;s{' '}
                  {RULES.requiredTesters}-testers-for-{RULES.requiredDays}-days
                  requirement is satisfied on the way through.
                </p>

                {/*
                  Most people arrive here having searched for reviews, and a good
                  number of them mean store reviews. That demand is real and this
                  paragraph is where it gets converted rather than either ignored
                  or served.
                  It leads with what you do get, because leading with a denial
                  reads as a disclaimer and disclaimers get skipped. This used to
                  be a flat denial — "not Play Store reviews" — which stopped being
                  true when store activities shipped. It is now a distinction rather
                  than a denial, and the warning has to survive that: whichever way
                  it is worded, a visitor must not get to the signup button still
                  thinking the store half is the safe half. Do not move it down the
                  page and do not soften it into "compliant" — say which reviews we
                  mean, and say what each one costs.
                */}
                <p className="mt-4 max-w-xl rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-[15px] leading-relaxed text-[var(--color-dim)]">
                  <strong className="font-semibold text-[var(--color-ink)]">
                    Private developer reviews, inside your own closed testing track.
                  </strong>{' '}
                  That is the default and it touches no public signal. Public Play
                  Store reviews are a separate thing you can switch on per app, and
                  they are incentivised the moment they are traded &mdash;{' '}
                  <a
                    href={POLICY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-[var(--color-line-hi)] underline-offset-2 hover:text-[var(--color-ink)]"
                  >
                    Google removes apps for it
                  </a>
                  . Know which one you are turning on: the reviews you want, or the
                  ones that can cost you the account.
                </p>

                {/*
                  The first ask is a look, not a form. /pool needs no account,
                  so a visitor can see whether anyone is actually here before
                  being asked for an email — which is the question they have,
                  and the one a signup wall refuses to answer.
                */}
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/feed" className="btn btn-primary h-11 px-5 text-[15px]">
                    Browse the feed <Arrow />
                  </Link>
                  <Link href="/login" className="btn btn-secondary h-11 px-5 text-[15px]">
                    Start free
                  </Link>
                </div>

                {/*
                  This strip used to read "1,247 developers · 38 listings live ·
                  9,318 apps greenlit", hardcoded, beside a glowing "live" dot.
                  On a page whose whole argument is that we are the honest option,
                  invented traffic figures are the one unforced error that costs
                  the argument — and "apps greenlit" is a claim about outcomes we
                  would have to defend. These four are true, checkable against
                  lib/economy, and they state the offer rather than flatter it.
                  Real network counts return here in phase 4, from an
                  anon-callable projection. See docs/FIRST-SIGHT.md.
                */}
                {/*
                  No vertical rules between these. A separator that is a sibling
                  of the items it separates ends up dangling at the start or end
                  of a line the moment the row wraps, and this row wraps at every
                  width between phone and desktop. Spacing separates them.
                */}
                <dl className="mt-10 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-[var(--color-line)] pt-6">
                  {[
                    // The promise, with numbers on it. A competitor selling the
                    // same shape says "up to 14 guaranteed"; ours is the better
                    // deal — three people can disappear and you still clear
                    // Google's bar — and it was the worse sentence until it had
                    // its numbers stated this plainly.
                    { v: `${RULES.cycleSize - 1}`, l: 'reviews on your app' },
                    {
                      v: `${RULES.cycleSize}`,
                      l: `seats, so ${RULES.cycleSize - RULES.requiredTesters} can vanish and you still clear ${RULES.requiredTesters}`,
                    },
                    { v: EARN.signupGrant.toLocaleString(), l: 'credits to start' },
                  ].map((s) => (
                    <div key={s.l}>
                      <dt className="sr-only">{s.l}</dt>
                      <dd className="num text-xl font-bold leading-none">{s.v}</dd>
                      <dd className="mt-1.5 text-sm leading-snug text-[var(--color-mute)]">{s.l}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-mute)]">
                  You pay for them by reviewing other people&rsquo;s apps. Credits
                  move between members and testing never creates them, so the loop
                  cannot be farmed and doing your share costs you nothing.
                </p>
              </div>

              <div className="min-w-0 lg:pt-4">
                <ReviewsVisual />
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- report */}
        <Section
          id="report"
          eyebrow="What you get back"
          title="One of the reviews, in full"
          lede={
            <>
              This is the screen a developer sees, rendered by the same component
              the product uses &mdash; an example of the format, not a real
              member&rsquo;s report. {RULES.cycleSize - 1} of these land on your app
              over {RULES.requiredDays} days.
            </>
          }
        >
          <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
            <div className="min-w-0">
              <SampleReport />
            </div>
            <div className="min-w-0 space-y-4">
              {REPORT_CLAIMS.map((c) => (
                <Card key={c.title} className="p-5">
                  <h3 className="text-[15px] font-semibold leading-snug">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-dim)]">
                    {c.body}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </Section>

        {/* ------------------------------------------------------------- job */}
        <Section
          id="job"
          eyebrow="How you pay for them"
          title="By reviewing other people’s apps"
          lede={
            <>
              Fourteen reviews is real work by fourteen people, so the price is
              that you do it too. Here is all of it &mdash; three things, none of
              which take an evening.
            </>
          }
        >
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {JOB.map((j) => (
              <Card key={j.title} className="flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold">{j.title}</h3>
                  {/*
                    The unpaid step says so out loud. Left blank it reads as an
                    omission, when it is the deliberate part: a check-in that
                    minted credits would pay a tester more for testing an app
                    than the test costs its developer.
                  */}
                  {j.pays === null ? (
                    <Pill tone="neutral">Pays nothing</Pill>
                  ) : (
                    <CreditChip amount={j.pays} signed />
                  )}
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-dim)]">
                  {j.body}
                </p>
                <p className="mt-4 border-t border-[var(--color-line)] pt-3 text-[12px] leading-relaxed text-[var(--color-mute)]">
                  {j.detail}
                </p>
              </Card>
            ))}
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--color-dim)]">
            A review takes about ten minutes. {RULES.cycleSize - 1} of them is
            the entire cost of getting your own app to
            production &mdash; {FULL_CYCLE_COST.toLocaleString()} credits out as a
            developer, {FULL_CYCLE_EARNINGS.toLocaleString()} back in as a tester.
            Do your share and you break exactly even.
          </p>
        </Section>

        {/* --------------------------------------------------------- problem */}
        <Section
          id="problem"
          eyebrow="Why they all arrive at once"
          title={
            <>
              Twelve testers. Fourteen consecutive days.
              <br className="hidden sm:block" /> No exceptions.
            </>
          }
          lede={
            <>
              Every personal developer account created after 13 November 2023
              has to run a closed test with at least {RULES.requiredTesters}{' '}
              testers opted in continuously for {RULES.requiredDays} days before
              Google will even consider production access. Miss it by one tester
              on one day and the count starts over &mdash; which is why the
              number of testers you ask for should be more than twelve, and why
              this is a listing you keep open rather than a batch you run once.
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

        {/* ---------------------------------------------------- reliability */}
        <Section
          id="reliability"
          eyebrow="Why the reviews are worth reading"
          title="The Reliability Score is the whole trick"
          lede="Every other free tester scheme dies the same way: people opt in, collect what they need, disappear on day four, and the reviews you do get are four words long. TesterPool makes both of those the most expensive things you can do."
        >
          <div className="mt-12 grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card className="flex flex-col items-center justify-center gap-4 p-8">
              <ReliabilityGauge score={94} size={132} />
              <div className="text-center">
                <div className="text-sm font-semibold">Public, 0&ndash;100</div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-mute)]">
                  Shown on every profile, every listing and the leaderboard.
                  Below {RULES.minReliabilityToJoin} you cannot take work at all.
                </p>
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { t: 'Finish what you take on', s: 'Your score climbs, and you can hold more at once', tone: 'up' },
                { t: 'Write a report they act on', s: 'Your best score bump, and a badge for the specific ones', tone: 'up' },
                { t: 'Take an abandoned seat', s: `+${EARN.rescueBonus} credits and a lasting score bump`, tone: 'up' },
                { t: 'Take a seat and vanish', s: `−${PENALTY.dropout} credits, a score collapse, and a lockout`, tone: 'down' },
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
                  ever was, and it is why the reports here are worth reading at all.
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
                { l: 'Completed all 14 days', v: '14', s: '1 seat re-taken' },
                { l: 'Avg days active', v: '13.6', s: 'across all testers' },
                { l: 'Daily engagement', v: '94%', s: 'sessions with proof' },
                // One review per tester per app, so this tracks the testers who
                // finished rather than exceeding them. It read 23 while the
                // label was "Feedback reports", which allowed several per
                // tester; renaming it to reviews made the old number impossible.
                { l: 'Private reviews', v: '14', s: 'approved, on-rubric' },
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
          title="Credits move. Testing never mints them."
          lede="This is the property the whole network rests on, so it is worth stating before the price list. Every credit a reviewer earns came out of the balance of the developer whose app they reviewed — no amount of work creates one, which is why the loop cannot be farmed and why doing your share costs you exactly nothing. The only credits that appear from nowhere are the ones we hand you at signup."
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
                developers; nothing here mints them. A full cycle earns you{' '}
                {FULL_CYCLE_EARNINGS} and costs you {FULL_CYCLE_COST}, so doing your
                share breaks exactly even &mdash; and no amount of testing can
                inflate the supply, because every credit anyone earns came out of
                somebody&rsquo;s balance.
              </p>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Card className="p-6">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  What credits buy
                </div>
                <ul className="mt-4 space-y-3">
                  {[
                    { l: 'Buffer seat', v: COST.bufferSeat, s: 'One more tester above the target you set' },
                    { l: 'Rescue seat', v: COST.rescueSeat, s: 'A verified replacement, found within hours' },
                    { l: 'Priority placement', v: COST.priorityMatch, s: 'Top of the feed until you are full' },
                    { l: 'Expert seat', v: COST.expertSeat, s: 'A long-form report from a senior tester' },
                    { l: 'Second app', v: COST.extraApp, s: 'Run two apps through testing at once' },
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

        {/* ------------------------------------------------------ compliance */}
        <section
          id="compliance"
          className="scroll-mt-20 border-y border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-20 sm:px-6 sm:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-14">
              <div>
                {/*
                  This section used to be headed "Nothing TesterPool does ever touches
                  the public store" and listed the absence of a store-review mechanism
                  as the proof. Store activities made every sentence of that false, and
                  a safety claim that is false is worse than no safety claim — it is the
                  one thing a developer would rely on before risking their account. It
                  now draws the line where the line actually is: closed testing is safe
                  and is the default; store activity is opt-in and is not.
                */}
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
                  Where the line is
                </div>
                <h2 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
                  Closed testing touches no public signal. Store activity does.
                </h2>
                <div className="mt-6 space-y-4 text-base leading-relaxed text-[var(--color-dim)]">
                  <p>
                    Closed-track activity — the listing, the testers, the fourteen days,
                    the private reports — does not affect store rankings, public ratings
                    or public install counts. It is invisible to the store surface
                    entirely, and there is nothing in it for Google&rsquo;s
                    anti-manipulation systems to object to, because no public signal is
                    being manufactured. Google&rsquo;s developer community guidance is
                    explicit that using a third-party service to find testers for a
                    closed test does not violate policy. That is the default, and for
                    most developers here it is the whole product.
                  </p>
                  <p>
                    <strong className="font-semibold text-[var(--color-ink)]">
                      Store activities are the exception, and we will not dress them up.
                    </strong>{' '}
                    A publisher can opt an app into paying for a public store install
                    and a published review. Google and Apple both prohibit incentivising{' '}
                    <strong className="font-semibold text-[var(--color-ink)]">
                      ratings, reviews and installs
                    </strong>
                    , and this is that. The closed-track reasoning above does not cover
                    it. If it goes wrong it goes wrong on the developer account that
                    switched it on.
                  </p>
                  <p>
                    So it is off everywhere until a publisher turns it on for one of
                    their own apps, and nobody is ever paid for a rating they did not
                    choose: the tester writes their own review, sets their own star
                    count, and is paid the same whatever they put. Closed testing runs
                    perfectly well without ever touching it.
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
                  { ok: true, t: 'Private structured reviews', s: 'On a rubric, arbitrated, never published' },
                  { ok: true, t: 'Daily engagement proof', s: 'Screenshot-backed, for your own application' },
                  { ok: false, t: 'Public store reviews', s: 'Opt-in per app, and against Play and App Store policy' },
                  { ok: false, t: 'Public ratings', s: 'The tester chooses the stars; pay never depends on them' },
                  { ok: false, t: 'Dictated or AI-written review copy', s: 'No mechanism exists in the product' },
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
            One-off pricing per app, not a subscription. If your listing fails to reach{' '}
            {RULES.requiredTesters} verified testers, a paid plan is refunded in full.
          </p>
        </Section>

        {/* ---------------------------------------------- the founding members */}
        <Section
          id="founding"
          eyebrow="Where this actually stands"
          title="TesterPool is new. The feed is the one filling now."
          lede={
            <>
              Most sites in this category would put three glowing testimonials
              here. We do not have any yet, and inventing them would contradict
              the only thing that makes this worth choosing.
            </>
          }
        >
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {FOUNDING.map((f) => (
              <Card key={f.t} className="flex flex-col p-6">
                <h3 className="text-base font-semibold">{f.t}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-dim)]">
                  {f.b}
                </p>
              </Card>
            ))}
          </div>

          <Card className="mt-4 flex flex-col items-start justify-between gap-5 p-7 sm:flex-row sm:items-center">
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-dim)]">
              If you need {RULES.requiredTesters} testers and would rather not buy
              them from a stranger, list your app. It goes into the feed the
              moment you save it, and there is nothing to wait for after that.
            </p>
            <Link href="/login" className="btn btn-primary shrink-0">
              List your app <Arrow />
            </Link>
          </Card>
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
              {EARN.signupGrant} credits when you sign up, enough to pay for more
              testers than the {RULES.requiredTesters} Google asks for, and an
              Evidence Pack that fills itself in as they arrive.
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
