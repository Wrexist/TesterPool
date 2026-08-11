import type { Metadata } from 'next';
import LoginForm from './LoginForm';
import { getFlags } from '@/lib/flags';

export const metadata: Metadata = {
  title: 'Log in',
  description:
    'Sign in to TesterPool with a magic link, Google, GitHub or Apple. Join a pod of 15 developers and get your 12 testers for 14 consecutive days.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  const referral = raw?.trim() ? raw.trim().slice(0, 32) : null;

  const rawError = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const initialError = rawError?.trim() ? rawError.trim().slice(0, 240) : null;

  // Server component: the flag read happens here, never in the browser.
  const flags = await getFlags();

  return (
    <main className="flex flex-1 flex-col">
      <LoginForm
        referral={referral}
        initialError={initialError}
        appleEnabled={flags.apple_login}
        githubEnabled={flags.github_login}
        signupsOpen={flags.signups_open}
      />
    </main>
  );
}
