'use server';

/**
 * TESTERPOOL — admin Server Actions.
 *
 * Thin wrappers over the admin RPCs. Every one of those functions checks
 * `is_admin()` itself and writes `admin_actions` in the same statement, so this
 * file deliberately adds no authorisation logic of its own — a second copy of
 * the rule is a second place for it to be wrong.
 *
 * The one job here that matters: when an RPC raises, the thrown text is the
 * useful part ("you cannot ban yourself", "a reason of at least 5 characters is
 * required"). It is surfaced verbatim rather than flattened into "that failed".
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { MIN_REASON, type AnnouncementTone, type UserRole } from '@/lib/admin';

type Supa = Awaited<ReturnType<typeof createClient>>;

async function requireAdmin(): Promise<{ supabase: Supa; userId: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: 'Your session expired. Sign in again.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return { error: 'This action requires an admin account.' };
  }
  return { supabase, userId: data.user.id };
}

function fail(message: string, code = 'error'): ActionResult {
  return { ok: false, error: code, message };
}

/**
 * Postgres exceptions arrive with the raised text in `message`, sometimes
 * prefixed by the driver. Strip the noise, keep the sentence an admin needs.
 */
function rpcMessage(error: { message?: string; details?: string; hint?: string }): string {
  const raw = (error.message || error.details || '').trim();
  if (!raw) return 'The database rejected that action and gave no reason.';
  return raw.replace(/^(ERROR|error):\s*/, '');
}

function checkReason(reason: string): string | null {
  if (reason.trim().length < MIN_REASON) {
    return `Write a reason of at least ${MIN_REASON} characters. The database rejects anything shorter, and the audit log is the point of this screen.`;
  }
  return null;
}

function revalidateAdmin(...extra: string[]) {
  revalidatePath('/admin');
  revalidatePath('/admin/audit');
  for (const path of extra) revalidatePath(path);
}

/* ------------------------------------------------------------------ users */

export async function adminAdjustCredits(
  userId: string,
  delta: number,
  reason: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('error' in auth) return fail(auth.error, 'forbidden');

  if (!Number.isInteger(delta) || delta === 0) {
    return fail('Enter a whole, non-zero amount. Positive grants credits, negative removes them.', 'bad_delta');
  }
  const reasonError = checkReason(reason);
  if (reasonError) return fail(reasonError, 'bad_reason');

  const { data, error } = await auth.supabase.rpc('admin_adjust_credits', {
    p_user: userId,
    p_delta: delta,
    p_reason: reason.trim(),
  });
  if (error) return fail(rpcMessage(error), 'rpc_error');

  const row = (data ?? {}) as { before?: number; after?: number };
  revalidateAdmin('/admin/users', '/credits');
  return {
    ok: true,
    data: row,
    message:
      row.after === undefined
        ? 'Balance adjusted.'
        : `Balance moved from ${row.before ?? '—'} to ${row.after}. The ledger entry is written and cannot be edited.`,
  };
}

export async function adminSetRole(
  userId: string,
  role: UserRole,
  reason: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('error' in auth) return fail(auth.error, 'forbidden');

  const reasonError = checkReason(reason);
  if (reasonError) return fail(reasonError, 'bad_reason');

  const { error } = await auth.supabase.rpc('admin_set_role', {
    p_user: userId,
    p_role: role,
    p_reason: reason.trim(),
  });
  if (error) return fail(rpcMessage(error), 'rpc_error');

  revalidateAdmin('/admin/users');
  return { ok: true, message: `Role set to ${role}. Moderator access follows the role automatically.` };
}

export async function adminSetBan(
  userId: string,
  banned: boolean,
  reason: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('error' in auth) return fail(auth.error, 'forbidden');

  if (banned) {
    const reasonError = checkReason(reason);
    if (reasonError) return fail(reasonError, 'bad_reason');
  }

  const { error } = await auth.supabase.rpc('admin_set_ban', {
    p_user: userId,
    p_banned: banned,
    p_reason: reason.trim() || null,
  });
  if (error) return fail(rpcMessage(error), 'rpc_error');

  revalidateAdmin('/admin/users', '/admin/pods');
  return {
    ok: true,
    message: banned
      ? 'Account banned. They were removed from their pods and their assignments were dropped, so the people they were testing for need replacements.'
      : 'Ban lifted. Pod memberships are not restored automatically.',
  };
}

/* ---------------------------------------------------------------- economy */

