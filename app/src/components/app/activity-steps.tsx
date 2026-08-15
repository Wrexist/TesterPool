/**
 * TESTERPOOL — the job, as three numbered steps.
 *
 * The work a tester does has always been three things: get into the closed
 * track, use the app, tell the developer what happened. Until now those three
 * lived on four different screens — the marketplace, /tests, /tests/[id]/optin
 * and /tests/[id]/feedback — and no single screen said what the job was or what
 * it paid. A developer had to assemble that from navigation.
 *
 * This is the assembly: one strip, three steps, the reward attached to the whole
 * thing, and the current step carrying the only button.
 */

import Link from 'next/link';
import { cx } from '@/components/ui';
import { IconCheck } from '@/components/app/icons';

export type StepState = 'done' | 'current' | 'locked';

export interface Step {
  label: string;
  state: StepState;
  /** Shown under the strip when this is the current step. */
  detail?: string;
  action?: { href: string; label: string; external?: boolean };
}

export function ActivitySteps({ steps }: { steps: Step[] }) {
  const current = steps.find((s) => s.state === 'current');

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex items-start">
        {steps.map((step, i) => {
          const done = step.state === 'done';
          const now = step.state === 'current';
          /*
           * Three states, three treatments, and only one of them is filled. A
           * strip where every circle is tinted tells a reader nothing about
           * where they are; the single filled dot is the whole point of it.
           */
          const railOn = done || now;

          return (
            <li key={step.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                {/* Half-width rails either side of the dot, so the line meets
                    the circle instead of running under it. */}
                <span
                  className={cx('h-[2px] flex-1 rounded-full', i === 0 && 'opacity-0')}
                  style={{ background: railOn ? 'var(--color-accent)' : 'var(--color-line)' }}
                />
                <span
                  className="num inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{
                    color: done || now ? '#fff' : 'var(--color-mute)',
                    background: done || now ? 'var(--color-accent)' : 'var(--color-surface)',
                    border: done || now ? 'none' : '2px solid var(--color-line)',
                  }}
                >
                  {done ? <IconCheck size={15} /> : i + 1}
                </span>
                <span
                  className={cx('h-[2px] flex-1 rounded-full', i === steps.length - 1 && 'opacity-0')}
                  style={{ background: done ? 'var(--color-accent)' : 'var(--color-line)' }}
                />
              </div>
              <span
                className="max-w-full truncate text-[13px] font-semibold"
                style={{ color: done || now ? 'var(--color-ink)' : 'var(--color-mute)' }}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {current?.detail && (
        <p className="text-[14px] leading-relaxed text-[var(--color-dim)]">{current.detail}</p>
      )}

      {current?.action && (
        current.action.external ? (
          <a
            href={current.action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full py-3 text-[15px]"
          >
            {current.action.label}
          </a>
        ) : (
          <Link href={current.action.href} className="btn btn-primary w-full py-3 text-[15px]">
            {current.action.label}
          </Link>
        )
      )}
    </div>
  );
}
