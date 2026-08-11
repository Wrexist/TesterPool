import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill } from '@/components/ui';
import { OptInWizard } from './optin-wizard';
import { IconArrow, IconCheck } from '@/components/app/icons';
import { fmtDate } from '@/lib/pods';
import type { AppRow, Assignment, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verify your opt-in — TesterPool' };

export default async function OptInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const [{ data: assignmentRow }, { data: profileRow }] = await Promise.all([
    supabase
      .from('assignments')
      .select('*, apps(*)')
      .eq('id', id)
      .eq('tester_id', user.id)
      .maybeSingle(),
    supabase.from('profiles').select('tester_email').eq('id', user.id).maybeSingle(),
  ]);

  const assignment = assignmentRow as (Assignment & { apps: AppRow | AppRow[] | null }) | null;
  if (!assignment) notFound();

  const app = Array.isArray(assignment.apps) ? assignment.apps[0] ?? null : assignment.apps;
  const profile = profileRow as Pick<Profile, 'tester_email'> | null;

  if (assignment.opt_in_verified_at) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-6">
          <Pill tone="green"><IconCheck size={12} /> Verified</Pill>
          <h1 className="mt-3 text-xl font-semibold">You are already opted in to {app?.name ?? 'this app'}</h1>
          <p className="mt-1 text-sm text-[var(--color-dim)]">
            Confirmed {fmtDate(assignment.opt_in_verified_at)}. All that is left is one open a day for the
            rest of the window.
          </p>
          <Link href="/tests" className="btn btn-primary mt-4">
            Go to my tests <IconArrow size={15} />
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <Link href="/tests" className="text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-ink)]">
          Back to my tests
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Verified opt-in for {app?.name ?? 'this app'}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
          Three steps. The whole point is that the developer can prove to Google that a real account joined
          their closed track, so every step here produces evidence rather than a claim.
        </p>
      </header>

      <OptInWizard
        assignmentId={assignment.id}
        userId={user.id}
        // Never fall back to the login email. The tester email must be the
        // Google account that will be added to the closed-testing track, and a
        // login address can be a GitHub email or an Apple private-relay alias
        // (@privaterelay.appleid.com), neither of which can accept a Play
        // opt-in. Silently prefilling one of those is the single most common
        // cause of a failed closed test.
        testerEmail={profile?.tester_email ?? ''}
        appName={app?.name ?? 'this app'}
        optInUrl={app?.opt_in_url ?? null}
        googleGroup={app?.google_group ?? null}
        instructions={app?.tester_instructions ?? null}
      />
    </div>
  );
}
