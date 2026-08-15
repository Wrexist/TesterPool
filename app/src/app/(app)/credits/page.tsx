import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CreditChip, EmptyState, Stat, Pill } from '@/components/ui';
import { SpendButton } from './spend-button';
import { InvitePanel } from '@/components/app/invite-panel';
import { EARN, COST, CHARGE, CAPS, FULL_CYCLE_EARNINGS, FULL_CYCLE_COST, RULES } from '@/lib/economy';
import { fmtDate, ledgerLabel, n } from '@/lib/format';
import type { LedgerEntry, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Credits — TesterPool' };

const EARN_ROWS = [
  { label: 'Confirmed install', value: EARN.optInVerified, note: 'Your closed-track opt-in verified. Paid by the app owner.' },
  { label: 'Confirmed report', value: EARN.feedbackApproved, note: 'Paid by the app owner. Criticism pays exactly what praise pays.' },
  { label: 'Daily check-in', value: EARN.dailyCheckin, note: `${EARN.dailyCheckin} x ${RULES.requiredDays} = ${EARN.dailyCheckin * RULES.requiredDays} over a full run.` },
  { label: 'Perfect 14 of 14', value: EARN.streakBonusFull, note: 'Paid only on a clean sheet.' },
  { label: 'Blocker with repro steps', value: EARN.bugBountyBlocker, note: 'Funded by us, not the developer. Finding the worst bug must never cost them most.' },
  { label: 'Rescue an abandoned seat', value: EARN.rescueBonus, note: 'Stepping in when someone else walked away.' },
  { label: 'Referral, when they finish', value: EARN.referralReferrer, note: 'Paid on their first finished job, never on signup.' },
];

const CHARGE_ROWS = [
  { label: 'A tester installs your app', value: CHARGE.install, note: 'Charged when their opt-in is confirmed, not before.' },
  { label: 'A tester reports on your app', value: CHARGE.review, note: 'Flat, whatever they found. Disputing and losing costs the same.' },
];

const SPEND_ROWS = [
  { key: 'cost_buffer_seat', fallback: COST.bufferSeat, label: 'Buffer seat', note: 'One extra tester beyond your target.' },
  { key: 'cost_rescue_seat', fallback: COST.rescueSeat, label: 'Rescue tester', note: 'Emergency replacement, matched within hours.' },
  { key: 'cost_priority_pod', fallback: COST.priorityMatch, label: 'Priority placement', note: 'Top of the feed until you have the testers you asked for.' },
  { key: 'cost_expert_seat', fallback: COST.expertSeat, label: 'Expert seat', note: 'A platinum tester in your category who writes long-form reports.' },
];

export default async function CreditsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const [{ data: profileRow }, { data: ledgerRows }, { data: configRows }, { count: referralCount }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60),
      supabase.from('economy_config').select('key, value'),
      supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', user.id),
    ]);

  const profile = profileRow as Profile | null;
  const ledger = (ledgerRows ?? []) as LedgerEntry[];
  const config: Record<string, number> = {};
  for (const row of (configRows ?? []) as { key: string; value: number }[]) config[row.key] = row.value;

  const balance = n(profile?.credits, 0);
  const earnedTotal = ledger.filter((e) => e.delta > 0).reduce((t, e) => t + e.delta, 0);
  const spentTotal = ledger.filter((e) => e.delta < 0).reduce((t, e) => t + Math.abs(e.delta), 0);
  const titheEarned = ledger.filter((e) => e.reason === 'referral_tithe').reduce((t, e) => t + e.delta, 0);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
          Credits move, they are never minted. What you earn testing comes out of the balance of the
          developer whose app you tested — and yours pays your testers the same way.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">Balance</div>
          <div className="mt-2"><CreditChip amount={balance} size="lg" /></div>
          <p className="mt-2 text-xs text-[var(--color-dim)]">
            A full cycle costs <span className="num">{FULL_CYCLE_COST}</span> and pays{' '}
            <span className="num">{FULL_CYCLE_EARNINGS}</span>. Do your share and you break even.
          </p>
        </Card>
        <Stat label="Earned, recent" value={<span className="num">{earnedTotal}</span>} sub="last 60 entries" />
        <Stat label="Spent, recent" value={<span className="num">{spentTotal}</span>} sub="last 60 entries" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ---------------------------------------------------------- ledger */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
            Ledger
          </h2>
          <Card className="overflow-hidden">
            {ledger.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Nothing has moved yet"
                  body="Your welcome grant and every credit you earn from testing appears here, with the reason attached. The ledger is append-only, so nothing quietly disappears."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[var(--color-mute)]">
                      <th className="px-4 py-2.5 font-semibold">Reason</th>
                      <th className="px-4 py-2.5 font-semibold">Date</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => (
                      <tr key={entry.id} className="border-b border-[var(--color-line)] last:border-b-0">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{ledgerLabel(entry.reason)}</div>
                          {entry.memo && <div className="text-xs text-[var(--color-mute)]">{entry.memo}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[var(--color-dim)]">{fmtDate(entry.created_at)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className="num font-semibold"
                            style={{ color: entry.delta >= 0 ? 'var(--color-accent)' : 'var(--color-danger)' }}
                          >
                            {entry.delta > 0 ? '+' : ''}{entry.delta}
                          </span>
                        </td>
                        <td className="num px-4 py-2.5 text-right text-[var(--color-dim)]">{entry.balance_after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        {/* ------------------------------------------------------- earn/spend */}
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
              How to earn
            </h2>
            <Card className="divide-y divide-[var(--color-line)]">
              {EARN_ROWS.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{row.label}</div>
                    <div className="text-xs text-[var(--color-mute)]">{row.note}</div>
                  </div>
                  <CreditChip amount={row.value} size="sm" signed />
                </div>
              ))}
              <div className="px-4 py-3 text-xs text-[var(--color-dim)]">
                Free members bank <span className="num">{CAPS.dailyInstalls}</span> installs and{' '}
                <span className="num">{CAPS.dailyReviews}</span> reports a day. The limit resets at midnight
                UTC.{' '}
                <a href="/billing" className="underline decoration-[var(--color-line-hi)] underline-offset-2">
                  Unlimited removes it
                </a>
                .
              </div>
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
              What your own app costs you
            </h2>
            <Card className="divide-y divide-[var(--color-line)]">
              {CHARGE_ROWS.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{row.label}</div>
                    <div className="text-xs text-[var(--color-mute)]">{row.note}</div>
                  </div>
                  <CreditChip amount={-row.value} size="sm" signed />
                </div>
              ))}
              <div className="px-4 py-3 text-xs text-[var(--color-dim)]">
                Run out and the testers already working are still paid — your app just stops taking new
                work until you top up. Abandoning a seat costs <span className="num">120</span> and a large reliability
                hit; you broke fourteen other clocks.
              </div>
            </Card>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">Spend</h2>
              <Pill tone="neutral">Balance {balance}</Pill>
            </div>
            <Card className="flex flex-col gap-3 p-4">
              {SPEND_ROWS.map((row) => (
                <div key={row.key}>
                  <SpendButton
                    configKey={row.key}
                    price={config[row.key] ?? row.fallback}
                    balance={balance}
                    label={row.label}
                  />
                  <p className="mt-1 text-[11px] text-[var(--color-mute)]">{row.note}</p>
                </div>
              ))}
              <p className="border-t border-[var(--color-line)] pt-3 text-[11px] text-[var(--color-mute)]">
                Short of credits and out of time?{' '}
                <a href="/billing" className="underline decoration-[var(--color-line-hi)] underline-offset-2">
                  Buy a credit pack or a paid plan
                </a>
                . Testing earns the same credits for free; the money only buys the fourteen days back.
              </p>
            </Card>
          </section>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
          Referrals
        </h2>
        <InvitePanel
          code={profile?.referral_code ?? ''}
          headline="Invite a developer who will actually test"
          body="Your code is below. You are paid when they finish their first job, and you keep a permanent cut of what they earn after that."
          referrals={referralCount ?? 0}
          titheEarned={titheEarned}
        />
      </section>
    </div>
  );
}
