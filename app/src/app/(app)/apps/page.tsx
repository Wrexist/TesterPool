import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState, CreditChip } from '@/components/ui';
import { AppRow } from '@/components/app/app-row';
import { ActivityIntake } from '@/components/app/activity-intake';
import { StoreReviewIntake } from '@/components/app/store-review-intake';
import { getFlags } from '@/lib/flags';
import { IconPlus, IconArrow, IconAlert } from '@/components/app/icons';
import { CHARGE } from '@/lib/economy';
import { marketHref, type MarketApp } from '@/lib/market';
import { n } from '@/lib/format';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My apps — TesterPool' };

/** What one tester's full run costs the owner, and so the floor to receive one. */
const ACTIVITY_COST = CHARGE.install + CHARGE.review;

/** The owner's two activity settings, read straight off their own app rows. */
type IntakeRow = {
  id: string;
  accepting_activities: boolean | null;
  activity_target: number | null;
  accepting_store_reviews: boolean | null;
  store_url: string | null;
};

/**
 * My apps.
 *
 * Reads through `market_apps('mine')` rather than the `apps` table, for the
 * same reason every other marketplace surface does: one projection decides what
 * an app row shows, so this screen and the public listing can never drift into
 * describing the same app differently.
 *
 * The credit gate at the top is the whole point of the page. `credits_paused`
 * is the moment a developer's testing stops, and until now it was an amber pill
 * halfway down the dashboard. It is a task, and it is stated as one.
 */
