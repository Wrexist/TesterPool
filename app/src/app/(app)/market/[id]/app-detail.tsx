/**
 * TESTERPOOL — one app, in full.
 *
 * Presentational on purpose: the route resolves the app through `market_app`
 * and this renders whatever came back. Every field it reads is one the RPC was
 * willing to hand this particular viewer, so there is no second place where a
 * decision about visibility could quietly be made differently.
 */

import Link from 'next/link';
import { Card, Pill, Stat, Avatar, TierBadge, cx } from '@/components/ui';
import { AppIcon } from '@/components/app/app-card';
import { RewardChip } from '@/components/app/app-row';
import { ActivitySteps, type Step } from '@/components/app/activity-steps';
import { StartActivityButton } from '@/components/app/start-activity-button';
import { StoreActivityButtons } from '@/components/app/store-activity-buttons';
import { SaveButton } from '../save-button';
import {
  IconArrow, IconExternal, IconFeedback, IconAlert, IconDevice, IconUpload, IconAndroid,
} from '@/components/app/icons';
import { EARN, RULES } from '@/lib/economy';
import { marketHref, stageOf, isListingOnly, rewardFor, type MarketAppDetail } from '@/lib/market';
import { fmtDate, n, tierOf } from '@/lib/format';

/** How much description to show before folding the rest away. */
const BLURB = 320;

export function AppDetail({ app, storeOpen = false }: { app: MarketAppDetail; storeOpen?: boolean }) {

  const stage = stageOf(app);
  const focus = app.focus_areas ?? [];
  const ios = isListingOnly(app);

  /*
   * The tagline is usually the first line of the description, so rendering both
   * printed the same sentence twice — once truncated under the title and once
   * again under About, which is what made this page read as padded. When they
   * overlap, the description wins and the tagline is dropped.
   */
  const description = (app.description ?? '').trim();
  const tagline = (app.tagline ?? '').trim();
  const duplicated =
    !!tagline && !!description &&
    description.slice(0, 80).toLowerCase().startsWith(tagline.slice(0, 40).toLowerCase());
  const showTagline = !!tagline && !duplicated;

  const long = description.length > BLURB;
  const blurb = long ? `${description.slice(0, BLURB).trimEnd()}…` : description;

  return (
    <div className="flex flex-col gap-6">
      {/* Save sits up here rather than in the header: in the header it took a
          column of its own on a phone, squeezed the title block to about 150px,
          and forced the status and category chips onto separate lines. */}
      <div className="flex items-center gap-3">
        <Link
          href="/market"
          aria-label="Back to the feed"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-2)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="flex-1 text-center text-[17px] font-bold tracking-tight">App Details</span>
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
          {showTagline && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-dim)]">{tagline}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <OwnerLine app={app} />
            <TierBadge tier={tierOf(app.owner_tier)} size="sm" />
            <span className="text-xs text-[var(--color-mute)]">
              Reliability <span className="num font-semibold text-[var(--color-dim)]">{Math.round(n(app.owner_reliability))}</span>
              {' · '}
              <span className="num">{n(app.owner_pods_completed)}</span> jobs completed
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
          {/*
            "Testers seated" and "Full 14 of 12 needed" are Google Play's
            production-access rule, counted. Apple has no equivalent gate, so on
            an iOS listing they are not merely irrelevant — "0 of 12 needed"
            states a requirement that does not exist and will never be met.
            They are dropped entirely rather than zeroed.
          */}
          <section className={cx('grid gap-3', ios ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
            {!ios && (
              <>
                <Stat label="Testers" value={n(app.testers_active)} sub="seated now" />
                <Stat label="Full 14" value={n(app.testers_full)} sub={`of ${RULES.requiredTesters} needed`} />
              </>
            )}
            <Stat label="Reports" value={n(app.reports)} sub="approved" />
            <Stat
              label={app.status === 'graduated' ? 'Graduated' : 'Listed'}
              value={<span className="text-base">{fmtDate(app.graduated_at ?? app.created_at)}</span>}
            />
          </section>

          {description && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">About</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--color-dim)]">
                {blurb}
              </p>
              {/* Folded rather than truncated: a store description runs to
                  thousands of words and dumping it here buried everything the
                  page is actually for. Native details, so it costs no JS. */}
              {long && (
                <details className="disclosure mt-1">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--color-accent)]">
                    Read the full description
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--color-dim)]">
                    {description.slice(0, 4000)}
                  </p>
                </details>
              )}
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

          {/*
            This claim has to follow the job on offer. Closed-track work genuinely is
            invisible to the store surface, and saying so is the honest sell. A store
            activity is not, and printing the closed-track line under an Install/Review
            button would be telling a tester their public review carries no risk at the
            moment we ask them to publish one.
          */}
          <p className="text-xs leading-relaxed text-[var(--color-mute)]">
            {storeOpen ? (
              <>
                This app is asking for a public store install and review. That is public
                activity, on your own store account, and it is not covered by the
                closed-track rule below — Google and Apple both prohibit incentivised
                reviews. Write what you actually think; the rating is yours, and you are
                paid the same either way.
              </>
            ) : (
              <>
                All testing happens inside closed testing tracks, which do not affect store
                rankings, ratings or install counts. Reports are private, and paid the same
                whether they praise the app or take it apart.
              </>
            )}
          </p>
        </div>

        {/* -------------------------------------------------------- action */}
        <aside className="order-1 flex flex-col gap-4 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <ActionCard app={app} storeOpen={storeOpen} />

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
 * Taking a seat here is the whole product, and the objection it has to answer
 * is that it earns credits from a developer who never agreed to pay them.
 * `start_activity` answers it in the database rather than on this page: the
 * owner's consent, their remaining seats and their balance are all checked
 * before the seat exists. When any of those says no, the button is not offered.
 */
