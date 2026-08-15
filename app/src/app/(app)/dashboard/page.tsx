import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  Card, Pill, Stat, Avatar, TierBadge, ProgressRing, EmptyState, CreditChip, cx,
} from '@/components/ui';
import { EvidencePack } from '@/components/app/evidence-pack';
import { FirstRun } from '@/components/app/first-run';
import { InvitePanel } from '@/components/app/invite-panel';
import { IconArrow, IconExternal, IconAlert } from '@/components/app/icons';
import { CHARGE } from '@/lib/economy';
import { buildEvidenceAnswers, evidenceAsText } from '@/lib/evidence';
import { tierOf, n, fmtRelative, APP_STATUS_COPY } from '@/lib/format';
import type {
  AppRow, Assignment, Feedback, ProductionEvidenceRow, Profile,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard — TesterPool' };

/** What one tester's full run costs the owner: the install plus the report. */
const RUN_COST = CHARGE.install + CHARGE.review;

type SeatRow = Assignment & {
  profiles: Pick<Profile, 'handle' | 'display_name' | 'avatar_url' | 'country_code' | 'tier' | 'reliability'> | null;
};

/**
 * The owner's screen for one app.
 *
 * There is no cohort behind this any more, and so no clock: testers arrive one
 * at a time from the feed, each one installs, uses the app and files a single
 * report. What an owner needs to see is therefore a count against the target
 * they set — how many have arrived, how many have paid out, what the rest will
 * cost — and never a day number.
 */
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

  const [{ data: profileRow }, { data: appRows }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('apps').select('*').eq('owner_id', user.id).order('created_at', { ascending: true }),
  ]);

  const profile = profileRow as Profile | null;
  const apps = (appRows ?? []) as AppRow[];
  const balance = n(profile?.credits, 0);

  /* ------------------------------------------------------------ no app yet */
  if (apps.length === 0) {
    return (
      <div>
        <PageHeading
          title="Welcome to TesterPool"
          sub="The whole idea, and what it asks of you."
        />
        <FirstRun credits={balance} />
      </div>
    );
  }

  // Default to whichever app is actually taking testers. A developer with a
  // shipped app and one still collecting reports cares about the second.
  const app =
    apps.find((a) => a.id === params.app) ??
    apps.find((a) => a.status === 'in_pod') ??
    apps.find((a) => a.status === 'queued') ??
    apps[0];

  const [{ data: seatRows }, { data: evidenceRow }, { data: feedbackRows }] = await Promise.all([
    supabase
      .from('assignments')
      .select('*, profiles(handle, display_name, avatar_url, country_code, tier, reliability)')
      .eq('app_id', app.id),
    supabase.from('production_evidence').select('*').eq('app_id', app.id).maybeSingle(),
    supabase
      .from('feedback')
      .select('id, assignment_id, severity, what_broke, suggestion, status')
      .eq('app_id', app.id),
  ]);

  const seats = (seatRows ?? []) as SeatRow[];
  const evidence = (evidenceRow ?? null) as ProductionEvidenceRow | null;
  const feedback = (feedbackRows ?? []) as Pick<
    Feedback, 'id' | 'assignment_id' | 'severity' | 'what_broke' | 'suggestion' | 'status'
  >[];

  const answers = buildEvidenceAnswers({ appName: app.name, evidence, feedback });
  const fullText = evidenceAsText(app.name, answers);

  /* ------------------------------------------------------------- the count */
  const target = Math.max(1, n((app as AppRow & { activity_target?: number | null }).activity_target, 5));
  const accepting = (app as AppRow & { accepting_activities?: boolean | null }).accepting_activities !== false;

  const installed = seats.filter((s) => s.opt_in_verified_at).length;
  const waiting = seats.filter((s) => !s.opt_in_verified_at && s.status !== 'dropped').length;

  const reportBySeat = new Map(feedback.map((f) => [f.assignment_id, f]));
  const reportsApproved = feedback.filter((f) => f.status === 'approved').length;
  const reportsWaiting = feedback.filter((f) => f.status === 'submitted').length;

  const remaining = Math.max(0, target - installed);
  const costToFinish = remaining * RUN_COST;
  const short = balance < RUN_COST;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title={app.name}
        sub={app.tagline || 'Your listing, and everyone working on it.'}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={APP_STATUS_COPY[app.status].tone}>{APP_STATUS_COPY[app.status].label}</Pill>
            <Link href={`/market/${app.id}`} className="btn btn-ghost">
              <IconExternal size={14} /> Feed listing
            </Link>
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
      <Card className="dotgrid overflow-hidden">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-5">
            <ProgressRing
              value={Math.min(installed, target)}
              max={target}
              size={148}
              caption="Testers in"
              sub={remaining === 0 ? 'Target reached' : `${remaining} to go`}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                Your target
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight">
                <span className="num">{installed}</span> of <span className="num">{target}</span>
              </div>
              <p className="mt-1 max-w-xs text-sm text-[var(--color-dim)]">
                {remaining === 0
                  ? 'Every tester you asked for has installed. Raise the target on My apps to keep going.'
                  : `${remaining} more ${remaining === 1 ? 'tester' : 'testers'} to reach it, at ${RUN_COST} credits each.`}
              </p>
              <div className="mt-3 text-xs text-[var(--color-mute)]">
                {accepting
                  ? <>Open to new testers · <span className="num">{costToFinish}</span> credits to finish</>
                  : 'Intake is off. Nobody new can pick this up.'}
              </div>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Installs confirmed"
              value={<span className="num">{installed}</span>}
              sub={waiting > 0 ? `${waiting} still to confirm` : 'none pending'}
              tone={installed >= target ? 'var(--color-accent)' : undefined}
            />
            <Stat
              label="Reports in"
              value={<span className="num">{reportsApproved}</span>}
              sub={reportsWaiting > 0 ? `${reportsWaiting} awaiting your verdict` : 'private to you'}
              tone={reportsWaiting > 0 ? 'var(--color-credit)' : undefined}
            />
            <Stat
              label="Spent on this app"
              value={<span className="num">{installed * CHARGE.install + reportsApproved * CHARGE.review}</span>}
              sub="paid to testers"
            />
            <Stat label="Your credits" value={<CreditChip amount={balance} size="lg" />} sub="funds the next tester" />
          </div>
        </div>

        {(short || !accepting) && (
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
              {short ? (
                <>
                  Your balance is under <span className="num">{RUN_COST}</span>, so nobody new can take this
                  app on. Test an app from the feed to earn, or top up on{' '}
                  <Link href="/billing" className="underline">billing</Link>.
                </>
              ) : (
                <>
                  Intake is switched off for this app. Turn it back on from{' '}
                  <Link href="/apps" className="underline">My apps</Link>.
                </>
              )}
            </p>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------- tester list */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Your testers</h2>
            <p className="text-sm text-[var(--color-dim)]">
              Everyone who has picked up {app.name}, and how far they have got.
            </p>
          </div>
          <span className="text-xs text-[var(--color-mute)]">
            <span className="num">{seats.length}</span> total
          </span>
        </div>

        {seats.length === 0 ? (
          <EmptyState
            title="Nobody has picked this up yet"
            body="Your app is in the feed. Testers browse it and take the ones they want; a sharper tagline and a clear opt-in link get picked up first."
            action={<Link href={`/market/${app.id}`} className="btn btn-secondary">See your listing <IconArrow size={15} /></Link>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seats
              .slice()
              .sort((a, b) => Number(!!b.opt_in_verified_at) - Number(!!a.opt_in_verified_at))
              .map((seat) => (
                <SeatTile key={seat.id} seat={seat} report={reportBySeat.get(seat.id) ?? null} />
              ))}
          </div>
        )}
      </section>

      {/* -------------------------------------------------------- invite */}
      {seats.length > 0 && seats.length < target && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Bring another developer in</h2>
          <p className="mt-1 max-w-lg text-sm text-[var(--color-dim)]">
            A deeper feed is more testers for your app, and referrals pay both of you.
          </p>
          <div className="mt-5">
            <InvitePanel code={profile?.referral_code ?? ''} />
          </div>
        </Card>
      )}

      {/* ----------------------------------------------------- evidence pack */}
      <EvidencePack
        appName={app.name}
        stats={{
          testersOptedIn: n(evidence?.testers_opted_in, installed),
          testersFull14: n(evidence?.testers_full_14, 0),
          avgDaysActive: n(evidence?.avg_days_active, 0),
          feedbackReports: n(evidence?.feedback_reports, reportsApproved),
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

/** The three states a seat can be in once there is no cohort behind it. */
type SeatState = 'pending' | 'installed' | 'reported' | 'dropped';

const SEAT_COPY: Record<SeatState, { label: string; tone: 'green' | 'amber' | 'red' | 'neutral'; note: string }> = {
  pending: { label: 'Opt-in pending', tone: 'neutral', note: 'has not confirmed the install yet' },
  installed: { label: 'Testing', tone: 'amber', note: 'installed, report not filed' },
  reported: { label: 'Report filed', tone: 'green', note: 'done — the report is in your inbox' },
  dropped: { label: 'Dropped', tone: 'red', note: 'took the seat and let it go' },
};

function SeatTile({
  seat, report,
}: {
  seat: SeatRow;
  report: Pick<Feedback, 'id' | 'status'> | null;
}) {
  const tester = seat.profiles;
  const name = tester?.display_name || tester?.handle || 'Tester';

  const state: SeatState =
    seat.status === 'dropped' || seat.status === 'removed' ? 'dropped'
    : report ? 'reported'
    : seat.opt_in_verified_at ? 'installed'
    : 'pending';

  const copy = SEAT_COPY[state];
  const accent =
    state === 'dropped' ? 'var(--color-danger)'
    : state === 'reported' ? 'var(--color-accent)'
    : 'var(--color-line)';

  return (
    <Card
      hover
      className="p-4"
      style={{
        borderColor: state === 'dropped' ? `color-mix(in oklab, ${accent} 45%, transparent)` : undefined,
        background: state === 'dropped' ? 'color-mix(in oklab, var(--color-danger) 5%, var(--color-surface))' : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} src={tester?.avatar_url} size={38} ring={state === 'dropped' ? accent : undefined} />
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

      <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--color-mute)]">
        <span>{copy.note}</span>
        <span>picked up {fmtRelative(seat.created_at)}</span>
      </div>

      {report?.status === 'submitted' && (
        <Link href="/feedback" className="btn btn-secondary mt-3 w-full justify-center">
          Review their report
        </Link>
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
