'use client';

/**
 * TESTERPOOL — the dashed "add a screenshot to claim" target.
 *
 * It looks like one control because to the reader it is one: I installed it,
 * here is the proof. Underneath it is either one step or two, and which one
 * depends on whether a seat already exists.
 *
 * When it does, this is a link to the upload page and nothing more. When it
 * does not, the seat has to be taken first — and taking a seat is what checks
 * the publisher's consent, their remaining places and their balance, so it
 * cannot be skipped or done afterwards. Doing it on this tap rather than on an
 * earlier one is the whole point: nobody should have to press "start" on a job
 * before they are allowed to see what the job is.
 *
 * `store` picks which door. A store activity is an install from the public
 * listing and a closed-track activity is an opt-in; they are different RPCs
 * with different guards, and the page above knows which applies because it
 * asked `store_review_open`.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { IconUpload } from '@/components/app/icons';
import { startActivity, startStoreActivity } from '@/app/(app)/actions';

export function ClaimStep({
  appId, assignmentId, store, body,
}: {
  appId: string;
  assignmentId: string | null;
  store: boolean;
  body: string;
}) {
  const router = useRouter();
  const { pending, feedback, run } = useAction();

  async function claim() {
    if (assignmentId) {
      router.push(`/tests/${assignmentId}/optin`);
      return;
    }
    const result = await run(
      () => (store ? startStoreActivity(appId) : startActivity(appId)),
      { refresh: false },
    );
    const id = (result.data as { assignment_id?: string } | undefined)?.assignment_id;
    if (result.ok && id) router.push(`/tests/${id}/optin`);
    else if (result.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void claim()}
        disabled={pending}
        className="card-dashed block w-full px-5 py-6 text-center disabled:opacity-70"
      >
        <span
          className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
        >
          {pending ? <Spinner /> : <IconUpload size={19} />}
        </span>
        <span className="block text-[16px] font-bold">
          {pending ? 'Taking your seat' : 'Add a screenshot to claim'}
        </span>
        <span className="mx-auto mt-2 block max-w-md text-[13px] leading-relaxed text-[var(--color-mute)]">
          {body}
        </span>
      </button>
      <Note feedback={feedback} />
    </div>
  );
}
