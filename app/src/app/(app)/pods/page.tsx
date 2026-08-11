import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Avatar, EmptyState, ProgressRing } from '@/components/ui';
import { JoinPodButton, StartPodButton, type JoinableApp } from './pod-actions';
import { IconArrow, IconPlus } from '@/components/app/icons';
import { RULES } from '@/lib/economy';
import { estimateStart, fmtDate, n, podDay, POD_STATUS_COPY } from '@/lib/pods';
import type { AppRow, PodHealthRow, PodMember, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pods — TesterPool' };

type MemberRow = Pick<PodMember, 'pod_id' | 'user_id' | 'app_id' | 'status'> & {
  profiles: Pick<Profile, 'handle' | 'display_name' | 'avatar_url' | 'reliability' | 'tier'> | null;
};

export default async function PodsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const [{ data: healthRows }, { data: appRows }, { data: myMemberRows }] = await Promise.all([
    supabase.from('pod_health').select('*').order('members', { ascending: false }).limit(60),
    supabase.from('apps').select('*').eq('owner_id', user.id),
    supabase.from('pod_members').select('pod_id, user_id, app_id, status').eq('user_id', user.id),
  ]);

  const health = (healthRows ?? []) as PodHealthRow[];
  const apps = (appRows ?? []) as AppRow[];
  const myMemberships = (myMemberRows ?? []) as Pick<PodMember, 'pod_id' | 'app_id' | 'status'>[];
  const myPodIds = new Set(myMemberships.map((m) => m.pod_id));

  const forming = health.filter((p) => p.status === 'forming');
  const mine = health.filter((p) => myPodIds.has(p.id));

  const visibleIds = [...new Set([...forming.map((p) => p.id), ...mine.map((p) => p.id)])];
  const { data: memberRows } = visibleIds.length
    ? await supabase
        .from('pod_members')
        .select('pod_id, user_id, app_id, status, profiles(handle, display_name, avatar_url, reliability, tier)')
        .in('pod_id', visibleIds)
    : { data: [] };

  const members = (memberRows ?? []) as unknown as MemberRow[];
  const byPod = new Map<string, MemberRow[]>();
  for (const m of members) {
    const list = byPod.get(m.pod_id) ?? [];
    list.push(m);
    byPod.set(m.pod_id, list);
  }

  const joinable = apps
    .filter((a) => a.status === 'draft' || a.status === 'queued')
    .map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      reachable: !!a.opt_in_url || !!a.google_group,
    }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pods</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
            {RULES.podSeats} developers testing each other for {RULES.requiredDays} days. Google needs{' '}
            {RULES.requiredTesters}, so three can drop out and your clock still holds.
          </p>
        </div>
        {apps.length === 0 && (
          <Link href="/onboarding" className="btn btn-primary">
            <IconPlus size={15} /> List your app
          </Link>
        )}
      </header>

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
            Your pods
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {mine.map((pod) => (
              <MyPodCard key={pod.id} pod={pod} members={byPod.get(pod.id) ?? []} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
              Forming pods
            </h2>
            <p className="mt-1 text-sm text-[var(--color-dim)]">
              Join the fullest one. It starts sooner.
            </p>
          </div>
        </div>

        {forming.length === 0 ? (
          <EmptyState
            title="No pods are forming right now"
            body="Join anyway and we open one for you. It fills as other developers arrive, usually within a few days."
            action={
              joinable.length > 0
                ? <div className="w-56"><JoinPodButton apps={joinable} /></div>
                : <Link href="/onboarding" className="btn btn-primary">List your app <IconArrow size={15} /></Link>
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {forming.map((pod) => (
              <FormingPodCard
                key={pod.id}
                pod={pod}
                members={byPod.get(pod.id) ?? []}
                joinable={joinable}
                alreadyIn={myPodIds.has(pod.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function avgReliability(members: MemberRow[]): number | null {
  const scores = members.map((m) => n(m.profiles?.reliability, NaN)).filter((v) => Number.isFinite(v));
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function MemberStrip({ members, seats }: { members: MemberRow[]; seats: number }) {
  const shown = members.slice(0, 8);
  const rest = Math.max(0, members.length - shown.length);
  const empty = Math.max(0, Math.min(4, seats - members.length));

  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <span key={`${m.pod_id}-${m.user_id}`} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar
            name={m.profiles?.display_name || m.profiles?.handle || 'Member'}
            src={m.profiles?.avatar_url}
            size={28}
            ring="var(--color-surface)"
          />
        </span>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <span
          key={`empty-${i}`}
          className="inline-block rounded-full border border-dashed border-[var(--color-line-hi)]"
          style={{ width: 28, height: 28, marginLeft: shown.length === 0 && i === 0 ? 0 : -8, background: 'var(--color-bg)' }}
        />
      ))}
      {rest > 0 && <span className="num ml-2 text-xs text-[var(--color-mute)]">+{rest}</span>}
    </div>
  );
}

function FormingPodCard({
  pod, members, joinable, alreadyIn,
}: {
  pod: PodHealthRow;
  members: MemberRow[];
  joinable: JoinableApp[];
  alreadyIn: boolean;
}) {
  const filled = n(pod.members);
  const seats = n(pod.core_seats, RULES.podSeats);
  const pct = seats > 0 ? Math.min(100, Math.round((filled / seats) * 100)) : 0;
  const reliability = avgReliability(members);

  return (
    <Card hover className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{pod.name || `Pod ${pod.code}`}</h3>
            <Pill tone={POD_STATUS_COPY[pod.status].tone}>{POD_STATUS_COPY[pod.status].label}</Pill>
          </div>
          <p className="mt-1 text-xs text-[var(--color-mute)]">
            Code <span className="num">{pod.code}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="num text-2xl font-bold leading-none">
            {filled}<span className="text-[var(--color-mute)]">/{seats}</span>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-mute)]">seats</div>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--color-accent)' }} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MemberStrip members={members} seats={seats} />
        <div className="flex items-center gap-4 text-xs text-[var(--color-mute)]">
          <span>
            Avg reliability{' '}
            <span className="num font-semibold text-[var(--color-ink)]">
              {reliability === null ? '—' : Math.round(reliability)}
            </span>
          </span>
          <span>{estimateStart(filled, seats)}</span>
        </div>
      </div>

      {alreadyIn ? (
        filled >= seats ? (
          <StartPodButton podId={pod.id} />
        ) : (
          <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-dim)]">
            You are in this pod. It starts when the last seat fills.
          </p>
        )
      ) : (
        <JoinPodButton apps={joinable} />
      )}
    </Card>
  );
}

function MyPodCard({ pod, members }: { pod: PodHealthRow; members: MemberRow[] }) {
  const duration = RULES.requiredDays;
  const day = podDay(pod.starts_at, duration);
  const seats = n(pod.core_seats, RULES.podSeats);

  return (
    <Card className="flex items-center gap-5 p-5">
      {pod.status === 'active' ? (
        <ProgressRing value={Math.max(day, 0)} max={duration} size={92} stroke={8} caption="Day" />
      ) : (
        <div className="flex h-[92px] w-[92px] shrink-0 flex-col items-center justify-center rounded-full border border-[var(--color-line)]">
          <span className="num text-xl font-bold">{n(pod.members)}</span>
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-mute)]">of {seats}</span>
        </div>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{pod.name || `Pod ${pod.code}`}</h3>
          <Pill tone={POD_STATUS_COPY[pod.status].tone}>{POD_STATUS_COPY[pod.status].label}</Pill>
        </div>
        <p className="mt-1 text-sm text-[var(--color-dim)]">
          {pod.status === 'active'
            ? <>Ends {fmtDate(pod.ends_at)} · <span className="num">{n(pod.verified_optins)}</span> verified opt-ins · <span className="num">{n(pod.dropouts)}</span> dropouts</>
            : pod.status === 'forming'
              ? estimateStart(n(pod.members), seats)
              : `Completed ${fmtDate(pod.ends_at)}`}
        </p>
        <div className="mt-3">
          <MemberStrip members={members} seats={seats} />
        </div>
      </div>
      <Link href="/dashboard" className="btn btn-ghost ml-auto shrink-0">
        <IconArrow size={15} />
      </Link>
    </Card>
  );
}
