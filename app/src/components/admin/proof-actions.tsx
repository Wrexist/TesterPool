'use client';

/**
 * TESTERPOOL — proof review from the admin surface.
 *
 * Same decision as the moderator queue, routed through `admin_review_proof` so
 * the review lands in the audit log with a name against it. Approving is one
 * click because approving is the safe direction; rejecting takes a reason,
 * because the tester reads it and loses the escrowed credit.
 */

import * as React from 'react';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { adminReviewProof } from '@/app/(app)/admin/actions';
import { reasonTooShort } from '@/lib/admin';

export function AdminProofActions({ proofId }: { proofId: string }) {
  const { pending, feedback, run } = useAction();
  const [reason, setReason] = React.useState('');
  const [settled, setSettled] = React.useState(false);
  const shortReason = reasonTooShort(reason);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || settled}
          onClick={() =>
            void run(() => adminReviewProof(proofId, true, '')).then((r) => {
              if (r.ok) setSettled(true);
            })
          }
        >
          {pending && <Spinner />} Approve
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending || settled || shortReason}
          title={shortReason ? 'A rejection needs a reason of at least five characters.' : undefined}
          onClick={() =>
            void run(() => adminReviewProof(proofId, false, reason)).then((r) => {
              if (r.ok) setSettled(true);
            })
          }
        >
          Reject
        </button>
      </div>
      <input
        className="input mt-2"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Rejection reason. The tester reads this."
        disabled={settled}
      />
      <Note feedback={feedback} />
    </div>
  );
}
