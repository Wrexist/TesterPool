/**
 * TESTERPOOL — one app, in full.
 *
 * One column at every width, and ordered by what the reader came to do rather
 * than by what there is to say about the app. The activity is first, the step
 * you are on is opened out underneath it, the ways to reach the developer come
 * after that, and the description is last — because someone who is three taps
 * into taking a job does not need the marketing copy above the button.
 *
 * The two-column version this replaced put a sticky action panel beside a body
 * of headings and statistics. On a phone that collapsed to two screens of
 * reading before the only control on the page, and on a desktop it spent half
 * the width on "Testers seated" — a number that answers a question nobody had.
 *
 * Presentational on purpose: the route resolves the app through `market_app`
 * and this renders whatever came back. Every field it reads is one the RPC was
 * willing to hand this particular viewer, so there is no second place where a
 * decision about visibility could quietly be made differently.
 */

import Link from 'next/link';
import { Card, Pill } from '@/components/ui';
import { AppIcon } from '@/components/app/app-card';
import { RewardChip, PlatformChip } from '@/components/app/app-row';
import { StepRail, type RailStep } from '@/components/app/step-rail';
import { ClaimStep } from '@/components/app/claim-step';
import { SaveButton } from '../save-button';
import {
  IconArrow, IconExternal, IconFeedback, IconAlert, IconDevice, IconAndroid, IconApple,
  IconChat, IconLock, IconStoreGet, IconUser, IconCheck,
} from '@/components/app/icons';
import { EARN, RULES } from '@/lib/economy';
import { marketHref, isListingOnly, type MarketAppDetail } from '@/lib/market';
import { sinceShort } from '@/lib/format';

/** What one complete activity pays: the install and the report together. */
const REWARD = EARN.optInVerified + EARN.feedbackApproved;

export function AppDetail({ app, storeOpen = false }: { app: MarketAppDetail; storeOpen?: boolean }) {
  const ios = isListingOnly(app);
  const owner = app.relation === 'owner';

  /*
   * The tagline is usually the first line of the description, so rendering both
   * printed the same sentence twice — once under the title and once again under
   * About. When they overlap the description wins and the tagline is dropped.
   */
  const description = (app.description ?? '').trim();
  const tagline = (app.tagline ?? '').trim();
  const duplicated =
    !!tagline && !!description &&
    description.slice(0, 80).toLowerCase().startsWith(tagline.slice(0, 40).toLowerCase());

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 pb-4">
      {/* ---------------------------------------------------------- chrome */}
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
      <header className="flex items-start gap-4 pt-1">
        <AppIcon name={app.name} src={app.icon_url} size={72} />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight">{app.name}</h1>
            {app.featured && <Pill tone="amber">Featured</Pill>}
          </div>
          <p className="mt-0.5 text-[15px] text-[var(--color-dim)]">
            {app.owner_display_name || (app.owner_handle ? `@${app.owner_handle}` : 'A developer')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PlatformChip ios={app.platform === 'ios'} />
            {app.category && (
              <span className="text-[13px] text-[var(--color-mute)]">{app.category}</span>
            )}
          </div>
        </div>
      </header>

      {!duplicated && tagline && (
        <p className="text-[15px] leading-relaxed text-[var(--color-dim)]">{tagline}</p>
      )}

      {/* -------------------------------------------------------- activity */}
      <Activity app={app} storeOpen={storeOpen} ios={ios} owner={owner} />

      {/* ------------------------------------------------------------ ways in */}
      <LinksCard app={app} owner={owner} />

      {/* ----------------------------------------------------------- about */}
      {description && (
        <section className="pt-1">
          <h2 className="text-[19px] font-bold tracking-tight">About this app</h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[var(--color-dim)]">
            {description.slice(0, 4000)}
          </p>
        </section>
      )}

      {app.tester_instructions && (
        <section>
          <h2 className="text-[19px] font-bold tracking-tight">Instructions from the developer</h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[var(--color-dim)]">
            {app.tester_instructions}
          </p>
        </section>
      )}

      {app.min_android_version && (
        <p className="text-[13px] text-[var(--color-mute)]">
          Needs Android <span className="num">{app.min_android_version}</span> or newer.
        </p>
      )}

      {/*
        This claim has to follow the job on offer. Closed-track work genuinely is
        invisible to the store surface, and saying so is the honest sell. A store
        activity is not, and printing the closed-track line under an Install button
        would be telling a tester their public review carries no risk at the very
        moment we ask them to publish one.
      */}
      <p className="text-[12px] leading-relaxed text-[var(--color-mute)]">
        {storeOpen && !owner ? (
          <>
            This developer is asking for a public store install and review. That is public
            activity on your own store account, and Google and Apple both prohibit
            incentivised reviews. Write what you actually think — the rating is yours, and
            you are paid the same whatever you give.
          </>
        ) : (
          <>
            Testing happens inside a closed testing track, which does not affect store
            rankings, ratings or install counts. Your report is private to the developer and
            paid the same whether it praises the app or takes it apart.
          </>
        )}
      </p>
    </div>
  );
}

