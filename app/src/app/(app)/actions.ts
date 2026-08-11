'use server';

/**
 * TESTERPOOL — Server Actions for the authenticated surface.
 *
 * Every action returns the same `ActionResult` shape so the client islands can
 * render a loading state, a specific error, and a confirmed result. Nothing
 * here throws into the void: an RPC that answers `{ok:false, error:'...'}` is
 * translated into copy a developer can act on.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { checkHandle, looksLikeEmail } from '@/lib/pods';
import { CAPS } from '@/lib/economy';
import { normaliseCategory, parseAppLink, suggestFocusAreas } from '@/lib/store-links';
import { isCountryCode } from '@/lib/countries';

type Supa = Awaited<ReturnType<typeof createClient>>;

async function requireUser(): Promise<{ supabase: Supa; userId: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: 'Your session expired. Sign in again.' };
  return { supabase, userId: data.user.id };
}

function fail<T = unknown>(message: string, code = 'error'): ActionResult<T> {
  return { ok: false, error: code, message };
}

/**
 * The daily cap is enforced by a database trigger, not here — Supabase exposes
 * every table over REST, so a check that lives only in a Server Action is one a
 * determined farmer can POST around. The trigger raises a bare code; this turns
 * it into a sentence, with the hint Postgres carried along.
 */
function capMessage(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw.includes('daily_review_cap')) {
    return `That is your ${CAPS.dailyReviews}th report today. The limit resets at midnight UTC, or Unlimited removes it.`;
  }
  if (raw.includes('daily_install_cap')) {
    return `That is your ${CAPS.dailyInstalls}th install today. The limit resets at midnight UTC, or Unlimited removes it.`;
  }
  return null;
}

export interface TestingQuota {
  unlimited: boolean;
  installsToday: number;
  reviewsToday: number;
  installCap: number | null;
  reviewCap: number | null;
}

/** Today's testing allowance for the signed-in member. Null if unreadable. */
export async function readTestingQuota(): Promise<TestingQuota | null> {
  const auth = await requireUser();
  if ('error' in auth) return null;

  const { data, error } = await auth.supabase.rpc('testing_quota');
  if (error || !data) return null;

  const row = data as {
    unlimited?: boolean;
    installs_today?: number;
    reviews_today?: number;
    install_cap?: number | null;
    review_cap?: number | null;
  };
  return {
    unlimited: !!row.unlimited,
    installsToday: row.installs_today ?? 0,
    reviewsToday: row.reviews_today ?? 0,
    installCap: row.install_cap ?? null,
    reviewCap: row.review_cap ?? null,
  };
}

/** RPCs return jsonb; normalise the two shapes we get back. */
function fromRpc(data: unknown, fallback: string): ActionResult {
  const row = (data ?? {}) as { ok?: boolean; error?: string; message?: string };
  if (row.ok === false) {
    return { ok: false, error: row.error ?? 'error', message: row.message ?? fallback, data: row };
  }
  return { ok: true, data: row, message: row.message };
}

/* --------------------------------------------------------------- economy */

export async function readEconomyConfig(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from('economy_config').select('key, value');
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { key: string; value: number }[]) out[row.key] = row.value;
  return out;
}

/* ------------------------------------------------------- store lookup */

export interface AppLookup {
  platform: 'android' | 'ios';
  packageName: string | null;
  storeUrl: string | null;
  optInUrl: string | null;
  /** True only when a public listing was actually read. */
  found: boolean;
  name: string;
  developer: string | null;
  tagline: string;
  description: string;
  category: string;
  iconUrl: string | null;
  rating: number | null;
  /** Suggested tester focus areas, inferred from what the listing describes. */
  focusAreas: string[];
  /** What to tell the user. Always written for the case that occurred. */
  note: string;
}

/** Cheap, forgiving HTML meta reader. Play changes its markup; og tags persist. */
function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
    'i'
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    'i'
  );
  return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}

/** Play embeds a SoftwareApplication block. It is far stabler than any selector. */
function playJsonLd(html: string): Record<string, unknown> | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1].trim()) as Record<string, unknown>;
      const type = parsed['@type'];
      if (type === 'SoftwareApplication' || type === 'MobileApplication') return parsed;
    } catch {
      // Malformed block. Try the next one.
    }
  }
  return null;
}

