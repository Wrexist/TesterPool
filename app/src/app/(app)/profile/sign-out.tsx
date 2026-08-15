'use client';

import * as React from 'react';
import { signOut } from '@/app/(app)/actions';

/**
 * Sign out, with the one confirmation step it deserves.
 *
 * A single tap on a full-width destructive button at the bottom of a scrolling
 * list is a tap people make by accident, and the cost of the accident is a
 * magic-link round trip through an inbox. The second tap is cheap; losing your
 * session on a train is not.
 */
export function SignOutButton() {
  const [armed, setArmed] = React.useState(false);
  const [pending, start] = React.useTransition();

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="btn btn-secondary w-full py-3 text-[15px]"
        style={{ color: 'var(--color-danger)' }}
      >
        Sign out
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="btn btn-secondary flex-1 py-3 text-[15px]"
        disabled={pending}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => start(() => void signOut())}
        className="btn btn-danger flex-1 py-3 text-[15px]"
        disabled={pending}
      >
        {pending ? 'Signing out' : 'Yes, sign out'}
      </button>
    </div>
  );
}
