'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { StreakStrip, cx, type DayState } from '@/components/ui';
import { Spinner } from '@/components/app/action-button';
import { IconCheck } from '@/components/app/icons';
import { submitCheckin } from '@/app/(app)/actions';

/**
 * The single most repeated interaction in the product: fourteen presses over
 * fourteen days. It commits optimistically — the strip fills the instant you
 * press — and rolls back with a specific reason if the server disagrees.
 *
 * No credit figure on the button. A check-in pays nothing directly; it protects
 * the reliability score that decides whether you can join a pod at all, which
 * is a far bigger number than five credits ever was.
 */
export function CheckInButton({
  assignmentId,
  days,
  currentDay,
  total,
  alreadyToday,
  disabled,
  disabledReason,
}: {
  assignmentId: string;
  days: DayState[];
  currentDay: number;
  total: number;
  alreadyToday: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const done = alreadyToday || optimistic;

  const shown: DayState[] = React.useMemo(() => {
    if (!optimistic || currentDay < 1) return days;
    const next = days.slice();
    next[currentDay - 1] = 'done';
    return next;
  }, [days, optimistic, currentDay]);

  async function check() {
    setOptimistic(true);
    setPending(true);
    setError(null);
    try {
      const result = await submitCheckin(assignmentId);
      if (!result.ok) {
        // 'already checked in' is not a rollback: the day really is done.
        if (result.error !== 'already_checked_in_today') setOptimistic(false);
        setError(result.message ?? 'Check-in failed.');
      } else {
        router.refresh();
      }
    } catch {
      setOptimistic(false);
      setError('Network error. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <StreakStrip days={shown} total={total} size={12} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cx('btn', done ? 'btn-secondary' : 'btn-primary')}
          disabled={done || pending || disabled}
          title={disabled ? disabledReason : undefined}
          onClick={() => void check()}
        >
          {pending && <Spinner />}
          {done ? (
            <>
              <IconCheck size={15} /> Checked in today
            </>
          ) : (
            <>Check in today</>
          )}
        </button>
        {done && !error && (
          <span className="animate-pop text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
            Day {Math.max(currentDay, 1)} logged
          </span>
        )}
      </div>
      {disabled && disabledReason && (
        <p className="text-xs text-[var(--color-mute)]">{disabledReason}</p>
      )}
      {error && <p role="status" className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  );
}
