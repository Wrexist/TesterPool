import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Avatar, TierBadge, EmptyState, CreditChip } from '@/components/ui';
import { ReviewActions } from './review-actions';
import { IconArrow, IconAlert, IconExternal } from '@/components/app/icons';
import { StarGlyph } from '@/components/app/app-row';
import { fmtDate, n, tierOf } from '@/lib/format';
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
  const isStoreReview = report.store_rating != null;

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
          {isStoreReview && <Pill tone="violet">Public store review</Pill>}
          {!isStoreReview && severity >= 2 && (
            <Pill tone={severity >= 3 ? 'red' : 'amber'}>Severity {severity}</Pill>
          )}
          <Pill tone={pill.tone}>{pill.label}</Pill>
        </div>
      </div>

      {/*
        Two different objects share this card, and they must not be shown the
        same way. A closed-track report is scored against a rubric and private;
        a store review is a rating and a body of text that is already public
        under this tester's name. Showing a store review through the rubric
        would print three "—/5" boxes and bury the only thing the publisher is
        actually being asked to judge.
      */}
      {isStoreReview ? (
        <StoreReviewBody report={report} />
      ) : (
        <>
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
        </>
      )}

      {report.creator_note && (
        <p className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-dim)]">
          Your note: {report.creator_note}
        </p>
      )}

      {actionable && <ReviewActions feedbackId={report.id} />}
    </Card>
  );
}

/**
 * A published store review, as the publisher has to judge it.
 *
 * The rating and the exact text come first because they are already public
 * under the tester's name — by the time this card is read, the thing being
 * approved has already happened, and the only question left is whether it gets
 * paid for. Saying that plainly is the least this screen can do.
 */
function StoreReviewBody({ report }: { report: Row }) {
  const rating = n(report.store_rating);

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} style={{ color: star <= rating ? '#F5A524' : 'var(--color-line-hi)' }}>
            <StarGlyph size={22} />
          </span>
        ))}
        <span className="num ml-1 text-[15px] font-bold">{rating}.0</span>
        <span className="text-[13px] text-[var(--color-mute)]">published on the store</span>
      </div>

      <blockquote
        className="whitespace-pre-wrap rounded-xl border-l-2 bg-[var(--color-surface-2)] px-4 py-3 text-[15px] leading-relaxed"
        style={{ borderLeftColor: 'var(--color-accent)' }}
      >
        {report.store_review_text || report.first_impression}
      </blockquote>

      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        {report.store_review_url && (
          <a
            href={report.store_review_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-accent)] hover:underline"
          >
            <IconExternal size={14} /> See it on the store
          </a>
        )}
        <span className="text-[var(--color-mute)]">
          {report.store_review_proof_id
            ? 'Screenshot attached — a moderator checks it independently'
            : 'No screenshot attached'}
        </span>
      </div>
    </div>
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
