'use client';

/**
 * TESTERPOOL — the owner's two activity controls.
 *
 * `accepting_activities` and `activity_target` decide whether strangers may pick
 * this app up and how many at once. They shipped as columns with defaults and no
 * UI, which meant a developer was consenting to something they had never been
 * shown. This is where they are shown.
 *
 * Stated as money, not as settings. "5 testers" means nothing on its own; "5
 * testers, 200 credits" is the decision the developer is actually making, and
 * it is the number that stops the target being nudged upwards without thought.
 *
 * Optimistic, because both controls are instant on the server and a toggle that
 * waits for a round trip before moving reads as broken. The server's answer
 * still wins — `onResult` reconciles — so a refusal snaps back rather than
 * leaving the UI claiming something the database did not do.
 */

import * as React from 'react';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { CreditChip, cx } from '@/components/ui';
import { setActivityIntake } from '@/app/(app)/actions';
import { CHARGE } from '@/lib/economy';

/** What one tester's full run costs the owner: the install and the report. */
const PER_TESTER = CHARGE.install + CHARGE.review;

const MIN_TARGET = 0;
const MAX_TARGET = 50;

export function ActivityIntake({
  appId,
  accepting,
  target,
  seatsLeft,
}: {
  appId: string;
  accepting: boolean;
  target: number;
  seatsLeft?: number | null;
}) {
  const { pending, feedback, run } = useAction();
  // Seeded from props and owned locally from then on. When the server sends
  // different values — a revalidate triggered by something else on the page —
  // the parent remounts this component with a new key rather than syncing in an
  // effect, so there is never a moment where local state and props disagree.
  const [open, setOpen] = React.useState(accepting);
  const [seats, setSeats] = React.useState(target);

  function commit(next: { accepting?: boolean; target?: number }) {
    // Kept so a refusal can be undone. `refresh: false` means no parent remount
    // is coming to correct the optimistic value, so without this the control
    // would go on showing a setting the database never accepted.
    const previous = { accepting: open, target: seats };

    if (next.accepting !== undefined) setOpen(next.accepting);
    if (next.target !== undefined) setSeats(next.target);

    void run(() => setActivityIntake(appId, next), {
      refresh: false,
      onOk: (result) => {
        const row = result.data as { accepting?: boolean; target?: number } | undefined;
        if (typeof row?.accepting === 'boolean') setOpen(row.accepting);
        if (typeof row?.target === 'number') setSeats(row.target);
      },
    }).then((result) => {
      if (!result.ok) {
        setOpen(previous.accepting);
        setSeats(previous.target);
      }
    });
  }

  const step = (delta: number) => {
    const next = Math.min(MAX_TARGET, Math.max(MIN_TARGET, seats + delta));
    if (next !== seats) commit({ target: next });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-line)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            Open to testers
            {pending && <Spinner size={12} />}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-mute)]">
            {open
              ? 'Anyone here can join your closed test, use the app and send you one report.'
              : 'Nobody new can pick this app up. Testers already on it keep their seat and still get paid.'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label="Open to testers"
          disabled={pending}
          onClick={() => commit({ accepting: !open })}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60"
          style={{
            background: open
              ? 'var(--color-accent)'
              : 'color-mix(in oklab, var(--color-ink) 18%, transparent)',
          }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-[var(--color-ink)] transition-[left]"
            style={{ left: open ? '1.375rem' : '0.125rem' }}
          />
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">How many at once</div>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-mute)]">
              <span className="num font-semibold text-[var(--color-dim)]">{seats}</span>
              {seats === 1 ? 'tester' : 'testers'} ·
              <CreditChip amount={seats * PER_TESTER} size="sm" /> if every one of them finishes
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Stepper label="Fewer testers" onClick={() => step(-1)} disabled={pending || seats <= MIN_TARGET}>
              &minus;
            </Stepper>
            <span className="num w-8 text-center text-sm font-semibold">{seats}</span>
            <Stepper label="More testers" onClick={() => step(1)} disabled={pending || seats >= MAX_TARGET}>
              +
            </Stepper>
          </div>
        </div>
      )}

      {open && typeof seatsLeft === 'number' && (
        <p className="text-xs text-[var(--color-mute)]">
          {seatsLeft > 0 ? (
            <>
              <span className="num font-semibold text-[var(--color-dim)]">{seatsLeft}</span>{' '}
              {seatsLeft === 1 ? 'seat' : 'seats'} unclaimed right now.
            </>
          ) : (
            'Every seat is taken. Raise the number to let more testers in.'
          )}
        </p>
      )}

      <Note feedback={feedback} className="mt-0" />
    </div>
  );
}

function Stepper({
  label, onClick, disabled, children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex h-7 w-7 items-center justify-center rounded-lg border text-base leading-none',
        'border-[var(--color-line)] hover:border-[var(--color-line-hi)]',
        'disabled:cursor-not-allowed disabled:opacity-40'
      )}
    >
      {children}
    </button>
  );
}
