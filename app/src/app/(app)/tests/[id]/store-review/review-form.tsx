'use client';

/**
 * TESTERPOOL — publishing a store review, for real.
 *
 * This is the wired version of `/preview/store-review`. Everything here writes:
 * the screenshot goes to the `proofs` bucket under the caller's own prefix,
 * `submit_proof` records it and triage looks at it, and `submitStoreReview`
 * files the review as `submitted` for the publisher to approve.
 *
 * The tester cannot approve their own work at any point. `guard_feedback_columns`
 * refuses any status but `submitted` from a client, so the only routes to a
 * payment are the publisher's verdict and, if they dispute it, a moderator's.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cx } from '@/components/ui';
import { IconCheck, IconExternal, IconUpload, IconCopy } from '@/components/app/icons';
import { StarGlyph } from '@/components/app/app-row';
import { recordProof, submitStoreReview } from '@/app/(app)/actions';

const MIN_REVIEW = 60;
const MAX_BYTES = 8 * 1024 * 1024;

function fileProblem(f: File): string | null {
  if (!/^image\//.test(f.type)) return 'That is not an image.';
  if (f.size > MAX_BYTES) return 'That image is over 8MB. Screenshot rather than photograph the screen.';
  return null;
}

export function StoreReviewForm({
  assignmentId, appId, appName, storeUrl, userId, highlights, reward,
}: {
  assignmentId: string;
  appId: string;
  appName: string;
  storeUrl: string;
  userId: string;
  highlights: string[];
  reward: number;
}) {
  const router = useRouter();

  const [stars, setStars] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [text, setText] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [proofId, setProofId] = React.useState<string | null>(null);
  const [proofState, setProofState] = React.useState<string | null>(null);

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const longEnough = text.trim().length >= MIN_REVIEW;
  const shown = hover || stars;

  function pick(next: File | null) {
    setError(null);
    const problem = next ? fileProblem(next) : null;
    if (problem) { setError(problem); return; }
    setFile(next);
    setProofId(null);
    setProofState(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return next ? URL.createObjectURL(next) : null;
    });
  }

  async function uploadProof() {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().slice(0, 5);
      // The `${userId}/` prefix is required by the storage policy and re-checked
      // by submit_proof, so an object written anywhere else can never be
      // submitted as a proof.
      const path = `${userId}/${assignmentId}/store-review-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (uploadError) { setError(`Upload failed: ${uploadError.message}`); return; }

      const saved = await recordProof(assignmentId, path, 'store_review');
      if (!saved.ok || !saved.data) {
        setError(saved.message ?? 'Could not record that screenshot.');
        return;
      }
      setProofId(saved.data.proofId);
      setProofState(saved.data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
    } finally {
      setPending(false);
    }
  }

  async function send() {
    if (!proofId) return;
    setPending(true);
    setError(null);
    try {
      const result = await submitStoreReview({
        assignmentId, appId, rating: stars, reviewText: text, reviewUrl: url, proofId,
      });
      if (!result.ok) { setError(result.message ?? 'Could not send that.'); return; }
      setSent(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="card flex flex-col items-center gap-3 p-7 text-center">
        <span
          className="animate-pop inline-flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          <IconCheck size={30} />
        </span>
        <h2 className="text-[20px] font-bold">Sent to the publisher</h2>
        <p className="max-w-sm text-[15px] leading-relaxed text-[var(--color-dim)]">
          They read it and approve it, and <span className="num font-semibold text-[var(--color-ink)]">{reward}</span>{' '}
          credits move from their balance to yours. If they dispute it, a moderator settles it —
          a critical review is paid at exactly the same rate as a glowing one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --------------------------------------------------------- rating */}
      <div className="card flex flex-col gap-4 p-5">
        <div className="label">Your rating</div>
        <div className="flex items-center gap-2" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              aria-pressed={stars === star}
              onMouseEnter={() => setHover(star)}
              onFocus={() => setHover(star)}
              onClick={() => setStars(star)}
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
          <div className="mt-1.5 flex items-center justify-between gap-3 text-[12px]">
            <span className="text-[var(--color-mute)]">
              {highlights.length > 0 ? `Mention one of: ${highlights.join(', ')}` : 'Be specific.'}
            </span>
            <span
              className="num inline-flex shrink-0 items-center gap-1 font-semibold"
              style={{ color: longEnough ? 'var(--color-android)' : 'var(--color-mute)' }}
            >
              {longEnough
                ? <><IconCheck size={12} /> {text.trim().length}</>
                : <>{text.trim().length}/{MIN_REVIEW}</>}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary w-full py-3 text-[15px]"
          disabled={!stars || !longEnough}
          onClick={() => {
            void navigator.clipboard?.writeText(text.trim()).catch(() => {});
            setCopied(true);
            window.open(storeUrl, '_blank', 'noopener');
          }}
        >
          <IconCopy size={16} />
          {copied ? 'Copied — paste it on the store page' : `Copy review and open ${appName}`}
        </button>
      </div>

      {/* ---------------------------------------------------------- proof */}
      <div className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-[17px] font-bold leading-tight">Prove you published it</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-dim)]">
            The store page showing your review live, with your name on it. The publisher and a
            moderator both see this screenshot.
          </p>
        </div>

        {preview ? (
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{file?.name}</div>
                <div className="mt-0.5 text-[12px] text-[var(--color-mute)]">
                  {proofId
                    ? proofState === 'pending' || proofState === 'escalated'
                      ? 'Recorded — a moderator will check it'
                      : 'Recorded and accepted'
                    : 'Not uploaded yet'}
                </div>
              </div>
              {proofId ? (
                <span className="text-[var(--color-android)]"><IconCheck size={20} /></span>
              ) : (
                <button type="button" onClick={() => pick(null)} className="btn btn-ghost text-[13px]">
                  Replace
                </button>
              )}
            </div>
          </div>
        ) : (
          <label className="card-dashed block cursor-pointer px-5 py-6 text-center">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <span
              className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
            >
              <IconUpload size={19} />
            </span>
            <span className="block text-[16px] font-bold">Screenshot your published review</span>
            <span className="mx-auto mt-2 block max-w-md text-[13px] leading-relaxed text-[var(--color-mute)]">
              PNG or JPG, under 8MB.
            </span>
          </label>
        )}

        {file && !proofId && (
          <button
            type="button"
            className="btn btn-primary w-full py-3 text-[15px]"
            disabled={pending}
            onClick={() => void uploadProof()}
          >
            {pending ? 'Uploading' : 'Upload this screenshot'}
          </button>
        )}

        <div>
          <label className="label" htmlFor="review-url">Link to the review (optional)</label>
          <input
            id="review-url"
            className="input"
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://play.google.com/store/apps/details?id=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p
          className="rounded-xl border px-4 py-3 text-[14px]"
          style={{
            borderColor: 'color-mix(in oklab, var(--color-danger) 35%, transparent)',
            background: 'color-mix(in oklab, var(--color-danger) 8%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </p>
      )}

      <button
        type="button"
        className={cx('btn btn-primary w-full py-3.5 text-[15px]')}
        disabled={pending || !stars || !longEnough || !proofId}
        onClick={() => void send()}
      >
        {!stars || !longEnough
          ? 'Rate and write your review first'
          : !proofId
            ? 'Upload your screenshot first'
            : pending
              ? 'Sending'
              : `Send to the publisher  +${reward} if approved`}
      </button>

      <p className="px-1 text-center text-[12px] leading-relaxed text-[var(--color-mute)]">
        The publisher approves or disputes it. A disputed review goes to a moderator, and specific
        criticism is paid at the same rate as praise — approval is not theirs to withhold.
      </p>

      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost w-full text-[14px]"
      >
        <IconExternal size={15} /> Open the store listing
      </a>
    </div>
  );
}