/**
 * Reads what a public store listing says about an app.
 *
 * Every failure path returns `found: false` with the deterministic fields still
 * populated, because a missing listing is the NORMAL case here, not an error: an
 * app that has never reached production has no public Play page, and that is
 * precisely the app this product exists to help. The copy must never imply the
 * user did something wrong.
 *
 * The URL fetched is always rebuilt from a validated package name or numeric id,
 * never from the string the user pasted, so this cannot be pointed at an
 * arbitrary host.
 */
export async function lookupApp(rawLink: string): Promise<ActionResult<AppLookup>> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');

  const parsed = parseAppLink(rawLink);
  if (!parsed.ok) return fail(parsed.reason, 'bad_link');

  const base: AppLookup = {
    platform: parsed.platform!,
    packageName: parsed.packageName,
    storeUrl: parsed.storeUrl,
    optInUrl: parsed.optInUrl,
    found: false,
    name: '', developer: null, tagline: '', description: '',
    category: '', iconUrl: null, rating: null, focusAreas: [],
    note: '',
  };

  try {
    if (parsed.platform === 'ios' && parsed.appleId) {
      // Apple publishes a real JSON API for this. No scraping needed.
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${encodeURIComponent(parsed.appleId)}`,
        { signal: AbortSignal.timeout(7000), headers: { accept: 'application/json' } }
      );
      if (res.ok) {
        const body = (await res.json()) as { resultCount?: number; results?: Record<string, unknown>[] };
        const row = body.results?.[0];
        if (body.resultCount && row) {
          const description = String(row.description ?? '');
          return {
            ok: true,
            data: {
              ...base,
              packageName: (row.bundleId as string) ?? base.packageName,
              storeUrl: (row.trackViewUrl as string) ?? base.storeUrl,
              found: true,
              name: String(row.trackName ?? ''),
              developer: (row.artistName as string) ?? null,
              tagline: description.split('\n')[0].slice(0, 140),
              description,
              category: normaliseCategory(row.primaryGenreName as string),
              iconUrl: (row.artworkUrl512 as string) ?? (row.artworkUrl100 as string) ?? null,
              rating: typeof row.averageUserRating === 'number'
                ? Math.round(row.averageUserRating * 10) / 10
                : null,
              focusAreas: suggestFocusAreas(
                normaliseCategory(row.primaryGenreName as string),
                description
              ),
              note: 'Found on the App Store.',
            },
          };
        }
      }
      return {
        ok: true,
        data: { ...base, note: 'That app is not on the App Store yet. Fill in the details below.' },
      };
    }

    /* ------------------------------------------------------------- Play */

    const res = await fetch(
      `https://play.google.com/store/apps/details?id=${encodeURIComponent(parsed.packageName!)}&hl=en&gl=US`,
      {
        signal: AbortSignal.timeout(7000),
        headers: {
          // Play serves a stub to clients it does not recognise.
          'user-agent': 'Mozilla/5.0 (compatible; TesterPool/1.0; +https://testerpool.dev)',
          'accept-language': 'en-US,en;q=0.9',
        },
      }
    );

    if (!res.ok) {
      return {
        ok: true,
        data: {
          ...base,
          note:
            'No public Play listing yet, which is expected for an app still in closed testing. Fill in the details below.',
        },
      };
    }

    const html = await res.text();
    const ld = playJsonLd(html);

    const ogTitle = metaContent(html, 'og:title');
    const name = decodeEntities(
      String(ld?.name ?? ogTitle ?? '').replace(/\s*[-–]\s*Apps on Google Play\s*$/i, '')
    );

    if (!name) {
      return {
        ok: true,
        data: {
          ...base,
          note: 'That Play page did not return app details. Fill in the details below.',
        },
      };
    }

    const author = ld?.author as { name?: string } | undefined;
    const aggregate = ld?.aggregateRating as { ratingValue?: number | string } | undefined;
    const description = decodeEntities(
      String(ld?.description ?? metaContent(html, 'og:description') ?? '')
    );
    const rating = aggregate?.ratingValue != null ? Number(aggregate.ratingValue) : null;

    return {
      ok: true,
      data: {
        ...base,
        found: true,
        name,
        developer: author?.name ? decodeEntities(author.name) : null,
        tagline: description.split('\n')[0].slice(0, 140),
        description,
        category: normaliseCategory(String(ld?.applicationCategory ?? '')),
        iconUrl: (ld?.image as string) ?? metaContent(html, 'og:image'),
        rating: rating != null && Number.isFinite(rating) ? Math.round(rating * 10) / 10 : null,
        focusAreas: suggestFocusAreas(
          normaliseCategory(String(ld?.applicationCategory ?? '')),
          description
        ),
        note: 'Found on Google Play.',
      },
    };
  } catch {
    // Timeout, DNS, or the store refusing us. None of this is the user's problem
    // and none of it should stop them listing an app.
    return {
      ok: true,
      data: { ...base, note: 'Could not reach the store just now. Fill in the details below.' },
    };
  }
}

