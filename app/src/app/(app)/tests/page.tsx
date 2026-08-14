import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, EmptyState, CreditChip } from '@/components/ui';
import { CheckInButton } from './checkin-button';
import { IconArrow, IconUpload, IconFeedback, IconCheck } from '@/components/app/icons';
import { EARN } from '@/lib/economy';
import { marketHref } from '@/lib/market';
import { readTestingQuota, type TestingQuota } from '@/app/(app)/actions';
import { stripFor, checkedInToday, n, fmtRelative } from '@/lib/format';
import type { AppRow, Assignment, Feedback, LedgerEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My tests — TesterPool' };

type TestRow = Assignment & { apps: AppRow | AppRow[] | null };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function TestsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const { data: rows } = await supabase
    .from('assignments')
    .select('*, apps(*)')
    .eq('tester_id', user.id)
    .order('created_at', { ascending: false });

  const tests = (rows ?? []) as TestRow[];
  const ids = tests.map((t) => t.id);

  const [{ data: feedbackRows }, { data: ledgerRows }] = await Promise.all([
    ids.length
      ? supabase.from('feedback').select('id, assignment_id, status, credits_awarded').in('assignment_id', ids)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from('credit_ledger')
      .select('delta, reason, ref_type, ref_id')
      .eq('user_id', user.id)
      .gt('delta', 0),
  ]);

  const feedbackByAssignment = new Map<string, Pick<Feedback, 'id' | 'assignment_id' | 'status' | 'credits_awarded'>>();
  for (const f of (feedbackRows ?? []) as Pick<Feedback, 'id' | 'assignment_id' | 'status' | 'credits_awarded'>[]) {
    feedbackByAssignment.set(f.assignment_id, f);
  }

  const earnedByAssignment = new Map<string, number>();
  for (const entry of (ledgerRows ?? []) as Pick<LedgerEntry, 'delta' | 'ref_type' | 'ref_id'>[]) {
    if (entry.ref_type !== 'assignment' || !entry.ref_id) continue;
    earnedByAssignment.set(entry.ref_id, (earnedByAssignment.get(entry.ref_id) ?? 0) + n(entry.delta));
  }

  const quota = await readTestingQuota();
  const active = tests.filter((t) => t.status !== 'dropped' && t.status !== 'removed');
  const finished = tests.filter((t) => t.status === 'dropped' || t.status === 'removed');
  const totalEarned = [...earnedByAssignment.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My tests</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
            Everything you have taken off the feed. Install, use it properly, send one report.{' '}
            <Link href="/market?scope=due" className="underline decoration-[var(--color-line-hi)] underline-offset-2 hover:text-[var(--color-ink)]">
              See which reports you still owe
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--color-dim)]">
          Earned from testing <CreditChip amount={totalEarned} />
        </div>
      </header>

      <QuotaStrip quota={quota} />

      {active.length === 0 ? (
        <EmptyState
          title="You are not testing anything yet"
          body={`Pick an app from the feed and it is yours: join the developer's closed testing track, use it, send one report. ${EARN.optInVerified + EARN.feedbackApproved} credits for the job, and you can finish it today.`}
          action={<Link href={marketHref({ scope: 'open' })} className="btn btn-primary">Find an app to test <IconArrow size={15} /></Link>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              feedback={feedbackByAssignment.get(test.id) ?? null}
              earned={earnedByAssignment.get(test.id) ?? 0}
            />
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
            Closed
          </h2>
          <div className="flex flex-col gap-2">
            {finished.map((test) => {
              const app = one<AppRow>(test.apps);
              return (
                <Card key={test.id} className="flex items-center gap-3 px-4 py-3 opacity-70">
                  <span className="text-sm font-medium">{app?.name ?? 'App'}</span>
                  <Pill tone="red">{test.status === 'dropped' ? 'Dropped' : 'Removed'}</Pill>
                  <span className="ml-auto text-xs text-[var(--color-mute)]">
                    taken {fmtRelative(test.created_at)}
                  </span>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Today's allowance, stated before it bites.
 *
 * A cap a tester only meets at the moment it stops them is a cap they
 * experience as a bug. Shown here, above the work, it reads as a budget.
 */
function QuotaStrip({ quota }: { quota: TestingQuota | null }) {
  if (!quota || quota.unlimited) return null;

  const rows = [
    { label: 'Installs', used: quota.installsToday, cap: quota.installCap },
    { label: 'Reports', used: quota.reviewsToday, cap: quota.reviewCap },
  ].filter((r): r is { label: string; used: number; cap: number } => r.cap != null);

  if (rows.length === 0) return null;
  const anyFull = rows.some((r) => r.used >= r.cap);

  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
        Today
      </span>
      {rows.map(({ label, used, cap }) => {
        const full = used >= cap;
        return (
          <span key={label} className="flex items-center gap-2 text-sm">
            <span className="text-[var(--color-dim)]">{label}</span>
            <span
              className="num font-semibold"
              style={{ color: full ? 'var(--color-credit)' : 'var(--color-ink)' }}
            >
              {used} of {cap}
            </span>
          </span>
        );
      })}
      <span className="ml-auto text-xs text-[var(--color-mute)]">
        {anyFull ? 'Resets at midnight UTC. ' : ''}
        <Link href="/billing" className="underline decoration-[var(--color-line-hi)] underline-offset-2">
          {anyFull ? 'Remove the limit' : 'Unlimited removes the limit'}
        </Link>
      </span>
    </Card>
  );
}

function TestCard({
  test, feedback, earned,
}: {
  test: TestRow;
  feedback: Pick<Feedback, 'id' | 'status'> | null;
  earned: number;
}) {
  const app = one<AppRow>(test.apps);
  /*
    Every seat is now the same shape: one install, one session, one report, and
    no clock to keep. There is nothing left to branch on — the cohort that once
    owned the fourteen days is gone, and so is the disabled check-in button
    that used to sit here waiting for a cohort that would never form.
  */
  const days = n(test.days_checked_in);
  const verified = !!test.opt_in_verified_at;
  const today = checkedInToday(test.last_checkin_on);
  const logged = days >= 1;
  /** The report is earned the moment the opt-in is verified. */
  const feedbackDue = verified;
  const feedbackSent = !!feedback && feedback.status !== 'draft';

  return (
    // The id is the anchor that reminder emails deep-link to:
    // /tests#test-<assignment_id> lands the reader on their own card.
    <Card id={`test-${test.id}`} className="p-5 scroll-mt-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {app?.id ? (
              <Link href={`/market/${app.id}`} className="text-base font-semibold hover:underline">
                {app.name}
              </Link>
            ) : (
              <h2 className="text-base font-semibold">App</h2>
            )}
            {app?.category && <Pill tone="neutral">{app.category}</Pill>}
            {!verified && <Pill tone="amber">Opt-in required</Pill>}
            {verified && feedbackSent && <Pill tone="green">Report sent</Pill>}
          </div>
          {app?.tagline && <p className="mt-1 text-sm text-[var(--color-dim)]">{app.tagline}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--color-mute)]">
            <span>
              {!verified
                ? 'Join the closed test and upload your proof to start.'
                : logged
                  ? 'Session logged. Send your report when you are ready.'
                  : 'Use the app properly, then report.'}
            </span>
            <span>taken {fmtRelative(test.created_at)}</span>
            <span className="inline-flex items-center gap-1.5">Earned <CreditChip amount={earned} size="sm" /></span>
            {app?.focus_areas && app.focus_areas.length > 0 && (
              <span className="truncate">Focus: {app.focus_areas.slice(0, 2).join(', ')}</span>
            )}
          </div>
        </div>

        <div className="lg:w-[300px] lg:shrink-0">
          {!verified ? (
            <div className="flex flex-col gap-2">
              <Link href={`/tests/${test.id}/optin`} className="btn btn-primary">
                <IconUpload size={15} /> Verify your opt-in <span className="num">+{EARN.optInVerified}</span>
              </Link>
              <p className="text-xs text-[var(--color-mute)]">
                Nothing counts until you appear in their tester list.
              </p>
            </div>
          ) : (
            <CheckInButton
              assignmentId={test.id}
              // One session, so the strip is one cell and the day is always
              // day one. Fourteen cells would draw thirteen empty days that
              // nothing will ever fill.
              days={stripFor(days, 1, 1)}
              currentDay={1}
              total={1}
              // `alreadyToday` alone would let the button come back tomorrow
              // against a seat that has no second day. The RPC refuses it
              // either way, and a button that is refused is worse than a
              // button that is not offered.
              alreadyToday={today || logged}
              disabled={logged}
              disabledReason={
                logged
                  ? 'Logged. This one is a single session — the report is what is left.'
                  : undefined
              }
            />
          )}
        </div>
      </div>

      {verified && (feedbackDue || feedbackSent) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] pt-4">
          {feedbackSent ? (
            <span className="inline-flex items-center gap-2 text-sm text-[var(--color-dim)]">
              <IconCheck size={15} /> Feedback report sent
              {feedback?.status === 'approved' && <Pill tone="green">Paid</Pill>}
              {feedback?.status === 'submitted' && <Pill tone="neutral">Awaiting review</Pill>}
              {feedback?.status === 'disputed' && <Pill tone="amber">In arbitration</Pill>}
              {feedback?.status === 'arbitrated' && <Pill tone="green">Paid on arbitration</Pill>}
              {feedback?.status === 'rejected' && <Pill tone="red">Rejected</Pill>}
            </span>
          ) : (
            <>
              <Link href={`/tests/${test.id}/feedback`} className="btn btn-secondary">
                <IconFeedback size={15} /> Write your report{' '}
                <span className="num">+{EARN.feedbackApproved} if approved</span>
              </Link>
              <p className="text-xs text-[var(--color-mute)]">
                Send it whenever you have something worth saying.
              </p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
