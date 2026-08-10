import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, Avatar, TierBadge, ReliabilityGauge, EmptyState, Pill } from '@/components/ui';
import { reliabilityBand } from '@/lib/economy';
import { n, tierOf } from '@/lib/pods';
import type { LeaderboardRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leaderboard — TesterPool' };

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: rows } = await supabase.from('leaderboard').select('*').limit(100);
  const list = (rows ?? []) as LeaderboardRow[];
  const [first, second, third] = list;
  const rest = list.slice(3);
  const myId = auth?.user?.id;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
          Ranked by reliability, because reliability is the only number that predicts whether a stranger will
          still be checking in on day 13. Nothing here is based on ratings or reviews.
        </p>
      </header>

      {list.length === 0 ? (
        <EmptyState
          title="No testers ranked yet"
          body="The board fills as people complete pods. Finish your first fourteen days and you will be on it."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {[first, second, third].filter(Boolean).map((row, i) => (
              <PodiumCard key={row.id} row={row} rank={i + 1} isMe={row.id === myId} />
            ))}
          </div>

          {rest.length > 0 && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[var(--color-mute)]">
                      <th className="px-4 py-2.5 font-semibold">#</th>
                      <th className="px-4 py-2.5 font-semibold">Tester</th>
                      <th className="px-4 py-2.5 font-semibold">Reliability</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Pods</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Apps shipped</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Reports</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Longest streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((row, i) => {
                      const score = n(row.reliability);
                      const band = reliabilityBand(score);
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-[var(--color-line)] last:border-b-0"
                          style={row.id === myId ? { background: 'color-mix(in oklab, var(--color-accent) 6%, transparent)' } : undefined}
                        >
                          <td className="num px-4 py-2.5 text-[var(--color-mute)]">{i + 4}</td>
                          <td className="px-4 py-2.5">
                            <Link href={`/u/${row.handle}`} className="flex items-center gap-2.5">
                              <Avatar name={row.display_name || row.handle} src={row.avatar_url} size={28} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium">
                                  {row.display_name || row.handle}
                                  {row.id === myId && <span className="ml-2 text-[11px] text-[var(--color-accent)]">you</span>}
                                </span>
                                <span className="block truncate text-xs text-[var(--color-mute)]">
                                  @{row.handle}{row.country_code ? ` · ${row.country_code}` : ''}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                                <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: band.color }} />
                              </div>
                              <span className="num text-xs font-semibold" style={{ color: band.color }}>
                                {Math.round(score)}
                              </span>
                              <TierBadge tier={tierOf(row.tier)} size="sm" />
                            </div>
                          </td>
                          <td className="num px-4 py-2.5 text-right">{n(row.pods_completed)}</td>
                          <td className="num px-4 py-2.5 text-right">{n(row.apps_helped_ship)}</td>
                          <td className="num px-4 py-2.5 text-right">{n(row.approved_reports)}</td>
                          <td className="num px-4 py-2.5 text-right">{n(row.longest_streak)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function PodiumCard({ row, rank, isMe }: { row: LeaderboardRow; rank: number; isMe: boolean }) {
  const medal = ['var(--color-credit)', '#C3CAD6', '#B08D57'][rank - 1];

  return (
    <Card
      hover
      className="relative flex flex-col items-center p-5 text-center"
      style={{ borderColor: `color-mix(in oklab, ${medal} 40%, transparent)` }}
    >
      <span
        className="num absolute left-4 top-4 text-xs font-bold"
        style={{ color: medal }}
      >
        {rank}
      </span>
      {isMe && <Pill tone="green" className="absolute right-3 top-3">You</Pill>}

      <Link href={`/u/${row.handle}`} className="flex flex-col items-center">
        <Avatar name={row.display_name || row.handle} src={row.avatar_url} size={56} ring={medal} />
        <div className="mt-2 text-sm font-semibold">{row.display_name || row.handle}</div>
        <div className="text-xs text-[var(--color-mute)]">@{row.handle}</div>
      </Link>

      <div className="mt-3"><TierBadge tier={tierOf(row.tier)} /></div>
      <div className="mt-3"><ReliabilityGauge score={n(row.reliability)} size={84} /></div>

      <dl className="mt-4 grid w-full grid-cols-3 gap-2 text-xs">
        {[
          ['Pods', n(row.pods_completed)],
          ['Shipped', n(row.apps_helped_ship)],
          ['Reports', n(row.approved_reports)],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt className="text-[10px] uppercase tracking-wide text-[var(--color-mute)]">{label}</dt>
            <dd className="num mt-0.5 text-base font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
