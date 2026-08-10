/**
 * Demo sign-in. Lets anyone explore the seeded prototype without a mailbox.
 *
 * Guarded by NEXT_PUBLIC_ENABLE_DEMO_LOGIN. Delete this route (and the seeded
 * @demo.testerpool.dev accounts) before the first real user ever touches the app.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Avatar, TierBadge, ReliabilityGauge } from '@/components/ui';
import type { TierKey } from '@/lib/economy';
import { DemoSignIn } from './DemoSignIn';

export const metadata = { title: 'Demo sign-in' };
export const dynamic = 'force-dynamic';

type Row = {
  handle: string;
  display_name: string;
  tester_email: string | null;
  tier: TierKey;
  reliability: number;
  credits: number;
  pods_completed: number;
  is_moderator: boolean;
};

export default async function DemoPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN !== 'true') notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('handle, display_name, tester_email, tier, reliability, credits, pods_completed, is_moderator')
    .like('tester_email', '%@demo.testerpool.dev')
    .order('reliability', { ascending: false })
    .limit(8);

  const rows = (data ?? []) as Row[];

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-[var(--color-dim)] hover:text-[var(--color-ink)]">
        ← Back to site
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">Explore the prototype</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--color-dim)]">
        Sign in as a seeded developer. They are all members of{' '}
        <span className="text-[var(--color-ink)]">Pod Aug 02</span>, currently on day 9 of 14, so the
        dashboard, tests, feedback and credits screens are all populated with real rows.
      </p>

      {rows.length === 0 ? (
        <Card className="mt-8 p-6 text-sm text-[var(--color-dim)]">
          No seeded accounts found. Run the seed in <code>supabase/seed.sql</code> first.
        </Card>
      ) : (
        <div className="mt-8 grid gap-3">
          {rows.map((p) => (
            <Card key={p.handle} hover className="flex items-center gap-4 p-4">
              <Avatar name={p.display_name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{p.display_name}</span>
                  <TierBadge tier={p.tier} size="sm" />
                  {p.is_moderator && (
                    <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-violet)]">
                      Moderator
                    </span>
                  )}
                </div>
                <div className="num mt-0.5 text-xs text-[var(--color-mute)]">
                  @{p.handle} · {p.credits.toLocaleString()} credits · {p.pods_completed} pods completed
                </div>
              </div>
              <ReliabilityGauge score={Number(p.reliability)} size={46} label={false} />
              <DemoSignIn email={p.tester_email ?? ''} />
            </Card>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-[var(--color-mute)]">
        Sign in as <span className="text-[var(--color-dim)]">Isac Molin</span> to see the moderation
        dashboard, which is otherwise hidden.
      </p>
    </main>
  );
}
