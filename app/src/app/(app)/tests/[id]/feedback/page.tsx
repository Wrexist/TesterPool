import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill } from '@/components/ui';
import { FeedbackForm } from './feedback-form';
import { IconArrow, IconCheck } from '@/components/app/icons';
import { fmtDate } from '@/lib/format';
import type { AppRow, Assignment, Feedback } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Feedback report — TesterPool' };

export default async function FeedbackReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const { data: assignmentRow } = await supabase
    .from('assignments')
    .select('*, apps(*)')
    .eq('id', id)
    .eq('tester_id', user.id)
    .maybeSingle();

  const assignment = assignmentRow as (Assignment & { apps: AppRow | AppRow[] | null }) | null;
  if (!assignment) notFound();

  const app = Array.isArray(assignment.apps) ? assignment.apps[0] ?? null : assignment.apps;

  const { data: existingRow } = await supabase
    .from('feedback')
    .select('*')
    .eq('assignment_id', assignment.id)
    .maybeSingle();

  const existing = existingRow as Feedback | null;

  if (existing && existing.status !== 'draft') {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-6">
          <Pill tone="green"><IconCheck size={12} /> Sent</Pill>
          <h1 className="mt-3 text-xl font-semibold">Your report on {app?.name ?? 'this app'} is in</h1>
          <p className="mt-1 text-sm text-[var(--color-dim)]">
            Submitted {fmtDate(existing.submitted_at ?? existing.created_at)}. One report per test keeps the
            signal honest, so this one is final.
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {[
              ['Usability', existing.score_usability],
              ['Performance', existing.score_performance],
              ['Clarity', existing.score_clarity],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-[var(--color-line)] px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--color-mute)]">{label}</dt>
                <dd className="num mt-0.5 text-lg font-bold">{value ?? '—'}<span className="text-[var(--color-mute)]">/5</span></dd>
              </div>
            ))}
          </dl>
          {existing.first_impression && (
            <p className="mt-4 whitespace-pre-wrap rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4 text-sm text-[var(--color-dim)]">
              {existing.first_impression}
            </p>
          )}
          <Link href="/tests" className="btn btn-primary mt-4">
            Back to my tests <IconArrow size={15} />
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
          Feedback report for {app?.name ?? 'this app'}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
          You have used it for a week or more. Write down what a stranger would need to know to make it
          better, in the developer&apos;s own terms.
        </p>
      </header>

      <FeedbackForm
        assignmentId={assignment.id}
        appId={assignment.app_id}
        appName={app?.name ?? 'this app'}
        focusAreas={app?.focus_areas ?? []}
        instructions={app?.tester_instructions ?? null}
      />
    </div>
  );
}