export default async function MyAppsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect('/login');

  const [{ data: rows }, { data: profileRow }, { data: intakeRows }] = await Promise.all([
    supabase.rpc('market_apps', { p_scope: 'mine', p_limit: 48 }),
    supabase.from('profiles').select('credits').eq('id', auth.user.id).maybeSingle(),
    /*
      The listing still comes from `market_apps` — these two columns do not,
      and deliberately. `accepting_activities` and `activity_target` are the
      owner's own settings, not part of the projection that decides what a
      browsing member may see, and putting them there would mean answering
      "which of these does a stranger get" for a pair of fields no stranger has
      any business reading. Scoped to this user's own rows, which is all RLS
      would return anyway.
    */
    supabase
      .from('apps')
      .select('id, accepting_activities, activity_target, accepting_store_reviews, store_url')
      .eq('owner_id', auth.user.id),
  ]);

  // The per-app switch only renders when the network-wide flag is on. A control
  // for a closed feature is a control that lies about what it does.
  const flags = await getFlags();

  const apps = (rows ?? []) as MarketApp[];
  const balance = n((profileRow as Pick<Profile, 'credits'> | null)?.credits, 0);
  const short = balance < ACTIVITY_COST;

  const intake = new Map(
    ((intakeRows ?? []) as IntakeRow[]).map((r) => [r.id, r])
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">My Apps</h1>
        <p className="mt-1 max-w-lg text-[16px] leading-snug text-[var(--color-dim)]">
          List your apps, get installs and feedback from other developers
        </p>
      </header>

      {short && apps.length > 0 && <CreditGate balance={balance} />}

      {apps.length === 0 ? (
        <EmptyState
          title="No apps listed yet"
          body="Your app appears in the marketplace the moment you list it, and testers can pick it up from there. A draft stays private until then."
          action={
            <Link href="/onboarding" className="btn btn-primary">
              List your first app <IconArrow size={15} />
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {apps.map((app) => {
            const row = intake.get(app.id);
            // An iOS listing takes no testers at all yet, so it gets no
            // controls — a switch that governs nothing is worse than no switch.
            const seated = app.platform === 'android';
            // Inactive means one of two things and a developer needs to know
            // which: their balance ran out, or they switched intake off. Both
            // stop testers arriving; only one of them costs money to fix.
            const paused = seated && (short || row?.accepting_activities === false);
            return (
              <Card key={app.id} className="overflow-hidden p-0">
                <AppRow app={app} href={`/dashboard?app=${app.id}`} counts bare />
                {paused && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--color-line)] px-4 py-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                      style={{ background: 'var(--color-credit-soft)', color: '#9A6510' }}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: 'var(--color-credit)' }}
                      />
                      Inactive
                    </span>
                    <span className="text-[13px] text-[var(--color-mute)]">
                      {short ? 'Your balance is too low' : 'You switched intake off'}
                    </span>
                    {short && (
                      <Link
                        href={marketHref({ status: 'needs_testers' })}
                        className="ml-auto text-[13px] font-semibold text-[var(--color-accent)]"
                      >
                        Earn credits to reactivate
                      </Link>
                    )}
                  </div>
                )}
                {seated && (
                  <ActivityIntake
                    // Remounts when the server's values change, which is how
                    // this component takes new props — see the note in it.
                    key={`${app.id}:${row?.accepting_activities}:${row?.activity_target}`}
                    appId={app.id}
                    accepting={row?.accepting_activities ?? true}
                    target={n(row?.activity_target, 5)}
                    seatsLeft={app.activity_seats_left}
                  />
                )}
                {seated && flags.store_reviews && (
                  <StoreReviewIntake
                    key={`${app.id}:store:${row?.accepting_store_reviews}`}
                    appId={app.id}
                    accepting={row?.accepting_store_reviews ?? false}
                    hasStoreListing={!!row?.store_url}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
      {/*
        A floating button rather than one in the header. On a phone the header
        scrolls away, and "add another app" is the one action on this screen a
        developer takes from anywhere in the list.
      */}
      <Link
        href="/onboarding"
        className="btn btn-primary fixed bottom-24 right-4 z-20 gap-2 px-5 py-3.5 text-[15px] shadow-lg md:bottom-8 md:right-8"
        style={{ boxShadow: '0 10px 30px -8px color-mix(in oklab, var(--color-accent) 55%, transparent)' }}
      >
        <IconPlus size={18} /> Add App
      </Link>
    </div>
  );
}

/**
 * The supply gate, phrased as the next thing to do.
 *
 * A developer whose balance cannot cover a tester's full run is not doing
 * anything wrong and has not hit an error — they have run out of the thing the
 * network trades in, and the fix is one activity away. Saying "you need more
 * credits" and stopping there would be an error message; saying what it costs,
 * what you have, and where to earn it is a task.
 */
function CreditGate({ balance }: { balance: number }) {
  return (
    <Card
      className="flex flex-col gap-3 p-5"
      style={{
        borderColor: 'color-mix(in oklab, var(--color-credit) 45%, transparent)',
        background: 'var(--color-credit-soft)',
      }}
    >
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <IconAlert size={18} className="text-[var(--color-credit)]" />
        You need more credits
      </h2>
      <p className="text-[15px] leading-relaxed text-[var(--color-dim)]">
        You have <CreditChip amount={balance} size="sm" />, but one tester&apos;s full run —
        the confirmed install and the report — costs{' '}
        <span className="num font-semibold text-[var(--color-ink)]">{ACTIVITY_COST}</span>. Testing
        on your apps pauses until you are above that, and resumes by itself the moment you are.
        Complete one job to earn{' '}
        <span className="num font-semibold text-[var(--color-ink)]">+{ACTIVITY_COST}</span>.
      </p>
      <Link href={marketHref({ status: 'needs_testers' })} className="btn btn-credit w-full py-3 text-[15px]">
        <IconBolt size={17} /> Earn <span className="num">{ACTIVITY_COST}</span> credits
      </Link>
      <Link href="/billing" className="text-center text-[14px] font-semibold text-[var(--color-dim)] hover:text-[var(--color-ink)]">
        Or buy a credit pack
      </Link>
    </Card>
  );
}

/** Only used on the amber button. Earning is the fast path, and it looks it. */
function IconBolt({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.2 2 4.6 13.1a.7.7 0 0 0 .55 1.13h4.4l-1.75 7.02a.7.7 0 0 0 1.23.6l8.6-11.1a.7.7 0 0 0-.55-1.13h-4.4l1.75-7.02A.7.7 0 0 0 13.2 2Z" />
    </svg>
  );
}
