/**
 * send-notifications — drains the `notifications` outbox.
 *
 * Reminders are not a courtesy in this product. A tester who forgets a day
 * breaks a stranger's fourteen-day clock and costs them a month of waiting, so
 * this function is the product working rather than a growth channel.
 *
 * Shape of a run:
 *   1. authenticate the caller (cron, or an operator with the service key)
 *   2. claim a batch atomically — see claim_notifications, FOR UPDATE SKIP LOCKED
 *   3. collapse each person's rows into one digest
 *   4. send, or, if delivery is not configured, say so and put the rows back
 *   5. settle every claimed id as sent, failed, or released, and log the run
 *
 * The invariant worth stating: a row is never left claimed. Every id that
 * comes out of claim_notifications leaves this function in one of those three
 * states, so nothing can quietly disappear into a half-run.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { type Claimed, renderDigest, renderItem } from './templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFICATION_FROM = Deno.env.get('NOTIFICATION_FROM') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://testerpool.dev').replace(/\/+$/, '');

const MAX_ATTEMPTS = 5;
const DEFAULT_LIMIT = 100;
const QUIET_HOURS = 20;
/** Resend's free tier allows two requests a second. Stay under it. */
const SEND_SPACING_MS = 120;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Length-independent comparison, so a wrong token leaks nothing by timing. */
function secretsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

/**
 * The endpoint has verify_jwt off, because pg_cron cannot mint a JWT. It
 * therefore has to check the caller itself: the service role key, the
 * CRON_SECRET environment variable, or the `cron_secret` stored in Vault,
 * which is what the scheduled job sends. Nothing else gets in, including a
 * logged-in user's own token.
 */
async function authorised(req: Request): Promise<boolean> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  if (secretsMatch(token, SERVICE_KEY)) return true;
  if (CRON_SECRET && secretsMatch(token, CRON_SECRET)) return true;
  const { data, error } = await db.rpc('cron_secret_matches', { p_token: token });
  if (error) console.error('cron_secret_matches failed', error.message);
  return data === true;
}

type Settle = { sent: number[]; failed: Array<{ ids: number[]; error: string }>; released: number[] };

