import 'server-only';

/**
 * TESTERPOOL — calling the vision triage function from the server.
 *
 * `triage-proof` runs as an edge function and authorises with the service-role
 * key, which bypasses RLS entirely. That key must never reach a browser, so
 * this module is `server-only`: importing it from a client component is a build
 * error rather than a silent leak.
 *
 * Every failure here is deliberately quiet and deliberately *closed*. A proof
 * whose triage did not run stays 'pending', which means a human looks at it.
 * The worst outcome of an outage is a slow approval; there is no path through
 * this file that approves anything by accident.
 */

const FUNCTIONS_URL =
  process.env.SUPABASE_FUNCTIONS_URL ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')}/functions/v1`
    : '');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/**
 * How long to wait before giving up and letting the sweep handle it.
 *
 * A vision call on a phone screenshot usually lands in three or four seconds.
 * Twelve is generous enough that the common case resolves while the user is
 * still looking at the screen, and short enough that a hung model does not hold
 * a Server Action open until the platform kills it.
 */
const TIMEOUT_MS = 12_000;

export interface TriageOutcome {
  /** What the proof ended up as. 'pending' covers every failure path. */
  status: 'pending' | 'auto_approved' | 'escalated' | 'approved' | 'rejected';
  /** Copy for the uploader. Never mentions the model, the key, or the reason it broke. */
  message: string;
  /** True only when triage actually produced a verdict. For logging, not for UI. */
  ran: boolean;
}

const QUEUED: TriageOutcome = {
  status: 'pending',
  ran: false,
  message: 'Uploaded. A moderator confirms this within a few hours, and your fourteen days start from the moment they do.',
};

/**
 * Asks the vision model about one proof and reports what it decided.
 *
 * Never throws and never approves: every failure returns {@link QUEUED}, which
 * leaves the proof pending for a human.
 */
export async function triageProof(proofId: string): Promise<TriageOutcome> {
  if (!FUNCTIONS_URL || !SERVICE_KEY) return QUEUED;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${FUNCTIONS_URL}/triage-proof`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ proof_id: proofId }),
      signal: abort.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`triage-proof ${res.status} for proof ${proofId}`);
      return QUEUED;
    }

    const body = (await res.json()) as {
      ok?: boolean;
      status?: string;
      matches?: boolean;
      confidence?: number;
      observed?: string;
    };

    if (!body.ok) return QUEUED;

    switch (body.status) {
      case 'auto_approved':
        return {
          status: 'auto_approved',
          ran: true,
          message: 'Opt-in verified. Your daily check-ins start now.',
        };
      case 'escalated':
        // Said plainly, without accusing anyone: the honest explanation for a
        // duplicate is usually two people photographing the same shared screen,
        // and the person who did nothing wrong deserves to know what happened.
        return {
          status: 'escalated',
          ran: true,
          message: 'Uploaded, and held for a moderator — this image matches one another account already sent. If that is a surprise, take a fresh screenshot and it will clear.',
        };
      default:
        return {
          status: 'pending',
          ran: true,
          message: body.matches === false
            ? 'Uploaded, but this does not look like the Play opt-in confirmation. A moderator will check — a screenshot of the "You are a tester" screen clears fastest.'
            : QUEUED.message,
        };
    }
  } catch (err) {
    // Timeout, DNS, a cold function, a bad deploy. All the same answer to the
    // user; not the same thing to whoever has to work out why it is slow.
    const name = err instanceof Error ? err.name : 'unknown';
    console.error(`triage-proof ${name} for proof ${proofId}`);
    return QUEUED;
  } finally {
    clearTimeout(timer);
  }
}