export async function adminSetConfig(
  key: string,
  value: number,
  reason: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('error' in auth) return fail(auth.error, 'forbidden');

  if (!Number.isInteger(value) || value < 0) {
    return fail('Economy values are whole numbers of credits, and none of them are meaningful below zero.', 'bad_value');
  }
  const reasonError = checkReason(reason);
  if (reasonError) return fail(reasonError, 'bad_reason');

  const { error } = await auth.supabase.rpc('admin_set_config', {
    p_key: key,
    p_value: value,
    p_reason: reason.trim(),
  });
  if (error) return fail(rpcMessage(error), 'rpc_error');

  revalidateAdmin('/admin/economy', '/credits', '/launch');
  return { ok: true, message: `${key.replace(/_/g, ' ')} is now ${value}. It applies to the next credit movement, with no deploy.` };
}

/* ------------------------------------------------------------------- pods */

export type PodActionKind = 'force_start' | 'extend' | 'complete' | 'cancel';

export async function adminPodAction(
  podId: string,
  action: PodActionKind,
  days: number | null,
  reason: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('error' in auth) return fail(auth.error, 'forbidden');

  const reasonError = checkReason(reason);
  if (reasonError) return fail(reasonError, 'bad_reason');

  if (action === 'extend' && (!days || days < 1)) {
    return fail('Extending needs a positive number of days.', 'bad_days');
  }

  const { error } = await auth.supabase.rpc('admin_pod_action', {
    p_pod: podId,
    p_action: action,
    p_days: action === 'extend' ? days : null,
    p_reason: reason.trim(),
  });
  if (error) return fail(rpcMessage(error), 'rpc_error');

  revalidateAdmin('/admin/pods', '/pods', '/tests', '/dashboard');

  const messages: Record<PodActionKind, string> = {
    force_start: 'Pod started. Day 1 of the clock is now, and every member has a check-in due today.',
    extend: `Pod extended by ${days} ${days === 1 ? 'day' : 'days'}. Everyone in it now has a later finish date than the one they planned around.`,
    complete: 'Pod marked complete. Active members are graduated and their completion counts are incremented.',
    cancel: 'Pod cancelled. The apps went back to the queue and will need a new pod.',
  };
  return { ok: true, message: messages[action] };
}

/* ------------------------------------------------------------- moderation */

export async function adminReviewProof(
  proofId: string,
  approve: boolean,
  reason: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('error' in auth) return fail(auth.error, 'forbidden');

  if (!approve) {
    const reasonError = checkReason(reason);
    if (reasonError) return fail(reasonError, 'bad_reason');
  }

  const { error } = await auth.supabase.rpc('admin_review_proof', {
    p_proof: proofId,
    p_approve: approve,
    p_reason: reason.trim() || null,
  });
  if (error) return fail(rpcMessage(error), 'rpc_error');

  revalidateAdmin('/admin/moderation', '/mod');
  return {
    ok: true,
    message: approve ? 'Proof approved. The opt-in credit is released.' : 'Proof rejected. The tester sees the reason you wrote.',
  };
}

/* ------------------------------------------------------------------ flags */

export async function adminSetFlag(
  key: string,
  enabled: boolean,
  reason: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('error' in auth) return fail(auth.error, 'forbidden');

  const reasonError = checkReason(reason);
  if (reasonError) return fail(reasonError, 'bad_reason');

  const { error } = await auth.supabase.rpc('admin_set_flag', {
    p_key: key,
    p_enabled: enabled,
    p_reason: reason.trim(),
  });
  if (error) return fail(rpcMessage(error), 'rpc_error');

  revalidateAdmin('/admin/flags');
  return { ok: true, message: `${key.replace(/_/g, ' ')} is ${enabled ? 'on' : 'off'}. It takes effect on the next request.` };
}

/* ---------------------------------------------------------- announcements */

export async function createAnnouncement(
  body: string,
  tone: AnnouncementTone
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('error' in auth) return fail(auth.error, 'forbidden');

  const text = body.trim();
  if (text.length < 10) {
    return fail('An announcement shorter than ten characters will not tell anyone anything useful.', 'bad_body');
  }

  const { error } = await auth.supabase
    .from('announcements')
    .insert({ body: text, tone, active: true, created_by: auth.userId });

  if (error) return fail(rpcMessage(error), 'db_error');

  revalidateAdmin('/admin/flags', '/dashboard');
  return { ok: true, message: 'Announcement is live. Every signed-in user sees it on their next page load.' };
}

export async function setAnnouncementActive(id: string, active: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ('error' in auth) return fail(auth.error, 'forbidden');

  const { error } = await auth.supabase.from('announcements').update({ active }).eq('id', id);
  if (error) return fail(rpcMessage(error), 'db_error');

  revalidateAdmin('/admin/flags', '/dashboard');
  return { ok: true, message: active ? 'Announcement is live again.' : 'Announcement retired. It stays in the table but nobody sees it.' };
}