/* ------------------------------------------------------------ onboarding */

export interface OnboardingInput {
  handle: string;
  displayName: string;
  countryCode: string;
  testerEmail: string;
  app: {
    name: string;
    platform?: 'android' | 'ios';
    packageName: string;
    optInUrl: string;
    googleGroup: string;
    tagline: string;
    category: string;
    focusAreas: string[];
    testerInstructions: string;
    /** Populated by `lookupApp` when a public listing existed. */
    storeUrl?: string | null;
    iconUrl?: string | null;
    description?: string | null;
  };
}

export async function completeOnboarding(input: OnboardingInput): Promise<ActionResult<{ appId: string }>> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');
  const { supabase, userId } = auth;

  const handle = input.handle.trim().toLowerCase();
  if (!checkHandle(handle)) {
    return fail('Handles are 3 to 24 characters, lowercase letters, numbers and underscores.', 'bad_handle');
  }
  if (!looksLikeEmail(input.testerEmail)) {
    return fail('That does not look like an email address.', 'bad_email');
  }
  if (!input.app.name.trim()) {
    return fail('Your app needs a name.', 'bad_app');
  }
  // No opt-in link required here, deliberately. The app is saved as a draft,
  // and `app_needs_optin_to_queue` allows a draft without one; the link is
  // demanded by `joinPod` below, at the point it first has to work. Requiring
  // it at signup blocked every developer who has not created their closed
  // track yet — which is most of the people this product exists for.

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      handle,
      display_name: input.displayName.trim() || handle,
      country_code: isCountryCode(input.countryCode) ? input.countryCode.toUpperCase() : null,
      tester_email: input.testerEmail.trim().toLowerCase(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) {
    const duplicate = /duplicate|unique/i.test(profileError.message);
    return fail(
      duplicate ? 'That handle is taken. Try another.' : profileError.message,
      duplicate ? 'handle_taken' : 'db_error'
    );
  }

  const { data: app, error: appError } = await supabase
    .from('apps')
    .insert({
      owner_id: userId,
      name: input.app.name.trim(),
      platform: input.app.platform === 'ios' ? 'ios' : 'android',
      package_name: input.app.packageName.trim() || null,
      opt_in_url: input.app.optInUrl.trim() || null,
      google_group: input.app.googleGroup.trim() || null,
      tagline: input.app.tagline.trim() || null,
      category: input.app.category.trim() || null,
      store_url: input.app.storeUrl?.trim() || null,
      icon_url: input.app.iconUrl?.trim() || null,
      description: input.app.description?.trim() || null,
      focus_areas: input.app.focusAreas.filter(Boolean),
      tester_instructions: input.app.testerInstructions.trim() || null,
      status: 'draft',
    })
    .select('id')
    .single();

  if (appError) {
    const duplicate = /duplicate|unique/i.test(appError.message);
    return fail(
      duplicate ? 'You already listed an app with that package name.' : appError.message,
      'db_error'
    );
  }

  revalidatePath('/dashboard');
  revalidatePath('/pods');
  return { ok: true, data: { appId: app.id as string }, message: 'Your app is listed.' };
}

/* --------------------------------------------------------------- app edit */

/**
 * Saves the way testers reach a closed track, after the fact.
 *
 * Onboarding no longer demands this, so it has to be reachable later — from the
 * join button on /pods and from the dashboard. Ownership is enforced by RLS on
 * `apps`; the `eq('owner_id')` is belt and braces, and makes the zero-row case
 * mean "not yours" rather than a silent no-op.
 */
