'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, Pill, cx } from '@/components/ui';
import { Spinner } from '@/components/app/action-button';
import { IconArrow, IconCheck, IconExternal, IconUpload, IconAlert } from '@/components/app/icons';
import { createClient } from '@/lib/supabase/client';
import { recordOptInProof } from '@/app/(app)/actions';
import { EARN } from '@/lib/economy';

const STEPS = ['Confirm your account', 'Open the track', 'Upload the proof'];

/**
 * What the browser is allowed to check.
 *
 * Format and size, and nothing else. There used to be a `triage()` here that
 * scored the file from its name and byte count and handed the number to the
 * server, which approved anything above 0.85 — so the client decided whether it
 * got paid. The real check is a vision model behind `submit_proof`, and its
 * verdict arrives in the response to the upload.
 *
 * These limits mirror the storage bucket's own, so an oversized file is refused
 * here with a sentence instead of by the API with a 413.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

function fileProblem(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return 'That needs to be a PNG, JPG or WebP.';
  if (file.size > MAX_BYTES) return 'That image is over 8 MB. A normal screenshot is well under it.';
  if (file.size < 5_000) return 'That file is too small to read. Send the full screenshot.';
  return null;
}

export function OptInWizard({
  assignmentId,
  testerEmail,
  appName,
  optInUrl,
  googleGroup,
  instructions,
  userId,
}: {
  assignmentId: string;
  testerEmail: string;
  appName: string;
  optInUrl: string | null;
  googleGroup: string | null;
  instructions: string | null;
  userId: string;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [emailConfirmed, setEmailConfirmed] = React.useState(false);
  const [opened, setOpened] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const [verdict, setVerdict] = React.useState<string | null>(null);

  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(next: File | null) {
    setError(null);
    setDone(null);
    setVerdict(null);
    const problem = next ? fileProblem(next) : null;
    setFile(problem ? null : next);
    if (problem) setError(problem);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return next && !problem ? URL.createObjectURL(next) : null;
    });
  }

  async function upload() {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().slice(0, 5);
      // The `${userId}/` prefix is not decoration — the storage policy and
      // submit_proof both require it, so an object written anywhere else can
      // never be submitted as a proof.
      const path = `${userId}/${assignmentId}/opt-in-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }

      const saved = await recordOptInProof(assignmentId, path);
      if (!saved.ok) {
        setError(saved.message ?? 'Could not record that proof.');
        return;
      }
      setVerdict(saved.data?.status ?? 'pending');
      setDone(saved.message ?? 'Uploaded.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
    } finally {
      setPending(false);
    }
  }

  const autoApproved = verdict === 'auto_approved';

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold"
              style={
                i < step
                  ? { background: 'var(--color-accent)', color: '#04150C', borderColor: 'transparent' }
                  : i === step
                    ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
                    : { borderColor: 'var(--color-line)', color: 'var(--color-mute)' }
              }
            >
              {i < step ? <IconCheck size={13} /> : i + 1}
            </span>
            <span className="hidden text-xs font-semibold sm:inline"
                  style={{ color: i === step ? 'var(--color-ink)' : 'var(--color-mute)' }}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-[var(--color-line)]" />}
          </li>
        ))}
      </ol>

      <Card className="p-6">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Confirm the account you will test with</h2>
              <p className="mt-1 text-sm text-[var(--color-dim)]">
                The developer added this exact address to their closed track. If the Play Store on your device
                is signed in to a different account, the opt-in link will show an error page rather than the
                app, and nothing you do afterwards will count.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                Your Google account
              </div>
              <div className="mt-1 break-all text-base font-semibold">{testerEmail || 'Not set'}</div>
              {!testerEmail && (
                <p className="mt-2 text-xs" style={{ color: 'var(--color-danger)' }}>
                  You have not set a tester email. Add it on your profile before opting in.
                </p>
              )}
              {/* An Apple private-relay alias is not a Google account and can
                  never accept a Play opt-in. Catch it here rather than letting
                  the tester burn fourteen days discovering it. */}
              {testerEmail.toLowerCase().endsWith('@privaterelay.appleid.com') && (
                <p className="mt-2 text-xs" style={{ color: 'var(--color-danger)' }}>
                  This is an Apple private-relay address, not a Google account. Play cannot add it
                  as a tester. Change it to your Gmail or Google Workspace address on your profile.
                </p>
              )}
              {testerEmail && !/@(gmail\.com|googlemail\.com)$/i.test(testerEmail) &&
                !testerEmail.toLowerCase().endsWith('@privaterelay.appleid.com') && (
                <p className="mt-2 text-xs" style={{ color: 'var(--color-credit)' }}>
                  This is not a gmail.com address. That is fine if it is a Google Workspace account
                  you can sign into on the Play Store, but not if it is only an email address.
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox" className="mt-0.5 accent-[var(--color-accent)]"
                checked={emailConfirmed} onChange={(e) => setEmailConfirmed(e.target.checked)}
              />
              <span className="text-[var(--color-dim)]">
                I checked the Play Store on my device and it is signed in to this account.
              </span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Join the closed test for {appName}</h2>
              <p className="mt-1 text-sm text-[var(--color-dim)]">
                Open the link on the device you will test with. You should see a page that says you are a
                tester, with a link to download the app on Google Play.
              </p>
            </div>

            {googleGroup && (
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  Join this group first
                </div>
                <div className="mt-1 break-all font-medium">{googleGroup}</div>
              </div>
            )}

            {optInUrl ? (
              <a
                href={optInUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpened(true)}
                className="btn btn-primary w-full justify-between px-5 py-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold">Open the opt-in page</span>
                  <span className="block truncate text-xs font-medium opacity-80">{optInUrl}</span>
                </span>
                <IconExternal size={18} />
              </a>
            ) : (
              <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-credit)' }}>
                <IconAlert size={15} className="mt-0.5 shrink-0" />
                This developer has not published an opt-in URL yet. Message them through their listing before
                uploading anything.
              </p>
            )}

            {instructions && (
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  What the developer asked for
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-dim)]">{instructions}</p>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox" className="mt-0.5 accent-[var(--color-accent)]"
                checked={opened} onChange={(e) => setOpened(e.target.checked)}
              />
              <span className="text-[var(--color-dim)]">
                I opened the link and the page confirmed I am a tester.
              </span>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Upload the confirmation screenshot</h2>
              <p className="mt-1 text-sm text-[var(--color-dim)]">
                A screenshot of the page that says you are a tester. This is the evidence the developer
                submits to Google, so it is worth getting a clean one.
              </p>
            </div>

            <label
              className={cx(
                'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors',
                file ? 'border-[var(--color-line-hi)]' : 'border-[var(--color-line)] hover:border-[var(--color-line-hi)]'
              )}
            >
              <input
                type="file" accept="image/*" className="sr-only"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Opt-in screenshot preview" className="max-h-56 rounded-lg object-contain" />
              ) : (
                <>
                  <IconUpload size={26} className="text-[var(--color-mute)]" />
                  <span className="mt-2 text-sm font-semibold">Choose a screenshot</span>
                  <span className="mt-1 text-xs text-[var(--color-mute)]">PNG or JPG from the device you tested on</span>
                </>
              )}
            </label>

            {file && !verdict && (
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
                <p className="text-xs leading-relaxed text-[var(--color-dim)]">
                  When you send this, a vision model reads the screenshot and checks it is the Play
                  opt-in confirmation for {appName}. Clear ones clear in seconds and pay{' '}
                  <span className="num">{EARN.optInVerified}</span> credits. Anything it is unsure
                  about goes to a person, which takes a few hours and pays exactly the same.
                </p>
              </div>
            )}

            {verdict && (
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">
                <Pill tone={autoApproved ? 'green' : verdict === 'escalated' ? 'red' : 'amber'}>
                  {autoApproved
                    ? 'Verified'
                    : verdict === 'escalated'
                      ? 'Held for review'
                      : 'Queued for a moderator'}
                </Pill>
              </div>
            )}

            {error && <p role="status" className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}
            {done && (
              <div className="rounded-xl border p-4"
                   style={{ borderColor: 'color-mix(in oklab, var(--color-accent) 32%, transparent)', background: 'color-mix(in oklab, var(--color-accent) 8%, transparent)' }}>
                <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
                  <IconCheck size={16} /> {done}
                </p>
                <Link href="/tests" className="btn btn-primary mt-3">
                  Back to my tests <IconArrow size={15} />
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
          <button
            type="button" className="btn btn-ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending || !!done}
          >
            Back
          </button>

          {step < 2 ? (
            <button
              type="button" className="btn btn-primary"
              disabled={step === 0 ? !emailConfirmed : !opened}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue <IconArrow size={15} />
            </button>
          ) : (
            <button
              type="button" className="btn btn-primary"
              disabled={!file || pending || !!done}
              onClick={() => void upload()}
            >
              {pending && <Spinner />}
              {pending ? 'Uploading' : done ? 'Saved' : 'Submit proof'}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
