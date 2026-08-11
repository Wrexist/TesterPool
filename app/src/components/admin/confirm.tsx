'use client';

/**
 * TESTERPOOL — the confirmation step every destructive admin action goes
 * through.
 *
 * It does three things a bare button cannot: it states the consequences in
 * full before the click, it collects the reason the RPCs require, and it shows
 * the database's own refusal text when the call is rejected. Nothing here
 * fails silently, and nothing destructive happens in one click.
 */

import * as React from 'react';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { IconAlert } from '@/components/app/icons';
import { cx } from '@/components/ui';
import { MIN_REASON, reasonTooShort } from '@/lib/admin';
import type { ActionResult } from '@/lib/types';

export function ConfirmAction({
  label,
  buttonClass = 'btn btn-secondary',
  heading,
  consequences,
  confirmLabel = 'Confirm',
  action,
  requireReason = true,
  reasonPlaceholder = 'Why. This is written to the audit log and cannot be edited later.',
  disabled,
  disabledHint,
  fields,
  onDone,
  compact = false,
}: {
  label: React.ReactNode;
  buttonClass?: string;
  heading: string;
  consequences: string[];
  confirmLabel?: string;
  action: (reason: string) => Promise<ActionResult>;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  disabled?: boolean;
  disabledHint?: string;
  /** Extra inputs owned by the calling island, rendered above the reason box. */
  fields?: React.ReactNode;
  onDone?: () => void;
  compact?: boolean;
}) {
  const { pending, feedback, run } = useAction();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [settled, setSettled] = React.useState(false);

  const shortReason = requireReason && reasonTooShort(reason);

  if (!open) {
    return (
      <div className="inline-flex flex-col items-start">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled}
          title={disabled ? disabledHint : undefined}
          onClick={() => { setOpen(true); setSettled(false); }}
        >
          {label}
        </button>
        {disabled && disabledHint && (
          <span className="mt-1 text-[11px] text-[var(--color-mute)]">{disabledHint}</span>
        )}
        {settled && <Note feedback={feedback} />}
      </div>
    );
  }

  return (
    <div
      className={cx(
        'rounded-xl border bg-[var(--color-surface-2)]',
        compact ? 'p-3' : 'p-4'
      )}
      style={{ borderColor: 'color-mix(in oklab, var(--color-credit) 40%, transparent)' }}
      role="group"
      aria-label={heading}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-[var(--color-credit)]"><IconAlert size={15} /></span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold">{heading}</h4>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-[var(--color-dim)]">
            {consequences.map((c, i) => (
              <li key={i} className="flex gap-1.5">
                <span aria-hidden className="text-[var(--color-mute)]">·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {fields && <div className="mt-3">{fields}</div>}

      {requireReason && (
        <div className="mt-3">
          <label className="label" htmlFor={`reason-${heading.replace(/\W+/g, '-')}`}>
            Reason (at least {MIN_REASON} characters)
          </label>
          <textarea
            id={`reason-${heading.replace(/\W+/g, '-')}`}
            className="input"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending || shortReason}
          onClick={() =>
            void run(() => action(reason)).then((r) => {
              setSettled(true);
              if (r.ok) {
                setOpen(false);
                setReason('');
                onDone?.();
              }
            })
          }
        >
          {pending && <Spinner />}
          {pending ? 'Working' : confirmLabel}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() => { setOpen(false); setReason(''); }}
        >
          Cancel
        </button>
        {shortReason && (
          <span className="text-[11px] text-[var(--color-mute)]">
            The database rejects a reason this short.
          </span>
        )}
      </div>

      <Note feedback={feedback} />
    </div>
  );
}