Deno.serve(async (req: Request) => {
  const started = Date.now();

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405);
  }
  if (!(await authorised(req))) {
    return json({ error: 'unauthorised' }, 401);
  }

  let body: { limit?: number; dry_run?: boolean } = {};
  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }
  const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_LIMIT, 1), 500);
  const forcedDryRun = body.dry_run === true;

  // ---- 1. Claim -----------------------------------------------------------
  const { data: claimed, error: claimError } = await db.rpc('claim_notifications', {
    p_limit: limit,
    p_max_attempts: MAX_ATTEMPTS,
    p_quiet_hours: QUIET_HOURS,
  });

  if (claimError) {
    await db.rpc('log_job_run', {
      p_job: 'send_notifications',
      p_ok: false,
      p_detail: { error: claimError.message },
      p_duration_ms: Date.now() - started,
    });
    return json({ error: 'claim_failed', detail: claimError.message }, 500);
  }

  const rows = (claimed ?? []) as Claimed[];
  if (rows.length === 0) {
    await db.rpc('log_job_run', {
      p_job: 'send_notifications',
      p_ok: true,
      p_detail: { claimed: 0, sent: 0, note: 'outbox empty' },
      p_duration_ms: Date.now() - started,
    });
    return json({ ok: true, claimed: 0, sent: 0, note: 'Nothing due.' });
  }

  const settle: Settle = { sent: [], failed: [], released: [] };

  // ---- 2. Collapse exact duplicates ---------------------------------------
  // Two rows for the same person and kind are usually two different apps, and
  // both belong in the digest. Two rows describing the same event are a bug
  // upstream; the reader should see it once. dedupe_key normally prevents
  // this — this is the second lock on the same door.
  const seen = new Set<string>();
  const duplicates: number[] = [];
  const live: Claimed[] = [];
  for (const r of rows) {
    const c = { ...(r.context ?? {}), ...(r.payload ?? {}) } as Record<string, unknown>;
    const signature = [
      r.user_id,
      r.kind,
      c.assignment_id ?? c.app_id ?? c.pod_id ?? '',
      c.day ?? '',
    ].join('|');
    if (seen.has(signature)) duplicates.push(r.id);
    else {
      seen.add(signature);
      live.push(r);
    }
  }

  // ---- 3. One digest per person -------------------------------------------
  const byUser = new Map<string, Claimed[]>();
  for (const r of live) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  const undeliverable: number[] = [];
  const digests: Array<{ to: string; ids: number[]; subject: string; html: string; text: string }> = [];

  for (const [, list] of byUser) {
    const to = (list[0].email ?? '').trim();
    const ids = list.map((r) => r.id);
    if (!to || !to.includes('@')) {
      undeliverable.push(...ids);
      continue;
    }
    const items = list.map((r) => renderItem(r, SITE_URL));
    const { subject, html, text } = renderDigest(list[0].display_name ?? 'there', items, SITE_URL);
    digests.push({ to, ids, subject, html, text });
  }

  // ---- 4. Delivery, or an honest refusal to pretend ------------------------
  // A missing key is a normal state before launch. The wrong answer is to mark
  // rows sent and lose 280 reminders silently; the right one is to describe
  // exactly what would have gone out, hand the attempts back, and let the next
  // run send for real once the key exists.
  const missing: string[] = [];
  if (!RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!NOTIFICATION_FROM) missing.push('NOTIFICATION_FROM');
  const dryRun = forcedDryRun || missing.length > 0;

  if (dryRun) {
    const allIds = rows.map((r) => r.id);
    await db.rpc('release_notifications', { p_ids: allIds });

    for (const d of digests) {
      console.log(JSON.stringify({
        dry_run: true, to: d.to, subject: d.subject,
        rows: d.ids, preview: d.text.slice(0, 400),
      }));
    }

    const summary = {
      ok: true,
      dry_run: true,
      delivery: 'unconfigured' as const,
      missing_env: missing,
      message: missing.length > 0
        ? `No email was sent. ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set on this function, so delivery is not configured. All claimed rows remain unsent and will be picked up again once it is.`
        : 'Dry run requested. No email was sent and all claimed rows remain unsent.',
      claimed: rows.length,
      would_send_emails: digests.length,
      would_cover_rows: digests.reduce((n, d) => n + d.ids.length, 0),
      undeliverable_rows: undeliverable.length,
      duplicate_rows_collapsed: duplicates.length,
      by_kind: countKinds(rows),
      sample: digests.slice(0, 3).map((d) => ({
        to: d.to, subject: d.subject, rows: d.ids.length,
      })),
      duration_ms: Date.now() - started,
    };

    await db.rpc('log_job_run', {
      p_job: 'send_notifications',
      p_ok: true,
      p_detail: { ...summary, sample: undefined },
      p_duration_ms: Date.now() - started,
    });
    return json(summary);
  }

  // Exact duplicates were covered by the digest that carried the original, so
  // they are settled as sent rather than left to be re-claimed forever.
  if (duplicates.length > 0) settle.sent.push(...duplicates);
  if (undeliverable.length > 0) {
    settle.failed.push({ ids: undeliverable, error: 'no deliverable email address on profile' });
  }

  let emailsAccepted = 0;
  for (const d of digests) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: NOTIFICATION_FROM,
          to: [d.to],
          subject: d.subject,
          html: d.html,
          text: d.text,
        }),
      });
      if (res.ok) {
        emailsAccepted++;
        settle.sent.push(...d.ids);
      } else {
        const detail = (await res.text()).slice(0, 300);
        settle.failed.push({ ids: d.ids, error: `resend ${res.status}: ${detail}` });
      }
    } catch (e) {
      settle.failed.push({ ids: d.ids, error: `resend request failed: ${String(e).slice(0, 200)}` });
    }
    await new Promise((r) => setTimeout(r, SEND_SPACING_MS));
  }

  // ---- 5. Settle ----------------------------------------------------------
  if (settle.sent.length > 0) {
    await db.rpc('mark_notifications_sent', { p_ids: settle.sent });
  }
  for (const f of settle.failed) {
    await db.rpc('mark_notifications_failed', {
      p_ids: f.ids,
      p_error: f.error,
      p_max_attempts: MAX_ATTEMPTS,
    });
  }

  const failedRows = settle.failed.reduce((n, f) => n + f.ids.length, 0);
  const summary = {
    ok: failedRows === 0,
    dry_run: false,
    delivery: 'resend' as const,
    claimed: rows.length,
    emails_sent: emailsAccepted,
    emails_attempted: digests.length,
    rows_sent: settle.sent.length,
    rows_failed: failedRows,
    duplicate_rows_collapsed: duplicates.length,
    by_kind: countKinds(rows),
    errors: settle.failed.slice(0, 5).map((f) => f.error),
    duration_ms: Date.now() - started,
  };

  await db.rpc('log_job_run', {
    p_job: 'send_notifications',
    p_ok: summary.ok,
    p_detail: summary,
    p_duration_ms: Date.now() - started,
  });

  return json(summary);
});

function countKinds(rows: Claimed[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.kind] = (out[r.kind] ?? 0) + 1;
  return out;
}
