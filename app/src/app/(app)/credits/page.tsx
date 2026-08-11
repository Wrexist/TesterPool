import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CreditChip, EmptyState, Stat, Pill } from '@/components/ui';
import { SpendButton } from './spend-button';
import { InvitePanel } from '@/components/app/invite-panel';
import { EARN, COST, FULL_CYCLE_EARNINGS, RULES } from '@/lib/economy';
import { fmtDate, ledgerLabel, n } from '@/lib/pods';
import type { LedgerEntry, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Credits — TesterPool' };

const EARN_ROWS = [
  { label: 'Verified opt-in', value: EARN.optInVerified, note: 'Escrowed, released when the pod completes.' },
  { label: 'Daily check-in', value: EARN.dailyCheckin, note: `${EARN.dailyCheckin} x ${RULES.requiredDays} = ${EARN.dailyCheckin * RULES.requiredDays} over a full run.` },
  { label: 'Perfect 14 of 14', value: EARN.streakBonusFull, note: 'Paid only on a clean sheet.' },
  { label: 'Approved feedback report', value: EARN.feedbackApproved, note: 'Specific and on-rubric. Criticism pays the same as praise.' },
  { label: 'Blocker with repro steps', value: EARN.bugBountyBlocker, note: 'Bonus on top of the report.' },
  { label: 'Rescue a broken pod', value: EARN.rescueBonus, note: 'Joining mid-cycle to replace a dropout.' },
  { label: 'Referral, when they finish', value: EARN.referralReferrer, note: 'Paid on their first completed pod, never on signup.' },
];

const SPEND_ROWS = [
  { key: 'cost_buffer_seat', fallback: COST.bufferSeat, label: 'Buffer seat', note: 'One extra tester beyond the pod default.' },
  { key: 'cost_rescue_seat', fallback: COST.rescueSeat, label: 'Rescue tester', note: 'Emergency replacement, matched within hours.' },
  { key: 'cost_priority_pod', fallback: COST.priorityPod, label: 'Priority pod', note: 'Skip the forming queue and start within 24 hours.' },
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
          The pod itself is barter: everyone tests everyone. Credits only price the edges, which is why one
          honest cycle of tester work pays exactly what one buffer seat costs.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">Balance</div>
          <div className="mt-2"><CreditChip amount={balance} size="lg" /></div>
          <p className="mt-2 text-xs text-[var(--color-dim)]">
            A full cycle of testing pays <span className="num">{FULL_CYCLE_EARNINGS}</span>.
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
                Abandoning a pod mid-cycle costs <span className="num">120</span> credits and a large
                reliability hit. You broke fourteen other clocks.
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
                  Buy a credit pack or a paid pod
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
          body="Your code is below. You are paid when they complete their first pod, and you keep a permanent cut of what they earn after that."
          referrals={referralCount ?? 0}
          titheEarned={titheEarned}
        />
      </section>
    </div>
  );
}
