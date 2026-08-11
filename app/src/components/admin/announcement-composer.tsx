'use client';

/**
 * TESTERPOOL — announcement composer with a live preview.
 *
 * The preview renders the same banner component the user will see, so there is
 * no gap between what is written here and what appears on their dashboard.
 */

import * as React from 'react';
import { Note, Spinner, useAction } from '@/components/app/action-button';
import { AnnouncementBanner } from '@/components/admin/parts';
import { createAnnouncement, setAnnouncementActive } from '@/app/(app)/admin/actions';
import { TONE_COPY, type AnnouncementTone } from '@/lib/admin';
import { cx } from '@/components/ui';

const TONES: AnnouncementTone[] = ['info', 'warning', 'critical'];

export function AnnouncementComposer() {
  const { pending, feedback, run } = useAction();
  const [body, setBody] = React.useState('');
  const [tone, setTone] = React.useState<AnnouncementTone>('info');

  const tooShort = body.trim().length < 10;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="announcement-body">Announcement</label>
        <textarea
          id="announcement-body"
          className="input"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="One or two sentences. State what is happening and what the reader should do."
        />
      </div>

      <div>
        <span className="label">Tone</span>
        <div className="flex gap-2">
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              className={cx('btn', tone === t ? 'btn-secondary' : 'btn-ghost')}
              aria-pressed={tone === t}
              onClick={() => setTone(t)}
            >
              {TONE_COPY[t].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Preview, exactly as a signed-in user sees it</span>
        <AnnouncementBanner body={body} tone={tone} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || tooShort}
          onClick={() =>
            void run(() => createAnnouncement(body, tone)).then((r) => {
              if (r.ok) setBody('');
            })
          }
        >
          {pending && <Spinner />} Publish
        </button>
        {tooShort && (
          <span className="text-[11px] text-[var(--color-mute)]">
            Write at least ten characters before publishing.
          </span>
        )}
      </div>

      <Note feedback={feedback} />
    </div>
  );
}

export function AnnouncementRetire({ id, active }: { id: string; active: boolean }) {
  const { pending, feedback, run } = useAction();

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        className={active ? 'btn btn-danger' : 'btn btn-secondary'}
        disabled={pending}
        onClick={() => void run(() => setAnnouncementActive(id, !active))}
      >
        {pending && <Spinner />}
        {active ? 'Retire' : 'Publish again'}
      </button>
      <Note feedback={feedback} />
    </div>
  );
}
