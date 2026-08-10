'use client';

import * as React from 'react';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { reviewFeedback } from '@/app/(app)/actions';
import { EARN } from '@/lib/economy';

export function ReviewActions({ feedbackId }: { feedbackId: string }) {
  const { pending, feedback, run } = useAction();
  const [note, setNote] = React.useState('');
  const [showNote, setShowNote] = React.useState(false);
  const [settled, setSettled] = React.useState(false);

  async function decide(verdict: 'useful' | 'low_effort') {
    const result = await run(() => reviewFeedback(feedbackId, verdict, note));
    if (result.ok) setSettled(true);
  }

  return (
    <div className="mt-4 border-t border-[var(--color-line)] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || settled}
          onClick={() => void decide('useful')}
        >
          {pending && <Spinner />}
          Useful — pay <span className="num">{EARN.feedbackApproved}</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending || settled}
          onClick={() => void decide('low_effort')}
        >
          Low effort — send to arbitration
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending || settled}
          onClick={() => setShowNote((v) => !v)}
        >
          {showNote ? 'Hide note' : 'Add a note'}
        </button>
      </div>

      {showNote && (
        <textarea
          className="input mt-2"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional. The tester and any moderator both read this."
        />
      )}

      <Note feedback={feedback} />
    </div>
  );
}
