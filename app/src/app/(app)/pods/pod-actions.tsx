'use client';

import * as React from 'react';
import Link from 'next/link';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { joinPod, startPod } from '@/app/(app)/actions';

export interface JoinableApp { id: string; name: string; status: string }

/**
 * `join_pod` answers with named error states rather than throwing, so each one
 * gets copy that tells the developer what to do next instead of "failed".
 */
export function JoinPodButton({ apps, disabled }: { apps: JoinableApp[]; disabled?: boolean }) {
  const { pending, feedback, run } = useAction();
  const [appId, setAppId] = React.useState(apps[0]?.id ?? '');
  const [joined, setJoined] = React.useState(false);

  if (apps.length === 0) {
    return (
      <Link href="/onboarding" className="btn btn-secondary w-full">
        List an app to join
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {apps.length > 1 && (
        <select className="input" value={appId} onChange={(e) => setAppId(e.target.value)} aria-label="App to enter">
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={pending || joined || disabled || !appId}
        onClick={() => void run(() => joinPod(appId)).then((r) => { if (r.ok) setJoined(true); })}
      >
        {pending && <Spinner />}
        {pending ? 'Joining' : joined ? 'Joined' : 'Join this pod'}
      </button>
      <Note feedback={feedback} />
    </div>
  );
}

export function StartPodButton({ podId }: { podId: string }) {
  const { pending, feedback, run } = useAction();
  const [started, setStarted] = React.useState(false);

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={pending || started}
        onClick={() => void run(() => startPod(podId)).then((r) => { if (r.ok) setStarted(true); })}
      >
        {pending && <Spinner />}
        {pending ? 'Starting' : started ? 'Started' : 'Start the 14 days'}
      </button>
      <Note feedback={feedback} />
    </div>
  );
}
