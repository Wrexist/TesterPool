'use client';

import * as React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, Pill, CreditChip, cx } from '@/components/ui';
import { LogoMark, Wordmark } from '@/components/Logo';
import { Turnstile } from '@/components/Turnstile';
import { EARN, RULES } from '@/lib/economy';

const TURNSTILE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

type Status = 'idle' | 'sending' | 'sent' | 'error';

/** The OAuth providers this screen can offer. Order is meaningful. */
type Provider = 'google' | 'github' | 'apple';

const PROVIDER_LABEL: Record<Provider, string> = {
  google: 'Google',
  github: 'GitHub',
  // Apple's Human Interface Guidelines permit only "Sign in with Apple",
  // "Sign up with Apple" or "Continue with Apple" as the button title.
  apple: 'Apple',
};

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

/**
 * The Octocat mark. Drawn in `currentColor` so it inherits the button's ink,
 * which is how GitHub's own logo guidance expects a monochrome placement.
 */
function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 0 1 3-.405c1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/**
 * The Apple mark. Apple's guidelines require the logo and title inside the
 * button to be either black or white and never a custom colour, so this is
 * drawn in `currentColor` and inherits `--color-ink` — effectively the white
 * treatment, which is the variant Apple specifies for dark backgrounds.
 */
function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/**
 * GoTrue's wording for the two failures a half-configured deployment actually
 * produces is accurate and useless to the person reading it. Translate the ones
 * we recognise, and always name the way in that is definitely working.
 */
