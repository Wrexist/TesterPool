import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui';
import { AppIcon } from '@/components/app/app-card';
import { IconArrow } from '@/components/app/icons';
import { sinceShort } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Messages — TesterPool' };

interface Thread {
  app_id: string;
  app_name: string;
  app_icon_url: string | null;
  platform: string;
  other_handle: string | null;
  other_display_name: string | null;
  other_last_seen_at: string | null;
  last_at: string;
  last_body: string;
  unread: number;
}

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect('/login');

  const { data } = await supabase.rpc('message_threads');
  const threads = (data as Thread[] | null) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 pb-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-[var(--color-dim)]">
          One thread per app you have taken on, or that someone has taken on from you.
        </p>
      </header>

      {threads.length === 0 ? (
        <EmptyState
          title="No messages"
          body="A thread opens once you take an app on, or once somebody takes on yours. It is the fastest way past a closed track that will not open."
          action={<Link href="/market" className="btn btn-primary">Browse the feed <IconArrow size={15} /></Link>}
        />
      ) : (
        <Card className="divide-y divide-[var(--color-line)] overflow-hidden p-0">
          {threads.map((t) => {
            const who = t.other_display_name || (t.other_handle ? `@${t.other_handle}` : 'A developer');
            const seen = sinceShort(t.other_last_seen_at);
            return (
              <Link
                key={`${t.app_id}-${t.other_handle}`}
                href={`/market/${t.app_id}/chat`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--color-surface-2)]"
              >
                <AppIcon name={t.app_name} src={t.app_icon_url} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-bold leading-tight">{who}</span>
                    {!!t.unread && (
                      <span
                        className="num shrink-0 rounded-full px-1.5 text-[11px] font-bold"
                        style={{ background: 'var(--color-accent)', color: '#fff' }}
                      >
                        {t.unread}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-[var(--color-mute)]">
                    {t.app_name}
                    {seen && ` · ${seen}`}
                  </span>
                  <span className="mt-1 block truncate text-[14px] text-[var(--color-dim)]">
                    {t.last_body}
                  </span>
                </span>
                <IconArrow size={16} className="shrink-0 text-[var(--color-mute)]" />
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
