'use client';

/**
 * TESTERPOOL — take this app's job.
 *
 * The marketplace has shown a reward chip on every row since it was built and
 * has never had the button that chip implies: a seat came from pod matching or
 * it did not come at all. This is that button.
 *
 * It routes onward rather than sitting still. Starting an activity creates the
 * seat and nothing else — the work has not begun until the tester is inside the
 * closed track — so landing them on step 1 with the upload in front of them is
 * the difference between a seat taken and a seat used. A refresh in place would
 * leave them looking at a stepper and hunting for what to press next.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { startActivity } from '@/app/(app)/actions';

export function StartActivityButton({
  appId,
  reward,
  className = 'btn btn-primary',
  label = 'Start testing this app',
}: {
  appId: string;
  reward?: number | null;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const { pending, feedback, run } = useAction();
  const done = feedback?.tone === 'ok';

  return (
    <div className="flex flex-col items-stretch">
      <button
        type="button"
        className={className}
        disabled={pending || done}
        onClick={() =>
          void run(() => startActivity(appId), {
            // The push is the refresh: /tests/[id]/optin is a server component
            // and reads the seat that was just created.
            refresh: false,
            onOk: (result) => {
              const id = (result.data as { assignment_id?: string } | undefined)?.assignment_id;
              if (id) router.push(`/tests/${id}/optin`);
              else router.refresh();
            },
          })
        }
      >
        {pending && <Spinner />}
        {pending ? 'Taking the seat' : done ? 'Seat taken' : label}
        {!pending && !done && reward ? <span className="num font-bold"> +{reward}</span> : null}
      </button>
      <Note feedback={feedback} />
    </div>
  );
}
