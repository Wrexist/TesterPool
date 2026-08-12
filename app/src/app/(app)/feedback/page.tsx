import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Avatar, TierBadge, EmptyState, CreditChip } from '@/components/ui';
import { ReviewActions } from './review-actions';
import { IconArrow, IconAlert } from '@/components/app/icons';
import { fmtDate, n, tierOf } from '@/lib/pods';
import type { AppRow, Feedback, FeedbackStatus, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Feedback inbox — TesterPool' };

type Row = Feedback & {
  apps: Pick<AppRow, 'id' | 'name' | 'owner_id'> | Pick<AppRow, 'id' | 'name' | 'owner_id'>[] | null;
  profiles: Pick<Profile, 'handle' | 'display_name' | 'avatar_url' | 'tier' | 'reliability'> | null;
};

const STATUS_PILL: Record<FeedbackStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'violet' | 'neutral' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Awaiting your review', tone: 'amber' },
  approved: { label: 'Paid', tone: 'green' },
  disputed: { label: 'In arbitration', tone: 'violet' },
  arbitrated: { label: 'Paid on arbitration', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};

export default async function FeedbackInboxPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const { data: rows } = await supabase
    .from('feedback')
    .select('*, apps!inner(id, name, owner_id), profiles(handle, display_name, avatar_url, tier, reliability)')
    .eq('apps.owner_id', user.id)
    .neq('status', 'draft')
    .order('submitted_at', { ascending: false });

  const reports = (rows ?? []) as Row[];
  const waiting = reports.filter((r) => r.status === 'submitted');
  const settled = reports.filter((r) => r.status !== 'submitted');

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Feedback inbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
          Private reports on your apps. All of it happens inside closed testing tracks, which do not
          affect store rankings, ratings, or public install counts.
        </p>
      </header>

      <div
        className="flex items-start gap-2 rounded-xl border p-4 text-sm"
        style={{
          borderColor: 'color-mix(in oklab, var(--color-violet) 28%, transparent)',
          background: 'color-mix(in oklab, var(--color-violet) 7%, transparent)',
        }}
      >
        <IconAlert size={16} className="mt-0.5 shrink-0" />
        <p className="text-[var(--color-dim)]">
          Arbitration is not rejection. A moderator reads the report and pays the tester anyway if it was
          specific — that protects the feedback you did not want to hear, which is the feedback worth having.
        </p>
      </div>

      {waiting.length === 0 && settled.length === 0 ? (
        <EmptyState
          title="No reports yet"
          body="Testers write their report from day seven onward, once they have used your app enough to say something useful. They will land here."
          action={<Link href="/dashboard" className="btn btn-secondary">Back to dashboard <IconArrow size={15} /></Link>}
        />
      ) : (
        <>
          {waiting.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                Awaiting your review · <span className="num">{waiting.length}</span>
              </h2>
              <div className="flex flex-col gap-3">
                {waiting.map((report) => <ReportCard key={report.id} report={report} actionable />)}
              </div>
            </section>
          )}

          {settled.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                Reviewed
              </h2>
              <div className="flex flex-col gap-3">
                {settled.map((report) => <ReportCard key={report.id} report={report} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ReportCard({ report, actionable = false }: { report: Row; actionable?: boolean }) {
  const app = Array.isArray(report.apps) ? report.apps[0] ?? null : report.apps;
  const tester = report.profiles;
  const name = tester?.display_name || tester?.handle || 'Tester';
  const pill = STATUS_PILL[report.status];
  const severity = n(report.severity);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={name} src={tester?.avatar_url} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {tester?.handle ? (
              <Link href={`/u/${tester.handle}`} className="text-sm font-semibold hover:underline">
                @{tester.handle}
              </Link>
            ) : (
              <span className="text-sm font-semibold">{name}</span>
            )}
            <TierBadge tier={tierOf(tester?.tier)} size="sm" />
            <span className="text-xs text-[var(--color-mute)]">on {app?.name ?? 'your app'}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-mute)]">
            <span>{fmtDate(report.submitted_at ?? report.created_at)}</span>
            {report.device_model && <span>{report.device_model}{report.os_version ? ` · ${report.os_version}` : ''}</span>}
            {report.credits_awarded > 0 && (
              <span className="inline-flex items-center gap-1">paid <CreditChip amount={report.credits_awarded} size="sm" /></span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {severity >= 2 && <Pill tone={severity >= 3 ? 'red' : 'amber'}>Severity {severity}</Pill>}
          <Pill tone={pill.tone}>{pill.label}</Pill>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xs">
        {[
          ['Usability', report.score_usability],
          ['Performance', report.score_performance],
          ['Clarity', report.score_clarity],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-[var(--color-line)] px-2.5 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-mute)]">{label}</div>
            <div className="num text-base font-bold">
              {value ?? '—'}<span className="text-xs text-[var(--color-mute)]">/5</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm">
        <Field label="First impression" value={report.first_impression} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What worked" value={report.what_worked} />
          <Field label="What broke" value={report.what_broke} tone="danger" />
        </div>
        <Field label="Reproduction steps" value={report.repro_steps} mono />
        <Field label="One change they would make" value={report.suggestion} />
      </div>

      {report.creator_note && (
        <p className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-dim)]">
          Your note: {report.creator_note}
        </p>
      )}

      {actionable && <ReviewActions feedbackId={report.id} />}
    </Card>
  );
}

function Field({
  label, value, tone, mono,
}: { label: string; value: string | null; tone?: 'danger'; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">{label}</div>
      <p
        className={mono ? 'mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed' : 'mt-1 whitespace-pre-wrap leading-relaxed'}
        style={{ color: tone === 'danger' ? 'var(--color-ink)' : 'var(--color-dim)' }}
      >
        {value}
      </p>
    </div>
  );
}
