'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Card,
  Pill,
  ReliabilityGauge,
  ProgressRing,
  cx,
} from '@/components/ui';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { RULES } from '@/lib/economy';

const POLICY_URL =
  'https://support.google.com/googleplay/android-developer/answer/9898684';

type Answer = 'yes' | 'no' | 'unsure';

type Item = {
  id: string;
  label: string;
  hint: string;
  /** How much of the total rejection risk this single item accounts for. */
  weight: number;
  /** The rejection this specific gap produces, in Google's language. */
  rejection: string;
  /** What to actually do about it. */
  fix: string;
  /** Shown when the answer is "not sure" — how to find out. */
  verify: string;
};

const ITEMS: Item[] = [
  {
    id: 'account',
    label: 'You know whether the 12/14 rule applies to your account',
    hint: 'Personal developer accounts created after 13 November 2023 must run a closed test before production access. Organisation accounts do not.',
    weight: 6,
    rejection: 'Wasted weeks running a test you never needed — or skipping one you did.',
    fix: 'Play Console → Setup → Account details. Check the account type and the creation date. If it is a personal account created on or after 13 Nov 2023, every item below applies to you.',
    verify: 'Open Play Console → Setup → Account details and read the account type and creation date. It takes thirty seconds and changes everything else on this page.',
  },
  {
    id: 'closed-track',
    label: 'A closed testing track is published and live',
    hint: 'Not internal testing, not a draft release. Closed testing, with a release actually rolled out.',
    weight: 12,
    rejection: 'Your test does not count. Internal testing and draft releases do not satisfy the requirement.',
    fix: 'Play Console → Testing → Closed testing → create a track, upload a build, and roll it out. Wait for the release to reach "Available to testers" before you count day one.',
    verify: 'Testing → Closed testing. The track status must read live, not "Draft" or "In review". If it says internal testing, that is the wrong track.',
  },
  {
    id: 'twelve',
    label: `At least ${RULES.requiredTesters} testers are opted in right now`,
    hint: 'Opted in — meaning they accepted the invite and installed from the testing link. Being on the email list is not the same thing.',
    weight: 16,
    rejection: 'Fewer than 12 testers. The single most common rejection, and the easiest to miss because the console shows invitees rather than opt-ins.',
    fix: `Get more testers, and get more than twelve. Aim for ${RULES.cycleSize} so that three can disappear without breaking anything. Every tester needs the exact Google account email that will install the app.`,
    verify: 'Ask each tester to send you a screenshot of the app installed, or check your closed track opt-in count. An invitation sent is not an opt-in.',
  },
  {
    id: 'continuous',
    label: `All ${RULES.requiredDays} days have been continuous, with nobody dropping below ${RULES.requiredTesters}`,
    hint: 'If a tester opts out on day 9 and drops you to eleven, the continuous count restarts from zero.',
    weight: 16,
    rejection: 'The 14 consecutive days requirement was not met. You will usually be told this after the fact, with no way to prove otherwise.',
    fix: 'Restart the count from the day you were last at twelve or more, and add buffer testers immediately so a single dropout cannot break it again.',
    verify: 'You need a per-day record of how many testers were opted in. If you do not have one, assume the count is not proven and start tracking today.',
  },
  {
    id: 'optin',
    label: 'A stranger has successfully used your opt-in link',
    hint: 'Someone who is not you, on a device you do not own, with an account you did not set up.',
    weight: 10,
    rejection: 'Silent failure: testers cannot join, your opt-in count never rises, and you find out on day 12.',
    fix: 'Send the opt-in URL (or Google Group invite) to someone unrelated to you and watch them complete it end to end. Broken or wrongly-scoped opt-in links are the most common silent killer of a closed test.',
    verify: 'If the only person who has used the link is you or a family member on your own Wi-Fi, it is untested. Get one outside confirmation.',
  },
  {
    id: 'engagement',
    label: 'Your testers are actually opening the app, most days',
    hint: 'Google asks how engaged testers were. Twelve silent installs reads as twelve silent installs.',
    weight: 14,
    rejection: 'Insufficient tester engagement. This is a rejection reason on its own, even with twelve testers for fourteen days.',
    fix: 'Ask for a daily open, give people a reason to come back, and keep a record of it. Screenshot-backed daily check-ins are the only version of this you can put in an application.',
    verify: 'Open Play Console → Statistics and look at daily active users on the closed track. If it is flat at zero after day two, you have an engagement problem, not a tester problem.',
  },
  {
    id: 'feedback',
    label: 'You have collected written feedback from testers',
    hint: 'The production access form asks what feedback you gathered. It expects a real answer.',
    weight: 12,
    rejection: 'No evidence of a genuine test. Applications with no feedback summary read as a box-ticking exercise.',
    fix: 'Ask every tester for a short structured report: what they tried, what broke, what confused them, what device. Five specific reports beat fifty "looks good" messages.',
    verify: 'Count how many written responses you could paste into an application right now. If the answer is under three, treat this as unmet.',
  },
  {
    id: 'changes',
    label: 'You changed something in response to testing',
    hint: 'The application asks what you did with the feedback. "Nothing" is a bad answer.',
    weight: 8,
    rejection: 'The test reads as performative. Reviewers look for evidence the closed test influenced the product.',
    fix: 'Ship at least one or two fixes that came directly out of tester reports, and note the version numbers. Even small changes count if you can point at the report that caused them.',
    verify: 'Look at your release notes since the test started. If nothing traces back to a tester, you have not got a story to tell yet.',
  },
  {
    id: 'listing',
    label: 'Your store listing is complete: description, screenshots, categorisation',
    hint: 'Production review looks at the listing, not just the test.',
    weight: 8,
    rejection: 'Store listing issues. Slow, avoidable, and entirely separate from the tester requirement.',
    fix: 'Full description, short description, at least four screenshots per supported form factor, a feature graphic, correct category, content rating questionnaire completed, target audience declared.',
    verify: 'Play Console → Grow → Store presence → Main store listing. Anything flagged incomplete there will block you regardless of your testers.',
  },
  {
    id: 'privacy',
    label: 'Your privacy policy URL is live and reachable',
    hint: 'A dead link or a page behind a login is treated as a missing policy.',
    weight: 8,
    rejection: 'Policy declaration issues. A rejection that costs days for something you can fix in an hour.',
    fix: 'Host the policy at a stable public URL, make sure it names your app, describes the data you collect and matches your Data Safety form exactly.',
    verify: 'Open the URL in a private browsing window on mobile data. If it 404s, redirects, or asks for a login, it does not count.',
  },
];

