import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, CreditChip, Stat, EmptyState } from '@/components/ui';
import { PLANS, CHARGE, FULL_CYCLE_EARNINGS, FULL_CYCLE_COST, RULES } from '@/lib/economy';
import {
  PLAN_SKUS,
  CREDIT_PACKS,
  skuForPlan,
  fmtPrice,
  centsPerCredit,
  PURCHASE_STATUS_LABEL,
  type PurchaseRow,
  type EntitlementRow,
} from '@/lib/billing';
import { stripeConfigured, isLiveMode } from '@/lib/stripe';
import { getFlag } from '@/lib/flags';
import { fmtDate, n } from '@/lib/format';
import { BuyButton, ManageBillingButton, type BuyApp } from './buy-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Billing — TesterPool' };

const ENTITLEMENT_LABEL: Record<string, string> = {
  fast_pod: 'Fast Track',
  pro: 'Pro',
  rescue: 'Rescue',
  unlimited: 'Unlimited',
};

function IconCheck({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.5 shrink-0">
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="var(--color-accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const paidOpen = await getFlag('paid_tiers');
  const configured = stripeConfigured();
  const live = isLiveMode();
  const sellable = paidOpen && configured;

  const [{ data: appRows }, { data: purchaseRows }, { data: entitlementRows }, { data: profileRow }] =
    await Promise.all([
      supabase.from('apps').select('id, name').eq('owner_id', user.id).order('created_at'),
      supabase
        .from('purchases')
        .select('id, app_id, sku, amount_cents, currency, status, credits_granted, created_at, fulfilled_at, refunded_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('entitlements')
        .select('id, app_id, kind, consumed_at, expires_at, revoked_at, created_at')
        .eq('user_id', user.id)
        .is('consumed_at', null)
        .is('revoked_at', null)
        // An expired pass is not an entitlement. Matches has_unlimited_testing.
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('credits').eq('id', user.id).maybeSingle<{ credits: number }>(),
    ]);

  const apps = ((appRows ?? []) as BuyApp[]).map((a) => ({ id: a.id, name: a.name || 'Untitled app' }));
  const appName = new Map(apps.map((a) => [a.id, a.name]));
  const purchases = (purchaseRows ?? []) as PurchaseRow[];
  const entitlements = (entitlementRows ?? []) as EntitlementRow[];
  const balance = n(profileRow?.credits, 0);

  const spentCents = purchases
    .filter((p) => p.status === 'fulfilled' || p.status === 'paid')
    .reduce((total, p) => total + p.amount_cents, 0);

  const bestPack = CREDIT_PACKS.reduce((best, pack) =>
    centsPerCredit(pack) < centsPerCredit(best) ? pack : best
  );

  const disabledReason = !configured
    ? 'Payments are not configured on this deployment.'
    : !paidOpen
      ? 'Paid plans are not open yet.'
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------------------ header */}
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          {configured && !live && <Pill tone="amber">Stripe test mode</Pill>}
          {!paidOpen && <Pill tone="neutral">Paid plans closed</Pill>}
        </div>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
          The free tier is the whole product: testers off the feed, {RULES.requiredDays} days of
          check-in tracking, structured feedback and an evidence pack, paid for by testing other
          people&rsquo;s apps. Money buys two things the free tier cannot give you — a start date
          you can plan around, and enough spare seats that a dropout is an inconvenience rather
          than a restart.
        </p>
      </header>

      {/* ----------------------------------------------------------- banners */}
      {params.checkout === 'success' && (
        <Card className="flex items-start gap-3 border-l-2 p-4" style={{ borderLeftColor: 'var(--color-accent)' }}>
          <IconCheck size={16} />
          <div>
            <div className="text-sm font-semibold">Payment received</div>
            <p className="mt-0.5 text-sm text-[var(--color-dim)]">
              Stripe confirms the charge to us over a webhook, which usually lands within a
              second or two. If the purchase below still says pending, reload the page — nothing
              is lost, the confirmation is just in flight.
            </p>
          </div>
        </Card>
      )}

      {params.checkout === 'cancelled' && (
        <Card className="p-4">
          <div className="text-sm font-semibold">Checkout cancelled</div>
          <p className="mt-0.5 text-sm text-[var(--color-dim)]">
            Nothing was charged. The free path is still open and costs you testing time instead.
          </p>
        </Card>
      )}

      {!configured && (
        <Card className="p-4">
          <div className="text-sm font-semibold">Payments are not configured yet</div>
          <p className="mt-0.5 max-w-2xl text-sm text-[var(--color-dim)]">
            This deployment has no Stripe keys, so no card can be charged here and the buttons
            below are inert. Everything else in TesterPool works normally. Setting it up is
            documented in <span className="font-medium">docs/PAYMENTS.md</span>.
          </p>
        </Card>
      )}

      {configured && !paidOpen && (
        <Card className="p-4">
          <div className="text-sm font-semibold">Paid plans are not open yet</div>
          <p className="mt-0.5 max-w-2xl text-sm text-[var(--color-dim)]">
            The exchange runs on barter while the network is small, because a paid guarantee we
            cannot keep is worse than no paid tier at all.{' '}
            <Link href="/market" className="underline decoration-[var(--color-line-hi)] underline-offset-2">
              Test an app from the feed
            </Link>{' '}
            — it costs nothing but the time you were going to spend anyway.
          </p>
        </Card>
      )}

      {/* ------------------------------------------------------------- stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
            Credit balance
          </div>
          <div className="mt-2">
            <CreditChip amount={balance} size="lg" />
          </div>
          <p className="mt-2 text-xs text-[var(--color-dim)]">
            A full cycle costs <span className="num">{FULL_CYCLE_COST}</span> and testing one back earns{' '}
            <span className="num">{FULL_CYCLE_EARNINGS}</span>.
          </p>
        </Card>
        <Stat
          label="Active entitlements"
          value={<span className="num">{entitlements.length}</span>}
          sub="paid benefits not yet used"
        />
        <Stat
          label="Spent to date"
          value={<span className="num">{fmtPrice(spentCents)}</span>}
          sub={`${purchases.length} purchase${purchases.length === 1 ? '' : 's'}`}
        />
      </div>

      {/* ------------------------------------------------------------- plans */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
          Plans
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const sku = plan.key === 'free' ? null : skuForPlan(plan.key);
            const highlight = 'highlight' in plan && plan.highlight === true;
            return (
              <Card
                key={plan.key}
                className="flex flex-col gap-3 p-5"
                style={
                  highlight
                    ? { borderColor: 'color-mix(in oklab, var(--color-accent) 38%, transparent)' }
                    : undefined
                }
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">{plan.name}</h3>
                    {highlight && <Pill tone="green">Most bought</Pill>}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="num text-2xl font-bold leading-none">
                      {plan.price === 0 ? 'Free' : fmtPrice(plan.price * 100)}
                    </span>
                    {plan.cadence && (
                      <span className="text-xs text-[var(--color-mute)]">{plan.cadence}</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-[var(--color-dim)]">{plan.tagline}</p>
                </div>

                <ul className="flex flex-1 flex-col gap-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-[13px] text-[var(--color-dim)]">
                      <IconCheck />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.key === 'free' ? (
                  <Link href="/market" className="btn btn-secondary w-full justify-center">
                    {plan.cta}
                  </Link>
                ) : sku ? (
                  <BuyButton
                    sku={sku.id}
                    label={plan.cta}
                    price={fmtPrice(sku.amountCents)}
                    apps={apps}
                    requiresApp={sku.requiresApp}
                    primary={highlight}
                    disabled={!sellable}
                    disabledReason={disabledReason}
                  />
                ) : null}
              </Card>
            );
          })}
        </div>
        <p className="mt-3 max-w-3xl text-xs text-[var(--color-dim)]">
          Rescue exists for one situation: a tester dropped on day 10, your fourteen-day clock is
          still running, and you need a verified replacement before the count falls under{' '}
          <span className="num">{RULES.requiredTesters}</span>. Nothing you buy here touches a
          public store listing — every seat is inside a closed testing track, which affects no
          ranking, rating or public install count.
        </p>
      </section>

      {/* ------------------------------------------------------ credit packs */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
            Credit packs
          </h2>
          <Pill tone="neutral">For people who would rather pay than test</Pill>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.id} className="flex flex-col gap-3 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <CreditChip amount={pack.credits ?? 0} size="lg" />
                  {pack.id === bestPack.id && <Pill tone="amber">Best value</Pill>}
                </div>
                <div className="num mt-1 text-lg font-semibold">{fmtPrice(pack.amountCents)}</div>
                <p className="mt-1 text-[13px] text-[var(--color-dim)]">{pack.description}</p>
              </div>
              <BuyButton
                sku={pack.id}
                label="Buy credits"
                price={fmtPrice(pack.amountCents)}
                apps={apps}
                disabled={!sellable}
                disabledReason={disabledReason}
              />
            </Card>
          ))}
        </div>
        <p className="mt-3 max-w-3xl text-xs text-[var(--color-dim)]">
          Credits pay your testers: <span className="num">{CHARGE.install}</span> per confirmed install
          and <span className="num">{CHARGE.review}</span> per confirmed report, so a full cycle costs{' '}
          <span className="num">{FULL_CYCLE_COST}</span>. Testing a cycle&apos;s worth of apps back earns
          exactly that, which is why doing your share is free. Buying credits skips the reciprocal
          testing — it does not shorten the fourteen-day closed test, and it does not buy anything
          a tester could not earn.
        </p>
      </section>

      {/* ------------------------------------------------------ entitlements */}
      {entitlements.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
            Unused benefits
          </h2>
          <Card className="divide-y divide-[var(--color-line)]">
            {entitlements.map((entitlement) => (
              <div key={entitlement.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">
                    {ENTITLEMENT_LABEL[entitlement.kind] ?? entitlement.kind}
                  </div>
                  <div className="text-xs text-[var(--color-mute)]">
                    {entitlement.app_id
                      ? appName.get(entitlement.app_id) ?? 'App removed'
                      : 'Not tied to an app'}
                    {entitlement.expires_at ? ` · expires ${fmtDate(entitlement.expires_at)}` : ''}
                  </div>
                </div>
                <Pill tone="green">Ready to use</Pill>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* ---------------------------------------------------------- history */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
            Purchase history
          </h2>
          {configured && purchases.length > 0 && <ManageBillingButton />}
        </div>
        <Card className="overflow-hidden">
          {purchases.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Nothing bought yet"
                body="Every charge, its Stripe receipt and any refund lands here. You do not need to buy anything to get testers — the free path takes longer, not less far."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[var(--color-mute)]">
                    <th className="px-4 py-2.5 font-semibold">Item</th>
                    <th className="px-4 py-2.5 font-semibold">App</th>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b border-[var(--color-line)] last:border-b-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">
                          {PLAN_SKUS.find((s) => s.id === purchase.sku)?.name ??
                            CREDIT_PACKS.find((s) => s.id === purchase.sku)?.name ??
                            purchase.sku}
                        </div>
                        {purchase.credits_granted > 0 && (
                          <div className="text-xs text-[var(--color-mute)]">
                            <span className="num">{purchase.credits_granted}</span> credits added to
                            the ledger
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--color-dim)]">
                        {purchase.app_id ? appName.get(purchase.app_id) ?? '—' : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--color-dim)]">
                        {fmtDate(purchase.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Pill
                          tone={
                            purchase.status === 'fulfilled'
                              ? 'green'
                              : purchase.status === 'refunded'
                                ? 'neutral'
                                : purchase.status === 'failed'
                                  ? 'red'
                                  : 'amber'
                          }
                        >
                          {PURCHASE_STATUS_LABEL[purchase.status] ?? purchase.status}
                        </Pill>
                      </td>
                      <td className="num px-4 py-2.5 text-right font-semibold">
                        {fmtPrice(purchase.amount_cents, purchase.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
