'use client';

/**
 * TESTERPOOL — Cloudflare Turnstile on the signup form.
 *
 * The token is not checked by us. It is handed to Supabase as
 * `options.captchaToken` and verified by GoTrue against Cloudflare using the
 * secret key set in the dashboard, which means the secret never touches this
 * codebase and a forged token cannot be waved through by our own code.
 *
 * Enabling it is therefore two steps, and BOTH are required — a site key here
 * with nothing set in Supabase gets you a widget that stops nobody:
 *
 *   1. NEXT_PUBLIC_TURNSTILE_SITE_KEY in the environment (public, by design).
 *   2. Supabase → Authentication → Bot and Abuse Protection → Turnstile, with
 *      the matching secret key.
 *
 * With no site key set the component renders nothing and `useTurnstile` reports
 * `required: false`, so local development and preview deploys are not gated on
 * a Cloudflare account. That is a deliberate hole in a development convenience,
 * not in the check itself: once Supabase is configured, GoTrue rejects a signup
 * with no token regardless of what this component did or did not draw.
 */

import * as React from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

/** One script tag per page, however many widgets ask for it. */
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_URL;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile script failed to load'));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export interface TurnstileState {
  /** True when a site key is configured, so the form should wait for a token. */
  required: boolean;
  token: string | null;
  /** Set when the challenge could not run at all. */
  error: string | null;
  /** Call after a failed submit — a token is single-use. */
  reset: () => void;
  setToken: (t: string | null) => void;
  setError: (e: string | null) => void;
}

export function useTurnstile(): TurnstileState {
  const [token, setToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const resetRef = React.useRef<() => void>(() => {});

  return {
    required: !!SITE_KEY,
    token,
    error,
    setToken,
    setError,
    reset: React.useCallback(() => {
      setToken(null);
      resetRef.current();
    }, []),
  };
}

export function Turnstile({
  state,
  action,
}: {
  state: TurnstileState;
  /** Labels the challenge in Cloudflare's analytics. Letters, dashes, max 32. */
  action?: string;
}) {
  const box = React.useRef<HTMLDivElement | null>(null);
  const widget = React.useRef<string | null>(null);
  const { setToken, setError } = state;

  React.useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let cancelled = false;
    const el = box.current;

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile || widget.current) return;
        widget.current = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          action,
          theme: 'dark',
          callback: (t: string) => setToken(t),
          // A token is good for five minutes. Expiring it clears the form's
          // copy so a stale one is never submitted.
          'expired-callback': () => setToken(null),
          'error-callback': () => {
            setToken(null);
            setError('The bot check could not run. Reload and try again.');
          },
        });
      })
      .catch(() => {
        if (!cancelled) setError('The bot check could not load. Reload and try again.');
      });

    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) {
        window.turnstile.remove(widget.current);
        widget.current = null;
      }
    };
  }, [action, setToken, setError]);

  if (!SITE_KEY) return null;
  return <div ref={box} className="flex justify-center" />;
}
