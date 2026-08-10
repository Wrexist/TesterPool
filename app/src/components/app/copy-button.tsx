'use client';

import * as React from 'react';
import { IconCopy, IconCheck } from '@/components/app/icons';

/** Copy to clipboard with a confirmed state. Falls back to select-and-copy. */
export function CopyButton({
  value,
  label = 'Copy',
  doneLabel = 'Copied',
  className = 'btn btn-secondary',
  size = 15,
}: {
  value: string;
  label?: string;
  doneLabel?: string;
  className?: string;
  size?: number;
}) {
  const [state, setState] = React.useState<'idle' | 'done' | 'error'>('idle');

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const el = document.createElement('textarea');
        el.value = value;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setState('done');
      setTimeout(() => setState('idle'), 2200);
    } catch {
      setState('error');
    }
  }

  return (
    <button type="button" className={className} onClick={() => void copy()}>
      {state === 'done' ? <IconCheck size={size} /> : <IconCopy size={size} />}
      {state === 'done' ? doneLabel : state === 'error' ? 'Press Ctrl C' : label}
    </button>
  );
}
