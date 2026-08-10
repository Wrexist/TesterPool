'use client';

/**
 * TESTERPOOL — the one button every mutation in the product goes through.
 *
 * It guarantees the three states the design rules demand: pending, error, and
 * a confirmed result. There is no code path where a click does nothing and
 * says nothing.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cx } from '@/components/ui';
import type { ActionResult } from '@/lib/types';
import { IconCheck } from '@/components/app/icons';

export type Feedback = { tone: 'ok' | 'error'; message: string } | null;

export function useAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(null);

  const run = React.useCallback(
    async (fn: () => Promise<ActionResult>, opts?: { refresh?: boolean; onOk?: (r: ActionResult) => void }) => {
      setPending(true);
      setFeedback(null);
      try {
        const result = await fn();
        if (result.ok) {
          setFeedback({ tone: 'ok', message: result.message ?? 'Done.' });
          opts?.onOk?.(result);
          if (opts?.refresh !== false) router.refresh();
        } else {
          setFeedback({ tone: 'error', message: result.message ?? 'That did not work.' });
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong. Try again.';
        setFeedback({ tone: 'error', message });
        return { ok: false, message } satisfies ActionResult;
      } finally {
        setPending(false);
      }
    },
    [router]
  );

  return { pending, feedback, setFeedback, run };
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden
         style={{ animation: 'testerpool-spin .8s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <style>{'@keyframes testerpool-spin{to{transform:rotate(360deg)}}'}</style>
    </svg>
  );
}

export function Note({ feedback, className }: { feedback: Feedback; className?: string }) {
  if (!feedback) return null;
  return (
    <p
      role="status"
      className={cx('mt-2 flex items-start gap-1.5 text-xs', className)}
      style={{ color: feedback.tone === 'ok' ? 'var(--color-accent)' : 'var(--color-danger)' }}
    >
      {feedback.tone === 'ok' && <IconCheck size={13} className="mt-px shrink-0" />}
      <span>{feedback.message}</span>
    </p>
  );
}

export function ActionButton({
  action,
  children,
  pendingLabel = 'Working',
  doneLabel,
  className = 'btn btn-secondary',
  disabled,
  title,
  onResult,
  showNote = true,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  pendingLabel?: string;
  doneLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  onResult?: (r: ActionResult) => void;
  showNote?: boolean;
}) {
  const { pending, feedback, run } = useAction();
  const done = feedback?.tone === 'ok';

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        className={className}
        disabled={disabled || pending || done}
        title={title}
        onClick={() => void run(action, { onOk: onResult })}
      >
        {pending && <Spinner />}
        {pending ? pendingLabel : done ? doneLabel ?? 'Done' : children}
      </button>
      {showNote && <Note feedback={feedback} />}
    </div>
  );
}
