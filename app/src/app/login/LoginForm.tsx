'use client';

import * as React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, Pill, CreditChip, cx } from '@/components/ui';
import { LogoMark, Wordmark } from '@/components/Logo';
import { EARN, RULES } from '@/lib/economy';

type Status = 'idle' | 'sending' | 'sent' | 'error';

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="m4 8 8 5 8-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginForm({
  referral,
  initialError = null,
}: {
  referral: string | null;
  initialError?: string | null;
}) {
  const ref = referral;

  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [oauthBusy, setOauthBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError);

  const callbackUrl = React.useCallback(() => {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const next = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    return `${origin}/auth/callback${next}`;
  }, [ref]);

  async function sendMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setError(null);

    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: callbackUrl(),
          data: ref ? { referral_code: ref } : undefined,
        },
      });
      if (err) throw err;
      setStatus('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setStatus('error');
    }
  }

  async function signInWithGoogle() {
    if (oauthBusy) return;
    setOauthBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        // The referral code rides along in the callback URL rather than in
        // user metadata: Google is the one filling in the profile here.
        options: { redirectTo: callbackUrl() },
      });
      if (err) throw err;
      // On success the browser is navigating away; leave the button busy.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in is unavailable right now.');
      setOauthBusy(false);
    }
  }

  return (
    <div className="dotgrid relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute left-1/2 top-[-16rem] h-[32rem] w-[52rem] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--color-accent) 12%, transparent), transparent 70%)',
        }}
      />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-14 sm:px-6">
        <Link href="/" className="mx-auto flex items-center gap-2" aria-label="TesterPool home">
          <LogoMark size={26} />
          <Wordmark className="text-base" />
        </Link>

        <Card className="mt-8 p-7">
          {ref && (
            <div
              className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3"
              style={{
                borderColor: 'color-mix(in oklab, var(--color-credit) 30%, transparent)',
                background: 'color-mix(in oklab, var(--color-credit) 8%, transparent)',
              }}
            >
              <CreditChip amount={EARN.referralReferee} signed size="lg" />
              <div>
                <div className="text-sm font-semibold">credits from your invite</div>
                <div className="num text-xs text-[var(--color-mute)]">
                  code {ref} · applied when you sign up
                </div>
              </div>
            </div>
          )}

          {status === 'sent' ? (
            <div className="text-center">
              <span
                className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'color-mix(in oklab, var(--color-accent) 14%, transparent)',
                  color: 'var(--color-accent)',
                }}
              >
                <MailIcon />
              </span>
              <h1 className="mt-4 text-lg font-semibold tracking-tight">Check your inbox</h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-dim)]">
                We sent a sign-in link to{' '}
                <span className="font-medium text-[var(--color-ink)]">{email}</span>. It
                is good for one hour and only works once.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatus('idle');
                  setError(null);
                }}
                className="btn btn-ghost mt-6 w-full"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">
                Get your {RULES.requiredTesters} testers
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-dim)]">
                Sign in or create an account. No password to remember, and{' '}
                {EARN.signupGrant} credits waiting.
              </p>

              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={oauthBusy}
                className="btn btn-secondary mt-6 w-full"
              >
                <GoogleIcon />
                {oauthBusy ? 'Opening Google…' : 'Continue with Google'}
              </button>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[var(--color-line)]" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  or
                </span>
                <span className="h-px flex-1 bg-[var(--color-line)]" />
              </div>

              <form onSubmit={sendMagicLink} noValidate>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@studio.dev"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === 'sending'}
                />

                <button
                  type="submit"
                  disabled={status === 'sending' || email.trim().length < 4}
                  className={cx('btn btn-primary mt-3 w-full')}
                >
                  {status === 'sending' ? 'Sending link…' : 'Email me a sign-in link'}
                </button>
              </form>

              {error && (
                <p
                  role="alert"
                  className="mt-3 text-xs leading-relaxed"
                  style={{ color: 'var(--color-danger)' }}
                >
                  {error}
                </p>
              )}
            </>
          )}
        </Card>

        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <Pill tone="green">Closed testing only</Pill>
          <p className="max-w-xs text-xs leading-relaxed text-[var(--color-mute)]">
            TesterPool never asks for a store review, a rating, or a production
            install. By continuing you agree to the terms and the privacy policy.
          </p>
          <Link
            href="/readiness"
            className="text-xs font-medium text-[var(--color-dim)] hover:text-[var(--color-ink)]"
          >
            Not sure you are ready? Run the free readiness check
          </Link>
        </div>
      </div>
    </div>
  );
}
