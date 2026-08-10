'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, Pill, cx } from '@/components/ui';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { IconArrow, IconAlert, IconCheck } from '@/components/app/icons';
import { checkHandle, checkOptInUrl, checkPackageName, isGoogleAccountEmail, looksLikeEmail } from '@/lib/pods';
import { completeOnboarding } from '@/app/(app)/actions';

const CATEGORIES = [
  'Productivity', 'Finance', 'Health & Fitness', 'Education', 'Games',
  'Photo & Video', 'Social', 'Travel', 'Utilities', 'Music', 'Other',
];

const FOCUS_AREAS = [
  'First-run experience', 'Sign-up flow', 'Performance on low-end devices',
  'Crashes and stability', 'Copy and clarity', 'Paywall and pricing',
  'Notifications', 'Offline behaviour', 'Accessibility', 'Dark mode',
];

const STEPS = ['Who you are', 'Your test account', 'Your first app'];

export function OnboardingForm({
  initial,
}: {
  initial: { handle: string; displayName: string; countryCode: string; testerEmail: string; authEmail: string };
}) {
  const router = useRouter();
  const { pending, feedback, run } = useAction();
  const [step, setStep] = React.useState(0);

  const [handle, setHandle] = React.useState(initial.handle);
  const [displayName, setDisplayName] = React.useState(initial.displayName);
  const [countryCode, setCountryCode] = React.useState(initial.countryCode);
  const [testerEmail, setTesterEmail] = React.useState(initial.testerEmail || initial.authEmail);

  const [name, setName] = React.useState('');
  const [packageName, setPackageName] = React.useState('');
  const [optInUrl, setOptInUrl] = React.useState('');
  const [googleGroup, setGoogleGroup] = React.useState('');
  const [tagline, setTagline] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [focusAreas, setFocusAreas] = React.useState<string[]>([]);
  const [testerInstructions, setTesterInstructions] = React.useState('');

  const handleOk = checkHandle(handle);
  const emailOk = looksLikeEmail(testerEmail);
  const googleOk = emailOk && isGoogleAccountEmail(testerEmail);
  const packageOk = !packageName.trim() || checkPackageName(packageName);
  const urlCheck = optInUrl.trim() ? checkOptInUrl(optInUrl) : null;
  const hasEntry = !!optInUrl.trim() || !!googleGroup.trim();
  const appOk = !!name.trim() && hasEntry;

  const stepOk = step === 0 ? handleOk : step === 1 ? emailOk : appOk;

  async function submit() {
    const result = await run(
      () =>
        completeOnboarding({
          handle: handle.trim().toLowerCase(),
          displayName,
          countryCode,
          testerEmail,
          app: {
            name, packageName, optInUrl, googleGroup, tagline, category,
            focusAreas, testerInstructions,
          },
        }),
      { refresh: false }
    );
    if (result.ok) {
      router.push('/pods');
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cx(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                i < step && 'border-transparent'
              )}
              style={
                i < step
                  ? { background: 'var(--color-accent)', color: '#04150C' }
                  : i === step
                    ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
                    : { borderColor: 'var(--color-line)', color: 'var(--color-mute)' }
              }
            >
              {i < step ? <IconCheck size={13} /> : i + 1}
            </span>
            <span
              className="hidden text-xs font-semibold sm:inline"
              style={{ color: i === step ? 'var(--color-ink)' : 'var(--color-mute)' }}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-[var(--color-line)]" />}
          </li>
        ))}
      </ol>

      <Card className="p-6">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Pick a handle</h2>
              <p className="mt-1 text-sm text-[var(--color-dim)]">
                Other developers see this on your seat in their pod and on the leaderboard.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="handle">Handle</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-mute)]">@</span>
                <input
                  id="handle" className="input" value={handle} autoComplete="off"
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                  placeholder="anna_builds"
                />
              </div>
              {!handleOk && handle.length > 0 && (
                <p className="mt-1.5 text-xs text-[var(--color-danger)]">
                  3 to 24 characters. Lowercase letters, numbers and underscores only.
                </p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="displayName">Display name</label>
              <input
                id="displayName" className="input" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} placeholder="Anna Petrova"
              />
            </div>
            <div>
              <label className="label" htmlFor="country">Country</label>
              <input
                id="country" className="input" value={countryCode} maxLength={2}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                placeholder="SE"
              />
              <p className="mt-1.5 text-xs text-[var(--color-mute)]">
                Two-letter code. Used to spread pods across time zones so daily check-ins land in different hours.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">The Google account you will test with</h2>
              <p className="mt-1 text-sm text-[var(--color-dim)]">
                Closed testing tracks are keyed to a Google account, not to a person. A developer adds this
                exact address to their tester list. If the address you give here is not the one signed in to
                the Play Store on your device, the opt-in link returns an error and the test never starts.
                This is the single most common reason a closed test fails.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="testerEmail">Google account email</label>
              <input
                id="testerEmail" className="input" type="email" value={testerEmail}
                onChange={(e) => setTesterEmail(e.target.value)} placeholder="you@gmail.com"
              />
              {!emailOk && testerEmail.length > 0 && (
                <p className="mt-1.5 text-xs text-[var(--color-danger)]">That does not look like an email address.</p>
              )}
              {emailOk && !googleOk && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--color-credit)]">
                  <IconAlert size={13} className="mt-px shrink-0" />
                  <span>
                    That is not a gmail.com address. Workspace accounts do work, but only if this is the account
                    signed in to the Play Store on the device you will test with. Check before you continue.
                  </span>
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
              <h3 className="text-sm font-semibold">How to check in 20 seconds</h3>
              <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-sm text-[var(--color-dim)]">
                <li>Open the Play Store on the device you will test on.</li>
                <li>Tap your avatar, top right. The address shown there is the one that matters.</li>
                <li>Paste that exact address above.</li>
              </ol>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">List your first app</h2>
              <p className="mt-1 text-sm text-[var(--color-dim)]">
                Everything here is shown to the testers matched to you. Precise instructions get precise reports.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="appName">App name</label>
                <input id="appName" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ledgerly" />
              </div>
              <div>
                <label className="label" htmlFor="pkg">Package name</label>
                <input id="pkg" className="input" value={packageName} onChange={(e) => setPackageName(e.target.value)} placeholder="com.ledgerly.app" />
                {!packageOk && (
                  <p className="mt-1.5 text-xs text-[var(--color-credit)]">
                    Package names look like com.company.app.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="optin">Play opt-in URL</label>
              <input
                id="optin" className="input" value={optInUrl}
                onChange={(e) => setOptInUrl(e.target.value)}
                placeholder="https://play.google.com/apps/testing/com.ledgerly.app"
              />
              {urlCheck && (
                <p
                  className="mt-1.5 flex items-start gap-1.5 text-xs"
                  style={{ color: urlCheck.ok ? 'var(--color-accent)' : 'var(--color-credit)' }}
                >
                  {urlCheck.ok ? <IconCheck size={13} className="mt-px shrink-0" /> : <IconAlert size={13} className="mt-px shrink-0" />}
                  <span>{urlCheck.reason}</span>
                </p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="group">Google Group (if your track uses one)</label>
              <input
                id="group" className="input" value={googleGroup}
                onChange={(e) => setGoogleGroup(e.target.value)}
                placeholder="ledgerly-testers@googlegroups.com"
              />
              {!hasEntry && (
                <p className="mt-1.5 text-xs text-[var(--color-dim)]">
                  One of these two is required. Without it, nobody can reach your closed track.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="tagline">Tagline</label>
                <input id="tagline" className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Expense tracking that takes four seconds" />
              </div>
              <div>
                <label className="label" htmlFor="category">Category</label>
                <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Choose one</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <span className="label">What should testers focus on</span>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((area) => {
                  const on = focusAreas.includes(area);
                  return (
                    <button
                      key={area}
                      type="button"
                      className="pill"
                      onClick={() => setFocusAreas((prev) => on ? prev.filter((a) => a !== area) : [...prev, area])}
                      style={
                        on
                          ? { color: 'var(--color-accent)', borderColor: 'color-mix(in oklab, var(--color-accent) 32%, transparent)', background: 'color-mix(in oklab, var(--color-accent) 10%, transparent)' }
                          : { color: 'var(--color-dim)', borderColor: 'var(--color-line)', background: 'var(--color-surface-2)' }
                      }
                    >
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="instructions">Tester instructions</label>
              <textarea
                id="instructions" className="input" rows={4} value={testerInstructions}
                onChange={(e) => setTesterInstructions(e.target.value)}
                placeholder="Open the app once a day. Add at least one expense on the first run. If the sync banner appears, tell me what it said."
              />
              <p className="mt-1.5 text-xs text-[var(--color-mute)]">
                Testers read this every day for two weeks. Two or three concrete asks beat a paragraph of context.
              </p>
            </div>
          </div>
        )}

        <Note feedback={feedback} />

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending}
          >
            Back
          </button>

          <div className="flex items-center gap-3">
            <Pill tone="neutral">Step {step + 1} of {STEPS.length}</Pill>
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary" disabled={!stepOk} onClick={() => setStep((s) => s + 1)}>
                Continue <IconArrow size={15} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={!stepOk || pending} onClick={() => void submit()}>
                {pending && <Spinner />}
                {pending ? 'Saving' : 'Finish setup'}
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
