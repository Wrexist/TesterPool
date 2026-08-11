import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from './onboarding-form';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Set up your account — TesterPool' };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const [{ data: profileRow }, { count: appCount }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('apps').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
  ]);

  const profile = profileRow as Profile | null;

  // Already set up. Sending someone back through onboarding would let them
  // create a duplicate app, so the dashboard is the honest destination.
  if (profile && (appCount ?? 0) > 0) redirect('/dashboard');

  return (
    <div className="pb-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Three steps, then you are in a pod</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
          About two minutes.
        </p>
      </header>

      <OnboardingForm
        initial={{
          handle: profile?.handle ?? '',
          displayName: profile?.display_name ?? '',
          countryCode: profile?.country_code ?? '',
          testerEmail: profile?.tester_email ?? '',
          authEmail: user.email ?? '',
        }}
      />
    </div>
  );
}
