import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MarketView, type ViewerSummary } from './market-view';
import type { ScopeCounts } from './filter-bar';
import { parseQuery, PAGE_SIZE, type MarketApp, type MarketPulse } from '@/lib/market';
import { n } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Home — TesterPool',
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

  /*
   * The header needs four things the feed query does not carry: who you are,
   * what you hold, and the two counts the round buttons badge. They are read
   * here rather than in the layout because the greeting only appears on this
   * screen, and a layout-wide read would cost every other screen the round
   * trip for a header they do not render.
   */
  const [
    { data: rows, error },
    { data: categoryRows },
    { data: countRow },
    { data: pulseRow },
    { data: profileRow },
    { count: inbox },
    { count: openWork },
    { count: ownedApps },
  ] = await Promise.all([
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
    supabase.from('profiles').select('display_name, handle, credits').eq('id', auth.user.id).maybeSingle(),
    supabase
      .from('feedback')
      .select('id, apps!inner(owner_id)', { count: 'exact', head: true })
      .eq('status', 'submitted')
      .eq('apps.owner_id', auth.user.id),
    supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('tester_id', auth.user.id)
      .in('status', ['opt_in_pending', 'active']),
    supabase
      .from('apps')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', auth.user.id),
  ]);

  const me = (profileRow ?? null) as { display_name: string | null; handle: string; credits: number | null } | null;
  const viewer: ViewerSummary = {
    displayName: me?.display_name || me?.handle || 'there',
    credits: n(me?.credits, 0),
    messages: inbox ?? 0,
    alerts: openWork ?? 0,
    ownsApps: (ownedApps ?? 0) > 0,
  };

  return (
    <MarketView
      query={query}
      apps={(rows ?? []) as MarketApp[]}
      categories={(categoryRows ?? []) as { category: string; apps: number }[]}
      counts={(countRow ?? {}) as ScopeCounts}
      pulse={(pulseRow ?? null) as MarketPulse | null}
      viewer={viewer}
      error={error}
    />
  );
}
