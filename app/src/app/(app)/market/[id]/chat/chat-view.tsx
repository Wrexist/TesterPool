'use client';

/**
 * TESTERPOOL — one thread, about one app.
 *
 * A tester who cannot get the closed track to open has exactly one useful move
 * and it is to ask the person who published it. That was previously not
 * possible at all, and the substitute was a report saying "could not install",
 * which costs the developer a seat and tells them nothing.
 *
 * Optimistic on send, because the alternative on a slow connection is a text
 * box that appears to have eaten what you typed. The optimistic row is replaced
 * by a refresh, and a failed send puts the text back in the box rather than
 * dropping it — losing somebody's typing is the one failure a chat must not
 * have.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, cx } from '@/components/ui';
import { AppIcon } from '@/components/app/app-card';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { IconArrow } from '@/components/app/icons';
import { sendMessage } from '@/app/(app)/actions';
import { sinceShort } from '@/lib/format';

export interface ChatMessage {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  sender_display_name: string | null;
  sender_handle: string | null;
}

export function ChatView({
  appId, appName, iconUrl, counterpart, lastSeen, messages,
}: {
  appId: string;
  appName: string;
  iconUrl: string | null;
  counterpart: string;
  lastSeen: string | null;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const { pending, feedback, run } = useAction();
  const [draft, setDraft] = React.useState('');
  const [sent, setSent] = React.useState<ChatMessage[]>([]);
  const foot = React.useRef<HTMLDivElement>(null);

  const all = React.useMemo(() => [...messages, ...sent], [messages, sent]);

  // Anchored to the newest message on arrival and after each send, the way
  // every other thread the reader has ever used behaves.
  React.useEffect(() => {
    foot.current?.scrollIntoView({ block: 'end' });
  }, [all.length]);

  // A new server list means the refresh landed, so the optimistic copies have
  // been superseded — holding on to them would show every message twice. This
  // is the adjust-during-render form rather than an effect: an effect would
  // paint the duplicate frame first and then remove it, which is a visible
  // flicker on exactly the message you just sent.
  const [seenServer, setSeenServer] = React.useState(messages);
  if (seenServer !== messages) {
    setSeenServer(messages);
    setSent([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;

    setDraft('');
    setSent((prev) => [...prev, {
      id: `pending-${prev.length}`,
      body,
      created_at: new Date().toISOString(),
      mine: true,
      sender_display_name: null,
      sender_handle: null,
    }]);

    const result = await run(() => sendMessage(appId, body), { refresh: false });
    if (result.ok) {
      router.refresh();
    } else {
      // Put it back rather than lose it.
      setSent((prev) => prev.filter((m) => m.body !== body));
      setDraft(body);
    }
  }

  const seen = sinceShort(lastSeen);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 pb-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/market/${appId}`}
          aria-label={`Back to ${appName}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-2)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <AppIcon name={appName} src={iconUrl} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight">{counterpart}</div>
          <div className="truncate text-[12px] text-[var(--color-mute)]">
            {appName}
            {seen && ` · Active ${seen}`}
          </div>
        </div>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        {all.length === 0 ? (
          <p className="px-1 py-6 text-center text-[14px] leading-relaxed text-[var(--color-mute)]">
            Nothing here yet. Ask about the track, the build, or anything that stopped you
            getting in — it is faster than filing a report that says you could not install it.
          </p>
        ) : (
          all.map((m) => <Bubble key={m.id} message={m} />)
        )}
        <div ref={foot} />
      </Card>

      <form onSubmit={submit} className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, shift+enter breaks the line. The composer is one row
            // tall, so treating enter as a newline would hide what you wrote.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit(e as unknown as React.FormEvent);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={`Message ${counterpart}`}
          aria-label="Your message"
          className="min-h-[46px] flex-1 resize-none rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-[15px] outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          className="btn btn-primary h-[46px] shrink-0 px-4"
          disabled={pending || !draft.trim()}
          aria-label="Send"
        >
          {pending ? <Spinner /> : <IconArrow size={18} />}
        </button>
      </form>

      <Note feedback={feedback} />
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.mine;
  return (
    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cx(
          'max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
          mine ? 'rounded-br-md' : 'rounded-bl-md',
        )}
        style={
          mine
            ? { background: 'var(--color-accent)', color: '#fff' }
            : { background: 'var(--color-surface-2)', color: 'var(--color-ink)' }
        }
      >
        {message.body}
      </div>
    </div>
  );
}
