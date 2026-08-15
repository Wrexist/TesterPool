'use client';

/**
 * PROTOTYPE — the public-store install-and-review flow, as OnTopRank runs it.
 *
 * Built to be looked at and clicked through, so every step holds real state:
 * the screenshots you attach render, the stars set, the character counter
 * counts, and the tracker advances. What it does NOT do is touch the database.
 * Nothing here calls `award_credits`, writes a `proofs` row or creates an
 * assignment — it is a mock of the interaction, kept for showing the flow
 * without a session.
 *
 * NOTE, and the reason this comment was rewritten: when this file was first
 * written it also said the schema had no column that could hold a public store
 * review. That stopped being true one commit later. The real, wired version of
 * this flow is `/tests/[id]/store-review`, and `feedback.store_rating` and
 * `feedback.store_review_text` exist — see the header of
 * `20260814240000_store_reviews.sql`. Anything here that looks like a claim
 * about the schema is out of date by construction; check the migration.
 *
 * The difference from the closed-track flow in `/market/[id]`:
 *
 *   closed track   install from the developer's CLOSED testing track,
 *                  report is private to the developer
 *   store review   install from the PUBLIC store listing,
 *                  review is posted publicly and paid for
 */

import * as React from 'react';
import { cx } from '@/components/ui';
import { IconCheck, IconExternal, IconUpload, IconCopy, IconAndroid } from '@/components/app/icons';
import { StarGlyph } from '@/components/app/app-row';

const INSTALL_REWARD = 10;
const REVIEW_REWARD = 30;
const MIN_REVIEW = 60;

/** The three things this app's developer wants a reviewer to mention. */
const HIGHLIGHTS = ['Offline sync', 'Widget setup', 'Import from CSV'];

type Shot = { name: string; url: string };

function useShot() {
  const [shot, setShot] = React.useState<Shot | null>(null);
  React.useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);
  return {
    shot,
    take(file: File | null) {
      if (!file) return;
      setShot({ name: file.name, url: URL.createObjectURL(file) });
    },
    clear() { setShot(null); },
  };
}

/* --------------------------------------------------------------- tracker */

