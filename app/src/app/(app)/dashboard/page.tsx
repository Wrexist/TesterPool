import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  Card, Pill, Stat, Avatar, TierBadge, StreakStrip, ProgressRing, EmptyState, CreditChip, cx,
} from '@/components/ui';
import { EvidencePack } from '@/components/app/evidence-pack';
import { RescueButton } from '@/components/app/rescue-button';
import { InvitePanel } from '@/components/app/invite-panel';
import { IconArrow, IconPlus, IconExternal, IconAlert } from '@/components/app/icons';
import { RULES, COST } from '@/lib/economy';
import { buildEvidenceAnswers, evidenceAsText } from '@/lib/evidence';
import {
  podDay, stripFor, seatHealth, SEAT_HEALTH_COPY, tierOf, n, fmtDate,
  APP_STATUS_COPY, estimateStart, missedDays,
} from '@/lib/pods';
import type {
  AppRow, Assignment, Feedback, Pod, PodHealthRow, ProductionEvidenceRow, Profile,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard — TesterPool' };

type SeatRow = Assignment & {
  profiles: Pick<Profile, 'handle' | 'display_name' | 'avatar_url' | 'country_code' | 'tier' | 'reliability'> | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const params = await searchParams;

  const [{ data: profileRow }, { data: appRows }, { data: configRows }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('apps').select('*').eq('owner_id', user.id).order('created_at', { ascending: true }),
    supabase.from('economy_config').select('key, value'),
  ]);

  const profile = profileRow as Profile | null;
  const apps = (appRows ?? []) as AppRow[];
  const config: Record<string, number> = {};
  for (const row of (configRows ?? []) as { key: string; value: number }[]) config[row.key] = row.value;
  const rescuePrice = config.cost_rescue_seat ?? COST.rescueSeat;
  const balance = n(profile?.credits, 0);

  /* ------------------------------------------------------------ no app yet */
  if (apps.length === 0) {
    return (
      <div>
        <PageHeading
          title="Your dashboard"
          sub="Once your app is listed and seated in a pod, this page becomes the only place you need to watch for 14 days."
        />
        <EmptyState
          title="List your app to get started"
          body="TesterPool matches you with about fifteen developers who all test each other for the same fourteen days. It takes two minutes to list an app and join the queue."
          action={
            <Link href="/onboarding" className="btn btn-primary">
              <IconPlus size={15} /> List your app
            </Link>
          }
        />
      </div>
    );
  }

  // Default to whichever app has a live clock. A developer with a shipped app
  // and one mid-pod cares about the one that can still fail.
  const app =
    apps.find((a) => a.id === params.app) ??
    apps.find((a) => a.status === 'in_pod') ??
    apps.find((a) => a.status === 'queued') ??
    apps[0];

  const [{ data: memberRow }, { data: seatRows }, { data: evidenceRow }, { data: feedbackRows }] =
    await Promise.all([
      supabase
        .from('pod_members')
        .select('id, pod_id, seat, status, pods(*)')
        .eq('user_id', user.id)
        .eq('app_id', app.id)
        .maybeSingle(),
      supabase
        .from('assignments')
        .select('*, profiles(handle, display_name, avatar_url, country_code, tier, reliability)')
        .eq('app_id', app.id),
      supabase.from('production_evidence').select('*').eq('app_id', app.id).maybeSingle(),
      supabase
        .from('feedback')
        .select('id, severity, what_broke, suggestion, status')
        .eq('app_id', app.id),
    ]);

  const membership = memberRow as { pod_id: string; seat: string; status: string; pods: Pod | Pod[] | null } | null;
  const pod = membership ? (Array.isArray(membership.pods) ? membership.pods[0] : membership.pods) : null;
  const seats = (seatRows ?? []) as SeatRow[];
  const evidence = (evidenceRow ?? null) as ProductionEvidenceRow | null;
  const feedback = (feedbackRows ?? []) as Pick<Feedback, 'id' | 'severity' | 'what_broke' | 'suggestion' | 'status'>[];

  const duration = pod?.duration_days ?? RULES.requiredDays;
  const currentDay = podDay(pod?.starts_at, duration);

  const answers = buildEvidenceAnswers({ appName: app.name, evidence, feedback });
  const fullText = evidenceAsText(app.name, answers);

  const optedIn = n(evidence?.testers_opted_in, seats.filter((s) => s.opt_in_verified_at).length);
  const avgDays = n(
    evidence?.avg_days_active,
    seats.length ? seats.reduce((t, s) => t + n(s.days_checked_in), 0) / seats.length : 0
  );
  const reports = n(evidence?.feedback_reports, feedback.filter((f) => f.status === 'approved').length);
  const atRisk = seats.filter(
    (s) => seatHealth(s.status, s.opt_in_verified_at, n(s.days_checked_in), currentDay) === 'at_risk'
  ).length;
  const dropped = seats.filter(
    (s) => seatHealth(s.status, s.opt_in_verified_at, n(s.days_checked_in), currentDay) === 'dropped'
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title={app.name}
        sub={app.tagline || 'Your 14-day closed test, one screen.'}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={APP_STATUS_COPY[app.status].tone}>{APP_STATUS_COPY[app.status].label}</Pill>
            {app.opt_in_url && (
              <a href={app.opt_in_url} target="_blank" rel="noreferrer" className="btn btn-ghost">
                <IconExternal size={14} /> Opt-in link
              </a>
            )}
          </div>
        }
      />

      {apps.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {apps.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard?app=${a.id}`}
              className={cx('pill', a.id === app.id && 'font-bold')}
              style={
                a.id === app.id
                  ? { color: 'var(--color-accent)', borderColor: 'color-mix(in oklab, var(--color-accent) 32%, transparent)', background: 'color-mix(in oklab, var(--color-accent) 10%, transparent)' }
                  : { color: 'var(--color-dim)', borderColor: 'var(--color-line)', background: 'var(--color-surface-2)' }
              }
            >
              {a.name}
            </Link>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- hero */}
      {pod && pod.status === 'active' ? (
        <Card className="dotgrid overflow-hidden">
          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-5">
              <ProgressRing
                value={Math.max(currentDay, 0)}
                max={duration}
                size={148}
                caption="Days elapsed"
                sub={currentDay >= duration ? 'Window complete' : `${duration - currentDay} to go`}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  {pod.name || `Pod ${pod.code}`}
                </div>
                <div className="mt-1 text-2xl font-bold tracking-tight">
                  Day <span className="num">{Math.max(currentDay, 1)}</span> of <span className="num">{duration}</span>
                </div>
                <p className="mt-1 max-w-xs text-sm text-[var(--color-dim)]">
                  {optedIn >= RULES.requiredTesters
                    ? 'You are above the 12-tester bar. Hold it to the last day.'
                    : `You need ${RULES.requiredTesters - optedIn} more verified opt-ins to clear Google's bar.`}
                </p>
                <div className="mt-3 text-xs text-[var(--color-mute)]">
                  Ends {fmtDate(pod.ends_at)}
                </div>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Testers opted in"
                value={<span className="num">{optedIn}</span>}
                sub={`of ${RULES.requiredTesters} required`}
                tone={optedIn >= RULES.requiredTesters ? 'var(--color-accent)' : undefined}
              />
              <Stat label="Avg days active" value={<span className="num">{avgDays.toFixed(1)}</span>} sub={`of ${duration}`} />
              <Stat label="Feedback reports" value={<span className="num">{reports}</span>} sub="private to you" />
              <Stat label="Your credits" value={<CreditChip amount={balance} size="lg" />} sub="spend on rescues" />
            </div>
          </div>

          {(atRisk > 0 || dropped > 0) && (
            <div
              className="flex items-start gap-2 border-t px-6 py-3 text-sm"
              style={{
                borderColor: 'color-mix(in oklab, var(--color-credit) 25%, transparent)',
                background: 'color-mix(in oklab, var(--color-credit) 8%, transparent)',
                color: 'var(--color-credit)',
              }}
            >
              <IconAlert size={15} className="mt-0.5 shrink-0" />
              <p>
                <span className="num">{atRisk}</span> seat{atRisk === 1 ? '' : 's'} at risk
                {dropped > 0 && <> and <span className="num">{dropped}</span> dropped</>}. Every seat below
                twelve on the final day resets your clock. Rescue testers are matched within hours.
              </p>
            </div>
          )}
        </Card>
      ) : (
        <FormingHero
          app={app}
          podId={membership?.pod_id ?? null}
          referralCode={profile?.referral_code ?? ''}
        />
      )}

      {/* -------------------------------------------------------- seat grid */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Your seats</h2>
            <p className="text-sm text-[var(--color-dim)]">
              Every tester matched to {app.name}, and exactly where their clock is.
            </p>
          </div>
          <span className="text-xs text-[var(--color-mute)]">
            <span className="num">{seats.length}</span> assigned
          </span>
        </div>

        {seats.length === 0 ? (
          <EmptyState
            title="No testers seated yet"
            body="Seats appear the moment your pod locks. Until then the pod is still filling, and you can speed that up by inviting another developer."
            action={<Link href="/pods" className="btn btn-secondary">Browse forming pods <IconArrow size={15} /></Link>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seats
              .slice()
              .sort((a, b) => n(b.days_checked_in) - n(a.days_checked_in))
              .map((seat) => (
                <SeatTile
                  key={seat.id}
                  seat={seat}
                  currentDay={currentDay}
                  duration={duration}
                  appId={app.id}
                  rescuePrice={rescuePrice}
                  balance={balance}
                />
              ))}
          </div>
        )}
      </section>

      {/* ----------------------------------------------------- evidence pack */}
      <EvidencePack
        appName={app.name}
        stats={{
          testersOptedIn: optedIn,
          testersFull14: n(evidence?.testers_full_14, seats.filter((s) => n(s.days_checked_in) >= duration).length),
          avgDaysActive: avgDays,
          feedbackReports: reports,
          significantIssues: n(evidence?.significant_issues, feedback.filter((f) => n(f.severity) >= 2).length),
        }}
        answers={answers}
        fullText={fullText}
      />
    </div>
  );
}

