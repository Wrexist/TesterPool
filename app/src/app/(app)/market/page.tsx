import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MarketView } from './market-view';
import type { ScopeCounts } from './filter-bar';
import { parseQuery, PAGE_SIZE, type MarketApp, type MarketPulse } from '@/lib/market';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Marketplace — TesterPool',
  description: 'Every app taking testers: what is open, what you are working on, and what graduated.',
};

/**
 * The marketplace.
 *
 * Reading goes through `market_apps`, never through the `apps` table: RLS on
 * `apps` deliberately hides everything you neither own nor test, and the RPC is
 * the projection that decides what a browsing member is allowed to see. In
 * particular it withholds the opt-in link and package name of any app you are
 * not seated on — for an app in closed testing those two things ARE the way in,
 * and the way in is granted by taking the job, not by browsing a directory.
 */
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect('/login');

  const query = parseQuery(await searchParams);

  const [{ data: rows, error }, { data: categoryRows }, { data: countRow }, { data: pulseRow }] = await Promise.all([
    supabase.rpc('market_apps', {
      p_scope: query.scope,
      p_platform: query.platform,
      p_status: query.status,
      p_category: query.category,
      p_q: query.q || null,
      p_sort: query.sort,
      p_limit: PAGE_SIZE,
      p_offset: (query.page - 1) * PAGE_SIZE,
    }),
    supabase.rpc('market_categories'),
    supabase.rpc('market_counts'),
    supabase.rpc('market_pulse'),
  ]);

  return (
    <MarketView
      query={query}
      apps={(rows ?? []) as MarketApp[]}
      categories={(categoryRows ?? []) as { category: string; apps: number }[]}
      counts={(countRow ?? {}) as ScopeCounts}
      pulse={(pulseRow ?? null) as MarketPulse | null}
      error={error}
    />
  );
}
