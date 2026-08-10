'use client';

import * as React from 'react';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { requestRescueSeat } from '@/app/(app)/actions';
import { CreditChip } from '@/components/ui';

/**
 * A seat went quiet on day 9. This is the button that fixes it, and it always
 * tells the developer the price and the shortfall before they press it.
 */
export function RescueButton({
  appId,
  price,
  balance,
  compact = false,
}: {
  appId: string;
  price: number;
  balance: number;
  compact?: boolean;
}) {
  const { pending, feedback, run } = useAction();
  const short = Math.max(0, price - balance);
  const affordable = short === 0;

  return (
    <div className="mt-2">
      <button
        type="button"
        className={compact ? 'btn btn-secondary w-full' : 'btn btn-secondary'}
        disabled={!affordable || pending}
        title={affordable ? `Costs ${price} credits` : `You need ${short} more credits`}
        onClick={() => void run(() => requestRescueSeat(appId))}
      >
        {pending && <Spinner />}
        <span>{pending ? 'Requesting' : 'Request rescue tester'}</span>
        {!pending && (
          <span className="inline-flex items-center" aria-hidden>
            <CreditChip amount={price} size="sm" />
          </span>
        )}
      </button>
      {!affordable && (
        <p className="mt-1 text-[11px] text-[var(--color-mute)]">
          <span className="num">{short}</span> more credits needed. Test another app to earn them.
        </p>
      )}
      <Note feedback={feedback} />
    </div>
  );
}
