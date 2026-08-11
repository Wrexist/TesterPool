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
