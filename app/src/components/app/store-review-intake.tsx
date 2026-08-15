'use client';

/**
 * TESTERPOOL — the publisher's store-review opt-in.
 *
 * A deliberately separate switch from `ActivityIntake`. Opting into closed-track
 * testers and opting into paid public reviews are different decisions with
 * different consequences, and one control that did both would let a publisher
 * turn this on without meaning to.
 *
 * It is also the only control in this product that states a risk rather than a
 * price. Everything else here can be undone by flipping the same switch back;
 * a published review cannot be, and the account it is attached to is the
 * publisher's own. Saying so at the point of the decision is the whole reason
 * this reads the way it does.
 */

import * as React from 'react';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { cx } from '@/components/ui';
import { setStoreReviewIntake } from '@/app/(app)/actions';

export function StoreReviewIntake({
  appId,
  accepting,
  hasStoreListing,
}: {
  appId: string;
  accepting: boolean;
  hasStoreListing: boolean;
}) {
  const { pending, feedback, run } = useAction();
  const [open, setOpen] = React.useState(accepting);
  const [confirming, setConfirming] = React.useState(false);

  function commit(next: boolean) {
    const previous = open;
    setOpen(next);
    setConfirming(false);
    void run(() => setStoreReviewIntake(appId, next), { refresh: false }).then((r) => {
      if (!r.ok) setOpen(previous);
    });
  }

  if (!hasStoreListing) {
    return (
      <div className="border-t border-[var(--color-line)] px-4 py-3">
        <p className="text-[13px] text-[var(--color-mute)]">
          Store reviews need a public store listing on this app. Add one and the switch appears.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--color-line)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold">Public store reviews</div>
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-mute)]">
            {open
              ? 'Testers install from your public listing and publish a review you approve.'
              : 'Off. Only closed-track testers can take this app on.'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label="Accept public store reviews"
          disabled={pending}
          onClick={() => (open ? commit(false) : setConfirming(true))}
          className={cx(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
            pending && 'opacity-60'
          )}
          style={{ background: open ? 'var(--color-credit)' : 'var(--color-line-hi)' }}
        >
          <span
            className="inline-block h-5 w-5 rounded-full bg-white transition-transform"
            style={{ transform: open ? 'translateX(26px)' : 'translateX(4px)' }}
          />
        </button>
      </div>

      {/*
        The one confirmation in this product that is not about money. Turning
        this on asks other developers to put their own store accounts behind
        your app, and neither they nor you can take that back afterwards.
      */}
      {confirming && (
        <div
          className="mt-3 rounded-xl border p-3"
          style={{
            borderColor: 'color-mix(in oklab, var(--color-credit) 45%, transparent)',
            background: 'var(--color-credit-soft)',
          }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: '#9A6510' }}>
            Testers will install from your public listing and publish reviews under their own
            names, paid for in credits. Under Google Play&rsquo;s Ratings, Reviews and Installs
            policy and Apple&rsquo;s Guideline 1.2 that is an incentivised review — the risk is to
            their accounts and to yours, and a published review cannot be withdrawn by switching
            this back off.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn btn-secondary flex-1 text-[13px]"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-credit flex-1 text-[13px]"
              disabled={pending}
              onClick={() => commit(true)}
            >
              {pending && <Spinner />} I understand — turn it on
            </button>
          </div>
        </div>
      )}

      <Note feedback={feedback} />
    </div>
  );
}
