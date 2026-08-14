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
import { StartActivityButton } from '@/components/app/start-activity-button';
import { SaveButton } from '../save-button';
import {
  IconArrow, IconExternal, IconFeedback, IconAlert,
} from '@/components/app/icons';
import { EARN, RULES } from '@/lib/economy';
import { marketHref, stageOf, isListingOnly, rewardFor, type MarketAppDetail } from '@/lib/market';
import { fmtDate, n, tierOf } from '@/lib/pods';

export function AppDetail({ app, podsOpen }: { app: MarketAppDetail; podsOpen: boolean }) {

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
          <ActionCard app={app} podsOpen={podsOpen} />

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
function ActionCard({ app, podsOpen }: { app: MarketAppDetail; podsOpen: boolean }) {
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
    // An activity is one check-in and one report. Drawing the fourteen-day
    // streak strip against it would promise a clock that does not exist and
    // read as thirteen missed days from the moment it appeared.
    const activity = !!app.is_activity;

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
        detail:
          joined && !app.report_due
            ? activity
              ? 'Spend a few minutes in the app, then log it. One session is the whole of this step.'
              : 'Open the app once a day and log it. Fourteen days keeps the clock intact.'
            : undefined,
        action: app.assignment_id
          ? { href: `/tests#test-${app.assignment_id}`, label: activity ? 'Log your session' : 'Check in for today' }
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

        {joined && !activity && (
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

        {joined && activity && (
          <p className="border-t border-[var(--color-line)] pt-4 text-xs leading-relaxed text-[var(--color-mute)]">
            No clock on this one. Take as long as you need over the app, then send the report
            whenever you have something worth saying.
          </p>
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

  // The seat this page can hand out itself, and it is checked FIRST — before
  // the status guard below, which used to turn every shipped app away. A live
  // game is the one case where those two disagree: `status` says graduated and
  // `activity_open` says the developer is still taking testers, and the second
  // is the one that answers "can I work on this".
  //
  // `activity_open` is computed in `market_apps` from every condition
  // `start_activity` enforces — the owner's consent, their remaining seats,
  // their balance, the flag, and a closed track to join — so the button appears
  // exactly when the RPC behind it will say yes.
  if (app.activity_open) {
    const live = app.status === 'graduated';
    return (
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold">{live ? 'Play this and report back' : 'Test this app'}</h2>
          {reward && <RewardChip amount={reward} />}
        </div>
        <p className="text-sm leading-relaxed text-[var(--color-dim)]">
          Three steps: join the developer&rsquo;s closed testing track, use the app, then send
          one report on what broke and what you would change. No group and no fourteen-day
          commitment — this one is yours alone and you can finish it today.
        </p>
        {/*
          Said plainly on the one screen where a reader might assume otherwise.
          This app is on the store; the job is not. Leaving it implicit would let
          someone install from the public listing, leave a store review and
          expect to be paid for it — which is the thing this product exists to
          not be.
        */}
        {live && (
          <p className="text-sm leading-relaxed text-[var(--color-dim)]">
            This one is already published. You are joining the closed track the developer
            runs alongside it, not installing from the store page, and your report goes to
            them privately. Nothing here asks you to review or rate it publicly.
          </p>
        )}

        <StartActivityButton appId={app.id} reward={reward} />

        {typeof app.activity_seats_left === 'number' && app.activity_seats_left <= 3 && (
          <p className="text-xs text-[var(--color-mute)]">
            <span className="num font-semibold text-[var(--color-dim)]">
              {app.activity_seats_left}
            </span>{' '}
            {app.activity_seats_left === 1 ? 'seat' : 'seats'} left on this app.
          </p>
        )}

        {/*
          Said here rather than in a footnote, because this is the screen where
          someone who arrived looking for the other kind of exchange decides
          what this is. The distinction is the product.
        */}
        <p className="text-xs leading-relaxed text-[var(--color-mute)]">
          The install is an opt-in to a closed testing track and the report goes to the
          developer, not to a store. {EARN.optInVerified} credits when your opt-in is verified
          from a screenshot, {EARN.feedbackApproved} when your report is approved, both out of
          the balance of the developer whose app you tested. Specific criticism pays exactly
          what praise pays.
        </p>
      </Card>
    );
  }

  // Not open to activities, and not in a state a pod could help either. A
  // shipped app reaches here only when its developer has closed it to testers,
  // run out of credits or never added a closed track — so the copy says the app
  // is shut, not that shipped apps are finished with. They are not any more.
  if (app.status !== 'queued' && app.status !== 'in_pod') {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">
          {app.status === 'graduated' ? 'Not taking testers right now' : 'Not taking testers'}
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-dim)]">
          {app.status === 'graduated'
            ? 'This one is published and its developer is not running an open closed-track slot at the moment. Live games do take testers here — this one just is not, today.'
            : 'The developer has this app paused. It may open to testers again later.'}
        </p>
        <Link href={marketHref({ scope: 'open' })} className="btn btn-secondary">
          Find an app you can start on <IconArrow size={15} />
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
      {/*
        Reached when the app itself is shut to activities — the owner is out of
        credits, has no seats left, or is not taking one-off testers — so the
        only honest offer left is the group. With `pod_matching` off there is no
        way to be seated at all, and this card must not pretend otherwise: a
        primary button that lands on an "Upcoming" screen is a dead door, and
        the first thing a new member would learn from it is that the product's
        buttons cannot be trusted.
      */}
      {podsOpen ? (
        <>
          <p className="text-sm leading-relaxed text-[var(--color-dim)]">
            Seats are handed out by the group, not by this page. Join a forming group with your own
            app and you are seated as a tester for every other app in it — this one included, if it
            is in the same one.
          </p>
          <Link href="/pods" className="btn btn-primary">
            Browse forming groups <IconArrow size={15} />
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-[var(--color-dim)]">
            Matching opens once enough developers have joined to fill a full round. List your own
            app now and you are in the first one — nothing to do after that but wait for the
            start date.
          </p>
          <Link href="/apps" className="btn btn-primary">
            List your app <IconArrow size={15} />
          </Link>
        </>
      )}
      <p className="text-xs text-[var(--color-mute)]">
        Each confirmed install pays you {EARN.optInVerified} and each approved report{' '}
        {EARN.feedbackApproved}, out of the balance of the developer whose app you tested.
      </p>
    </Card>
  );
}