function ActionCard({ app, storeOpen }: { app: MarketAppDetail; storeOpen: boolean }) {
  /*
   * Checked before anything else, including the iOS bail-out below.
   *
   * A store activity runs against a PUBLIC listing, so unlike closed-track
   * testing it does not care which store the app is on — an iOS listing is as
   * reviewable as an Android one. Leaving the platform check first would have
   * turned every opted-in iOS app away from a job it can actually do.
   */
  if (storeOpen && app.relation !== 'owner') {
    const stage: 'none' | 'installed' | 'reported' =
      app.relation === 'tested' ? 'reported'
      : app.opt_in_verified ? 'installed'
      : app.relation === 'testing' ? 'none'
      : 'none';

    return (
      <Card className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-[17px] font-bold leading-tight">Install and review</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-dim)]">
            Two steps, paid separately, out of this publisher&apos;s balance.
          </p>
        </div>

        <StoreActivityButtons
          appId={app.id}
          assignmentId={app.assignment_id}
          stage={stage}
          installReward={EARN.optInVerified}
          reviewReward={EARN.feedbackApproved}
        />

        <p className="text-[12px] leading-relaxed text-[var(--color-mute)]">
          Your review is published publicly under your own name on the store listing. The
          publisher reads it and approves the payment; a moderator settles it if they dispute it.
        </p>
      </Card>
    );
  }

  if (isListingOnly(app)) {
    return (
      <Card className="flex flex-col gap-2 p-5">
        <h2 className="text-sm font-semibold">An iOS listing</h2>
        <p className="text-sm leading-relaxed text-[var(--color-dim)]">
          This app is here to be seen, not tested. Closed-track testing is Android only, because
          Google Play is the store that gates production access behind {RULES.requiredTesters}{' '}
          testers for {RULES.requiredDays} days and Apple has no equivalent gate.
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
            A draft is private. Open it to testers and it appears in the feed for everyone.
          </p>
        )}
      </Card>
    );
  }

  if (app.relation === 'testing') {
    const joined = !!app.opt_in_verified;

    // Three steps, and the state of each is read from the assignment rather than
    // guessed: joined when the opt-in is verified, using it while days are still
    // being logged, reporting once there is something to report on.
    const steps: Step[] = [
      {
        label: 'Install',
        state: joined ? 'done' : 'current',
        detail: joined
          ? undefined
          : 'Open the closed track, install from it, then upload the screenshot that proves you are in.',
        action: app.assignment_id
          ? { href: `/tests/${app.assignment_id}/optin`, label: 'Join and upload proof' }
          : undefined,
      },
      {
        label: 'Test',
        state: !joined ? 'locked' : app.report_due ? 'done' : 'current',
        detail:
          joined && !app.report_due
            ? 'Spend a few minutes in the app, then log it. One session is the whole of this step.'
            : undefined,
        action: app.assignment_id
          ? { href: `/tests#test-${app.assignment_id}`, label: 'Log your session' }
          : undefined,
      },
      {
        label: 'Review',
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
      <div className="flex flex-col gap-4">
        {/*
          Tinted, and the only tinted card on the page. This is the one region
          that is about the reader rather than about the app, and on a screen
          that is otherwise a listing it has to be findable without reading.
        */}
        <Card
          className="flex flex-col gap-4 p-5"
          style={{ background: 'var(--color-accent-soft)', borderColor: 'transparent' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                Your activity
              </h2>
              <p className="mt-1 text-[14px] text-[var(--color-dim)]">
                Complete all steps to earn the reward
              </p>
            </div>
            <RewardChip amount={EARN.optInVerified + EARN.feedbackApproved} />
          </div>

          <ActivitySteps steps={steps} />
        </Card>

        {/*
          The current step, opened out. The strip above says where you are; this
          says what to do about it, and it is the reason the opt-in link and the
          screenshot upload are on the same screen as the listing rather than
          two taps away.
        */}
        {!joined && (
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                <IconDevice size={20} />
              </span>
              <div>
                <h3 className="text-[17px] font-bold leading-tight">Install the app</h3>
                <p className="mt-0.5 text-[14px] text-[var(--color-mute)]">Step 1 of your activity</p>
              </div>
            </div>

            {app.opt_in_url ? (
              <a
                href={app.opt_in_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-2)] px-4 py-3.5 text-[15px] font-semibold transition-colors hover:bg-[var(--color-line)]"
              >
                <IconAndroid size={19} />
                <span className="flex-1">Open the closed testing track</span>
                <IconExternal size={16} className="text-[var(--color-mute)]" />
              </a>
            ) : (
              <p className="text-[14px] text-[var(--color-mute)]">
                The developer has not published a link yet. Nothing can be installed until they do.
              </p>
            )}

            {app.assignment_id && (
              <Link href={`/tests/${app.assignment_id}/optin`} className="card-dashed block px-5 py-6 text-center">
                <span
                  className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                >
                  <IconUpload size={19} />
                </span>
                <span className="block text-[16px] font-bold">Add a screenshot to claim</span>
                <span className="mx-auto mt-2 block max-w-md text-[13px] leading-relaxed text-[var(--color-mute)]">
                  Best: the Play testing page showing you are a tester — it verifies instantly. Your
                  home screen with the app icon works too. For a screen inside the app, the status
                  bar clock must be visible. The developer will see this screenshot.
                </span>
              </Link>
            )}
          </Card>
        )}

        {joined && (
          <Card className="flex flex-col gap-3 p-5">
            <p className="text-[14px] leading-relaxed text-[var(--color-dim)]">
              There is no clock on this. Take as long as you need over the app, then send the report
              whenever you have something worth saying.
            </p>
            {app.opt_in_url && (
              <a href={app.opt_in_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                <IconExternal size={15} /> Open the closed track
              </a>
            )}
          </Card>
        )}
      </div>
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

  // Not open to testers, and not in a state that can change from this page. A
  // shipped app reaches here only when its developer has closed it to testers,
  // run out of credits or never added a closed track — so the copy says the app
  // is shut, not that shipped apps are finished with. They are not any more.
  if (app.status !== 'queued' && app.status !== 'in_pod') { // 'in_pod' is the legacy enum value for 'taking testers'
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
        <h2 className="text-sm font-semibold">Not taking testers right now</h2>
        {reward && <RewardChip amount={reward} />}
      </div>
      {/*
        Reached when the app is listed but shut to new testers — the owner is
        out of credits, has hit the number of testers they asked for, or has
        switched intake off. There is no second route to a seat any more, so
        this card offers the feed rather than pretending at one: a primary
        button that lands on a dead door is the fastest way to teach a new
        member that the product's buttons cannot be trusted.
      */}
      <p className="text-sm leading-relaxed text-[var(--color-dim)]">
        This one is listed but closed to new testers at the moment. That usually means the
        developer has as many as they asked for, or their balance is too low to pay for another.
      </p>
      <Link href={marketHref({ scope: 'open' })} className="btn btn-primary">
        Find an app you can start on <IconArrow size={15} />
      </Link>
      <p className="text-xs text-[var(--color-mute)]">
        Each confirmed install pays you {EARN.optInVerified} and each approved report{' '}
        {EARN.feedbackApproved}, out of the balance of the developer whose app you tested.
      </p>
    </Card>
  );
}
