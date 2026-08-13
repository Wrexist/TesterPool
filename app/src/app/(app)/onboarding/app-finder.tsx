'use client';

/**
 * TESTERPOOL — "where is your app, and what is its link".
 *
 * Replaces eight fields typed by hand with one paste. Three screens: pick the
 * store, paste the link, confirm what came back.
 *
 * The screen that matters is the third one, and specifically its unhappy path.
 * Most apps arriving here have NO public store listing — the whole product
 * exists because Google will not let a new personal developer account publish to
 * production until twelve testers have run the app for fourteen consecutive
 * days, so the app sits in a closed track and the public page 404s. That is the
 * expected case, not a failure, and the copy says so. What the link always gives
 * us, listing or no listing, is the package name and the opt-in URL — which is
 * the tedious part to type correctly anyway.
 */

import * as React from 'react';
import { Card, Disclosure, Pill, cx } from '@/components/ui';
import { Spinner, useAction } from '@/components/app/action-button';
import { IconAlert, IconArrow, IconCheck, IconAndroid, IconApple } from '@/components/app/icons';
import { lookupApp, type AppLookup } from '@/app/(app)/actions';

type Store = 'android' | 'ios';
type Screen = 'store' | 'link' | 'result';

function StarMark({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m12 17.27 5.18 3.13-1.37-5.89 4.57-3.96-6.02-.51L12 4.5 9.64 10.04l-6.02.51 4.57 3.96-1.37 5.89z" />
    </svg>
  );
}

const STORE_COPY: Record<Store, { label: string; where: string; hint: string; placeholder: string }> = {
  android: {
    label: 'Android',
    where: 'Google Play',
    hint: 'Your closed-testing opt-in link works, and so does the package name on its own.',
    placeholder: 'https://play.google.com/apps/testing/com.ledgerly.app',
  },
  ios: {
    label: 'iOS',
    where: 'the App Store',
    hint: 'Open your app on the App Store, tap share, then Copy Link.',
    placeholder: 'https://apps.apple.com/app/id123456789',
  },
};

