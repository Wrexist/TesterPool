'use client';

/**
 * TESTERPOOL — save an app to your list.
 *
 * Optimistic, because it is a bookmark: the icon fills on click and reverts if
 * the write fails. Anything that moves credits gets the pending-then-confirmed
 * treatment instead; this does not, and making a bookmark feel like a purchase
 * would be its own kind of lie.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cx } from '@/components/ui';
import { IconBookmark } from '@/components/app/icons';
import { setWatching } from '@/app/(app)/actions';

export function SaveButton({
  appId,
  initial,
  variant = 'icon',
}: {
  appId: string;
  initial: boolean;
  variant?: 'icon' | 'full';
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The server is the source of truth: if a navigation brings a different
  // answer back, take it.
  const [lastInitial, setLastInitial] = React.useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setSaved(initial);
  }

  async function toggle(event: React.MouseEvent) {
    // Cards wrap this button in a link to the app.
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;

    const next = !saved;
    setSaved(next);
    setPending(true);
    setError(null);

    const result = await setWatching(appId, next);
    setPending(false);

    if (!result.ok) {
      setSaved(!next);
      setError(result.message ?? 'Could not save that.');
      return;
    }
    router.refresh();
  }

  const label = saved ? 'Saved. Click to remove' : 'Save for later';

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        className="btn btn-secondary"
        title={error ?? label}
      >
        <IconBookmark size={15} filled={saved} />
        {saved ? 'Saved' : 'Save'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={label}
      title={error ?? label}
      className={cx(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
        saved
          ? 'border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)] text-[var(--color-accent)]'
          : 'border-[var(--color-line)] text-[var(--color-mute)] hover:border-[var(--color-line-hi)] hover:text-[var(--color-ink)]'
      )}
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      <IconBookmark size={15} filled={saved} />
    </button>
  );
}
