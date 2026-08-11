'use client';

/**
 * The one interactive thing on the billing page.
 *
 * Three states, like every other mutation in this product: idle, working, and
 * a result you can read. The success state is a redirect to Stripe, so the
 * button stays in "Redirecting" until the browser leaves the page — going back
 * to idle would invite a second click and a second Checkout Session.
 */

import * as React from 'react';
import { Spinner } from '@/components/app/action-button';

export interface BuyApp {
  id: string;
  name: string;
}

export function BuyButton({
  sku,
  label,
  price,
  apps,
  requiresApp = false,
  primary = false,
  disabled = false,
  disabledReason,
}: {
  sku: string;
  label: string;
  price: string;
  apps: BuyApp[];
  requiresApp?: boolean;
  primary?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [appId, setAppId] = React.useState<string>(apps[0]?.id ?? '');
  const [state, setState] = React.useState<'idle' | 'working' | 'leaving'>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const noApp = requiresApp && apps.length === 0;
  const blocked = disabled || noApp;

  async function buy() {
    setState('working');
    setError(null);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku, appId: requiresApp ? appId : null }),
      });
      const body = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !body.url) {
        setError(body.error ?? 'Checkout could not be opened. Try again.');
        setState('idle');
        return;
      }

      setState('leaving');
      window.location.href = body.url;
    } catch {
      setError('Could not reach the payment service. Check your connection and try again.');
      setState('idle');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {requiresApp && apps.length > 1 && (
        <label className="block">
          <span className="label">Which app</span>
          <select
            className="input"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            disabled={state !== 'idle'}
          >
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {requiresApp && apps.length === 1 && (
        <p className="text-[11px] text-[var(--color-mute)]">
          For {apps[0].name}.
        </p>
      )}

      <button
        type="button"
        className={primary ? 'btn btn-primary w-full justify-center' : 'btn btn-secondary w-full justify-center'}
        disabled={blocked || state !== 'idle'}
        title={blocked ? disabledReason ?? 'Not available yet' : `${label} — ${price}`}
        onClick={() => void buy()}
      >
        {state === 'idle' ? (
          <>
            {label} <span className="num ml-1 opacity-80">{price}</span>
          </>
        ) : (
          <>
            <Spinner /> {state === 'working' ? 'Opening checkout' : 'Redirecting to Stripe'}
          </>
        )}
      </button>

      {noApp && (
        <p className="text-[11px] text-[var(--color-mute)]">
          Add an app first — this is bought for a specific app.
        </p>
      )}
      {blocked && !noApp && disabledReason && (
        <p className="text-[11px] text-[var(--color-mute)]">{disabledReason}</p>
      )}
      {error && (
        <p role="status" className="text-[11px]" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Receipts, cards and refund requests, handled by Stripe rather than by email. */
export function ManageBillingButton({ disabled = false }: { disabled?: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function open() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        setError(body.error ?? 'The billing portal could not be opened.');
        setPending(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError('Could not reach the payment service.');
      setPending(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button type="button" className="btn btn-ghost" disabled={disabled || pending} onClick={() => void open()}>
        {pending && <Spinner />}
        {pending ? 'Opening' : 'Receipts and refunds'}
      </button>
      {error && (
        <p role="status" className="mt-1 text-[11px]" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
