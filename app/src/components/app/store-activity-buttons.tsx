'use client';

/**
 * TESTERPOOL — the two priced actions on a store listing.
 *
 * Both steps are shown at once, and priced, because the decision a member is
 * making is about the pair: forty credits for an install and a published
 * review. Showing only "Install +10" and revealing the rest afterwards would
 * be quoting half the job.
 *
 * Only the first is a button. The review is a step, not a choice — it unlocks
 * when the install is confirmed, and drawing it as a second live button would
 * offer an action that `submit_store_review` refuses. It is styled as what it
 * is: the next thing, with its price attached.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { StarGlyph } from '@/components/app/app-row';
import { IconCheck, IconArrow } from '@/components/app/icons';
import { cx } from '@/components/ui';
import { startStoreActivity } from '@/app/(app)/actions';

type Stage = 'none' | 'installed' | 'reported';

function PriceRow({
  n: step, title, sub, amount, state,
}: {
  n: number;
  title: string;
  sub: string;
  amount: number;
  state: 'done' | 'now' | 'next';
}) {
  const done = state === 'done';
  const now = state === 'now';

  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-2xl px-4 py-3',
        now ? 'bg-[var(--color-accent-soft)]' : 'bg-[var(--color-surface-2)]'
      )}
    >
      <span
        className="num inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
        style={{
          background: done || now ? 'var(--color-accent)' : 'transparent',
          color: done || now ? '#fff' : 'var(--color-mute)',
          border: done || now ? 'none' : '2px solid var(--color-line-hi)',
        }}
      >
        {done ? <IconCheck size={15} /> : step}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-tight">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-[var(--color-mute)]">{sub}</span>
      </span>

      <span
        className="num inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-bold"
        style={{
          background: now ? '#fff' : 'var(--color-accent-soft)',
          color: 'var(--color-accent)',
        }}
      >
        <StarGlyph size={12} />+{amount}
      </span>
    </div>
  );
}

export function StoreActivityButtons({
  appId, assignmentId, stage, installReward, reviewReward,
}: {
  appId: string;
  /** Set once a seat exists, which is what turns this into a router. */
  assignmentId: string | null;
  stage: Stage;
  installReward: number;
  reviewReward: number;
}) {
  const router = useRouter();
  const { pending, feedback, run } = useAction();

  async function start() {
    const result = await run(() => startStoreActivity(appId), { refresh: false });
    const id = (result.data as { assignment_id?: string } | undefined)?.assignment_id;
    if (result.ok && id) router.push(`/tests/${id}/optin`);
    else if (result.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-2.5">
      <PriceRow
        n={1}
        title="Install it"
        sub="From the public store listing, then upload the screenshot"
        amount={installReward}
        state={stage === 'none' ? 'now' : 'done'}
      />
      <PriceRow
        n={2}
        title="Review it"
        sub="Publish an honest review and screenshot it"
        amount={reviewReward}
        state={stage === 'reported' ? 'done' : stage === 'installed' ? 'now' : 'next'}
      />

      {stage === 'none' && (
        <button
          type="button"
          className="btn btn-primary w-full py-3.5 text-[15px]"
          disabled={pending}
          onClick={() => void start()}
        >
          {pending && <Spinner />}
          {pending ? 'Taking it' : `Take this job — earn ${installReward + reviewReward}`}
        </button>
      )}

      {stage === 'installed' && assignmentId && (
        <button
          type="button"
          className="btn btn-primary w-full py-3.5 text-[15px]"
          onClick={() => router.push(`/tests/${assignmentId}/store-review`)}
        >
          Write your review <IconArrow size={16} />
        </button>
      )}

      {stage === 'reported' && (
        <p className="px-1 text-center text-[13px] leading-relaxed text-[var(--color-mute)]">
          Filed. The publisher approves it and the credits move, or a moderator settles it.
        </p>
      )}

      <Note feedback={feedback} />
    </div>
  );
}
