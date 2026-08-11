import * as React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Avatar, EmptyState, StreakStrip, cx } from '@/components/ui';
import { Section, WarnBox } from '@/components/admin/parts';
import { PodActions } from '@/components/admin/pod-actions';
import { fmtDate, stripFor, POD_STATUS_COPY, n } from '@/lib/pods';
import { RULES } from '@/lib/economy';
import { num, podRisk, RISK_LABEL, RISK_TONE, type AdminPodWatchRow } from '@/lib/admin';
import type { PodStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  status?: string;
  pod?: string;
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'active', label: 'Active' },
  { key: 'forming', label: 'Forming' },
  { key: 'all', label: 'All' },
];

export default async function AdminPodsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filter = params.status ?? 'open';
  const supabase = await createClient();

  const { data: podRows, error } = await supabase.from('admin_pod_watch').select('*').limit(300);
  const allPods = (podRows ?? []) as AdminPodWatchRow[];

  const filtered = allPods.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'active') return p.status === 'active';
    if (filter === 'forming') return p.status === 'forming';
    return p.status === 'active' || p.status === 'forming' || p.status === 'locked';
  });

  const ranked = filtered
    .map((pod) => ({ pod, risk: podRisk(pod) }))
    .sort((a, b) => b.risk.score - a.risk.score)
    .slice(0, 30);

  const podIds = ranked.map((r) => r.pod.id);

  // Members and their per-tester progress, in two queries rather than one per pod.
  const [{ data: memberRows }, { data: assignmentRows }] = podIds.length
    ? await Promise.all([
        supabase
          .from('pod_members')
          .select('pod_id, user_id, status, seat, profiles(handle, display_name, avatar_url)')
          .in('pod_id', podIds)
          .limit(1000),
        supabase
          .from('assignments')
          .select('pod_id, tester_id, days_checked_in, status')
          .in('pod_id', podIds)
          .limit(4000),
      ])
    : [{ data: [] }, { data: [] }];

  type MemberRow = {
    pod_id: string;
    user_id: string;
    status: string;
    seat: string;
    profiles:
      | { handle: string; display_name: string | null; avatar_url: string | null }
      | { handle: string; display_name: string | null; avatar_url: string | null }[]
      | null;
  };
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  const membersByPod = new Map<string, MemberRow[]>();
  for (const m of (memberRows ?? []) as MemberRow[]) {
    const list = membersByPod.get(m.pod_id) ?? [];
    list.push(m);
    membersByPod.set(m.pod_id, list);
  }

  // Best progress a tester has in a pod. A tester holds one assignment per app,
  // so the highest count is the clock most likely to be intact.
  const progress = new Map<string, number>();
  for (const a of (assignmentRows ?? []) as { pod_id: string; tester_id: string; days_checked_in: number | null }[]) {
    const key = `${a.pod_id}:${a.tester_id}`;
    progress.set(key, Math.max(progress.get(key) ?? 0, n(a.days_checked_in)));
  }

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Pod control"
        note="Sorted by risk, not by date. The pod quietly failing sorts above the twelve that are fine."
        right={
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === 'open' ? '/admin/pods' : `/admin/pods?status=${f.key}`}
                className={cx(
                  'btn',
                  filter === f.key ? 'btn-secondary' : 'btn-ghost'
                )}
              >
                {f.label}
              </Link>
            ))}
          </div>
        }
      >
        {error && <WarnBox tone="red">The pod query failed: {error.message}</WarnBox>}
      </Section>

      {ranked.length === 0 ? (
        <EmptyState
          title="No pods match"
          body="Nothing in admin_pod_watch matches this filter. Switch to All to see completed and failed pods."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {ranked.map(({ pod, risk }) => {
            const duration = RULES.requiredDays;
            const day = num(pod.day_index);
            const members = membersByPod.get(pod.id) ?? [];
            const label = pod.name || (pod.code ? `Pod ${pod.code}` : 'Unnamed pod');
            const statusCopy = POD_STATUS_COPY[pod.status as PodStatus] ?? { label: pod.status, tone: 'neutral' as const };
            const seats = num(pod.core_seats, RULES.podSeats);
            const memberCount = num(pod.members);

            return (
              <Card key={pod.id} className={cx('p-5', params.pod === pod.id && 'border-[var(--color-line-hi)]')} id={pod.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">{label}</h2>
                      <Pill tone={statusCopy.tone}>{statusCopy.label}</Pill>
                      <Pill tone={RISK_TONE[risk.level]}>{RISK_LABEL[risk.level]}</Pill>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-mute)]">
                      <span>
                        seats <span className="num text-[var(--color-ink)]">{memberCount}</span>
                        <span className="num"> / {seats}</span>
                      </span>
                      <span>
                        day <span className="num text-[var(--color-ink)]">{day}</span> of{' '}
                        <span className="num">{duration}</span>
                      </span>
                      <span className={num(pod.dropouts) > 0 ? 'text-[var(--color-danger)]' : undefined}>
                        dropouts <span className="num">{num(pod.dropouts)}</span>
                      </span>
                      <span>
                        avg days <span className="num text-[var(--color-ink)]">{num(pod.avg_days).toFixed(1)}</span>
                      </span>
                      <span>
                        apps on track{' '}
                        <span className="num text-[var(--color-ink)]">{num(pod.apps_on_track)}</span>
                      </span>
                      <span>
                        active assignments <span className="num">{num(pod.active_assignments)}</span>
                      </span>
                      <span>starts {fmtDate(pod.starts_at)}</span>
                      <span>ends {fmtDate(pod.ends_at)}</span>
                    </div>
                  </div>
                </div>

                {risk.reasons.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1">
                    {risk.reasons.map((reason, i) => (
                      <li key={i} className="text-xs" style={{ color: risk.level === 'critical' ? 'var(--color-danger)' : 'var(--color-credit)' }}>
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}

                {/* --------------------------------------------- members */}
                <div className="mt-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                    Members and streaks
                  </h3>
                  {members.length === 0 ? (
                    <p className="mt-1 text-xs text-[var(--color-mute)]">
                      No membership rows for this pod. It may have been created but never filled.
                    </p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {members.map((m) => {
                        const p = one(m.profiles);
                        const done = progress.get(`${pod.id}:${m.user_id}`) ?? 0;
                        const dropped = m.status === 'dropped' || m.status === 'removed';
                        return (
                          <Link
                            key={`${pod.id}-${m.user_id}`}
                            href={`/admin/users?q=${encodeURIComponent(p?.handle ?? '')}`}
                            className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] px-2.5 py-2 transition-colors hover:border-[var(--color-line-hi)]"
                          >
                            <Avatar
                              name={p?.display_name || p?.handle || 'Member'}
                              src={p?.avatar_url}
                              size={26}
                              ring={dropped ? 'color-mix(in oklab, var(--color-danger) 60%, transparent)' : undefined}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">@{p?.handle ?? 'unknown'}</span>
                              <StreakStrip
                                days={stripFor(dropped ? 0 : done, pod.status === 'active' ? day : 0, duration)}
                                total={duration}
                                size={7}
                                gap={2}
                              />
                            </span>
                            {dropped && <Pill tone="red">out</Pill>}
                            {m.seat !== 'core' && !dropped && <Pill tone="violet">{m.seat}</Pill>}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* --------------------------------------------- actions */}
                <div className="mt-4 border-t border-[var(--color-line)] pt-4">
                  <PodActions
                    podId={pod.id}
                    podLabel={label}
                    status={pod.status}
                    members={memberCount}
                    dayIndex={day}
                    duration={duration}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
