import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChatView, type ChatMessage } from './chat-view';
import type { MarketAppDetail } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc('market_app', { p_app: id });
  const app = data as MarketAppDetail | null;
  return { title: app ? `Chat — ${app.name} — TesterPool` : 'Chat — TesterPool' };
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect('/login');

  const { data: appRow } = await supabase.rpc('market_app', { p_app: id });
  const app = appRow as MarketAppDetail | null;
  if (!app) notFound();

  /*
   * The same rule `send_message` enforces, asked before the page renders rather
   * than after the first attempt to post. Reaching a composer that every send
   * will refuse is a worse answer than not being shown one.
   */
  if (app.can_message !== true) notFound();

  // Reading the thread is what marks it read, so this call has a side effect
  // and belongs on the page rather than in a cached loader.
  const { data: rows } = await supabase.rpc('thread_messages', { p_app: id });

  return (
    <ChatView
      appId={app.id}
      appName={app.name}
      iconUrl={app.icon_url}
      counterpart={
        app.relation === 'owner'
          ? 'your tester'
          : app.owner_display_name || (app.owner_handle ? `@${app.owner_handle}` : 'the developer')
      }
      lastSeen={app.owner_last_seen_at}
      messages={(rows as ChatMessage[] | null) ?? []}
    />
  );
}