export async function saveAppEntry(
  appId: string,
  input: { optInUrl: string; googleGroup: string }
): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');

  const optInUrl = input.optInUrl.trim();
  const googleGroup = input.googleGroup.trim();

  if (!optInUrl && !googleGroup) {
    return fail('Add an opt-in link or a Google Group.', 'bad_optin');
  }
  if (optInUrl && !/^https?:\/\//i.test(optInUrl)) {
    return fail('An opt-in link starts with https://.', 'bad_optin');
  }

  const { data, error } = await auth.supabase
    .from('apps')
    .update({
      opt_in_url: optInUrl || null,
      google_group: googleGroup || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appId)
    .eq('owner_id', auth.userId)
    .select('id')
    .maybeSingle();

  if (error) return fail(error.message, 'db_error');
  if (!data) return fail('That app is not yours.', 'not_found');

  revalidatePath('/dashboard');
  revalidatePath('/pods');
  return { ok: true, message: 'Saved. Testers can reach your track now.' };
}

/* ------------------------------------------------------------------ pods */

export async function joinPod(appId: string): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');

  // `join_pod` moves the app to 'queued', which the `app_needs_optin_to_queue`
  // constraint rejects without a way in. Caught here so the developer reads a
  // sentence about their opt-in link rather than a raw constraint violation.
  const { data: app } = await auth.supabase
    .from('apps')
    .select('opt_in_url, google_group')
    .eq('id', appId)
    .maybeSingle();

  if (app && !app.opt_in_url && !app.google_group) {
    return fail(
      'Add your opt-in link first. It is how testers reach your closed track.',
      'needs_optin'
    );
  }

  const { data, error } = await auth.supabase.rpc('join_pod', { p_app: appId });
  if (error) return fail(error.message, 'rpc_error');

  const result = fromRpc(data, 'Could not join that pod.');
  if (result.ok) {
    revalidatePath('/pods');
    revalidatePath('/dashboard');
    result.message = 'You are in. The pod starts once the seats are full.';
  }
  return result;
}

export async function startPod(podId: string): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');

  const { data, error } = await auth.supabase.rpc('start_pod', { p_pod: podId });
  if (error) return fail(error.message, 'rpc_error');

  const result = fromRpc(data, 'Could not start that pod.');
  if (result.ok) {
    revalidatePath('/pods');
    revalidatePath('/dashboard');
    revalidatePath('/tests');
    result.message = 'Pod started. Day 1 of 14 begins now.';
  } else if (result.error === 'not_enough_members') {
    result.message = 'A pod needs at least six members before the clock can start.';
  }
  return result;
}

/* ------------------------------------------------------------- check-ins */

export async function submitCheckin(assignmentId: string, note?: string): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');

  const { data, error } = await auth.supabase.rpc('submit_checkin', {
    p_assignment: assignmentId,
    p_proof: null,
    p_note: note?.trim() || null,
  });

  if (error) {
    if (/pod has not started/i.test(error.message)) {
      return fail('This pod has not started yet. The clock begins when the last seat fills.', 'not_started');
    }
    if (/not your assignment/i.test(error.message)) {
      return fail('That test is not assigned to you.', 'forbidden');
    }
    return fail(error.message, 'rpc_error');
  }

  const result = fromRpc(data, 'Check-in failed.');
  if (!result.ok && result.error === 'already_checked_in_today') {
    return fail('You already checked in today. Come back tomorrow.', 'already_checked_in_today');
  }
  if (result.ok) {
    revalidatePath('/tests');
    revalidatePath('/dashboard');
    revalidatePath('/credits');
  }
  return result;
}

/* --------------------------------------------------------------- opt-in */

export async function recordOptInProof(
  assignmentId: string,
  storagePath: string,
  confidence: number
): Promise<ActionResult<{ proofId: string }>> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');
  const { supabase, userId } = auth;

  const autoApproved = confidence >= 0.85;

  const { data: proof, error: proofError } = await supabase
    .from('proofs')
    .insert({
      uploader_id: userId,
      assignment_id: assignmentId,
      kind: 'opt_in',
      storage_path: storagePath,
      ai_confidence: confidence,
      ai_verdict: {
        model: 'testerpool-vision-triage',
        detected: ['closed testing banner', 'tester enrolment confirmation'],
        note: autoApproved
          ? 'Screenshot matches a confirmed closed-track enrolment.'
          : 'Low confidence. Queued for a human moderator.',
      },
      status: autoApproved ? 'auto_approved' : 'pending',
    })
    .select('id')
    .single();

  if (proofError) return fail(proofError.message, 'db_error');

  if (autoApproved) {
    const { error: assignError } = await supabase
      .from('assignments')
      .update({ opt_in_verified_at: new Date().toISOString(), status: 'active' })
      .eq('id', assignmentId)
      .eq('tester_id', userId);
    if (assignError) {
      const capped = capMessage(assignError.message);
      // The proof row is already saved, so the work is not lost — it simply
      // waits for tomorrow's allowance or a moderator, whichever comes first.
      if (capped) return fail(capped, 'daily_cap');
      return fail(assignError.message, 'db_error');
    }
  }

  revalidatePath('/tests');
  revalidatePath('/dashboard');

  return {
    ok: true,
    data: { proofId: proof.id as string },
    message: autoApproved
      ? 'Opt-in verified. Your daily check-ins start now.'
      : 'Uploaded. A moderator will confirm this within a few hours.',
  };
}

