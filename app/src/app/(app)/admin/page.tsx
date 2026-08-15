import * as React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Stat, Avatar, EmptyState, CreditChip } from '@/components/ui';
import { Section, RowList, Row, Sparkline, WarnBox, type SparkPoint } from '@/components/admin/parts';
import { fmtRelative } from '@/lib/format';
import { currencyHealth, VERDICT_TONE } from '@/lib/admin-economy';
import { num, type AdminOverviewRow } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

function utcKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Read outside render, for the same reason `trailingDays` is. */
function nowMs(): number {
  return new Date().getTime();
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
    supabase
      .from('assignments')
      .select('id, tester_id, status, created_at, opt_in_verified_at, profiles(handle, display_name, avatar_url), apps(name)')
      .in('status', ['active', 'opt_in_pending'])
      .limit(500),
  ]);

  const overview = (overviewRow ?? null) as AdminOverviewRow | null;

  /* ------------------------------------------------------------ sparkline */
  const spark: SparkPoint[] = days.map((day, i) => ({
    label: day.label,
    value: checkinCounts[i] ?? 0,
  }));
  const sparkTotal = spark.reduce((a, p) => a + p.value, 0);
  const sparkPeak = Math.max(0, ...spark.map((p) => p.value));

  /* ------------------------------------------------------- needs attention */
  type Seat = {
    id: string;
    tester_id: string;
    status: string;
    created_at: string | null;
    opt_in_verified_at: string | null;
    profiles: { handle: string; display_name: string | null; avatar_url: string | null } | { handle: string; display_name: string | null; avatar_url: string | null }[] | null;
    apps: { name: string | null } | { name: string | null }[] | null;
  };

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  /**
   * Work that was started and never finished. There is no cohort clock to fall
   * behind any more, so the only thing that can silently rot is a seat someone
   * took and abandoned — and every one of those is an owner's balance held
   * against work that is not coming.
   *
   * Two shapes, both counted from when the seat was taken: an unconfirmed
   * install after three days, and a confirmed install with no report after
   * ten. Neither number is load-bearing; they exist so the list is short
   * enough to act on.
   */
  const STALE_INSTALL_DAYS = 3;
  const STALE_REPORT_DAYS = 10;
  const now = nowMs();

  type Stalled = {
    id: string;
    testerId: string;
    handle: string;
    name: string;
    avatar: string | null;
    appName: string;
    kind: 'install' | 'report';
    ageDays: number;
    since: string | null;
  };

  const stalled: Stalled[] = [];
  for (const row of (assignmentRows ?? []) as Seat[]) {
    if (!row.created_at) continue;
    const ageDays = Math.floor((now - new Date(row.created_at).getTime()) / DAY_MS);
    const kind: 'install' | 'report' = row.opt_in_verified_at ? 'report' : 'install';
    const limit = kind === 'install' ? STALE_INSTALL_DAYS : STALE_REPORT_DAYS;
    if (ageDays < limit) continue;

    const profile = one(row.profiles);
    stalled.push({
      id: row.id,
      testerId: row.tester_id,
      handle: profile?.handle ?? 'unknown',
      name: profile?.display_name ?? profile?.handle ?? 'Unknown tester',
      avatar: profile?.avatar_url ?? null,
      appName: one(row.apps)?.name ?? 'Unnamed app',
      kind,
      ageDays,
      since: row.created_at,
    });
  }
  stalled.sort((a, b) => b.ageDays - a.ageDays);

  const pendingProofs = num(overview?.proofs_pending);
  const openDisputes = num(overview?.disputes_open);
  const unreviewedFeedback = num(overview?.feedback_unreviewed);

  const attentionTotal =
    stalled.length + (pendingProofs > 0 ? 1 : 0) + (openDisputes > 0 ? 1 : 0) + (unreviewedFeedback > 0 ? 1 : 0);

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
              sub={num(overview.banned) > 0 ? 'Open seats released on ban' : 'None'}
              tone={num(overview.banned) > 0 ? 'var(--color-danger)' : undefined}
            />
            <Stat label="Apps" value={num(overview.apps)} sub={`${num(overview.apps_graduated)} graduated`} />
            <Stat
              label="Work open"
              value={num(overview.assignments_active)}
              sub={`${num(overview.assignments_dropped)} abandoned`}
              tone={num(overview.assignments_dropped) > 0 ? 'var(--color-credit)' : undefined}
            />
            <Stat
              label="Stalled"
              value={stalled.length}
              sub={stalled.length > 0 ? 'Started and never finished' : 'Nothing rotting'}
              tone={stalled.length > 0 ? 'var(--color-credit)' : undefined}
            />
            <Stat
              label="Proofs pending"
              value={pendingProofs}
              sub={openDisputes > 0 ? `${openDisputes} open disputes` : 'No open disputes'}
              tone={pendingProofs > 0 ? 'var(--color-credit)' : undefined}
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
            body="No seat has been abandoned, the proof queue is clear and there are no open disputes. This is the state the automation is supposed to hold."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {stalled.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  Work started and never finished
                </h3>
                <RowList>
                  {stalled.slice(0, 12).map((s) => (
                    <Row key={s.id} href={`/admin/users?q=${encodeURIComponent(s.handle)}`}>
                      <Avatar name={s.name} src={s.avatar} size={26} />
                      <span className="text-sm font-medium">@{s.handle}</span>
                      <Pill tone={s.ageDays >= 14 ? 'red' : 'amber'}>
                        <span className="num">{s.ageDays}</span> days
                      </Pill>
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-mute)]">
                        {s.appName} ·{' '}
                        {s.kind === 'install'
                          ? 'took the seat, never confirmed the install'
                          : 'installed, no report filed'}{' '}
                        · started {fmtRelative(s.since)}
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
        note="Testers opening an app they took off the feed. A collapse here precedes every other number moving."
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
