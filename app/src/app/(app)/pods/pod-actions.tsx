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
  /** True when the owner's balance ran out and the app cannot take on new work. */
  creditsPaused: boolean;
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

  // `selected` falls back to apps[0] when appId matches nothing, which happens
  // when the server prop changes under client state — exactly what the refresh
  // after a save or a join does. Writing to `appId` while showing `selected`
  // would save the typed opt-in link onto an app the developer is not looking at.
  async function join() {
    if (!selected) return;
    if (needsLink) {
      const saved = await run(
        () => saveAppEntry(selected.id, { optInUrl, googleGroup: '' }),
        { refresh: false }
      );
      if (!saved.ok) return;
    }
    const result = await run(() => joinPod(selected.id));
    if (result.ok) setJoined(true);
  }

  return (
    <div className="flex flex-col gap-2">
      {apps.length > 1 && (
        <select className="input" value={appId} onChange={(e) => setAppId(e.target.value)} aria-label="App to enter">
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}

      {selected?.creditsPaused && !joined && (
        <p
          className="rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: 'color-mix(in oklab, var(--color-credit) 30%, transparent)',
            background: 'color-mix(in oklab, var(--color-credit) 8%, transparent)',
            color: 'var(--color-credit)',
          }}
        >
          {selected.name} is out of credits. Test someone else&apos;s app to earn some, or buy a pack —
          it can join again the moment your balance is positive.{' '}
          <Link href="/billing" className="underline decoration-current/40 underline-offset-2">
            Top up
          </Link>
          .
        </p>
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
        disabled={
          pending || joined || disabled || !selected ||
          selected.creditsPaused ||
          (needsLink && !optInUrl.trim())
        }
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