function Tracker({ step }: { step: number }) {
  const labels = ['Install', 'Test', 'Review'];
  return (
    <ol className="flex items-start">
      {labels.map((label, i) => {
        const done = i < step;
        const now = i === step;
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full items-center">
              <span
                className={cx('h-[2px] flex-1 rounded-full', i === 0 && 'opacity-0')}
                style={{ background: done || now ? 'var(--color-accent)' : 'var(--color-line)' }}
              />
              <span
                className="num inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-all"
                style={{
                  color: done || now ? '#fff' : 'var(--color-mute)',
                  background: done || now ? 'var(--color-accent)' : 'var(--color-surface)',
                  border: done || now ? 'none' : '2px solid var(--color-line)',
                }}
              >
                {done ? <IconCheck size={15} /> : i + 1}
              </span>
              <span
                className={cx('h-[2px] flex-1 rounded-full', i === labels.length - 1 && 'opacity-0')}
                style={{ background: done ? 'var(--color-accent)' : 'var(--color-line)' }}
              />
            </div>
            <span
              className="text-[13px] font-semibold"
              style={{ color: done || now ? 'var(--color-ink)' : 'var(--color-mute)' }}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------ shot picker */

function ShotZone({
  title, help, shot, onPick, onClear,
}: {
  title: string;
  help: string;
  shot: Shot | null;
  onPick: (f: File | null) => void;
  onClear: () => void;
}) {
  const id = React.useId();

  if (shot) {
    return (
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot.url} alt="" className="h-16 w-16 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-android)]">
              <IconCheck size={15} /> Attached
            </div>
            <div className="mt-0.5 truncate text-[12px] text-[var(--color-mute)]">{shot.name}</div>
          </div>
          <button type="button" onClick={onClear} className="btn btn-ghost text-[13px]">
            Replace
          </button>
        </div>
      </div>
    );
  }

  return (
    <label htmlFor={id} className="card-dashed block cursor-pointer px-5 py-6 text-center">
      <input
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <span
        className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
      >
        <IconUpload size={19} />
      </span>
      <span className="block text-[16px] font-bold">{title}</span>
      <span className="mx-auto mt-2 block max-w-md text-[13px] leading-relaxed text-[var(--color-mute)]">
        {help}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ stars */

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;

  return (
    <div className="flex items-center gap-2" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          aria-pressed={value === star}
          onMouseEnter={() => setHover(star)}
          onFocus={() => setHover(star)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
          style={{ color: star <= shown ? '#F5A524' : 'var(--color-line-hi)' }}
        >
          <StarGlyph size={30} />
        </button>
      ))}
      <span className="num ml-2 text-[15px] font-semibold text-[var(--color-dim)]">
        {shown > 0 ? `${shown}.0` : '—'}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------- flow */

export function StoreReviewFlow() {
  const [step, setStep] = React.useState(0);
  const [stars, setStars] = React.useState(0);
  const [text, setText] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [claimed, setClaimed] = React.useState(false);

  const install = useShot();
  const review = useShot();

  const longEnough = text.trim().length >= MIN_REVIEW;
  const canPost = stars > 0 && longEnough;
  const earned = (step > 0 ? INSTALL_REWARD : 0) + (claimed ? REVIEW_REWARD : 0);

  function reset() {
    setStep(0); setStars(0); setText(''); setCopied(false); setClaimed(false);
    install.clear(); review.clear();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------ the tracker */}
      <div
        className="card flex flex-col gap-4 p-5"
        style={{ background: 'var(--color-accent-soft)', borderColor: 'transparent' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
              Your activity
            </h2>
            <p className="mt-1 text-[14px] text-[var(--color-dim)]">
              Complete all steps to earn the reward
            </p>
          </div>
          <span
            className="num inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold"
            style={{ color: 'var(--color-accent)', background: '#fff' }}
          >
            <StarGlyph size={13} />
            +{INSTALL_REWARD + REVIEW_REWARD}
          </span>
        </div>

        <Tracker step={claimed ? 3 : step} />

        {earned > 0 && (
          <p className="num text-center text-[13px] font-semibold text-[var(--color-accent)]">
            {earned} of {INSTALL_REWARD + REVIEW_REWARD} earned
          </p>
        )}
      </div>

      {/* -------------------------------------------------------- 1. install */}
      {step === 0 && (
        <div className="card flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              <IconAndroid size={20} />
            </span>
            <div>
              <h3 className="text-[17px] font-bold leading-tight">Install the app</h3>
              <p className="mt-0.5 text-[14px] text-[var(--color-mute)]">Step 1 of your activity</p>
            </div>
            <span className="num ml-auto text-[14px] font-bold text-[var(--color-accent)]">
              +{INSTALL_REWARD}
            </span>
          </div>

          <a
            href="https://play.google.com/store/apps/details?id=com.example.ledgerly"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-2)] px-4 py-3.5 text-[15px] font-semibold transition-colors hover:bg-[var(--color-line)]"
          >
            <IconAndroid size={19} />
            <span className="flex-1">Get it on Google Play</span>
            <IconExternal size={16} className="text-[var(--color-mute)]" />
          </a>

          <ShotZone
            title="Add a screenshot to claim"
            help="Best: the store page showing the Open button — it verifies instantly. Your home screen with the app icon works too. For a screen inside the app the status bar clock must be visible. The developer will see this screenshot."
            shot={install.shot}
            onPick={install.take}
            onClear={install.clear}
          />

          <button
            type="button"
            className="btn btn-primary w-full py-3 text-[15px]"
            disabled={!install.shot}
            onClick={() => setStep(1)}
          >
            {install.shot ? `Claim +${INSTALL_REWARD}` : 'Attach your screenshot first'}
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------- 2. test */}
      {step === 1 && (
        <div className="card flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              <span className="num text-[16px] font-bold">2</span>
            </span>
            <div>
              <h3 className="text-[17px] font-bold leading-tight">Use it properly</h3>
              <p className="mt-0.5 text-[14px] text-[var(--color-mute)]">Step 2 of your activity</p>
            </div>
          </div>

          <p className="text-[15px] leading-relaxed text-[var(--color-dim)]">
            Spend a few minutes actually using the app. A review written without opening it is
            obvious to everyone who reads it, and it is what gets this kind of network shut down.
          </p>

          <div className="rounded-2xl bg-[var(--color-surface-2)] p-4">
            <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              The developer asked you to look at
            </div>
            <ul className="mt-2.5 flex flex-col gap-2">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-center gap-2.5 text-[15px]">
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                  >
                    <IconCheck size={12} />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            className="btn btn-primary w-full py-3 text-[15px]"
            onClick={() => setStep(2)}
          >
            I have used it — write my review
          </button>
        </div>
      )}

      {/* --------------------------------------------------------- 3. review */}
      {step === 2 && !claimed && (
        <div className="card flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              <StarGlyph size={19} />
            </span>
            <div>
              <h3 className="text-[17px] font-bold leading-tight">Leave your review</h3>
              <p className="mt-0.5 text-[14px] text-[var(--color-mute)]">Step 3 of your activity</p>
            </div>
            <span className="num ml-auto text-[14px] font-bold text-[var(--color-accent)]">
              +{REVIEW_REWARD}
            </span>
          </div>

          <div>
            <div className="label">Your rating</div>
            <StarPicker value={stars} onChange={setStars} />
          </div>

          <div>
            <label className="label" htmlFor="review-text">Your review</label>
            <textarea
              id="review-text"
              rows={6}
              className="input resize-none"
              placeholder="What did you actually do in the app, and what happened? Specifics are what make a review worth reading."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="mt-1.5 flex items-center justify-between text-[12px]">
              <span className="text-[var(--color-mute)]">
                Mention one of: {HIGHLIGHTS.join(', ')}
              </span>
              {/* A minimum is only news while you are under it. Past it, the
                  ratio reads as a second limit you might be exceeding. */}
              <span
                className="num inline-flex items-center gap-1 font-semibold"
                style={{ color: longEnough ? 'var(--color-android)' : 'var(--color-mute)' }}
              >
                {longEnough ? (
                  <><IconCheck size={12} /> {text.trim().length} characters</>
                ) : (
                  <>{text.trim().length}/{MIN_REVIEW}</>
                )}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary w-full py-3 text-[15px]"
            disabled={!canPost}
            onClick={() => {
              void navigator.clipboard?.writeText(text.trim()).catch(() => {});
              setCopied(true);
              window.open(
                'https://play.google.com/store/apps/details?id=com.example.ledgerly&showAllReviews=true',
                '_blank',
                'noopener'
              );
            }}
          >
            <IconCopy size={16} />
            {copied ? 'Copied — paste it on the store page' : 'Copy review and open the store'}
          </button>

          <ShotZone
            title="Screenshot your published review"
            help="The store page showing your review live, with your name on it. This is what the developer and moderation both see."
            shot={review.shot}
            onPick={review.take}
            onClear={review.clear}
          />

          <button
            type="button"
            className="btn btn-primary w-full py-3 text-[15px]"
            disabled={!canPost || !review.shot}
            onClick={() => setClaimed(true)}
          >
            {!canPost
              ? 'Rate and write your review first'
              : !review.shot
                ? 'Attach proof of your review'
                : `Claim +${REVIEW_REWARD}`}
          </button>
        </div>
      )}

      {/* -------------------------------------------------------- 4. cleared */}
      {claimed && (
        <div className="card flex flex-col items-center gap-3 p-7 text-center">
          <span
            className="animate-pop inline-flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            <IconCheck size={30} />
          </span>
          <h3 className="text-[20px] font-bold">Activity complete</h3>
          <p className="max-w-sm text-[15px] leading-relaxed text-[var(--color-dim)]">
            You installed the app, used it, and published a{' '}
            <span className="num font-semibold text-[var(--color-ink)]">{stars}-star</span> review.
          </p>
          <span
            className="num inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[17px] font-bold"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
          >
            <StarGlyph size={17} />
            +{INSTALL_REWARD + REVIEW_REWARD}
          </span>

          <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[var(--color-mute)]">
            Nothing was written to the database. This prototype does not pay credits, store a
            proof, or record a review anywhere.
          </p>

          <button type="button" onClick={reset} className="btn btn-secondary mt-2">
            Run it again
          </button>
        </div>
      )}
    </div>
  );
}
