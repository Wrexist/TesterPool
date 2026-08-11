'use client';

import * as React from 'react';
import Link from 'next/link';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { joinPod, saveAppEntry, startPod } from '@/app/(app)/actions';

export interface JoinableApp {
  id: string;
  name: string;
  status: string;
  /** False when the app has no opt-in link and no Google Group yet. */
  reachable: boolean;
}

/**
 * `join_pod` answers with named error states rather than throwing, so each one
 * gets copy that tells the developer what to do next instead of "failed".
 *
 * An app with no opt-in link cannot be queued — the database says so. Rather
 * than disable the button and leave the developer nothing to press, the field
 * that unblocks it is shown here, in place, at the one moment it matters.
 */
export function JoinPodButton({ apps, disabled }: { apps: JoinableApp[]; disabled?: boolean }) {
  const { pending, feedback, run } = useAction();
  const [appId, setAppId] = React.useState(apps[0]?.id ?? '');
  const [joined, setJoined] = React.useState(false);
  const [optInUrl, setOptInUrl] = React.useState('');

  if (apps.length === 0) {
    return (
      <Link href="/onboarding" className="btn btn-secondary w-full">
        List an app to join
      </Link>
    );
  }

  const selected = apps.find((a) => a.id === appId) ?? apps[0];
  const needsLink = !!selected && !selected.reachable;

  async function join() {
    if (needsLink) {
      const saved = await run(() => saveAppEntry(appId, { optInUrl, googleGroup: '' }), { refresh: false });
      if (!saved.ok) return;
    }
    const result = await run(() => joinPod(appId));
    if (result.ok) setJoined(true);
  }

  return (
    <div className="flex flex-col gap-2">
      {apps.length > 1 && (
        <select className="input" value={appId} onChange={(e) => setAppId(e.target.value)} aria-label="App to enter">
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}

      {needsLink && !joined && (
        <div>
          <label className="label" htmlFor={`optin-${selected.id}`}>
            Opt-in link for {selected.name}
          </label>
          <input
            id={`optin-${selected.id}`}
            className="input"
            value={optInUrl}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            onChange={(e) => setOptInUrl(e.target.value)}
            placeholder="https://play.google.com/apps/testing/com.ledgerly.app"
          />
          <p className="mt-1.5 text-xs text-[var(--color-mute)]">
            Play Console, then Testing, Closed testing, Testers tab.
          </p>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={pending || joined || disabled || !appId || (needsLink && !optInUrl.trim())}
        onClick={() => void join()}
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
