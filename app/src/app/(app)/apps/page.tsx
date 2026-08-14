import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState, CreditChip } from '@/components/ui';
import { AppRow } from '@/components/app/app-row';
import { IconPlus, IconArrow, IconAlert } from '@/components/app/icons';
import { CHARGE } from '@/lib/economy';
import { marketHref, type MarketApp } from '@/lib/market';
import { n } from '@/lib/pods';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My apps — TesterPool' };

/** What one tester's full run costs the owner, and so the floor to receive one. */
const ACTIVITY_COST = CHARGE.install + CHARGE.review;

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

  const [{ data: rows }, { data: profileRow }] = await Promise.all([
    supabase.rpc('market_apps', { p_scope: 'mine', p_limit: 48 }),
    supabase.from('profiles').select('credits').eq('id', auth.user.id).maybeSingle(),
  ]);

  const apps = (rows ?? []) as MarketApp[];
  const balance = n((profileRow as Pick<Profile, 'credits'> | null)?.credits, 0);
  const short = balance < ACTIVITY_COST;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My apps</h1>
          <p className="mt-1 text-sm text-[var(--color-dim)]">
            List an app, get installs and reports from other developers.
          </p>
        </div>
        <Link href="/onboarding" className="btn btn-secondary shrink-0">
          <IconPlus size={15} /> Add app
        </Link>
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
        <div className="flex flex-col gap-2.5">
          {apps.map((app) => (
            <AppRow key={app.id} app={app} href={`/dashboard?app=${app.id}`} counts />
          ))}
        </div>
      )}
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
        borderColor: 'color-mix(in oklab, var(--color-credit) 30%, transparent)',
        background: 'color-mix(in oklab, var(--color-credit) 7%, transparent)',
      }}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <IconAlert size={15} className="text-[var(--color-credit)]" />
        You need more credits
      </h2>
      <p className="text-sm leading-relaxed text-[var(--color-dim)]">
        You have <CreditChip amount={balance} size="sm" />, and one tester&apos;s full run —
        the confirmed install and the report — costs <span className="num font-semibold text-[var(--color-ink)]">{ACTIVITY_COST}</span>.
        Testing on your apps pauses until you are above that, and resumes by itself the moment
        you are.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={marketHref({ status: 'needs_testers' })} className="btn btn-primary">
          Earn <span className="num">{ACTIVITY_COST}</span> credits
        </Link>
        <Link href="/billing" className="btn btn-secondary">
          Buy credits
        </Link>
      </div>
    </Card>
  );
}
