'use client';

import * as React from 'react';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { arbitrateDispute, reviewProof } from '@/app/(app)/actions';

export function ProofActions({ proofId }: { proofId: string }) {
  const { pending, feedback, run } = useAction();
  const [reason, setReason] = React.useState('');
  const [settled, setSettled] = React.useState(false);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button" className="btn btn-primary" disabled={pending || settled}
          onClick={() => void run(() => reviewProof(proofId, true)).then((r) => { if (r.ok) setSettled(true); })}
        >
          {pending && <Spinner />} Approve
        </button>
        <button
          type="button" className="btn btn-danger" disabled={pending || settled}
          onClick={() => void run(() => reviewProof(proofId, false, reason)).then((r) => { if (r.ok) setSettled(true); })}
        >
          Reject
        </button>
      </div>
      <input
        className="input mt-2"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Rejection reason, shown to the tester"
      />
      <Note feedback={feedback} />
    </div>
  );
}

export function DisputeActions({ disputeId }: { disputeId: string }) {
  const { pending, feedback, run } = useAction();
  const [resolution, setResolution] = React.useState('');
  const [settled, setSettled] = React.useState(false);

  return (
    <div className="mt-3">
      <textarea
        className="input"
        rows={2}
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        placeholder="One line of reasoning. The developer and the tester both read this."
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button" className="btn btn-primary" disabled={pending || settled || !resolution.trim()}
          onClick={() => void run(() => arbitrateDispute(disputeId, false, resolution)).then((r) => { if (r.ok) setSettled(true); })}
        >
          {pending && <Spinner />} Pay the tester
        </button>
        <button
          type="button" className="btn btn-danger" disabled={pending || settled || !resolution.trim()}
          onClick={() => void run(() => arbitrateDispute(disputeId, true, resolution)).then((r) => { if (r.ok) setSettled(true); })}
        >
          Uphold the developer
        </button>
      </div>
      <Note feedback={feedback} />
    </div>
  );
}