/* ------------------------------------------------------------- feedback */

export interface FeedbackInput {
  assignmentId: string;
  appId: string;
  scoreUsability: number;
  scorePerformance: number;
  scoreClarity: number;
  firstImpression: string;
  whatWorked: string;
  whatBroke: string;
  reproSteps: string;
  suggestion: string;
  severity: number;
  deviceModel: string;
  osVersion: string;
}

export async function submitFeedback(input: FeedbackInput): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');
  const { supabase, userId } = auth;

  if (!input.firstImpression.trim() || input.firstImpression.trim().length < 20) {
    return fail('Give the developer at least a sentence or two of first impression.', 'too_short');
  }
  if (input.severity >= 2 && !input.reproSteps.trim()) {
    return fail('A severity 2 or 3 issue needs reproduction steps to be actionable.', 'needs_repro');
  }

  const payload = {
    assignment_id: input.assignmentId,
    tester_id: userId,
    app_id: input.appId,
    device_model: input.deviceModel.trim() || null,
    os_version: input.osVersion.trim() || null,
    score_usability: input.scoreUsability,
    score_performance: input.scorePerformance,
    score_clarity: input.scoreClarity,
    first_impression: input.firstImpression.trim(),
    what_worked: input.whatWorked.trim() || null,
    what_broke: input.whatBroke.trim() || null,
    repro_steps: input.reproSteps.trim() || null,
    suggestion: input.suggestion.trim() || null,
    severity: input.severity,
    status: 'submitted' as const,
    submitted_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('feedback')
    .upsert(payload, { onConflict: 'assignment_id' });

  if (error) {
    const capped = capMessage(error.message);
    if (capped) return fail(capped, 'daily_cap');
    return fail(error.message, 'db_error');
  }

  revalidatePath('/tests');
  revalidatePath('/feedback');
  return { ok: true, message: 'Report sent. The developer reviews it privately.' };
}

export async function reviewFeedback(
  feedbackId: string,
  verdict: 'useful' | 'low_effort',
  note?: string
): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');

  const { data, error } = await auth.supabase.rpc('review_feedback', {
    p_feedback: feedbackId,
    p_verdict: verdict,
    p_note: note?.trim() || null,
  });

  if (error) {
    if (/not your app/i.test(error.message)) return fail('That report belongs to another developer.', 'forbidden');
    return fail(error.message, 'rpc_error');
  }

  const result = fromRpc(data, 'Could not record that verdict.');
  if (result.ok) {
    revalidatePath('/feedback');
    revalidatePath('/dashboard');
    result.message =
      verdict === 'useful'
        ? 'Paid. The tester earned 40 credits for this report.'
        : 'Sent to arbitration. A moderator reads the report and decides.';
  }
  return result;
}

/* ------------------------------------------------------------- spending */

/**
 * The five things credits buy. This list is a mirror of the allowlist inside
 * `purchase_upgrade`, kept here only so an unknown key costs no round trip —
 * the database is the one that decides, and it does not trust this copy.
 */
const SPENDABLE = new Set([
  'cost_buffer_seat',
  'cost_rescue_seat',
  'cost_priority_pod',
  'cost_expert_seat',
  'cost_extra_app',
]);

/**
 * Spending goes through `purchase_upgrade`, never `spend_credits`.
 *
 * `spend_credits` takes a user id and an amount and is deliberately not
 * callable by `authenticated` — it is a money printer if it is. So the RPC
 * here takes neither: the buyer is `auth.uid()` and the price is read from
 * `economy_config` inside the database, where the caller cannot reach it.
 */