function readableAuthError(message: string, provider?: Provider): string {
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    const name = provider ? PROVIDER_LABEL[provider] : 'That provider';
    return `${name} sign-in is not switched on for this deployment yet. Use the email link below — it works now.`;
  }
  if (/requested path is invalid|redirect/i.test(message)) {
    return 'This deployment’s address is not on the allow list in Supabase, so sign-in cannot get back here. Use the email link below.';
  }
  return message;
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
  appleEnabled = false,
  githubEnabled = false,
  signupsOpen = true,
}: {
  referral: string | null;
  initialError?: string | null;
  appleEnabled?: boolean;
  githubEnabled?: boolean;
  signupsOpen?: boolean;
}) {
  const ref = referral;

  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [oauthBusy, setOauthBusy] = React.useState<Provider | null>(null);
  const [error, setError] = React.useState<string | null>(
    initialError ? readableAuthError(initialError) : null
  );
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);

  /**
   * `signInWithOAuth` does not ask Supabase whether the provider exists — it
   * builds the authorize URL in the browser and navigates. So a provider that
   * was never configured returns no error here, and the button sits on
   * "Opening Google…" forever while the redirect dies somewhere the user cannot
   * see. This is the escape hatch: if we are still on this page after ten
   * seconds, the redirect did not happen, and saying nothing is not an option.
   *
   * Misfiring is harmless. It re-enables the button and shows a message; it
   * cannot cancel a navigation that is merely slow, and `pagehide` clears it the
   * moment one commits.
   */
  const stallTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStallTimer = React.useCallback(() => {
    if (stallTimer.current) {
      clearTimeout(stallTimer.current);
      stallTimer.current = null;
    }
  }, []);

  React.useEffect(() => {
    window.addEventListener('pagehide', clearStallTimer);
    return () => {
      clearStallTimer();
      window.removeEventListener('pagehide', clearStallTimer);
    };
  }, [clearStallTimer]);

  const callbackUrl = React.useCallback(() => {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const next = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    return `${origin}/auth/callback${next}`;
  }, [ref]);

  async function sendMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'sending') return;
    if (TURNSTILE_CONFIGURED && !turnstileToken) {
      setError('Complete the verification challenge above first.');
      return;
    }
    setStatus('sending');
    setError(null);

    try {
      if (TURNSTILE_CONFIGURED) {
        const verifyRes = await fetch('/api/turnstile/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const verifyJson = (await verifyRes.json()) as { ok: boolean; error?: string };
        if (!verifyJson.ok) {
          setError(verifyJson.error ?? 'Verification failed. Refresh and try again.');
          setStatus('error');
          return;
        }
      }

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

  async function signInWithProvider(provider: Provider) {
    if (oauthBusy || status === 'sending') return;
    clearStallTimer();
    setOauthBusy(provider);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        // The referral code rides along in the callback URL rather than in
        // user metadata: the provider is the one filling in the profile here.
        options: { redirectTo: callbackUrl() },
      });
      if (err) throw err;

      // The browser should now be navigating away. If it is still here in ten
      // seconds, it is not going to be.
      stallTimer.current = setTimeout(() => {
        stallTimer.current = null;
        setOauthBusy(null);
        setError(
          `${PROVIDER_LABEL[provider]} did not open. It is most likely not configured for this deployment yet. Use the email link below — it works now.`
        );
      }, 10_000);
    } catch (err) {
      setError(
        readableAuthError(
          err instanceof Error
            ? err.message
            : `${PROVIDER_LABEL[provider]} sign-in is unavailable right now. Use the email link below.`,
          provider
        )
      );
      setOauthBusy(null);
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
                {signupsOpen ? `Get your ${RULES.requiredTesters} testers` : 'Welcome back'}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-dim)]">
                {signupsOpen ? (
                  <>
                    Sign in or create an account. No password to remember, and{' '}
                    {EARN.signupGrant} credits waiting.
                  </>
                ) : (
                  <>Sign in to your account. No password to remember.</>
                )}
              </p>

              {!signupsOpen && (
                <div
                  className="mt-4 rounded-xl border px-4 py-3 text-xs leading-relaxed"
                  style={{
                    borderColor: 'color-mix(in oklab, var(--color-credit) 30%, transparent)',
                    background: 'color-mix(in oklab, var(--color-credit) 8%, transparent)',
                    color: 'var(--color-dim)',
                  }}
                >
                  <span className="font-semibold text-[var(--color-credit)]">
                    New signups are paused
                  </span>{' '}
                  while the current pods finish their 14 days. Existing accounts sign in
                  as usual. Check back shortly — we open the next intake when seats free
                  up.
                </div>
              )}

              {/*
                Three peers, not one primary and two afterthoughts: identical
                surface, identical height, identical type. That also satisfies
                Apple's rule that its button be no smaller or less prominent
                than any other sign-in option on the screen.
              */}
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => signInWithProvider('google')}
                  disabled={oauthBusy !== null}
                  className="btn btn-secondary w-full"
                >
                  <GoogleIcon />
                  {oauthBusy === 'google' ? 'Opening Google…' : 'Continue with Google'}
                </button>

                {githubEnabled && (
                  <button
                    type="button"
                    onClick={() => signInWithProvider('github')}
                    disabled={oauthBusy !== null}
                    className="btn btn-secondary w-full"
                  >
                    <GitHubIcon />
                    {oauthBusy === 'github' ? 'Opening GitHub…' : 'Continue with GitHub'}
                  </button>
                )}

                {appleEnabled && (
                  <button
                    type="button"
                    onClick={() => signInWithProvider('apple')}
                    disabled={oauthBusy !== null}
                    // Apple permits only its three approved titles, so the busy
                    // state moves to aria-busy rather than rewriting the label.
                    aria-busy={oauthBusy === 'apple'}
                    className="btn btn-secondary w-full"
                  >
                    <AppleIcon />
                    Sign in with Apple
                  </button>
                )}
              </div>

              {oauthBusy === 'apple' && (
                <p
                  role="status"
                  className="mt-2 text-center text-xs text-[var(--color-dim)]"
                >
                  Opening Apple…
                </p>
              )}

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
                  disabled={status === 'sending' || oauthBusy !== null}
                />

                <Turnstile
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken(null)}
                />

                <button
                  type="submit"
                  disabled={
                    status === 'sending' ||
                    oauthBusy !== null ||
                    email.trim().length < 4 ||
                    (TURNSTILE_CONFIGURED && !turnstileToken)
                  }
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
            install. By continuing you agree to the{' '}
            <Link href="/terms" className="underline hover:text-[var(--color-dim)]">
              terms
            </Link>{' '}
            and the{' '}
            <Link href="/privacy" className="underline hover:text-[var(--color-dim)]">
              privacy policy
            </Link>
            .
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
