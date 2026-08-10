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
import type { ActionResult, LedgerReason } from '@/lib/types';
import { checkHandle, looksLikeEmail } from '@/lib/pods';

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

/* ------------------------------------------------------------ onboarding */

export interface OnboardingInput {
  handle: string;
  displayName: string;
  countryCode: string;
  testerEmail: string;
  app: {
    name: string;
    packageName: string;
    optInUrl: string;
    googleGroup: string;
    tagline: string;
    category: string;
    focusAreas: string[];
    testerInstructions: string;
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
  if (!input.app.optInUrl.trim() && !input.app.googleGroup.trim()) {
    return fail('Add an opt-in URL or a Google Group. Testers cannot join a closed track without one.', 'bad_optin');
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      handle,
      display_name: input.displayName.trim() || handle,
      country_code: input.countryCode ? input.countryCode.toUpperCase().slice(0, 2) : null,
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
      platform: 'android',
      package_name: input.app.packageName.trim() || null,
      opt_in_url: input.app.optInUrl.trim() || null,
      google_group: input.app.googleGroup.trim() || null,
      tagline: input.app.tagline.trim() || null,
      category: input.app.category.trim() || null,
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

/* ------------------------------------------------------------------ pods */

export async function joinPod(appId: string): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');

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
    if (assignError) return fail(assignError.message, 'db_error');
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

  if (error) return fail(error.message, 'db_error');

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

const SPEND_REASONS: Record<string, LedgerReason> = {
  cost_buffer_seat: 'buffer_seat_spend',
  cost_rescue_seat: 'rescue_seat_spend',
  cost_priority_pod: 'priority_spend',
  cost_expert_seat: 'expert_seat_spend',
  cost_extra_app: 'extra_app_spend',
};

export async function spendCredits(configKey: string, appId?: string): Promise<ActionResult> {
  const auth = await requireUser();
  if ('error' in auth) return fail(auth.error, 'no_session');
  const { supabase, userId } = auth;

  const reason = SPEND_REASONS[configKey];
  if (!reason) return fail('Unknown purchase.', 'bad_request');

  const { data: cfg } = await supabase
    .from('economy_config')
    .select('value')
    .eq('key', configKey)
    .maybeSingle();

  const price = (cfg?.value ?? null) as number | null;
  if (price === null) return fail('That option is not available right now.', 'no_config');

  const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).maybeSingle();
  const balance = (profile?.credits ?? 0) as number;
  if (balance < price) {
    return fail(`You need ${price - balance} more credits.`, 'insufficient');
  }

  const { data, error } = await supabase.rpc('spend_credits', {
    p_user: userId,
    p_amount: price,
    p_reason: reason,
    p_ref_type: appId ? 'app' : null,
    p_ref_id: appId ?? null,
  });

  if (error) return fail(error.message, 'rpc_error');
  if (data === false) return fail('Not enough credits for that.', 'insufficient');

  revalidatePath('/credits');
  revalidatePath('/dashboard');
  return { ok: true, message: `Done. ${price} credits spent.` };
}

/** Dashboard shortcut: buy a rescue seat for a specific app. */
export async function requestRescueSeat(appId: string): Promise<ActionResult> {
  const result = await spendCredits('cost_rescue_seat', appId);
  if (result.ok) {
    result.message = 'Rescue tester requested. We match a verified replacement within hours.';
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
