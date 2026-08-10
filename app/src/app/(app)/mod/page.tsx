import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Avatar, EmptyState, cx } from '@/components/ui';
import { ProofActions, DisputeActions } from './mod-actions';
import { IconAlert, IconShield } from '@/components/app/icons';
import { fmtDateTime, fmtRelative, n } from '@/lib/pods';
import type { Dispute, Feedback, PodHealthRow, Profile, Proof } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moderation — TesterPool' };

type Tab = 'proofs' | 'disputes' | 'fraud';
const TABS: { key: Tab; label: string }[] = [
  { key: 'proofs', label: 'Proof queue' },
  { key: 'disputes', label: 'Disputes' },
  { key: 'fraud', label: 'Fraud signals' },
];

type ProofRow = Proof & { profiles: Pick<Profile, 'handle' | 'display_name' | 'avatar_url'> | null };
type DisputeRow = Dispute & { feedback: Feedback | Feedback[] | null };

export default async function ModPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('is_moderator')
    .eq('id', user.id)
    .maybeSingle();

  if (!profileRow?.is_moderator) redirect('/dashboard');

  const params = await searchParams;
  const tab: Tab = params.tab === 'disputes' || params.tab === 'fraud' ? params.tab : 'proofs';

  const [{ data: proofRows }, { data: disputeRows }] = await Promise.all([
    supabase
      .from('proofs')
      .select('*, profiles(handle, display_name, avatar_url)')
      .in('status', ['pending', 'escalated'])
      .order('created_at', { ascending: true })
      .limit(40),
    supabase
      .from('disputes')
      .select('*, feedback(*)')
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(40),
  ]);

  const proofs = (proofRows ?? []) as ProofRow[];
  const disputes = (disputeRows ?? []) as DisputeRow[];

  // Signed thumbnails. Storage may not have the object in a partially seeded
  // database, so a missing URL degrades to a "screenshot unavailable" tile.
  const thumbs = new Map<string, string>();
  if (tab === 'proofs' && proofs.length) {
    const { data: signed } = await supabase.storage
      .from('proofs')
      .createSignedUrls(proofs.map((p) => p.storage_path), 3600);
    for (const item of signed ?? []) {
      if (item.signedUrl && item.path) thumbs.set(item.path, item.signedUrl);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <IconShield size={22} /> Moderation
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
            The model auto-approves what it is sure about. Everything else lands here, which is what keeps
            moderation load sublinear as the network grows.
          </p>
        </div>
        <div className="flex gap-2">
          <Pill tone={proofs.length ? 'amber' : 'neutral'}><span className="num">{proofs.length}</span> proofs</Pill>
          <Pill tone={disputes.length ? 'violet' : 'neutral'}><span className="num">{disputes.length}</span> disputes</Pill>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-[var(--color-line)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/mod?tab=${t.key}`}
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

      {tab === 'proofs' && <ProofQueue proofs={proofs} thumbs={thumbs} />}
      {tab === 'disputes' && <DisputeQueue disputes={disputes} />}
      {tab === 'fraud' && <FraudSignals />}
    </div>
  );
}

/* ------------------------------------------------------------ proof queue */

function ProofQueue({ proofs, thumbs }: { proofs: ProofRow[]; thumbs: Map<string, string> }) {
  if (proofs.length === 0) {
    return (
      <EmptyState
        title="The queue is clear"
        body="Nothing is waiting on a human. High-confidence opt-in screenshots approve themselves, so an empty queue is the normal state."
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {proofs.map((proof) => {
        const url = thumbs.get(proof.storage_path);
        const confidence = proof.ai_confidence === null ? null : Number(proof.ai_confidence);
        const uploader = proof.profiles;
        return (
          <Card key={proof.id} className="flex flex-col p-4">
            <div className="flex items-center gap-2.5">
              <Avatar name={uploader?.display_name || uploader?.handle || 'Tester'} src={uploader?.avatar_url} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">@{uploader?.handle ?? 'unknown'}</div>
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
              {proof.perceptual_hash && (
                <span className="num truncate">hash {proof.perceptual_hash.slice(0, 12)}</span>
              )}
            </div>

            <ProofActions proofId={proof.id} />
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- disputes */

function DisputeQueue({ disputes }: { disputes: DisputeRow[] }) {
  if (disputes.length === 0) {
    return (
      <EmptyState
        title="No open disputes"
        body="A dispute opens when a developer marks a report low effort. Until then there is nothing to arbitrate, which is the outcome the rule is designed to produce."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {disputes.map((dispute) => {
        const report = Array.isArray(dispute.feedback) ? dispute.feedback[0] ?? null : dispute.feedback;
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
                <div className="flex gap-4 text-xs text-[var(--color-mute)]">
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

/* ---------------------------------------------------------- fraud signals */

async function FraudSignals() {
  const supabase = await createClient();

  const [{ data: hashRows }, { data: checkinRows }, { data: podRows }] = await Promise.all([
    supabase
      .from('proofs')
      .select('id, uploader_id, perceptual_hash, storage_path, created_at')
      .not('perceptual_hash', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('checkins')
      .select('id, assignment_id, created_at, checkin_date')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('pod_health').select('*').gt('dropouts', 1).limit(30),
  ]);

  const hashes = (hashRows ?? []) as Pick<Proof, 'id' | 'uploader_id' | 'perceptual_hash' | 'created_at'>[];
  const checkins = (checkinRows ?? []) as { id: string; assignment_id: string; created_at: string }[];
  const pods = (podRows ?? []) as PodHealthRow[];

  const byHash = new Map<string, typeof hashes>();
  for (const proof of hashes) {
    if (!proof.perceptual_hash) continue;
    const list = byHash.get(proof.perceptual_hash) ?? [];
    list.push(proof);
    byHash.set(proof.perceptual_hash, list);
  }
  const duplicates = [...byHash.entries()].filter(([, list]) => list.length > 1);

  // Velocity: several check-ins committed inside the same ten-minute window is
  // the shape of someone clearing a backlog of assignments without opening a
  // single app.
  const bucket = new Map<string, number>();
  for (const c of checkins) {
    const stamp = new Date(c.created_at).getTime();
    if (!Number.isFinite(stamp)) continue;
    const key = `${Math.floor(stamp / 600_000)}`;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }
  const burstWindows = [...bucket.entries()]
    .filter(([, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({ at: new Date(Number(key) * 600_000).toISOString(), count }));

  const nothing = duplicates.length === 0 && burstWindows.length === 0 && pods.length === 0;

  if (nothing) {
    return (
      <EmptyState
        title="No fraud signals"
        body="Duplicate screenshots, check-in bursts and dropout clusters all come back clean on the data available. Signals appear here the moment any of the three trip."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Signal
        title="Duplicate screenshots"
        note="The same image submitted more than once. Usually one tester reusing a capture across apps."
        count={duplicates.length}
      >
        {duplicates.map(([hash, list]) => (
          <div key={hash} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
            <span className="num text-xs text-[var(--color-dim)]">{hash.slice(0, 16)}</span>
            <Pill tone="red"><span className="num">{list.length}</span> uploads</Pill>
            <span className="text-xs text-[var(--color-mute)]">
              {new Set(list.map((p) => p.uploader_id)).size} distinct uploaders · latest {fmtRelative(list[0]?.created_at)}
            </span>
          </div>
        ))}
      </Signal>

      <Signal
        title="Check-in bursts"
        note="Five or more check-ins committed network-wide inside a ten-minute window."
        count={burstWindows.length}
      >
        {burstWindows.map((w) => (
          <div key={w.at} className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
            <span className="text-xs text-[var(--color-dim)]">{fmtDateTime(w.at)}</span>
            <Pill tone="amber"><span className="num">{w.count}</span> check-ins</Pill>
          </div>
        ))}
      </Signal>

      <Signal
        title="Dropout clusters"
        note="Pods losing more than one member. Two dropouts in one pod is usually coordination, not coincidence."
        count={pods.length}
      >
        {pods.map((pod) => (
          <div key={pod.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
            <span className="text-sm font-medium">{pod.name || `Pod ${pod.code}`}</span>
            <Pill tone="red"><span className="num">{n(pod.dropouts)}</span> dropouts</Pill>
            <span className="text-xs text-[var(--color-mute)]">
              <span className="num">{n(pod.members)}</span> of <span className="num">{n(pod.core_seats)}</span> seats ·
              avg <span className="num">{n(pod.avg_days).toFixed(1)}</span> days active
            </span>
          </div>
        ))}
      </Signal>
    </div>
  );
}

function Signal({
  title, note, count, children,
}: { title: string; note: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Pill tone={count > 0 ? 'amber' : 'neutral'}><span className="num">{count}</span></Pill>
      </div>
      <p className="mb-2 text-xs text-[var(--color-mute)]">{note}</p>
      <Card className="overflow-hidden">
        {count === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--color-mute)]">Nothing flagged.</p>
        ) : (
          children
        )}
      </Card>
    </section>
  );
}
