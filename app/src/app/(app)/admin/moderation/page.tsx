import * as React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Avatar, EmptyState, cx } from '@/components/ui';
import { Section, WarnBox } from '@/components/admin/parts';
import { AdminProofActions } from '@/components/admin/proof-actions';
// The dispute control is identical on both surfaces and goes through the same
// `arbitrate_dispute` RPC, so it is reused rather than duplicated.
import { DisputeActions } from '@/app/(app)/mod/mod-actions';
import { IconAlert } from '@/components/app/icons';
import { fmtDateTime, fmtRelative, n } from '@/lib/format';
import type { Dispute, Feedback, Profile, Proof } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Tab = 'proofs' | 'disputes' | 'feedback';

const TABS: { key: Tab; label: string }[] = [
  { key: 'proofs', label: 'Proof queue' },
  { key: 'disputes', label: 'Disputes' },
  { key: 'feedback', label: 'Awaiting creator' },
];

type UploaderProfile = Pick<Profile, 'handle' | 'display_name' | 'avatar_url'>;
type ProofRow = Proof & { profiles: UploaderProfile | UploaderProfile[] | null };
type DisputeRow = Dispute & { feedback: Feedback | Feedback[] | null };
type PendingFeedback = Pick<
  Feedback,
  'id' | 'app_id' | 'severity' | 'status' | 'submitted_at' | 'first_impression' | 'what_broke'
