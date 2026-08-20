/**
 * TESTERPOOL — the three steps of an activity, as a rail.
 *
 * Install, Test, Review, drawn as numbered circles joined by a line. It is a
 * map rather than a control: nothing here is clickable, because every step has
 * exactly one place it is actually done and that place is the card underneath.
 * A tracker whose circles are also buttons teaches people to tap the picture
 * and then wonder why nothing happened on the step that is still locked.
 *
 * The number stays visible on a step that is done — a tick alone loses which
 * step it was, and the rail is read as "where am I in three" more often than as
 * "what is finished".
 */

import { cx } from '@/components/ui';
import { IconCheck } from '@/components/app/icons';

export type RailState = 'done' | 'current' | 'locked';

export interface RailStep {
  label: string;
  state: RailState;
}

export function StepRail({ steps }: { steps: RailStep[] }) {
  return (
    <ol className="flex items-start" role="list">
      {steps.map((step, i) => {
        const first = i === 0;
        const last = i === steps.length - 1;
        return (
          <li key={step.label} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {/* The rails are drawn either side of the circle rather than
                  between list items, so the circle stays centred over its own
                  label at every width. The outer halves are hidden rather than
                  omitted, which keeps all three columns the same width. */}
              <Rail on={!first && steps[i - 1].state === 'done'} hidden={first} />
              <Bead step={step} index={i} />
              <Rail on={step.state === 'done'} hidden={last} />
            </div>
            <span
              className={cx(
                'mt-2 text-center text-[13px] leading-tight',
                step.state === 'locked'
                  ? 'text-[var(--color-mute)]'
                  : 'font-semibold text-[var(--color-ink)]',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Rail({ on, hidden }: { on: boolean; hidden?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx('h-[2px] flex-1 rounded-full', hidden && 'invisible')}
      style={{ background: on ? 'var(--color-accent)' : 'var(--color-line)' }}
    />
  );
}

function Bead({ step, index }: { step: RailStep; index: number }) {
  const done = step.state === 'done';
  const current = step.state === 'current';

  return (
    <span
      className={cx(
        'num inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
        !done && !current && 'border',
      )}
      style={
        done || current
          ? { background: 'var(--color-accent)', color: '#fff' }
          : {
              background: 'var(--color-surface)',
              borderColor: 'var(--color-line)',
              color: 'var(--color-mute)',
            }
      }
    >
      {done ? <IconCheck size={15} /> : index + 1}
    </span>
  );
}
