import * as React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Stat, Avatar, EmptyState, CreditChip } from '@/components/ui';
import { Section, RowList, Row, Sparkline, WarnBox, type SparkPoint } from '@/components/admin/parts';
import { podDay, missedDays, n } from '@/lib/pods';
import { RULES } from '@/lib/economy';
import { currencyHealth, VERDICT_TONE } from '@/lib/admin-economy';
import { num, podRisk, RISK_LABEL, RISK_TONE, type AdminOverviewRow, type AdminPodWatchRow } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

function utcKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The 14 UTC days ending today, oldest first. Built outside the component so
 * the clock read is not a render-time side effect.
 */
function trailingDays(count = 14): { key: string; label: string }[] {
  const today = new Date().getTime();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today - (count - 1 - i) * DAY_MS);
    return {
      key: utcKey(d),
      label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
    };
  });
}

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const days = trailingDays();

  const [
    { data: overviewRow },
    checkinCounts,
    { data: podRows },
    { data: assignmentRows },
  ] = await Promise.all([
    supabase.from('admin_overview').select('*').maybeSingle(),
    // Counted per day rather than fetched. PostgREST caps a row read at 1,000,
    // and a silently truncated sparkline is worse than no sparkline.
    Promise.all(
      days.map((day) =>
        supabase
          .from('checkins')
          .select('id', { count: 'exact', head: true })
          .eq('checkin_date', day.key)
          .then((res) => res.count ?? 0)
      )
    ),
    supabase.from('admin_pod_watch').select('*').limit(200),
    supabase
      .from('assignments')
      .select('id, tester_id, days_checked_in, status, pod_id, profiles(handle, display_name, avatar_url), pods(code, name, starts_at, duration_days, status)')
      .in('status', ['active', 'opt_in_pending'])
      .limit(500),
  ]);

  const overview = (overviewRow ?? null) as AdminOverviewRow | null;
  const pods = ((podRows ?? []) as AdminPodWatchRow[]).filter(
    (p) => p.status === 'active' || p.status === 'forming' || p.status === 'locked'
  );

  /* ------------------------------------------------------------ sparkline */
  const spark: SparkPoint[] = days.map((day, i) => ({
    label: day.label,
    value: checkinCounts[i] ?? 0,
  }));
  const sparkTotal = spark.reduce((a, p) => a + p.value, 0);
  const sparkPeak = Math.max(0, ...spark.map((p) => p.value));

  /* ------------------------------------------------------- needs attention */
  type Membership = {
    id: string;
    tester_id: string;
    days_checked_in: number | null;
    status: string;
    pod_id: string;
    profiles: { handle: string; display_name: string | null; avatar_url: string | null } | { handle: string; display_name: string | null; avatar_url: string | null }[] | null;
    pods: { code: string | null; name: string | null; starts_at: string | null; duration_days: number | null; status: string } | { code: string | null; name: string | null; starts_at: string | null; duration_days: number | null; status: string }[] | null;
  };

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  // One row per tester, not per assignment. A tester holds one assignment per
  // app in the pod, so the naive list repeats the same person a dozen times and
  // buries everyone else.
  type Lagging = {
    testerId: string;
    handle: string;
    name: string;
    avatar: string | null;
    missed: number;
    day: number;
    tests: number;
    podLabel: string;
  };

  const laggingByTester = new Map<string, Lagging>();
  for (const row of (assignmentRows ?? []) as Membership[]) {
    const pod = one(row.pods);
    const profile = one(row.profiles);
    if (!pod || pod.status !== 'active') continue;
    const day = podDay(pod.starts_at, pod.duration_days ?? RULES.requiredDays);
    const missed = missedDays(n(row.days_checked_in), day);
    if (missed < 2) continue;

    const existing = laggingByTester.get(row.tester_id);
    if (existing) {
      existing.missed = Math.max(existing.missed, missed);
      existing.tests += 1;
      continue;
    }
    laggingByTester.set(row.tester_id, {
      testerId: row.tester_id,
      handle: profile?.handle ?? 'unknown',
      name: profile?.display_name ?? profile?.handle ?? 'Unknown tester',
      avatar: profile?.avatar_url ?? null,
      missed,
      day,
      tests: 1,
      podLabel: pod.name || (pod.code ? `Pod ${pod.code}` : 'Unnamed pod'),
    });
  }
  const laggingTesters = [...laggingByTester.values()].sort((a, b) => b.missed - a.missed);

  const riskyPods = pods
    .map((pod) => ({ pod, risk: podRisk(pod) }))
    .filter((entry) => entry.risk.reasons.length > 0)
    .sort((a, b) => b.risk.score - a.risk.score);

  const pendingProofs = num(overview?.proofs_pending);
  const openDisputes = num(overview?.disputes_open);
  const unreviewedFeedback = num(overview?.feedback_unreviewed);

  const attentionTotal =
    riskyPods.length + laggingTesters.length + (pendingProofs > 0 ? 1 : 0) + (openDisputes > 0 ? 1 : 0) + (unreviewedFeedback > 0 ? 1 : 0);

  /* -------------------------------------------------------- economy health */
  const health = currencyHealth(
    num(overview?.credits_minted),
    num(overview?.credits_burned),
    num(overview?.credits_outstanding)
  );

  return (
    <div className="flex flex-col gap-8">
      {/* ------------------------------------------------------- headline */}
      <Section title="Headline" note="One row from admin_overview, read live.">
        {overview ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Users" value={num(overview.users)} sub={`${num(overview.users_7d)} joined in 7 days`} />
            <Stat
              label="Banned"
              value={num(overview.banned)}
              sub={num(overview.banned) > 0 ? 'Removed from pods on ban' : 'None'}
              tone={num(overview.banned) > 0 ? 'var(--color-danger)' : undefined}
            />
            <Stat label="Apps" value={num(overview.apps)} sub={`${num(overview.apps_graduated)} graduated`} />
            <Stat
              label="Pods active"
              value={num(overview.pods_active)}
              sub={`${num(overview.pods_forming)} still forming`}
            />
            <Stat
              label="Assignments"
              value={num(overview.assignments_active)}
              sub={`${num(overview.assignments_dropped)} dropped`}
              tone={num(overview.assignments_dropped) > 0 ? 'var(--color-credit)' : undefined}
            />
            <Stat
              label="Check-ins today"
              value={num(overview.checkins_today)}
              sub={`avg ${num(overview.avg_days).toFixed(1)} days per assignment`}
            />
          </div>
        ) : (
          <WarnBox tone="amber">
            admin_overview returned no row. Either the view is empty or this account lost its admin read.
          </WarnBox>
        )}
      </Section>

      {/* ---------------------------------------------------- needs attention */}
      <Section
        title="Needs attention"
        note="Everything below is something a person has to decide. Each row links to the screen where it gets fixed."
        right={
          <Pill tone={attentionTotal > 0 ? 'amber' : 'green'}>
            <span className="num">{attentionTotal}</span> open
          </Pill>
        }
      >
        {attentionTotal === 0 ? (
          <EmptyState
            title="Nothing is waiting on you"
            body="No pod is losing members, no tester has missed two days, the proof queue is clear and there are no open disputes. This is the state the automation is supposed to hold."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {riskyPods.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  Pods off track
                </h3>
                <RowList>
                  {riskyPods.slice(0, 8).map(({ pod, risk }) => (
                    <Row key={pod.id} href={`/admin/pods?pod=${pod.id}`}>
                      <Pill tone={RISK_TONE[risk.level]}>{RISK_LABEL[risk.level]}</Pill>
                      <span className="text-sm font-medium">{pod.name || `Pod ${pod.code ?? ''}`}</span>
                      <span className="text-xs text-[var(--color-mute)]">
                        day <span className="num">{num(pod.day_index)}</span> of{' '}
                        <span className="num">{RULES.requiredDays}</span>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-dim)]">
                        {risk.reasons[0]}
                      </span>
                    </Row>
                  ))}
                </RowList>
              </div>
            )}

            {laggingTesters.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  Testers who have missed two or more days
                </h3>
                <RowList>
                  {laggingTesters.slice(0, 10).map((t) => (
                    <Row key={t.testerId} href={`/admin/users?q=${encodeURIComponent(t.handle)}`}>
                      <Avatar name={t.name} src={t.avatar} size={26} />
                      <span className="text-sm font-medium">@{t.handle}</span>
                      <Pill tone={t.missed >= 3 ? 'red' : 'amber'}>
                        <span className="num">{t.missed}</span> days missed
                      </Pill>
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-mute)]">
                        {t.podLabel} · day <span className="num">{t.day}</span> · affects{' '}
                        <span className="num">{t.tests}</span>{' '}
                        {t.tests === 1 ? 'app' : 'apps'} they are testing. Two misses inside a 14-day window
                        usually becomes a dropout.
                      </span>
                    </Row>
                  ))}
                </RowList>
              </div>
            )}

            <RowList>
              {pendingProofs > 0 && (
                <Row href="/admin/moderation">
                  <Pill tone="amber"><span className="num">{pendingProofs}</span></Pill>
                  <span className="text-sm font-medium">Proofs waiting on a human</span>
                  <span className="text-xs text-[var(--color-mute)]">
                    Opt-in credit is escrowed until each one is reviewed.
                  </span>
                </Row>
              )}
              {openDisputes > 0 && (
                <Row href="/admin/moderation?tab=disputes">
                  <Pill tone="violet"><span className="num">{openDisputes}</span></Pill>
                  <span className="text-sm font-medium">Open disputes</span>
                  <span className="text-xs text-[var(--color-mute)]">
                    A tester is unpaid until this is arbitrated. Specific critical feedback is paid at the
                    same rate as praise.
                  </span>
                </Row>
              )}
              {unreviewedFeedback > 0 && (
                <Row href="/admin/moderation?tab=feedback">
                  <Pill tone="neutral"><span className="num">{unreviewedFeedback}</span></Pill>
                  <span className="text-sm font-medium">Reports awaiting a creator verdict</span>
                  <span className="text-xs text-[var(--color-mute)]">
                    Not yours to decide, but a growing number here means creators have stopped reviewing.
                  </span>
                </Row>
              )}
            </RowList>
          </div>
        )}
      </Section>

      {/* -------------------------------------------------------- economy */}
      <Section
        title="Economy health"
        note="Minted, burned and outstanding come straight from the credit ledger, which is the source of truth for balances."
      >
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">Minted</div>
              <div className="mt-1"><CreditChip amount={health.minted} size="lg" /></div>
              <p className="mt-1 text-xs text-[var(--color-mute)]">Everything ever earned, granted or purchased.</p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">Burned</div>
              <div className="mt-1"><CreditChip amount={health.burned} size="lg" /></div>
              <p className="mt-1 text-xs text-[var(--color-mute)]">Spent on buffer seats, rescues, priority and penalties.</p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">Outstanding</div>
              <div className="mt-1"><CreditChip amount={health.outstanding} size="lg" /></div>
              <p className="mt-1 text-xs text-[var(--color-mute)]">Sitting in balances right now, waiting to be spent.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Pill tone={VERDICT_TONE[health.verdict]}>
              {health.verdict === 'unknown' ? 'No verdict' : health.verdict}
            </Pill>
            <span className="text-xs text-[var(--color-dim)]">
              sink ratio <span className="num">{Math.round(health.sinkRatio * 100)}%</span>
            </span>
            <Link href="/admin/economy" className="btn btn-ghost ml-auto">Tune the rates</Link>
          </div>

          <p className="mt-2 max-w-3xl text-sm text-[var(--color-dim)]">{health.note}</p>

          {health.unbackedNote && (
            <div className="mt-3">
              <WarnBox tone="amber">{health.unbackedNote}</WarnBox>
            </div>
          )}
        </Card>
      </Section>

      {/* ------------------------------------------------------- sparkline */}
      <Section
        title="Check-ins, last 14 days"
        note="The core loop, drawn at the same length as the thing it measures. A collapse here precedes every other number moving."
      >
        <Card className="p-5">
          <Sparkline
            points={spark}
            width={620}
            height={72}
            caption={`${sparkTotal} check-ins over 14 days · peak ${sparkPeak} in a day · latest ${spark[spark.length - 1]?.value ?? 0}`}
          />
          <div className="mt-2 flex justify-between text-[10px] text-[var(--color-mute)]">
            <span>{spark[0]?.label}</span>
            <span>{spark[spark.length - 1]?.label}</span>
          </div>
        </Card>
      </Section>
    </div>
  );
}
