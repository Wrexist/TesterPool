/**
 * TESTERPOOL — feature flags.
 *
 * Mirrors the `feature_flags` table (key, enabled, description, updated_at),
 * which is world-readable by design so the public login screen can decide
 * which sign-in providers to offer without a session.
 *
 * Server-side only. The whole point is that a flag read must never be able to
 * break login, so every failure path falls back to `FLAG_DEFAULTS`.
 */
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * The defaults used when the table is unreachable, empty, or missing a key.
 *
 * The two provider flags fail closed: if we cannot confirm that Apple or
 * GitHub is configured, we would rather show two working buttons than three
 * where one dead-ends in Supabase's "provider is not enabled" error.
 *
 * `signups_open` fails open: it only ever adds a notice to the page, and a
 * transient database blip should not make the product look closed.
 */
export const FLAG_DEFAULTS = {
  apple_login: false,
  github_login: false,
  signups_open: true,
  /**
   * Whether a developer may join or start a pod today.
   *
   * This is the flag `join_pod` and `start_pod` already enforce inside the
   * database, which is why the pods screen reads it rather than a second flag
   * of its own: a gate the UI keeps and the RPC does not is not a gate, and
   * every RPC here is reachable over REST.
   *
   * Turn it off in /admin/flags to put pods in their Upcoming state — the
   * button and the RPC move together. Pods already in flight keep running, and
   * the cron keeps advancing them either way.
   *
   * Defaults true to match the RPC, which treats a missing row as open. The
   * flag row is the source of truth; this constant only covers an unreachable
   * database, and in that case a join fails on its own merits rather than
   * because a flag read failed.
   */
  pod_matching: true,
  /**
   * Whether a member may start a one-off activity: join an app's closed test,
   * use it, file one report, be paid the same 10 + 30 a pod seat pays.
   *
   * Same rule as `pod_matching` — `start_activity` enforces this flag inside
   * the database and `market_apps` computes `activity_open` from it, so the
   * button, the row and the RPC all move together. Turning it off leaves work
   * already started running; only new activities stop.
   *
   * Defaults true to match the RPC, which treats a missing row as open.
   */
  activities: true,
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

/** Known keys are guaranteed present; unknown keys are readable but optional. */
export type Flags = Record<FlagKey, boolean> & Record<string, boolean>;

type FlagRow = { key: string; enabled: boolean | null };

/**
 * Reads every flag. Deduplicated per request by `cache`, so a layout and a
 * page can both call it without a second round trip.
 */
export const getFlags = cache(async function getFlags(): Promise<Flags> {
  const flags: Flags = { ...FLAG_DEFAULTS };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('feature_flags')
      .select('key, enabled')
      .returns<FlagRow[]>();

    if (error || !data) return flags;

    for (const row of data) {
      if (typeof row.key === 'string' && row.key.length > 0) {
        flags[row.key] = row.enabled === true;
      }
    }
  } catch {
    // Network, cookie or configuration failure. Defaults stand; login works.
  }

  return flags;
});

/** Reads a single flag, falling back to its default (or `false` if unknown). */
export async function getFlag(key: string): Promise<boolean> {
  const flags = await getFlags();
  const value = flags[key];
  return typeof value === 'boolean' ? value : false;
}
