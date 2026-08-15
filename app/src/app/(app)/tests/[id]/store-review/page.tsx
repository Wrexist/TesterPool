import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill } from '@/components/ui';
import { AppIcon } from '@/components/app/app-card';
import { StoreReviewForm } from './review-form';
import { IconAlert } from '@/components/app/icons';
import { EARN } from '@/lib/economy';
import { getFlags } from '@/lib/flags';
import type { AppRow, Assignment, Feedback } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Publish your review — TesterPool' };

/**
 * Step three of a store-listing job.
 *
 * Reachable only from a seat you hold that was created by `start_store_activity`
 * — a closed-track seat sends you to the private report form instead, because
 * the two are different products and a tester should never be guessing which
 * one they are on.
 */
export default async function StoreReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const flags = await getFlags();

  const { data: row } = await supabase
    .from('assignments')
    .select('*, apps(*)')
    .eq('id', id)
    .eq('tester_id', user.id)
    .maybeSingle();

  const assignment = row as (Assignment & { kind?: string; apps: AppRow | AppRow[] | null }) | null;
  if (!assignment) notFound();

  const app = (Array.isArray(assignment.apps) ? assignment.apps[0] : assignment.apps) as AppRow | null;
  if (!app) notFound();

  // A closed-track seat has a private report form, not this one.
  if (assignment.kind !== 'store_listing') redirect(`/tests/${id}/feedback`);

  const { data: existing } = await supabase
    .from('feedback')
    .select('id, status, store_rating')
    .eq('assignment_id', id)
    .maybeSingle();
  const filed = existing as Pick<Feedback, 'id' | 'status'> | null;

  const installed = !!assignment.opt_in_verified_at;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/tests"
          aria-label="Back to my tests"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-2)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="flex-1 text-center text-[17px] font-bold tracking-tight">Publish your review</span>
        <span className="w-10" />
      </div>

      <div className="flex items-start gap-4">
        <AppIcon name={app.name} src={app.icon_url} size={62} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-bold leading-tight tracking-tight">{app.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone="violet">Store review</Pill>
            {app.category && <span className="text-[13px] text-[var(--color-mute)]">{app.category}</span>}
          </div>
        </div>
      </div>

      {!flags.store_reviews ? (
        <Card className="flex flex-col gap-2 p-5">
          <h2 className="flex items-center gap-2 text-[16px] font-bold">
            <IconAlert size={17} className="text-[var(--color-credit)]" /> Store reviews are switched off
          </h2>
          <p className="text-[15px] leading-relaxed text-[var(--color-dim)]">
            An admin has closed this route. Work already started is not lost — nothing has been
            withdrawn — but nothing new can be filed until it is switched back on.
          </p>
        </Card>
      ) : filed ? (
        <Card className="flex flex-col gap-2 p-5">
          <h2 className="text-[16px] font-bold">You have already filed this one</h2>
          <p className="text-[15px] leading-relaxed text-[var(--color-dim)]">
            It is with the publisher. Its state is{' '}
            <span className="font-semibold text-[var(--color-ink)]">{filed.status}</span>.
          </p>
          <Link href="/tests" className="btn btn-secondary mt-1">Back to my tests</Link>
        </Card>
      ) : !installed ? (
        <Card className="flex flex-col gap-2 p-5">
          <h2 className="flex items-center gap-2 text-[16px] font-bold">
            <IconAlert size={17} className="text-[var(--color-credit)]" /> Install it first
          </h2>
          <p className="text-[15px] leading-relaxed text-[var(--color-dim)]">
            Your install has not been confirmed yet, and a review filed before one is the exact
            pattern a store looks for. Upload the install screenshot, then come back.
          </p>
          <Link href={`/tests/${id}/optin`} className="btn btn-primary mt-1">
            Upload your install proof
          </Link>
        </Card>
      ) : (
        <StoreReviewForm
          assignmentId={id}
          appId={app.id}
          appName={app.name}
          storeUrl={app.store_url ?? ''}
          userId={user.id}
          highlights={app.focus_areas ?? []}
          reward={EARN.feedbackApproved}
        />
      )}
    </div>
  );
}