/* --------------------------------------------------------------- pieces */

function PageHeading({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">{sub}</p>
      </div>
      {right}
    </header>
  );
}

function SeatTile({
  seat, currentDay, duration, appId, rescuePrice, balance,
}: {
  seat: SeatRow;
  currentDay: number;
  duration: number;
  appId: string;
  rescuePrice: number;
  balance: number;
}) {
  const tester = seat.profiles;
  const name = tester?.display_name || tester?.handle || 'Tester';
  const days = n(seat.days_checked_in);
  const health = seatHealth(seat.status, seat.opt_in_verified_at, days, currentDay);
  const copy = SEAT_HEALTH_COPY[health];
  const missed = missedDays(days, currentDay);
  const needsRescue = health === 'at_risk' || health === 'dropped';

  const accent =
    health === 'dropped' ? 'var(--color-danger)'
    : health === 'at_risk' ? 'var(--color-credit)'
    : 'var(--color-line)';

  return (
    <Card
      hover
      className="p-4"
      style={{
        borderColor: needsRescue ? `color-mix(in oklab, ${accent} 45%, transparent)` : undefined,
        background: health === 'dropped' ? 'color-mix(in oklab, var(--color-danger) 5%, var(--color-surface))' : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} src={tester?.avatar_url} size={38} ring={needsRescue ? accent : undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {tester?.handle ? (
                <Link href={`/u/${tester.handle}`} className="hover:underline">@{tester.handle}</Link>
              ) : name}
            </span>
            {tester?.country_code && (
              <span className="text-[11px] uppercase text-[var(--color-mute)]">{tester.country_code}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <TierBadge tier={tierOf(tester?.tier)} size="sm" />
            <span className="text-[11px] text-[var(--color-mute)]">
              reliability <span className="num">{Math.round(n(tester?.reliability))}</span>
            </span>
          </div>
        </div>
        <span className="pill shrink-0" style={pillStyle(copy.tone)}>{copy.label}</span>
      </div>

      <div className="mt-3">
        <StreakStrip days={stripFor(days, currentDay, duration)} total={duration} size={11} />
        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-mute)]">
          <span><span className="num">{days}</span> of <span className="num">{duration}</span> days</span>
          {missed > 0 && health !== 'dropped' && (
            <span style={{ color: 'var(--color-credit)' }}><span className="num">{missed}</span> missed</span>
          )}
          {health === 'pending' && <span>waiting on opt-in</span>}
        </div>
      </div>

      {needsRescue && (
        <RescueButton appId={appId} price={rescuePrice} balance={balance} compact />
      )}
    </Card>
  );
}

function pillStyle(tone: 'green' | 'amber' | 'red' | 'neutral'): React.CSSProperties {
  const map = {
    green: 'var(--color-accent)',
    amber: 'var(--color-credit)',
    red: 'var(--color-danger)',
    neutral: 'var(--color-dim)',
  } as const;
  const color = map[tone];
  return tone === 'neutral'
    ? { color, borderColor: 'var(--color-line)', background: 'var(--color-surface-2)' }
    : {
        color,
        borderColor: `color-mix(in oklab, ${color} 32%, transparent)`,
        background: `color-mix(in oklab, ${color} 10%, transparent)`,
      };
}

async function FormingHero({
  app, podId, referralCode,
}: {
  app: AppRow;
  podId: string | null;
  referralCode: string;
}) {
  const supabase = await createClient();

  let health: PodHealthRow | null = null;
  if (podId) {
    const { data } = await supabase.from('pod_health').select('*').eq('id', podId).maybeSingle();
    health = (data ?? null) as PodHealthRow | null;
  }

  if (!podId || !health) {
    return (
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-lg">
            <h2 className="text-lg font-semibold">{app.name} is not in a pod yet</h2>
            <p className="mt-1 text-sm text-[var(--color-dim)]">
              A pod is about fifteen developers who all test each other for the same fourteen days. Join one
              and your clock starts the moment the last seat fills.
            </p>
          </div>
          <Link href="/pods" className="btn btn-primary">
            Find a pod <IconArrow size={15} />
          </Link>
        </div>
      </Card>
    );
  }

  const members = n(health.members);
  const seats = n(health.core_seats, RULES.podSeats);
  const pct = seats > 0 ? Math.min(100, Math.round((members / seats) * 100)) : 0;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Your pod is filling</h2>
          <p className="mt-1 max-w-lg text-sm text-[var(--color-dim)]">
            {estimateStart(members, seats)}. The 14-day clock does not start until every seat is taken, so a
            full pod is worth more to you than an early one.
          </p>
        </div>
        <div className="text-right">
          <div className="num text-3xl font-bold leading-none">
            {members}<span className="text-[var(--color-mute)]"> of {seats}</span>
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-[var(--color-mute)]">seats filled</div>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: 'var(--color-accent)' }}
        />
      </div>

      <div className="mt-5">
        <InvitePanel code={referralCode} />
      </div>
    </Card>
  );
}