/* ========================================================================== */

/**
 * The three steps, and the one you are on opened out underneath them.
 *
 * Every state of this screen is a state of the same three steps, which is why
 * there is one component rather than a card per case. The rail says where you
 * are; the card below says what to do about it.
 */
function Activity({
  app, storeOpen, ios, owner,
}: {
  app: MarketAppDetail; storeOpen: boolean; ios: boolean; owner: boolean;
}) {
  if (owner) return <OwnerCard app={app} />;

  const seated = app.relation === 'testing' || app.relation === 'tested';
  const installed = !!app.opt_in_verified;
  const reported = app.relation === 'tested';

  /*
   * Whether this app can be worked on at all, and by which door. A store
   * activity runs against a PUBLIC listing, so unlike closed-track testing it
   * does not care which store the app is on — that check is first, deliberately,
   * because putting the platform check first turned every opted-in iOS app away
   * from a job it could actually do.
   */
  const open = storeOpen || app.activity_open;

  if (!open && !seated) return <ShutCard ios={ios} />;

  /*
   * Exactly one bead is ever current. Marking Test and Review both current once
   * the install landed lit two of the three at the same time, which stops the
   * rail answering the only question it is there for — where am I of three.
   *
   * Test stays current until the report is filed, and Review is the thing that
   * finishes it. That is why the card underneath is headed "step 2" and its
   * button is "write your review": the reader is on Test, and writing it up is
   * how Test ends.
   */
  const steps: RailStep[] = [
    { label: 'Install', state: installed ? 'done' : 'current' },
    { label: 'Test',    state: reported ? 'done' : installed ? 'current' : 'locked' },
    { label: 'Review',  state: reported ? 'done' : 'locked' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card
        className="flex flex-col gap-5 p-5"
        style={{ background: 'var(--color-accent-soft)', borderColor: 'transparent' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
              Your activity
            </h2>
            <p className="mt-1 text-[14px] text-[var(--color-dim)]">
              {reported ? 'Both steps are done' : 'Complete all steps to earn the reward'}
            </p>
          </div>
          <RewardChip amount={REWARD} />
        </div>
        <StepRail steps={steps} />
      </Card>

      {!installed && <InstallCard app={app} storeOpen={storeOpen} />}
      {installed && !reported && <ReviewCard app={app} storeOpen={storeOpen} />}
      {reported && <DoneCard />}

      {/* Locked until the step above is finished, and drawn as locked rather
          than hidden: the reader is being asked to do step one on the promise
          of step two, so step two has to be visible while it is unreachable. */}
      {!installed && <LockedReview />}
    </div>
  );
}

/** Step one, opened out: where to get it, and where to put the proof. */
function InstallCard({ app, storeOpen }: { app: MarketAppDetail; storeOpen: boolean }) {
  const apple = app.platform === 'ios';
  const store = storeOpen && !app.activity_open;

  // Where the install comes from. A store activity points at the public
  // listing; a closed-track one points at the track, and refuses to invent a
  // link when the developer has not published one.
  const href = store ? app.store_url : (app.opt_in_url ?? app.store_url);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <StepHead
        n={1}
        title="Install the app"
        sub="Step 1 of your activity"
        icon={<IconDevice size={20} />}
      />

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-2)] px-4 py-3.5 text-[15px] font-semibold transition-colors hover:bg-[var(--color-line)]"
        >
          {apple ? <IconApple size={19} /> : <IconAndroid size={19} />}
          <span className="flex-1 text-left">
            {store
              ? (apple ? 'Get it on App Store' : 'Get it on Google Play')
              : 'Open the closed testing track'}
          </span>
          <IconStoreGet size={16} className="text-[var(--color-mute)]" />
        </a>
      ) : (
        <p className="text-[14px] text-[var(--color-mute)]">
          The developer has not published a link yet. Nothing can be installed until they do.
        </p>
      )}

      <ClaimStep
        appId={app.id}
        assignmentId={app.assignment_id}
        store={store}
        body={
          store
            ? (apple
                ? 'Best: the App Store page showing the "Open" button — it verifies instantly. Your home screen with the app icon works too. For a screen inside the app, the status bar clock must be visible. The developer will see this screenshot.'
                : 'Best: the Play Store page showing the "Open" button — it verifies instantly. Your home screen with the app icon works too. For a screen inside the app, the status bar clock must be visible. The developer will see this screenshot.')
            : 'Best: the Play testing page showing you are a tester — it verifies instantly. Your home screen with the app icon works too. For a screen inside the app, the status bar clock must be visible. The developer will see this screenshot.'
        }
      />
    </Card>
  );
}

