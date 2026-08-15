import * as React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, EmptyState } from '@/components/ui';
import { Section, WarnBox } from '@/components/admin/parts';
import { fmtDateTime, fmtRelative } from '@/lib/format';

export const dynamic = 'force-dynamic';

const BURST_WINDOW_MS = 600_000; // ten minutes
const BURST_THRESHOLD = 4;
const TIGHT_START_MS = 300_000; // five minutes
const TIGHT_START_MIN = 3;

interface ProofLite {
  id: string;
  uploader_id: string;
  perceptual_hash: string | null;
  created_at: string;
}
interface CheckinLite {
  id: string;
  assignment_id: string;
  created_at: string;
}
interface AssignmentLite {
  id: string;
  tester_id: string;
  created_at: string;
}
interface ProfileLite {
  id: string;
  handle: string;
  signup_ip_hash: string | null;
  device_fp_hash: string | null;
  created_at: string;
}

export default async function AdminFraudPage() {
  const supabase = await createClient();

  const [{ data: proofRows }, { data: checkinRows }, { data: assignmentRows }, { data: profileRows }] =
    await Promise.all([
      supabase
        .from('proofs')
        .select('id, uploader_id, perceptual_hash, created_at')
        .not('perceptual_hash', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('checkins')
        .select('id, assignment_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('assignments')
        .select('id, tester_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('profiles')
        .select('id, handle, signup_ip_hash, device_fp_hash, created_at')
        .limit(1000),
    ]);

  const proofs = (proofRows ?? []) as ProofLite[];
  const checkins = (checkinRows ?? []) as CheckinLite[];
  const assignments = (assignmentRows ?? []) as AssignmentLite[];
  const profiles = (profileRows ?? []) as ProfileLite[];

  const handleOf = new Map(profiles.map((p) => [p.id, p.handle]));
  const testerOfAssignment = new Map(assignments.map((a) => [a.id, a.tester_id]));

  /* ------------------------------------------------- duplicate screenshots */
  const byHash = new Map<string, ProofLite[]>();
  for (const proof of proofs) {
    if (!proof.perceptual_hash) continue;
    const list = byHash.get(proof.perceptual_hash) ?? [];
    list.push(proof);
    byHash.set(proof.perceptual_hash, list);
  }
  const duplicates = [...byHash.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([hash, list]) => ({
      hash,
      list,
      uploaders: [...new Set(list.map((p) => p.uploader_id))],
    }))
    .sort((a, b) => b.list.length - a.list.length)
    .slice(0, 20);

  /* ------------------------------------------------------ check-in bursts */
  const perUserWindow = new Map<string, number>();
  for (const checkin of checkins) {
    const tester = testerOfAssignment.get(checkin.assignment_id);
    if (!tester) continue;
    const stamp = new Date(checkin.created_at).getTime();
    if (!Number.isFinite(stamp)) continue;
    const key = `${tester}:${Math.floor(stamp / BURST_WINDOW_MS)}`;
    perUserWindow.set(key, (perUserWindow.get(key) ?? 0) + 1);
  }
  const bursts = [...perUserWindow.entries()]
    .filter(([, count]) => count >= BURST_THRESHOLD)
    .map(([key, count]) => {
      const [userId, bucket] = key.split(':');
      return { userId, at: new Date(Number(bucket) * BURST_WINDOW_MS).toISOString(), count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  /* --------------------------------------------- synchronised assignments */
  const byTester = new Map<string, AssignmentLite[]>();
  for (const assignment of assignments) {
    const list = byTester.get(assignment.tester_id) ?? [];
    list.push(assignment);
    byTester.set(assignment.tester_id, list);
  }
  const synchronised = [...byTester.entries()]
    .map(([testerId, list]) => {
      const stamps = list
        .map((a) => new Date(a.created_at).getTime())
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b);
      if (stamps.length < TIGHT_START_MIN) return null;
      const spread = stamps[stamps.length - 1] - stamps[0];
      if (spread > TIGHT_START_MS) return null;
      return { testerId, count: stamps.length, spreadSeconds: Math.round(spread / 1000), at: new Date(stamps[0]).toISOString() };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  /* ------------------------------------------------------ shared identity */
  function shareGroups(field: 'signup_ip_hash' | 'device_fp_hash') {
    const map = new Map<string, ProfileLite[]>();
    for (const profile of profiles) {
      const value = profile[field];
      if (!value) continue;
      const list = map.get(value) ?? [];
      list.push(profile);
      map.set(value, list);
    }
    return [...map.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([value, list]) => ({ value, list }))
      .sort((a, b) => b.list.length - a.list.length)
      .slice(0, 20);
  }
  const sharedIp = shareGroups('signup_ip_hash');
  const sharedDevice = shareGroups('device_fp_hash');

  const total =
    duplicates.length + bursts.length + synchronised.length + sharedIp.length + sharedDevice.length;

  if (total === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Section
          title="Fraud signals"
          note="Five heuristics run over the most recent proofs, check-ins, assignments and accounts. None of them are proof of anything on their own."
        >
          <EmptyState
            title="No signals"
            body="No duplicate screenshots, no check-in bursts, no synchronised assignment starts and no shared signup or device fingerprints on the data available. An empty page here is the expected state."
          />
        </Section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Fraud signals"
        note="Each of these is a shape, not a verdict. Read the explanation before acting: several have innocent explanations, and a wrong ban costs someone a month."
      >
        <WarnBox tone="neutral">
          Signals are computed from the most recent 1,000 rows of each of proofs, check-ins, assignments and
          accounts, which is the read ceiling. An older pattern will not appear here.
        </WarnBox>
      </Section>

      <Signal
        title="Duplicate screenshots"
        why="The same image, by perceptual hash, submitted more than once. Usually one tester reusing a single opt-in capture across several apps, which means the opt-in it evidences never happened for most of them."
        count={duplicates.length}
      >
        {duplicates.map(({ hash, list, uploaders }) => (
          <div key={hash} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
            <span className="num text-xs text-[var(--color-dim)]">{hash.slice(0, 16)}</span>
            <Pill tone="red"><span className="num">{list.length}</span> uploads</Pill>
            <span className="text-xs text-[var(--color-mute)]">
              latest {fmtRelative(list[0]?.created_at)}
            </span>
            <span className="flex flex-wrap gap-2">
              {uploaders.map((id) => (
                <UserLink key={id} handle={handleOf.get(id)} />
              ))}
            </span>
          </div>
        ))}
      </Signal>

      <Signal
        title="Check-in bursts"
        why={`One account committing ${BURST_THRESHOLD} or more check-ins inside a ten-minute window. Testing four apps properly takes longer than ten minutes, so this is the shape of someone clearing a backlog without opening anything.`}
        count={bursts.length}
      >
        {bursts.map((burst) => (
          <div key={`${burst.userId}-${burst.at}`} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
            <UserLink handle={handleOf.get(burst.userId)} />
            <Pill tone="amber"><span className="num">{burst.count}</span> check-ins</Pill>
            <span className="text-xs text-[var(--color-mute)]">around {fmtDateTime(burst.at)}</span>
          </div>
        ))}
      </Signal>

      <Signal
        title="Synchronised assignment starts"
        why={`An account whose ${TIGHT_START_MIN}+ assignments were all created inside five minutes of each other. Normal picking up work off the feed is spread over days; this pattern suggests a script taking seats in bulk.`}
        count={synchronised.length}
      >
        {synchronised.map((row) => (
          <div key={row.testerId} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
            <UserLink handle={handleOf.get(row.testerId)} />
            <Pill tone="amber"><span className="num">{row.count}</span> assignments</Pill>
            <span className="text-xs text-[var(--color-mute)]">
              all within <span className="num">{row.spreadSeconds}</span> seconds, starting {fmtDateTime(row.at)}
            </span>
          </div>
        ))}
      </Signal>

      <Signal
        title="Shared signup IP"
        why="Accounts created from the same hashed IP. Shared offices, universities and mobile carriers produce this legitimately, so treat it as a reason to look rather than a reason to act."
        count={sharedIp.length}
      >
        {sharedIp.map(({ value, list }) => (
          <div key={value} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
            <span className="num text-xs text-[var(--color-dim)]">{value.slice(0, 16)}</span>
            <Pill tone="amber"><span className="num">{list.length}</span> accounts</Pill>
            <span className="flex flex-wrap gap-2">
              {list.slice(0, 10).map((p) => <UserLink key={p.id} handle={p.handle} />)}
            </span>
          </div>
        ))}
      </Signal>

      <Signal
        title="Shared device fingerprint"
        why="Accounts sharing a device fingerprint. Much stronger than a shared IP: one browser profile signing up repeatedly is the standard shape of a multi-account farm."
        count={sharedDevice.length}
      >
        {sharedDevice.map(({ value, list }) => (
          <div key={value} className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
            <span className="num text-xs text-[var(--color-dim)]">{value.slice(0, 16)}</span>
            <Pill tone="red"><span className="num">{list.length}</span> accounts</Pill>
            <span className="flex flex-wrap gap-2">
              {list.slice(0, 10).map((p) => <UserLink key={p.id} handle={p.handle} />)}
            </span>
          </div>
        ))}
      </Signal>
    </div>
  );
}

function UserLink({ handle }: { handle: string | undefined }) {
  if (!handle) return <span className="text-xs text-[var(--color-mute)]">unknown account</span>;
  return (
    <Link
      href={`/admin/users?q=${encodeURIComponent(handle)}`}
      className="text-xs font-medium text-[var(--color-dim)] hover:text-[var(--color-accent)]"
    >
      @{handle}
    </Link>
  );
}

function Signal({
  title,
  why,
  count,
  children,
}: {
  title: string;
  why: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Section title={title} note={why} right={<Pill tone={count > 0 ? 'amber' : 'neutral'}><span className="num">{count}</span></Pill>}>
      <Card className="overflow-hidden">
        {count === 0 ? (
          <p className="px-4 py-5 text-center text-sm text-[var(--color-mute)]">No signals.</p>
        ) : (
          children
        )}
      </Card>
    </Section>
  );
}
