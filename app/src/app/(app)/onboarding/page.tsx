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

  /*
   * This used to `redirect('/dashboard')` for anyone who already owned an app,
   * to stop a second run through setup creating a duplicate. It also broke the
   * only way to list a second app: the "Add App" button on My Apps points here,
   * so for every existing owner it was a button that bounced them somewhere
   * else. `completeOnboarding` has always handled an additional app correctly —
   * it updates the profile and inserts a new row — so the redirect was
   * protecting nothing that needed protecting.
   *
   * Instead: an owner with a set-up profile gets the app step on its own. The
   * two profile steps are the part that must not run twice, and they are the
   * part that is skipped.
   */
  const setUp = !!profile?.handle && !!profile?.tester_email;
  const another = setUp && (appCount ?? 0) > 0;

  return (
    <div className="pb-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {another ? 'Add another app' : 'Three steps, then you are listed'}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
          {another
            ? 'Paste a store link and it is listed. Your account details are already set.'
            : 'About two minutes.'}
        </p>
      </header>

      <OnboardingForm
        another={another}
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
