'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, cx } from '@/components/ui';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { submitFeedback } from '@/app/(app)/actions';
import { EARN } from '@/lib/economy';

const RUBRIC = [
  { key: 'usability', label: 'Usability', hint: 'Could you do what the app is for without guessing?' },
  { key: 'performance', label: 'Performance', hint: 'Speed, jank, battery, crashes.' },
  { key: 'clarity', label: 'Clarity', hint: 'Did the screens explain themselves?' },
] as const;

const SEVERITY = [
  { value: 0, label: 'No issue', note: 'Nothing broke.' },
  { value: 1, label: 'Minor', note: 'Cosmetic or easily avoided.' },
  { value: 2, label: 'Significant', note: 'Blocks a real task, has a workaround.' },
  { value: 3, label: 'Blocker', note: 'Crash or dead end. Pays a bug bounty.' },
];

function Rubric({
  label, hint, value, onChange,
}: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label mb-1">{label}</span>
        <span className="text-[11px] text-[var(--color-mute)]">{hint}</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((score) => {
          const on = value === score;
          return (
            <button
              key={score}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(score)}
              className={cx(
                'num h-10 flex-1 rounded-lg border text-sm font-bold transition-colors',
                on ? 'border-transparent' : 'border-[var(--color-line)] text-[var(--color-dim)] hover:border-[var(--color-line-hi)]'
              )}
              style={on ? { background: 'var(--color-accent)', color: '#FFFFFF' } : { background: 'var(--color-bg)' }}
            >
              {score}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FeedbackForm({
  assignmentId, appId, appName, focusAreas, instructions,
}: {
  assignmentId: string;
  appId: string;
  appName: string;
  focusAreas: string[];
  instructions: string | null;
}) {
  const router = useRouter();
  const { pending, feedback, run } = useAction();

  const [usability, setUsability] = React.useState(0);
  const [performance, setPerformance] = React.useState(0);
  const [clarity, setClarity] = React.useState(0);
  const [firstImpression, setFirstImpression] = React.useState('');
  const [whatWorked, setWhatWorked] = React.useState('');
  const [whatBroke, setWhatBroke] = React.useState('');
  const [reproSteps, setReproSteps] = React.useState('');
  const [suggestion, setSuggestion] = React.useState('');
  const [severity, setSeverity] = React.useState(0);
  const [deviceModel, setDeviceModel] = React.useState('');
  const [osVersion, setOsVersion] = React.useState('');
  const [sent, setSent] = React.useState(false);

  const scoresSet = usability > 0 && performance > 0 && clarity > 0;
  const longEnough = firstImpression.trim().length >= 20;
  const reproOk = severity < 2 || reproSteps.trim().length > 0;
  const ready = scoresSet && longEnough && reproOk && !!deviceModel.trim();

  async function send() {
    const result = await run(
      () =>
        submitFeedback({
          assignmentId, appId,
          scoreUsability: usability, scorePerformance: performance, scoreClarity: clarity,
          firstImpression, whatWorked, whatBroke, reproSteps, suggestion, severity,
          deviceModel, osVersion,
        }),
      { refresh: false }
    );
    if (result.ok) {
      setSent(true);
      router.refresh();
      setTimeout(() => router.push('/tests'), 1200);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: 'color-mix(in oklab, var(--color-violet) 28%, transparent)',
          background: 'color-mix(in oklab, var(--color-violet) 7%, transparent)',
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-violet)' }}>
          This report is private to the developer
        </h2>
        <p className="mt-1 text-sm text-[var(--color-dim)]">
          It is never published, never becomes a store review or rating, and is never connected to any public
          surface. Critical feedback is paid exactly the same as praise: {EARN.feedbackApproved} credits for a
          specific, on-rubric report. If a developer disputes a report because they did not like it, a
          moderator reads it and pays you anyway.
        </p>
      </div>

      <Card className="flex flex-col gap-6 p-6">
        {(focusAreas.length > 0 || instructions) && (
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">
              What {appName} asked you to look at
            </div>
            {focusAreas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {focusAreas.map((area) => (
                  <span key={area} className="pill" style={{ color: 'var(--color-dim)', borderColor: 'var(--color-line)', background: 'var(--color-bg)' }}>
                    {area}
                  </span>
                ))}
              </div>
            )}
            {instructions && <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-dim)]">{instructions}</p>}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {RUBRIC.map((r) => (
            <Rubric
              key={r.key}
              label={r.label}
              hint={r.hint}
              value={r.key === 'usability' ? usability : r.key === 'performance' ? performance : clarity}
              onChange={r.key === 'usability' ? setUsability : r.key === 'performance' ? setPerformance : setClarity}
            />
          ))}
        </div>

        <div>
          <label className="label" htmlFor="first">First impression</label>
          <textarea
            id="first" className="input" rows={3} value={firstImpression}
            onChange={(e) => setFirstImpression(e.target.value)}
            placeholder="What you expected on opening it, and what actually happened in the first minute."
          />
          <p className="mt-1 text-xs text-[var(--color-mute)]">
            <span className="num">{firstImpression.trim().length}</span> characters. At least 20.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="worked">What worked</label>
            <textarea id="worked" className="input" rows={3} value={whatWorked}
                      onChange={(e) => setWhatWorked(e.target.value)}
                      placeholder="Be specific. 'The onboarding' helps nobody." />
          </div>
          <div>
            <label className="label" htmlFor="broke">What broke</label>
            <textarea id="broke" className="input" rows={3} value={whatBroke}
                      onChange={(e) => setWhatBroke(e.target.value)}
                      placeholder="The screen, the action, the result you got." />
          </div>
        </div>

        <div>
          <span className="label">Severity</span>
          <div className="grid gap-2 sm:grid-cols-4">
            {SEVERITY.map((s) => {
              const on = severity === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSeverity(s.value)}
                  className={cx(
                    'rounded-lg border px-3 py-2 text-left transition-colors',
                    on ? 'border-transparent' : 'border-[var(--color-line)] hover:border-[var(--color-line-hi)]'
                  )}
                  style={
                    on
                      ? {
                          background: `color-mix(in oklab, ${s.value >= 2 ? 'var(--color-danger)' : 'var(--color-accent)'} 14%, transparent)`,
                          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${s.value >= 2 ? 'var(--color-danger)' : 'var(--color-accent)'} 45%, transparent)`,
                        }
                      : { background: 'var(--color-bg)' }
                  }
                >
                  <span className="block text-xs font-bold">{s.label}</span>
                  <span className="mt-0.5 block text-[11px] text-[var(--color-mute)]">{s.note}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="repro">Reproduction steps</label>
          <textarea
            id="repro" className="input" rows={3} value={reproSteps}
            onChange={(e) => setReproSteps(e.target.value)}
            placeholder={'1. Open the app on a cold start\n2. Tap Add\n3. Rotate the device\n4. The sheet closes and the entry is gone'}
          />
          {!reproOk && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-credit)' }}>
              Severity {severity} needs steps a developer can follow. Without them the report cannot be acted on.
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="suggestion">One change you would make</label>
          <textarea id="suggestion" className="input" rows={2} value={suggestion}
                    onChange={(e) => setSuggestion(e.target.value)}
                    placeholder="The single highest-value fix, in your opinion." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="device">Device model</label>
            <input id="device" className="input" value={deviceModel}
                   onChange={(e) => setDeviceModel(e.target.value)} placeholder="Pixel 7a" />
          </div>
          <div>
            <label className="label" htmlFor="os">Android version</label>
            <input id="os" className="input" value={osVersion}
                   onChange={(e) => setOsVersion(e.target.value)} placeholder="Android 15" />
          </div>
        </div>

        <Note feedback={feedback} />

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
          <p className="text-xs text-[var(--color-mute)]">
            Approved reports pay <span className="num">{EARN.feedbackApproved}</span> credits, and a blocker
            with repro steps adds <span className="num">{EARN.bugBountyBlocker}</span>.
          </p>
          <button type="button" className="btn btn-primary" disabled={!ready || pending || sent} onClick={() => void send()}>
            {pending && <Spinner />}
            {pending ? 'Sending' : sent ? 'Sent' : 'Send report'}
          </button>
        </div>
      </Card>
    </div>
  );
}
