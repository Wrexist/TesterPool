import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Avatar, EmptyState, CreditChip } from '@/components/ui';
import { JoinPackButton, type JoinableApp } from './pack-actions';
import { IconArrow, IconPlus, IconCheck } from '@/components/app/icons';
import { RULES, CHARGE } from '@/lib/economy';
import { getFlags } from '@/lib/flags';
import { fmtDate, n } from '@/lib/format';
import type { AppRow, PodHealthRow, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Packs — TesterPool' };

/** What a full pack costs the developer: 14 testers, each doing a full run. */
const PACK_COST = (CHARGE.install + CHARGE.review) * (RULES.cycleSize - 1);

type MemberRow = {
  pod_id: string;
  user_id: string;
  app_id: string | null;
  status: string;
  profiles: Pick<Profile, 'handle' | 'display_name' | 'avatar_url' | 'reliability' | 'tier'> | null;
};

/**
 * Packs.
 *
 * The feed is one tester at a time and asks nothing of you in advance. A pack
 * is the other trade: fifteen developers who all need the same thing on the
 * same fortnight, so you receive fourteen testers in one go and owe fourteen
 * apps back.
 *
 * It is a tab rather than the spine of the product, and that is the whole
 * design. A developer who never opens this screen still has a complete product;
 * one who does is buying a shape, not the only route in.
 *
 * The join button and `join_pod` read the same `pod_matching` flag, because a
 * gate the UI keeps and the RPC does not is not a gate.
 */
export default async function PacksPage() {
  const flags = await getFlags();
  const open = flags.pod_matching;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect('/login');

  const [{ data: healthRows }, { data: appRows }, { data: myMemberRows }, { data: profileRow }] =
    await Promise.all([
      supabase.from('pod_health').select('*').order('members', { ascending: false }).limit(40),
      supabase.from('apps').select('*').eq('owner_id', user.id),
      supabase.from('pod_members').select('pod_id, app_id, status').eq('user_id', user.id),
      supabase.from('profiles').select('credits').eq('id', user.id).maybeSingle(),
    ]);

  const health = (healthRows ?? []) as PodHealthRow[];
  const apps = (appRows ?? []) as AppRow[];
  const myPodIds = new Set(
    ((myMemberRows ?? []) as { pod_id: string }[]).map((m) => m.pod_id)
  );
  const balance = n((profileRow as Pick<Profile, 'credits'> | null)?.credits, 0);

  const mine = health.filter((p) => myPodIds.has(p.id));
  const forming = health.filter((p) => p.status === 'forming' && !myPodIds.has(p.id));

  const visible = [...new Set([...forming.map((p) => p.id), ...mine.map((p) => p.id)])];
  const { data: memberRows } = visible.length
    ? await supabase
        .from('pod_members')
        .select('pod_id, user_id, app_id, status, profiles(handle, display_name, avatar_url, reliability, tier)')
        .in('pod_id', visible)
    : { data: [] };

  const byPod = new Map<string, MemberRow[]>();
  for (const m of ((memberRows ?? []) as unknown as MemberRow[])) {
    const list = byPod.get(m.pod_id) ?? [];
    list.push(m);
    byPod.set(m.pod_id, list);
  }

  const joinable: JoinableApp[] = apps
    .filter((a) => a.status === 'draft' || a.status === 'queued')
    .map((a) => ({
      id: a.id,
      name: a.name,
      reachable: !!a.opt_in_url || !!a.google_group,
      creditsPaused: !!a.credits_paused,
    }));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">Packs</h1>
        <p className="mt-1 text-[16px] leading-snug text-[var(--color-dim)]">
          Team up. Test each other. Everyone clears the bar.
        </p>
      </header>

      <PackHero balance={balance} />

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 text-[19px] font-bold tracking-tight">Your packs</h2>
          <div className="flex flex-col gap-3">
            {mine.map((pod) => (
              <PackCard key={pod.id} pod={pod} members={byPod.get(pod.id) ?? []} joined />
            ))}
          </div>
        </section>
      )}

      <HowItWorks />

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[19px] font-bold tracking-tight">Packs forming</h2>
          {open && forming.length > 0 && (
            <span className="text-[13px] text-[var(--color-mute)]">Join the fullest one — it starts sooner</span>
          )}
        </div>

        {!open ? (
          <EmptyState
            title="Packs are closed right now"
            body="Joining is switched off while the network is too thin to fill one. A pack is a promise about fourteen specific days, and opening one that cannot fill costs a developer a month. The feed is unaffected and pays the same per tester."
            action={<Link href="/market" className="btn btn-primary">Browse the feed <IconArrow size={15} /></Link>}
          />
        ) : forming.length === 0 ? (
          <EmptyState
            title="Nothing forming at this minute"
            body="A pack opens as soon as enough developers want one. Meanwhile every app in the feed pays the same per tester, with nothing to wait for."
            action={<Link href="/market" className="btn btn-primary">Browse the feed <IconArrow size={15} /></Link>}
          />
        ) : joinable.length === 0 ? (
          <EmptyState
            title="You need a listed app first"
            body="A pack seats your app alongside fourteen others. List one and you can claim a seat in any pack below."
            action={<Link href="/onboarding" className="btn btn-primary"><IconPlus size={15} /> List your app</Link>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {forming.map((pod) => (
              <PackCard
                key={pod.id}
                pod={pod}
                members={byPod.get(pod.id) ?? []}
                action={<JoinPackButton podId={pod.id} apps={joinable} />}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

/**
 * The offer, in the three numbers that decide it.
 *
 * All three are read from `lib/economy` rather than typed here. The reference
 * this is modelled on advertises a flat joining fee; ours has none, and the
 * honest third number is what the run costs you in credits — which you earn
 * back testing the other fourteen apps, and which the card says.
 */
function PackHero({ balance }: { balance: number }) {
  const stats = [
    { v: String(RULES.cycleSize - 1), l: 'reviews\nyou receive' },
    { v: `${RULES.requiredDays}d`, l: 'to\ncomplete' },
    { v: String(PACK_COST), l: 'credits\nit costs' },
  ];

  return (
    <Card
      className="dotgrid-on-accent relative overflow-hidden border-0 p-6"
      style={{ background: 'var(--color-accent)', color: '#fff' }}
    >
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
        style={{ background: 'rgba(255,255,255,.10)' }}
        aria-hidden
      />
      <div className="relative">
        <span className="text-[34px] leading-none" aria-hidden>🤝</span>
        <h2 className="mt-4 text-[26px] font-bold leading-tight tracking-tight">Join a testing pack</h2>
        <p className="mt-2 max-w-md text-[16px] leading-relaxed" style={{ color: 'rgba(255,255,255,.88)' }}>
          {RULES.cycleSize} developers, {RULES.requiredDays} days. Everyone installs and reviews
          everyone else&apos;s app — enough testers to clear Google&apos;s bar in one run.
        </p>

        <div
          className="mt-6 grid grid-cols-3 gap-2 rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,.14)' }}
        >
          {stats.map((s, i) => (
            <div
              key={s.l}
              className="text-center"
              style={i > 0 ? { borderLeft: '1px solid rgba(255,255,255,.22)' } : undefined}
            >
              <div className="num text-[26px] font-bold leading-none">{s.v}</div>
              <div className="mt-1.5 whitespace-pre-line text-[12px] leading-tight" style={{ color: 'rgba(255,255,255,.8)' }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[13px]" style={{ color: 'rgba(255,255,255,.8)' }}>
          You hold <span className="num font-bold">{balance}</span>. Testing the other{' '}
          <span className="num">{RULES.cycleSize - 1}</span> apps earns exactly what your own run
          costs, so doing your share breaks even.
        </p>
      </div>
    </Card>
  );
}

function HowItWorks() {
  const steps = [
    {
      t: 'Claim your seat',
      b: `Put one listed app into a forming pack. The pack starts the moment all ${RULES.cycleSize} seats fill.`,
    },
    {
      t: 'Test your packmates',
      b: `Install and review each of the other ${RULES.cycleSize - 1} apps. Same proof, same rates as the feed.`,
    },
    {
      t: 'Collect your run',
      b: `Fourteen testers hold your closed track for ${RULES.requiredDays} days, and your Evidence Pack fills in as they go.`,
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-[19px] font-bold tracking-tight">How it works</h2>
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
              >
                <span className="num text-[15px] font-bold">{i + 1}</span>
              </span>
              {i < steps.length - 1 && (
                <span className="w-px flex-1 bg-[var(--color-line)]" style={{ minHeight: 22 }} />
              )}
            </div>
            <div className={i < steps.length - 1 ? 'pb-6' : undefined}>
              <h3 className="text-[17px] font-bold leading-tight">{s.t}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-[var(--color-dim)]">{s.b}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PackCard({
  pod, members, action, joined = false,
}: {
  pod: PodHealthRow;
  members: MemberRow[];
  action?: React.ReactNode;
  joined?: boolean;
}) {
  const seats = n(pod.core_seats, RULES.cycleSize);
  const filled = n(pod.members);
  const left = Math.max(0, seats - filled);
  const pct = seats > 0 ? Math.min(100, Math.round((filled / seats) * 100)) : 0;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-bold leading-tight">
            {pod.name || `Pack ${pod.code}`}
          </h3>
          <p className="mt-1 text-[13px] text-[var(--color-mute)]">
            {pod.status === 'forming' ? (
              left === 0 ? 'Full — starting now' : <>{left} of {seats} seats still open</>
            ) : pod.starts_at ? (
              <>Running since {fmtDate(pod.starts_at)}</>
            ) : (
              pod.status
            )}
          </p>
        </div>
        {joined ? (
          <Pill tone="green"><IconCheck size={12} /> You are in</Pill>
        ) : (
          <CreditChip amount={-PACK_COST} size="sm" signed />
        )}
      </div>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${pct}%`, background: 'var(--color-accent)' }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px] text-[var(--color-mute)]">
          <span><span className="num font-semibold text-[var(--color-dim)]">{filled}</span> of <span className="num">{seats}</span> seats</span>
          <span className="num">{pct}%</span>
        </div>
      </div>

      {members.length > 0 && (
        <div className="flex items-center gap-1.5">
          {members.slice(0, 8).map((m) => (
            <Avatar
              key={`${m.pod_id}:${m.user_id}`}
              name={m.profiles?.display_name || m.profiles?.handle || 'Member'}
              src={m.profiles?.avatar_url ?? null}
              size={30}
            />
          ))}
          {members.length > 8 && (
            <span className="num text-[12px] text-[var(--color-mute)]">+{members.length - 8}</span>
          )}
        </div>
      )}

      {action}
    </Card>
  );
}
