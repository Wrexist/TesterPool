'use client';

import * as React from 'react';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { spendCredits } from '@/app/(app)/actions';
import { CreditChip } from '@/components/ui';

export function SpendButton({
  configKey, price, balance, label,
}: {
  configKey: string;
  price: number;
  balance: number;
  label: string;
}) {
  const { pending, feedback, run } = useAction();
  const [bought, setBought] = React.useState(false);
  const short = Math.max(0, price - balance);

  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary w-full justify-between"
        disabled={pending || bought || short > 0}
        title={short > 0 ? `You need ${short} more credits` : `Costs ${price} credits`}
        onClick={() => void run(() => spendCredits(configKey)).then((r) => { if (r.ok) setBought(true); })}
      >
        <span className="inline-flex items-center gap-2">
          {pending && <Spinner />}
          {pending ? 'Buying' : bought ? 'Bought' : label}
        </span>
        <CreditChip amount={price} size="sm" />
      </button>
      {short > 0 && (
        <p className="mt-1 text-[11px] text-[var(--color-mute)]">
          <span className="num">{short}</span> more credits needed.
        </p>
      )}
      <Note feedback={feedback} />
    </div>
  );
}
