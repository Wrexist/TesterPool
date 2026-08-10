'use client';

import * as React from 'react';
import { CopyButton } from '@/components/app/copy-button';
import { CreditChip } from '@/components/ui';
import { EARN } from '@/lib/economy';
import { referralLink } from '@/lib/pods';

/**
 * Pods fill faster when members bring people. The referrer is paid on the
 * referee's first completed pod, not on signup, which is why this can be shown
 * everywhere without turning into a spam engine.
 */
export function InvitePanel({
  code,
  headline = 'Fill your pod faster',
  body = 'Every developer you bring is another seat filled. You are paid when they finish their first pod, so the invite is only worth sending to someone who will actually test.',
  referrals,
  titheEarned,
}: {
  code: string;
  headline?: string;
  body?: string;
  referrals?: number;
  titheEarned?: number;
}) {
  // The link has to carry the origin the user is actually on, which only the
  // browser knows. On the server it falls back to the configured site URL.
  const origin = React.useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ''
  );
  const link = referralLink(code, origin || undefined);

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
      <h3 className="text-sm font-semibold">{headline}</h3>
      <p className="mt-1 text-sm text-[var(--color-dim)]">{body}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-dim)]">
          {link}
        </code>
        <CopyButton value={link} label="Copy invite link" doneLabel="Link copied" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-mute)]">
        <span className="inline-flex items-center gap-1.5">
          You earn <CreditChip amount={EARN.referralReferrer} size="sm" />
        </span>
        <span className="inline-flex items-center gap-1.5">
          They earn <CreditChip amount={EARN.referralReferee} size="sm" />
        </span>
        <span>
          Plus <span className="num">{EARN.referralTithePct}%</span> of everything they earn, forever
        </span>
        {typeof referrals === 'number' && (
          <span><span className="num">{referrals}</span> joined so far</span>
        )}
        {typeof titheEarned === 'number' && titheEarned > 0 && (
          <span className="inline-flex items-center gap-1.5">
            Tithe earned <CreditChip amount={titheEarned} size="sm" />
          </span>
        )}
      </div>
    </div>
  );
}