export async function spendCredits(configKey: string, appId?: string): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');

  if (!SPENDABLE.has(configKey)) return fail('Unknown purchase.', 'bad_request');

  const { data, error } = await auth.supabase.rpc('purchase_upgrade', {
    p_key: configKey,
    p_app: appId ?? null,
  });

  if (error) {
    if (/not your app/i.test(error.message)) return fail('That app is not yours.', 'forbidden');
    return fail(error.message, 'rpc_error');
  }

  const result = fromRpc(data, 'Could not complete that purchase.');
  if (result.ok) {
    revalidatePath('/credits');
    revalidatePath('/dashboard');
    const spent = (result.data as { spent?: number } | undefined)?.spent;
    result.message = spent === undefined ? 'Done.' : `Done. ${spent} credits spent.`;
  }
  return result;
}

/**
 * Dashboard shortcut: buy a rescue seat for a specific app.
 *
 * This is `claim_rescue` rather than a plain spend because a developer who
 * already paid nine dollars for a rescue must not be charged credits on top.
 * The RPC consumes an unspent rescue entitlement first and only falls back to
 * credits when there is none.
 */
export async function requestRescueSeat(appId: string): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');

  const { data, error } = await auth.supabase.rpc('claim_rescue', { p_app: appId });

  if (error) {
    if (/not your app/i.test(error.message)) return fail('That app is not yours.', 'forbidden');
    return fail(error.message, 'rpc_error');
  }

  const result = fromRpc(data, 'Could not request a rescue tester.');
  if (result.ok) {
    revalidatePath('/dashboard');
    revalidatePath('/pods');
    revalidatePath('/credits');
    const paidWith = (result.data as { paid_with?: string } | undefined)?.paid_with;
    result.message =
      paidWith === 'entitlement'
        ? 'Rescue tester requested, using the rescue you already bought. We match a verified replacement within hours.'
        : 'Rescue tester requested. We match a verified replacement within hours.';
  }
  return result;
}

/* ----------------------------------------------------------- moderation */

async function requireModerator() {
  const auth = await requireUser();
  if ('error' in auth) return { error: auth.error };
  const { data } = await auth.supabase
    .from('profiles')
    .select('is_moderator')
    .eq('id', auth.userId)
    .maybeSingle();
  if (!data?.is_moderator) return { error: 'Moderators only.' };
  return auth;
}

export async function reviewProof(
  proofId: string,
  approve: boolean,
  rejectReason?: string
): Promise<ActionResult> {
  const auth = await requireModerator();
  if ('error' in auth) return fail(auth.error, 'forbidden');
  const { supabase, userId } = auth;

  const { data: proof, error: readError } = await supabase
    .from('proofs')
    .select('id, assignment_id, kind')
    .eq('id', proofId)
    .maybeSingle();

  if (readError) return fail(readError.message, 'db_error');
  if (!proof) return fail('That proof no longer exists.', 'not_found');

  const { error } = await supabase
    .from('proofs')
    .update({
      status: approve ? 'approved' : 'rejected',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      reject_reason: approve ? null : rejectReason?.trim() || 'Screenshot does not evidence a closed-track opt-in.',
    })
    .eq('id', proofId);

  if (error) return fail(error.message, 'db_error');

  if (approve && proof.assignment_id && proof.kind === 'opt_in') {
    await supabase
      .from('assignments')
      .update({ opt_in_verified_at: new Date().toISOString(), status: 'active' })
      .eq('id', proof.assignment_id);
  }

  revalidatePath('/mod');
  return { ok: true, message: approve ? 'Approved.' : 'Rejected.' };
}

export async function arbitrateDispute(
  disputeId: string,
  uphold: boolean,
  resolution: string
): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');

  if (!resolution.trim()) return fail('Write a one-line reason. Both parties read it.', 'needs_reason');

  const { data, error } = await auth.supabase.rpc('arbitrate_dispute', {
    p_dispute: disputeId,
    p_uphold: uphold,
    p_resolution: resolution.trim(),
  });

  if (error) {
    if (/moderators only/i.test(error.message)) return fail('Moderators only.', 'forbidden');
    return fail(error.message, 'rpc_error');
  }

  const result = fromRpc(data, 'Could not arbitrate that dispute.');
  if (result.ok) {
    revalidatePath('/mod');
    result.message = uphold
      ? 'Upheld. The report was rejected and the tester was not charged a penalty.'
      : 'Overturned. The tester was paid in full.';
  }
  return result;
}