/** Step two and three, which are one screen: use it, then write it up. */
function ReviewCard({ app, storeOpen }: { app: MarketAppDetail; storeOpen: boolean }) {
  const store = storeOpen && !app.activity_open;
  const href = app.assignment_id
    ? `/tests/${app.assignment_id}/${store ? 'store-review' : 'feedback'}`
    : '/tests';

  return (
    <Card className="flex flex-col gap-4 p-5">
      <StepHead
        n={2}
        title="Write your review"
        sub={store ? 'Publish it, then screenshot it' : 'Private to the developer'}
        icon={<IconFeedback size={19} />}
      />
      <p className="text-[14px] leading-relaxed text-[var(--color-dim)]">
        Spend a few minutes in the app first. There is no clock on this — send it when you
        have something worth saying. Specific criticism pays exactly what praise pays.
      </p>
      <Link href={href} className="btn btn-primary w-full py-3.5 text-[15px]">
        Write your review <IconArrow size={16} />
      </Link>
    </Card>
  );
}

function DoneCard() {
  return (
    <Card className="flex items-start gap-3 p-5">
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'var(--color-android-soft)', color: 'var(--color-android)' }}
      >
        <IconCheck size={18} />
      </span>
      <p className="text-[14px] leading-relaxed text-[var(--color-dim)]">
        Filed. The developer reads it and approves the payment; if they dispute it a
        moderator settles it, and specific criticism is upheld.
      </p>
    </Card>
  );
}

/** Step two, drawn shut. */
function LockedReview() {
  return (
    <Card className="flex items-center gap-3 p-5">
      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'var(--color-surface-2)', color: 'var(--color-mute)' }}
      >
        <IconLock size={19} />
      </span>
      <div className="min-w-0">
        <h3 className="text-[17px] font-bold leading-tight text-[var(--color-mute)]">
          Write your review
        </h3>
        <p className="mt-0.5 text-[14px] text-[var(--color-mute)]">
          Install the app first to unlock
        </p>
      </div>
    </Card>
  );
}