const TOTAL_WEIGHT = ITEMS.reduce((s, i) => s + i.weight, 0);

function riskBand(risk: number) {
  if (risk >= 45) return { label: 'High risk', tone: 'red' as const, color: 'var(--color-danger)' };
  if (risk >= 18) return { label: 'Elevated risk', tone: 'amber' as const, color: 'var(--color-credit)' };
  if (risk > 0) return { label: 'Low risk', tone: 'green' as const, color: 'var(--color-accent)' };
  return { label: 'Ready to apply', tone: 'green' as const, color: 'var(--color-accent)' };
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ANSWERS: Array<{ key: Answer; label: string }> = [
  { key: 'yes', label: 'Yes' },
  { key: 'no', label: 'No' },
  { key: 'unsure', label: 'Not sure' },
];

export default function ReadinessChecker() {
  const [answers, setAnswers] = React.useState<Record<string, Answer>>({});

  const set = React.useCallback((id: string, a: Answer) => {
    setAnswers((prev) => ({ ...prev, [id]: a }));
  }, []);

  const answeredCount = ITEMS.filter((i) => answers[i.id]).length;
  const clearedCount = ITEMS.filter((i) => answers[i.id] === 'yes').length;

  // Unanswered items are treated as unknown, not as failures, so the score is
  // honest before you have filled the thing in.
  const risk = ITEMS.reduce((sum, i) => {
    const a = answers[i.id];
    if (a === 'yes') return sum;
    if (a === 'no') return sum + i.weight;
    if (a === 'unsure') return sum + i.weight * 0.5;
    return sum;
  }, 0);
  const riskPct = Math.round((risk / TOTAL_WEIGHT) * 100);
  const readiness = 100 - riskPct;
  const band = riskBand(riskPct);

  const failures = ITEMS.filter((i) => answers[i.id] === 'no').sort((a, b) => b.weight - a.weight);
  const unknowns = ITEMS.filter((i) => answers[i.id] === 'unsure').sort((a, b) => b.weight - a.weight);
  const primary = failures[0] ?? unknowns[0] ?? null;

  const reset = () => setAnswers({});

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
            <Pill tone="green">Free, no signup</Pill>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl">
              Production Access Readiness Checker
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-dim)]">
              Ten questions that map to the ten ways a Google Play production
              access application actually gets rejected. Answer honestly and you
              will know, in about two minutes, which one is going to get you.
            </p>
            <p className="mt-3 max-w-2xl text-sm text-[var(--color-mute)]">
              Nothing is uploaded, stored, or sent anywhere. This runs entirely in
              your browser.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
            {/* ------------------------------------------------ the checklist */}
            <ol className="space-y-3">
              {ITEMS.map((item, i) => {
                const a = answers[item.id];
                const failed = a === 'no';
                const unsure = a === 'unsure';
                return (
                  <li key={item.id} id={item.id === 'optin' ? 'optin' : undefined} className="scroll-mt-20">
                    <Card
                      className="p-5"
                      style={
                        failed
                          ? { borderColor: 'color-mix(in oklab, var(--color-danger) 32%, var(--color-line))' }
                          : unsure
                            ? { borderColor: 'color-mix(in oklab, var(--color-credit) 32%, var(--color-line))' }
                            : a === 'yes'
                              ? { borderColor: 'color-mix(in oklab, var(--color-accent) 30%, var(--color-line))' }
                              : undefined
                      }
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cx(
                            'num mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                            a === 'yes' ? 'text-[#04150C]' : 'text-[var(--color-mute)]'
                          )}
                          style={{
                            background: a === 'yes' ? 'var(--color-accent)' : 'var(--color-surface-2)',
                          }}
                        >
                          {a === 'yes' ? <Check /> : i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-[15px] font-semibold leading-snug">{item.label}</h2>
                          <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-dim)]">
                            {item.hint}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {ANSWERS.map((opt) => {
                              const active = a === opt.key;
                              return (
                                <button
                                  key={opt.key}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => set(item.id, opt.key)}
                                  className={cx('btn', active ? 'btn-primary' : 'btn-secondary')}
                                  style={
                                    active && opt.key === 'no'
                                      ? { background: 'var(--color-danger)', color: '#1A0505' }
                                      : active && opt.key === 'unsure'
                                        ? { background: 'var(--color-credit)', color: '#1A1204' }
                                        : undefined
                                  }
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>

                          {(failed || unsure) && (
                            <div
                              className="mt-4 rounded-xl border px-4 py-3"
                              style={{
                                borderColor: failed
                                  ? 'color-mix(in oklab, var(--color-danger) 26%, transparent)'
                                  : 'color-mix(in oklab, var(--color-credit) 26%, transparent)',
                                background: failed
                                  ? 'color-mix(in oklab, var(--color-danger) 7%, transparent)'
                                  : 'color-mix(in oklab, var(--color-credit) 7%, transparent)',
                              }}
                            >
                              <div
                                className="text-[11px] font-semibold uppercase tracking-wide"
                                style={{ color: failed ? 'var(--color-danger)' : 'var(--color-credit)' }}
                              >
                                {failed ? 'Likely rejection' : 'How to find out'}
                              </div>
                              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-dim)]">
                                {failed ? item.rejection : item.verify}
                              </p>
                              {failed && (
                                <>
                                  <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                                    Do this
                                  </div>
                                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-dim)]">
                                    {item.fix}
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>

            {/* ---------------------------------------------------- the score */}
            <aside className="lg:sticky lg:top-20">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                    Rejection risk
                  </span>
                  <Pill tone={band.tone}>{band.label}</Pill>
                </div>

                <div className="mt-5 flex items-center justify-center gap-6">
                  <ReliabilityGauge score={readiness} size={116} label={false} />
                  <div>
                    <div
                      className="num text-3xl font-bold leading-none"
                      style={{ color: band.color }}
                    >
                      {riskPct}%
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-mute)]">
                      chance of a rejection
                      <br />
                      on current answers
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[var(--color-line)] pt-4 text-xs text-[var(--color-dim)]">
                  <span className="num">
                    {clearedCount} of {ITEMS.length} cleared
                  </span>
                  <span className="num text-[var(--color-mute)]">
                    {answeredCount} of {ITEMS.length} answered
                  </span>
                </div>

                {answeredCount === 0 ? (
                  <p className="mt-4 text-sm leading-relaxed text-[var(--color-dim)]">
                    Answer the questions on the left. Unanswered items count as
                    unknown rather than as failures, so the number only moves when
                    you tell it something.
                  </p>
                ) : primary ? (
                  <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                      Most likely reason you get rejected
                    </div>
                    <p className="mt-2 text-sm font-medium leading-snug">
                      {primary.rejection}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-dim)]">
                      {failures[0] ? primary.fix : primary.verify}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                      Nothing left to fix
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-dim)]">
                      On these ten questions you are clear. Submit the application,
                      and keep your closed track running until you hear back — a
                      tester dropping off after you apply still looks bad.
                    </p>
                  </div>
                )}

                {(failures.length > 0 || unknowns.length > 0) && (
                  <div className="mt-4 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                      Your fix list, worst first
                    </div>
                    {[...failures, ...unknowns].map((f) => (
                      <a
                        key={f.id}
                        href={`#${f.id}`}
                        className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs leading-snug text-[var(--color-dim)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                      >
                        <span
                          className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            background: answers[f.id] === 'no' ? 'var(--color-danger)' : 'var(--color-credit)',
                          }}
                        />
                        {f.label}
                      </a>
                    ))}
                  </div>
                )}

                {answeredCount > 0 && (
                  <button type="button" onClick={reset} className="btn btn-ghost mt-4 w-full">
                    Start over
                  </button>
                )}
              </Card>

              {/* soft CTA */}
              <Card className="mt-4 p-6">
                <div className="flex items-start gap-4">
                  <ProgressRing value={clearedCount} max={ITEMS.length} size={78} stroke={7} />
                  <div>
                    <h2 className="text-sm font-semibold">
                      Four of these are just &ldquo;find good testers&rdquo;
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-dim)]">
                      Twelve opt-ins, fourteen unbroken days, real engagement, and
                      written feedback are the four hardest items here, and they
                      are the four TesterPool handles for you — testers off a live
                      feed, screenshot-verified opt-ins, and an Evidence Pack that
                      fills itself in as they arrive.
                    </p>
                  </div>
                </div>
                <Link href="/login" className="btn btn-primary mt-5 w-full">
                  List your app, free <Arrow />
                </Link>
                <p className="mt-3 text-center text-xs text-[var(--color-mute)]">
                  Or keep this page bookmarked. It works fine without us.
                </p>
              </Card>
            </aside>
          </div>

          <Card className="mt-10 p-6">
            <h2 className="text-sm font-semibold">A note on what does not help</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-dim)]">
              Buying installs or reviews to look more active will not fix an
              engagement rejection — it is the specific thing Google&rsquo;s
              ratings, reviews and installs policy prohibits, and enforcement is
              account-level. Closed testing activity is safe because it never
              reaches the public store surface. Keep everything inside the closed
              track and you have nothing to worry about.{' '}
              <a
                href={POLICY_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--color-accent)] hover:underline"
              >
                Read the policy
              </a>
              .
            </p>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
