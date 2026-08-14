import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppDetail } from './app-detail';
import type { MarketAppDetail } from '@/lib/market';
import { getFlags } from '@/lib/flags';

export const dynamic = 'force-dynamic';

async function load(id: string): Promise<MarketAppDetail | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect('/login');

  // A malformed id is a 404, not a 500: this route is linked from cards, and
  // cards get pasted around.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const { data } = await supabase.rpc('market_app', { p_app: id });
  return (data as MarketAppDetail | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const app = await load((await params).id);
  return { title: app ? `${app.name} — TesterPool` : 'App — TesterPool' };
}

export default async function MarketAppPage({ params }: { params: Promise<{ id: string }> }) {
  const app = await load((await params).id);
  if (!app) notFound();
  const flags = await getFlags();
  return <AppDetail app={app} podsOpen={flags.pod_matching} />;
}