function StepHead({
  n, title, sub, icon,
}: { n: number; title: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'var(--color-accent)', color: '#fff' }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[17px] font-bold leading-tight">{title}</h3>
        <p className="mt-0.5 text-[14px] text-[var(--color-mute)]">{sub}</p>
      </div>
      <span className="num shrink-0 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-[13px] font-semibold text-[var(--color-dim)]">
        {n} of 3
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ ways in */

/**
 * The three ways out of this page: talk to the developer, look at who they
 * are, look at the app where it lives.
 *
 * The thread is first and is the only one in accent, because it is the only one
 * that does something rather than going somewhere — and because a tester who is
 * stuck on an install has one useful move and it is to ask.
 */
function LinksCard({ app, owner }: { app: MarketAppDetail; owner: boolean }) {
  const canMessage = app.can_message === true && !owner;
  const seen = sinceShort(app.owner_last_seen_at);

  return (
    <Card className="divide-y divide-[var(--color-line)] overflow-hidden p-0">
      {canMessage && (
        <Link
          href={`/market/${app.id}/chat`}
          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--color-surface-2)]"
        >
          <IconChat size={19} className="shrink-0 text-[var(--color-accent)]" />
          <span className="flex-1 text-[15px] font-semibold text-[var(--color-accent)]">
            Chat with Developer
          </span>
          {!!app.unread && (
            <span
              className="num rounded-full px-2 py-0.5 text-[12px] font-bold"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              {app.unread}
            </span>
          )}
          {seen && <span className="shrink-0 text-[13px] text-[var(--color-mute)]">Active {seen}</span>}
        </Link>
      )}

      {app.owner_handle && (
        <Link
          href={`/u/${app.owner_handle}`}
          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--color-surface-2)]"
        >
          <IconUser size={19} className="shrink-0 text-[var(--color-ink)]" />
          <span className="flex-1 text-[15px] font-semibold">Developer Profile</span>
          <IconArrow size={16} className="shrink-0 text-[var(--color-mute)]" />
        </Link>
      )}

      {app.store_url && (
        <a
          href={app.store_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--color-surface-2)]"
        >
          <IconStoreGet size={19} className="shrink-0 text-[var(--color-ink)]" />
          <span className="flex-1 text-[15px] font-semibold">
            Open in {app.platform === 'ios' ? 'App Store' : 'Google Play'}
          </span>
          <IconExternal size={16} className="shrink-0 text-[var(--color-mute)]" />
        </a>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- other states */

function OwnerCard({ app }: { app: MarketAppDetail }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-[17px] font-bold">This is your app</h2>
      <p className="text-[14px] leading-relaxed text-[var(--color-dim)]">
        This is what everyone else sees. Your opt-in link, package name and instructions are
        not on this page for anyone but you.
      </p>
      <Link href={`/dashboard?app=${app.id}`} className="btn btn-primary">
        Open the dashboard <IconArrow size={15} />
      </Link>
      <Link href="/feedback" className="btn btn-secondary">
        <IconFeedback size={15} /> Feedback inbox
      </Link>
      {app.status === 'draft' && (
        <p className="flex items-start gap-1.5 text-[12px] text-[var(--color-mute)]">
          <IconAlert size={13} className="mt-px shrink-0" />
          A draft is private. Open it to testers and it appears in the feed for everyone.
        </p>
      )}
    </Card>
  );
}

/**
 * Listed, but there is no job here today.
 *
 * Reached when the publisher has switched intake off, filled the places they
 * asked for, or run out of balance — and, on iOS, when they have not opted the
 * listing into store activities. The copy says the app is shut rather than that
 * the platform is, because an iOS listing that IS opted in works fine.
 */
function ShutCard({ ios }: { ios: boolean }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-[17px] font-bold">Not taking testers right now</h2>
      <p className="text-[14px] leading-relaxed text-[var(--color-dim)]">
        {ios
          ? 'This developer has not opened their listing to activities. Closed-track testing is Android only — Google Play is the store that gates production access behind '
            + `${RULES.requiredTesters} testers for ${RULES.requiredDays} days — so on iOS the way in is a store activity, and this one has not switched it on.`
          : 'This one is listed but closed to new testers at the moment. That usually means the developer has as many as they asked for, or their balance is too low to pay for another.'}
      </p>
      <Link href={marketHref({ scope: 'open' })} className="btn btn-primary">
        Find an app you can start on <IconArrow size={15} />
      </Link>
    </Card>
  );
}
