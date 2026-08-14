/**
 * TESTERPOOL — one app, in full.
 *
 * Presentational on purpose: the route resolves the app through `market_app`
 * and this renders whatever came back. Every field it reads is one the RPC was
 * willing to hand this particular viewer, so there is no second place where a
 * decision about visibility could quietly be made differently.
 */

import Link from 'next/link';
import { Card, Pill, Stat, Avatar, TierBadge, StreakStrip, streakFromCount } from '@/components/ui';
import { AppIcon } from '@/components/app/app-card';
import { RewardChip } from '@/components/app/app-row';
import { ActivitySteps, type Step } from '@/components/app/activity-steps';
import { SaveButton } from '../save-button';
import {
  IconArrow, IconExternal, IconFeedback, IconAlert,
} from '@/components/app/icons';
import { EARN, RULES } from '@/lib/economy';
import { marketHref, stageOf, isListingOnly, rewardFor, type MarketAppDetail } from '@/lib/market';
import { fmtDate, n, tierOf } from '@/lib/pods';

export function AppDetail({ app }: { app: MarketAppDetail }) {

  const stage = stageOf(app);
  const focus = app.focus_areas ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Save sits up here rather than in the header: in the header it took a
          column of its own on a phone, squeezed the title block to about 150px,
          and forced the status and category chips onto separate lines. */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/market" className="text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-ink)]">
          ← Marketplace
        </Link>
        <SaveButton appId={app.id} initial={!!app.watching} variant="full" />
      </div>

      {/* ------------------------------------------------------------ head */}
      <header className="flex flex-wrap items-start gap-5">
        <AppIcon name={app.name} src={app.icon_url} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="w-full text-2xl font-semibold tracking-tight sm:w-auto">{app.name}</h1>
            {stage && <Pill tone={stage.tone}>{stage.label}</Pill>}
            {app.category && <Pill tone="neutral">{app.category}</Pill>}
          </div>
          {app.tagline && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-dim)]">{app.tagline}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <OwnerLine app={app} />
            <TierBadge tier={tierOf(app.owner_tier)} size="sm" />
            <span className="text-xs text-[var(--color-mute)]">
              Reliability <span className="num font-semibold text-[var(--color-dim)]">{Math.round(n(app.owner_reliability))}</span>
              {' · '}
              <span className="num">{n(app.owner_pods_completed)}</span> pods completed
              {' · '}
              helped ship <span className="num">{n(app.owner_apps_helped_ship)}</span>
            </span>
          </div>
        </div>
      </header>

      {/* On a phone the activity comes first and the reading matter second: the
          job and its button were landing below About, the focus areas and the
          instructions, which is two screens of scrolling to reach the only thing
          on the page you can act on. From lg up the aside is a sticky column and
          the natural order is right again. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* --------------------------------------------------------- body */}
        <div className="order-2 flex flex-col gap-6 lg:order-1">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Testers" value={n(app.testers_active)} sub="seated now" />
            <Stat label="Full 14" value={n(app.testers_full)} sub={`of ${RULES.requiredTesters} needed`} />
            <Stat label="Reports" value={n(app.reports)} sub="approved" />
            <Stat
              label={app.status === 'graduated' ? 'Graduated' : 'Listed'}
              value={<span className="text-base">{fmtDate(app.graduated_at ?? app.created_at)}</span>}
            />
          </section>

          {app.description && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">About</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--color-dim)]">
                {app.description.slice(0, 2000)}
              </p>
            </section>
          )}

          {focus.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                What the developer wants looked at
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {focus.map((area) => (
                  <Pill key={area} tone="violet">{area}</Pill>
                ))}
              </div>
            </section>
          )}

          {app.tester_instructions && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                Instructions for testers
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--color-dim)]">
                {app.tester_instructions}
              </p>
            </section>
          )}

          {app.min_android_version && (
            <p className="text-xs text-[var(--color-mute)]">
              Needs Android <span className="num">{app.min_android_version}</span> or newer.
            </p>
          )}

          <p className="text-xs leading-relaxed text-[var(--color-mute)]">
            All testing happens inside closed testing tracks, which do not affect store rankings,
            ratings or install counts. Reports are private, and paid the same whether they praise
            the app or take it apart.
          </p>
        </div>

        {/* -------------------------------------------------------- action */}
        <aside className="order-1 flex flex-col gap-4 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <ActionCard app={app} />

          {app.store_url && (
            <a
              href={app.store_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn btn-ghost justify-start"
            >
              <IconExternal size={15} /> View the public listing
            </a>
          )}

          {app.owner_handle && (
            <Link
              href={marketHref({ q: app.owner_handle })}
              className="text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            >
              {n(app.owner_apps)} {n(app.owner_apps) === 1 ? 'app' : 'apps'} from @{app.owner_handle} in the pool →
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * The developer, linked only when there is somewhere to link to.
 *
 * `owner_handle` is nullable in the projection, and an unguarded template
 * rendered "@null" over a link to /u/ — a dead page under a wrong name.
 */
function OwnerLine({ app }: { app: MarketAppDetail }) {
  const name = app.owner_display_name || (app.owner_handle ? `@${app.owner_handle}` : 'A developer');
  const inner = (
    <>
      <Avatar name={app.owner_display_name || app.owner_handle || app.name} src={app.owner_avatar_url} size={26} />
      <span className="font-medium">{name}</span>
    </>
  );

  if (!app.owner_handle) {
    return <span className="flex items-center gap-2 text-sm text-[var(--color-dim)]">{inner}</span>;
  }
  return (
    <Link
      href={`/u/${app.owner_handle}`}
      className="flex items-center gap-2 text-sm text-[var(--color-dim)] transition-colors hover:text-[var(--color-ink)]"
    >
      {inner}
    </Link>
  );
}

/**
 * The one thing to do next, decided by where the viewer stands with this app.
 *
 * There is no "start testing" here for a stranger, and there cannot be. A seat
 * is created by pod matching, which is what escrows the install and report
 * charges against the owner's balance; a button in a directory that seated
 * someone directly would be a way to earn credits from a developer who never
 * agreed to pay them. So the CTA for a stranger points at the pod.
 */
function ActionCard({ app }: { app: MarketAppDetail }) {
  if (isListingOnly(app)) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">An iOS listing</h2>
        <p className="text-sm leading-relaxed text-[var(--color-dim)]">
          Listing an iOS app is its own feature: it puts the app in front of the pool and nothing
          else. Pods, credits and proof are Android, because Google Play is the store that gates
          production access behind {RULES.requiredTesters} testers for {RULES.requiredDays}{' '}
          consecutive days and Apple has no equivalent gate to clear.
        </p>
        <p className="text-xs text-[var(--color-mute)]">
          Nothing here touches App Store reviews, ratings or install counts, and it never will.
        </p>
      </Card>
    );
  }

  if (app.relation === 'owner') {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">This is your app</h2>
        <p className="text-sm text-[var(--color-dim)]">
          This is what everyone else sees. Your opt-in link, package name and instructions are not
          on this page for anyone but you.
        </p>
        <Link href={`/dashboard?app=${app.id}`} className="btn btn-primary">
          Open the dashboard <IconArrow size={15} />
        </Link>
        <Link href="/feedback" className="btn btn-secondary">
          <IconFeedback size={15} /> Feedback inbox
        </Link>
        {app.status === 'draft' && (
          <p className="flex items-start gap-1.5 text-xs text-[var(--color-mute)]">
            <IconAlert size={13} className="mt-px shrink-0" />
            A draft is private. Join a pod with it and it appears in the marketplace for everyone.
          </p>
        )}
      </Card>
    );
  }

  if (app.relation === 'testing') {
    const days = n(app.days_checked_in);
    const joined = !!app.opt_in_verified;

    // Three steps, and the state of each is read from the assignment rather than
    // guessed: joined when the opt-in is verified, using it while days are still
    // being logged, reporting once there is something to report on.
    const steps: Step[] = [
      {
        label: 'Join',
        state: joined ? 'done' : 'current',
        detail: joined
          ? undefined
          : 'Open the closed track, install from it, then upload the screenshot that proves you are in.',
        action: app.assignment_id
          ? { href: `/tests/${app.assignment_id}/optin`, label: 'Join and upload proof' }
          : undefined,
      },
      {
        label: 'Use it',
        state: !joined ? 'locked' : app.report_due ? 'done' : 'current',
        detail: joined && !app.report_due ? 'Open the app once a day and log it. Fourteen days keeps the clock intact.' : undefined,
        action: app.assignment_id
          ? { href: `/tests#test-${app.assignment_id}`, label: 'Check in for today' }
          : undefined,
      },
      {
        label: 'Report',
        state: app.report_due ? 'current' : joined ? 'locked' : 'locked',
        detail: app.report_due
          ? 'Tell the developer what broke and what worked. Specific criticism pays the same as praise.'
          : undefined,
        action: app.assignment_id
          ? { href: `/tests/${app.assignment_id}/feedback`, label: `Write your report  +${EARN.feedbackApproved}` }
          : undefined,
      },
    ];

    return (
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Your activity</h2>
            <p className="mt-0.5 text-xs text-[var(--color-mute)]">
              Complete all steps to earn the reward
            </p>
          </div>
          <RewardChip amount={EARN.optInVerified + EARN.feedbackApproved} />
        </div>

        <ActivitySteps steps={steps} />

        {joined && (
          <div className="border-t border-[var(--color-line)] pt-4">
            <StreakStrip
              days={streakFromCount(days, n(app.pod_day, days), RULES.requiredDays)}
              total={RULES.requiredDays}
            />
            <p className="mt-2 text-xs text-[var(--color-mute)]">
              <span className="num font-semibold text-[var(--color-dim)]">{days}</span> of{' '}
              <span className="num">{RULES.requiredDays}</span> days logged
            </p>
          </div>
        )}

        {app.opt_in_url && joined && (
          <a href={app.opt_in_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <IconExternal size={15} /> Open the closed track
          </a>
        )}
      </Card>
    );
  }

  if (app.relation === 'tested') {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">You tested this</h2>
        <p className="text-sm text-[var(--color-dim)]">
          <span className="num font-semibold text-[var(--color-ink)]">{n(app.days_checked_in)}</span> days logged.
          Your report stays between you and the developer.
        </p>
        <Link href="/tests" className="btn btn-secondary">
          My tests <IconArrow size={15} />
        </Link>
      </Card>
    );
  }

  const reward = rewardFor(app);

  // Only an app that can still take testers gets a call to action. A shipped,
  // paused or removed app offering "Want to test this?" is an invitation to a
  // door that is shut.
  if (app.status !== 'queued' && app.status !== 'in_pod') {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">
          {app.status === 'graduated' ? 'This one shipped' : 'Not taking testers'}
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-dim)]">
          {app.status === 'graduated'
            ? 'It cleared production access and is out of closed testing, so there is nothing left to test here.'
            : 'The developer has this app paused. It may open to testers again later.'}
        </p>
        <Link href={marketHref({ status: 'needs_testers' })} className="btn btn-secondary">
          Find an app that needs testers <IconArrow size={15} />
        </Link>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">Want to test this?</h2>
        {reward && <RewardChip amount={reward} />}
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-dim)]">
        Seats are handed out by the pod, not by this page. Join a forming pod with your own app and
        you are seated as a tester for every other app in it — this one included, if it is in the
        same pod.
      </p>
      <Link href="/pods" className="btn btn-primary">
        Browse forming pods <IconArrow size={15} />
      </Link>
      <p className="text-xs text-[var(--color-mute)]">
        Each confirmed install pays you {EARN.optInVerified} and each approved report{' '}
        {EARN.feedbackApproved}, out of the balance of the developer whose app you tested.
      </p>
    </Card>
  );
}