export function AppFinder({
  result,
  onFound,
  onReset,
}: {
  result: AppLookup | null;
  onFound: (found: AppLookup) => void;
  onReset: () => void;
}) {
  const { pending, run } = useAction();
  const [screen, setScreen] = React.useState<Screen>(result ? 'result' : 'store');
  const [store, setStore] = React.useState<Store>(result?.platform ?? 'android');
  const [link, setLink] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  async function fetchDetails() {
    if (!link.trim() || pending) return;
    setError(null);
    const res = await run(() => lookupApp(link), { refresh: false });
    if (res.ok && res.data) {
      onFound(res.data as AppLookup);
      setScreen('result');
    } else {
      setError(res.message ?? 'That link did not work.');
    }
  }

  function startOver() {
    onReset();
    setLink('');
    setError(null);
    setScreen('store');
  }

  /* --------------------------------------------------------------- store */

  if (screen === 'store') {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Where is your app?</h2>
          <p className="mt-1 text-sm text-[var(--color-dim)]">
            Paste its link and we fill in the name, package and opt-in URL for you.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {(['android', 'ios'] as Store[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setStore(key);
                setScreen('link');
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4 text-left transition-colors hover:border-[var(--color-line-hi)]"
            >
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'color-mix(in oklab, var(--color-accent) 12%, transparent)',
                  color: 'var(--color-accent)',
                }}
              >
                {key === 'android' ? <IconAndroid size={20} /> : <IconApple size={20} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{STORE_COPY[key].label}</span>
                <span className="block text-xs text-[var(--color-dim)]">
                  Published on {STORE_COPY[key].where}
                </span>
              </span>
              <IconArrow size={16} className="shrink-0 text-[var(--color-mute)]" />
            </button>
          ))}
        </div>

        <p className="text-xs text-[var(--color-mute)]">
          Most people here are on Android — that is where Google&apos;s twelve-tester rule applies.
        </p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- link */

  if (screen === 'link') {
    const copy = STORE_COPY[store];
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Paste your {copy.where} link</h2>
          <p className="mt-1 text-sm text-[var(--color-dim)]">{copy.hint}</p>
        </div>

        <div>
          <label className="label" htmlFor="appLink">
            {store === 'android' ? 'Play link or package name' : 'App Store link'}
          </label>
          <input
            id="appLink"
            className="input"
            value={link}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void fetchDetails();
              }
            }}
            placeholder={copy.placeholder}
          />
          {error && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--color-danger)]">
              <IconAlert size={13} className="mt-px shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setScreen('store')}>
            Back
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={!link.trim() || pending}
            onClick={() => void fetchDetails()}
          >
            {pending && <Spinner />}
            {pending ? 'Looking it up' : 'Fetch app details'}
          </button>
        </div>

        <Disclosure summary="Where do I find the link">
          {store === 'android' ? (
            <ol className="flex list-decimal flex-col gap-1 pl-4 text-sm text-[var(--color-dim)]">
              <li>Play Console, then your app, then Testing, then Closed testing.</li>
              <li>Copy the opt-in link on the Testers tab.</li>
              <li>
                No link yet? Type the package name instead —{' '}
                <span className="text-[var(--color-ink)]">com.ledgerly.app</span>.
              </li>
            </ol>
          ) : (
            <ol className="flex list-decimal flex-col gap-1 pl-4 text-sm text-[var(--color-dim)]">
              <li>Open your app&apos;s page on the App Store.</li>
              <li>Tap the share button, then Copy Link.</li>
            </ol>
          )}
        </Disclosure>
      </div>
    );
  }

  /* -------------------------------------------------------------- result */

  if (!result) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">
          {result.found ? 'Found it' : 'Got your package name'}
        </h2>
        <p className="mt-1 text-sm text-[var(--color-dim)]">
          {result.found ? 'Check it is right. Everything below is editable.' : result.note}
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cx(
              'inline-flex items-center gap-1.5 text-xs font-semibold',
              result.found ? 'text-[var(--color-accent)]' : 'text-[var(--color-credit)]'
            )}
          >
            {result.found ? <IconCheck size={13} /> : <IconAlert size={13} />}
            {result.found
              ? `Found on ${result.platform === 'ios' ? 'the App Store' : 'Google Play'}`
              : 'Not published yet'}
          </span>
          <button
            type="button"
            onClick={startOver}
            className="text-xs font-medium text-[var(--color-dim)] underline decoration-[var(--color-line-hi)] underline-offset-2 hover:text-[var(--color-ink)]"
          >
            Change
          </button>
        </div>

        <div className="mt-3 flex items-start gap-3">
          {result.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- store CDN, sized, decorative
            <img
              src={result.iconUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-xl border border-[var(--color-line)] object-cover"
            />
          ) : (
            <span
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--color-line)] text-[var(--color-mute)]"
              style={{ background: 'var(--color-surface-2)' }}
            >
              {result.platform === 'ios' ? <IconApple size={22} /> : <IconAndroid size={22} />}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {result.name || result.packageName || 'Your app'}
            </div>
            {result.developer && (
              <div className="truncate text-xs text-[var(--color-dim)]">{result.developer}</div>
            )}
            {result.rating != null && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-credit)]">
                <StarMark />
                <span className="num">{result.rating.toFixed(1)}</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Pill tone="neutral">{result.platform === 'ios' ? 'iOS' : 'Android'}</Pill>
              {result.category && <Pill tone="violet">{result.category}</Pill>}
            </div>
          </div>
        </div>

        {result.packageName && (
          <p className="num mt-3 truncate border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-mute)]">
            {result.packageName}
          </p>
        )}
      </Card>

      {!result.found && (
        <p className="text-xs text-[var(--color-mute)]">
          Nothing is wrong. An app in closed testing has no public store page yet — that is the reason
          you are here.
        </p>
      )}
    </div>
  );
}
