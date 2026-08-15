import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppDetail } from './app-detail';
import type { MarketAppDetail } from '@/lib/market';

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
  const { id } = await params;
  const app = await load(id);
  if (!app) notFound();

  /*
   * Whether a store activity can be started here. Not part of `market_apps`:
   * that projection decides what a stranger may SEE about an app, and this is a
   * question about what they may DO. `store_review_open` mirrors every
   * condition `start_store_activity` enforces, so the buttons this drives are
   * buttons the RPC will honour.
   */
  const supabase = await createClient();
  const { data: storeOpen } = await supabase.rpc('store_review_open', { p_app: id });

  return <AppDetail app={app} storeOpen={storeOpen === true} />;
}
