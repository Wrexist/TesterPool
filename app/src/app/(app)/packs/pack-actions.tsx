'use client';

import * as React from 'react';
import Link from 'next/link';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { joinPack, saveAppEntry } from '@/app/(app)/actions';

export interface JoinableApp {
  id: string;
  name: string;
  /** False when the app has no opt-in link and no Google Group yet. */
  reachable: boolean;
  /** True when the owner's balance ran out and the app cannot take on new work. */
  creditsPaused: boolean;
}

/**
 * Claim a seat.
 *
 * An app with no opt-in link cannot be queued — the database says so, in
 * `app_needs_optin_to_queue`. Rather than disable the button and leave the
 * developer nothing to press, the field that unblocks it appears here, in
 * place, at the one moment it matters.
 */
export function JoinPackButton({ podId, apps }: { podId: string; apps: JoinableApp[] }) {
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

  // Falls back to apps[0] when appId matches nothing, which happens when the
  // server prop changes under client state — exactly what the refresh after a
  // save or a join does. Writing to `appId` while showing `selected` would save
  // the typed opt-in link onto an app the developer is not looking at.
  const selected = apps.find((a) => a.id === appId) ?? apps[0];
  const needsLink = !!selected && !selected.reachable;

  async function join() {
    if (!selected) return;
    if (needsLink) {
      const saved = await run(
        () => saveAppEntry(selected.id, { optInUrl, googleGroup: '' }),
        { refresh: false }
      );
      if (!saved.ok) return;
    }
    const result = await run(() => joinPack(selected.id));
    if (result.ok) setJoined(true);
  }

  return (
    <div className="flex flex-col gap-2">
      {apps.length > 1 && (
        <select
          className="input"
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          aria-label="App to seat in this pack"
        >
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}

      {selected?.creditsPaused && !joined && (
        <p
          className="rounded-xl border px-3 py-2 text-[13px]"
          style={{
            borderColor: 'color-mix(in oklab, var(--color-credit) 40%, transparent)',
            background: 'var(--color-credit-soft)',
            color: '#9A6510',
          }}
        >
          {selected.name} is out of credits. Test someone else&apos;s app to earn some, or buy a
          pack — it can join again the moment your balance is positive.{' '}
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
          <p className="mt-1.5 text-[12px] text-[var(--color-mute)]">
            Play Console, then Testing, Closed testing, Testers tab.
          </p>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary w-full py-3 text-[15px]"
        disabled={
          pending || joined || !selected ||
          selected.creditsPaused ||
          (needsLink && !optInUrl.trim())
        }
        onClick={() => void join()}
        data-pod={podId}
      >
        {pending && <Spinner />}
        {pending ? 'Claiming' : joined ? 'Seat claimed' : 'Claim your seat'}
      </button>
      <Note feedback={feedback} />
    </div>
  );
}