> & {
  apps: { name: string } | { name: string }[] | null;
  profiles: Pick<Profile, 'handle'> | Pick<Profile, 'handle'>[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = params.tab === 'disputes' || params.tab === 'feedback' ? params.tab : 'proofs';

  const supabase = await createClient();

  const [{ data: proofRows, error: proofError }, { data: disputeRows }, { data: feedbackRows }] =
    await Promise.all([
      supabase
        .from('proofs')
        .select('*, profiles!proofs_uploader_id_fkey(handle, display_name, avatar_url)')
        .in('status', ['pending', 'escalated'])
        .order('created_at', { ascending: true })
        .limit(48),
      supabase
        .from('disputes')
        .select('*, feedback(*)')
        .eq('status', 'open')
        .order('created_at', { ascending: true })
        .limit(40),
      supabase
        .from('feedback')
        .select('id, app_id, severity, status, submitted_at, first_impression, what_broke, apps(name), profiles!feedback_tester_id_fkey(handle)')
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: true })
        .limit(40),
    ]);

  const proofs = (proofRows ?? []) as ProofRow[];
  const disputes = (disputeRows ?? []) as DisputeRow[];
  const pending = (feedbackRows ?? []) as PendingFeedback[];

  // Signed thumbnails. Storage may not hold the object in a partly seeded
  // database, so a missing URL degrades to a labelled placeholder.
  const thumbs = new Map<string, string>();
  if (tab === 'proofs' && proofs.length > 0) {
    const { data: signed } = await supabase.storage
      .from('proofs')
      .createSignedUrls(proofs.map((p) => p.storage_path), 3600);
    for (const item of signed ?? []) {
      if (item.signedUrl && item.path) thumbs.set(item.path, item.signedUrl);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Moderation"
        note="The same queue moderators see, with admin review recorded in the audit log. Everything the model is sure about never reaches this page."
        right={
          <div className="flex gap-2">
            <Pill tone={proofs.length ? 'amber' : 'neutral'}>
              <span className="num">{proofs.length}</span> proofs
            </Pill>
            <Pill tone={disputes.length ? 'violet' : 'neutral'}>
              <span className="num">{disputes.length}</span> disputes
            </Pill>
            <Link href="/mod" className="btn btn-ghost">Moderator view</Link>
          </div>
        }
      >
        <nav className="flex gap-1 border-b border-[var(--color-line)]">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/moderation?tab=${t.key}`}
              className={cx(
                'px-3 py-2 text-sm font-semibold transition-colors',
                tab === t.key ? 'text-[var(--color-ink)]' : 'text-[var(--color-mute)] hover:text-[var(--color-dim)]'
              )}
              style={tab === t.key ? { boxShadow: 'inset 0 -2px 0 var(--color-accent)' } : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </Section>

      {proofError && tab === 'proofs' && (
        <WarnBox tone="red">The proof queue could not be read: {proofError.message}</WarnBox>
      )}

      {tab === 'proofs' && (
        proofs.length === 0 ? (
          <EmptyState
            title="The queue is clear"
            body="Nothing is waiting on a human. High-confidence opt-in screenshots approve themselves, so an empty queue is the normal state."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {proofs.map((proof) => {
              const url = thumbs.get(proof.storage_path);
              const uploader = one(proof.profiles);
              const confidence = proof.ai_confidence === null ? null : Number(proof.ai_confidence);
              return (
                <Card key={proof.id} className="flex flex-col p-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={uploader?.display_name || uploader?.handle || 'Tester'} src={uploader?.avatar_url} size={30} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/users?q=${encodeURIComponent(uploader?.handle ?? '')}`}
                        className="block truncate text-sm font-semibold hover:text-[var(--color-accent)]"
                      >
                        @{uploader?.handle ?? 'unknown'}
                      </Link>
                      <div className="text-[11px] text-[var(--color-mute)]">{fmtRelative(proof.created_at)}</div>
                    </div>
                    <Pill tone="neutral">{proof.kind.replace('_', ' ')}</Pill>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)]">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="Uploaded proof" className="h-44 w-full object-cover object-top" />
                    ) : (
                      <div className="flex h-44 flex-col items-center justify-center gap-1 text-xs text-[var(--color-mute)]">
                        <IconAlert size={18} />
                        Screenshot unavailable
                        <span className="max-w-full truncate px-3 text-[10px]">{proof.storage_path}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-mute)]">
                    {confidence !== null && (
                      <Pill tone={confidence >= 0.85 ? 'green' : confidence >= 0.6 ? 'amber' : 'red'}>
                        <span className="num">{Math.round(confidence * 100)}%</span> confidence
                      </Pill>
                    )}
                    {proof.status === 'escalated' && <Pill tone="red">Escalated</Pill>}
                    {proof.perceptual_hash && (
                      <span className="num truncate">hash {proof.perceptual_hash.slice(0, 12)}</span>
                    )}
                  </div>

                  <AdminProofActions proofId={proof.id} />
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === 'disputes' && (
        disputes.length === 0 ? (
          <EmptyState
            title="No open disputes"
            body="A dispute opens when a developer marks a report low effort. Specific critical feedback is paid at the same rate as praise, so an empty list is the rule working."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {disputes.map((dispute) => {
              const report = one(dispute.feedback);
              return (
                <Card key={dispute.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="violet">Open dispute</Pill>
                    <span className="text-xs text-[var(--color-mute)]">raised {fmtDateTime(dispute.created_at)}</span>
                    {report && n(report.severity) >= 2 && <Pill tone="amber">Severity {n(report.severity)}</Pill>}
                  </div>

                  <p className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3 text-sm">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                      Developer&apos;s reason
                    </span>
                    <br />
                    {dispute.reason}
                  </p>

                  {report ? (
                    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[var(--color-line)] p-4 text-sm">
                      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-mute)]">
                        <span>Usability <span className="num text-[var(--color-ink)]">{report.score_usability ?? '—'}</span></span>
                        <span>Performance <span className="num text-[var(--color-ink)]">{report.score_performance ?? '—'}</span></span>
                        <span>Clarity <span className="num text-[var(--color-ink)]">{report.score_clarity ?? '—'}</span></span>
                        {report.device_model && <span>{report.device_model}</span>}
                      </div>
                      <ReportField label="First impression" value={report.first_impression} />
                      <ReportField label="What worked" value={report.what_worked} />
                      <ReportField label="What broke" value={report.what_broke} />
                      <ReportField label="Reproduction steps" value={report.repro_steps} />
                      <ReportField label="Suggestion" value={report.suggestion} />
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--color-mute)]">
                      The underlying report is no longer readable. Resolve in the tester&apos;s favour unless you
                      have other evidence.
                    </p>
                  )}

                  <DisputeActions disputeId={dispute.id} />
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === 'feedback' && (
        pending.length === 0 ? (
          <EmptyState
            title="No reports waiting on a creator"
            body="Every submitted report has had a verdict. A backlog here means developers have stopped reviewing, which delays tester payment."
          />
        ) : (
          <div className="flex flex-col gap-2">
            <WarnBox tone="neutral">
              These are the developer&apos;s decision, not yours. They are listed because a long queue here
              means testers are waiting to be paid for work they have already done.
            </WarnBox>
            <Card className="overflow-hidden">
              {pending.map((report) => {
                const app = one(report.apps);
                const tester = one(report.profiles);
                return (
                  <div key={report.id} className="border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{app?.name ?? 'App unavailable'}</span>
                      <Link
                        href={`/admin/users?q=${encodeURIComponent(tester?.handle ?? '')}`}
                        className="text-xs text-[var(--color-dim)] hover:text-[var(--color-accent)]"
                      >
                        @{tester?.handle ?? 'unknown'}
                      </Link>
                      {n(report.severity) >= 2 && <Pill tone="amber">Severity {n(report.severity)}</Pill>}
                      <span className="text-xs text-[var(--color-mute)]">
                        submitted {fmtRelative(report.submitted_at)}
                      </span>
                    </div>
                    {(report.what_broke || report.first_impression) && (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-dim)]">
                        {report.what_broke || report.first_impression}
                      </p>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        )
      )}
    </div>
  );
}

function ReportField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">{label}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-[var(--color-dim)]">{value}</p>
    </div>
  );
}
