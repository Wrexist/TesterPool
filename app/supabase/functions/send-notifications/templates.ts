/**
 * Email copy for every notification kind.
 *
 * House style, from CLAUDE.md: confident and specific, no emoji, no
 * exclamation marks, written for a solo developer who is four weeks behind
 * schedule. Every message answers three questions in its first line — what
 * happened, which app, what to press — because most of these are read on a
 * phone between other things.
 *
 * checkin_due is the volume case: fourteen of them per tester per pod. It has
 * to be readable in the notification shade without opening anything, so the
 * app name and the day number go in the subject.
 */

export type Kind =
  | 'checkin_due' | 'streak_at_risk' | 'streak_broken' | 'pod_started'
  | 'pod_filling' | 'pod_completed' | 'seat_at_risk' | 'rescue_needed'
  | 'feedback_due' | 'feedback_reviewed' | 'dispute_opened' | 'greenlit';

export type Claimed = {
  id: number;
  user_id: string;
  kind: Kind;
  payload: Record<string, unknown> | null;
  attempts: number;
  email: string | null;
  display_name: string | null;
  context: Record<string, unknown> | null;
};

export type Item = {
  subject: string;
  heading: string;
  body: string[];
  cta: { label: string; url: string };
};

const FALLBACK_APP = 'your test app';

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}
function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * One outbox row becomes one block of copy. Everything degrades: a payload
 * that lost its app name still produces a sentence that makes sense, because
 * a vague reminder is better than no reminder.
 */
export function renderItem(n: Claimed, site: string): Item {
  const c = { ...(n.context ?? {}), ...(n.payload ?? {}) } as Record<string, unknown>;
  const app = str(c.app_name, FALLBACK_APP);
  const assignment = str(c.assignment_id);
  const total = num(c.total_days) ?? 14;
  const day = num(c.day);
  const done = num(c.days_done);
  const missed = num(c.missed);
  const checkinUrl = assignment ? `${site}/tests#test-${assignment}` : `${site}/tests`;

  switch (n.kind) {
    case 'checkin_due':
      return {
        subject: day
          ? `${app}: day ${day} of ${total} check-in`
          : `${app}: today's check-in`,
        heading: day ? `Day ${day} of ${total} on ${app}` : `Today's check-in on ${app}`,
        body: [
          `Open ${app} on your device, use it briefly, then log the day. One press, and today is on the record.`,
          `Google Play counts consecutive days across the whole pod. Your day keeps ${total === 14 ? 'the fourteen-day' : `the ${total}-day`} clock intact for everyone testing alongside you.`,
        ],
        cta: { label: 'Log today', url: checkinUrl },
      };

    case 'streak_at_risk':
      return {
        subject: `${app}: ${missed ? `${missed} days` : 'a few days'} without a check-in`,
        heading: `Your run on ${app} is slipping`,
        body: [
          missed
            ? `You have not logged a day on ${app} in ${missed} days. Two missed days is recoverable. Four ends the assignment and the seat goes to a rescue tester.`
            : `You have missed a couple of days on ${app}. Two is recoverable. Four ends the assignment and the seat goes to a rescue tester.`,
          `Logging today stops the countdown. The days you have already banked stay yours either way.`,
        ],
        cta: { label: 'Log today', url: checkinUrl },
      };

    case 'streak_broken':
      return {
        subject: `${app}: your run reset`,
        heading: `The streak on ${app} has ended`,
        body: [
          done
            ? `Four consecutive days without a check-in ended this assignment at ${done} logged days. Those days and the credits attached to them are already yours.`
            : `Four consecutive days without a check-in ended this assignment. The days you logged and the credits attached to them are already yours.`,
          `The developer will be given a rescue tester so their fourteen days are not lost. When you are ready, join a forming pod and start a clean run.`,
        ],
        cta: { label: 'Find a pod', url: `${site}/pods` },
      };

    case 'pod_started': {
      const pod = str(c.pod_name) || str(c.pod_code, 'your pod');
      return {
        subject: `${pod} is live — day 1 of ${total}`,
        heading: `${pod} started`,
        body: [
          `Every seat is filled and the clock is running. Your first task is the opt-in: join each app's closed test through its link, then upload the confirmation screenshot.`,
          `From tomorrow it is one check-in per app per day for ${total} days. Miss four in a row and you lose the seat.`,
        ],
        cta: { label: 'Open your tests', url: `${site}/tests` },
      };
    }

    case 'pod_filling': {
      const filled = num(c.seats_filled);
      const seats = num(c.seats_total);
      const left = filled !== null && seats !== null ? seats - filled : null;
      return {
        subject: left !== null && left > 0
          ? `Your pod needs ${left} more ${left === 1 ? 'developer' : 'developers'}`
          : `Your pod is filling`,
        heading: `Your pod is almost full`,
        body: [
          filled !== null && seats !== null
            ? `${filled} of ${seats} seats are taken. The fourteen days begin the moment the last seat fills.`
            : `Seats are filling. The fourteen days begin the moment the last one is taken.`,
          `If you know another Android developer waiting on production access, your referral link fills a seat and pays you both.`,
        ],
        cta: { label: 'View the pod', url: `${site}/pods` },
      };
    }

    case 'pod_completed':
      return {
        subject: `Pod finished — ${total} days complete`,
        heading: `Your pod has completed`,
        body: [
          `All ${total} days are logged. Escrowed credits for the assignments you finished have been released to your balance, and your reliability score has been recalculated.`,
          `If your own app was in this pod, the readiness page now has the tester count, the date range and the three answers Google asks for in the production access form.`,
        ],
        cta: { label: 'Check readiness', url: `${site}/readiness` },
      };

    case 'seat_at_risk':
      return {
        subject: `${app}: a tester has gone quiet`,
        heading: `One of your testers is behind`,
        body: [
          missed
            ? `A tester on ${app} has not checked in for ${missed} days. Google counts testers who stay opted in for the full run, so a seat that goes dark can cost you the cycle.`
            : `A tester on ${app} has stopped checking in. Google counts testers who stay opted in for the full run, so a seat that goes dark can cost you the cycle.`,
          `They still have time to come back and we have already nudged them. If they drop, a rescue tester can take the seat the same day.`,
        ],
        cta: { label: 'View your pod', url: `${site}/pods` },
      };

    case 'rescue_needed':
      return {
        subject: `${app}: a seat needs filling`,
        heading: `A tester dropped out of ${app}`,
        body: [
          `The seat is empty as of today. Your remaining testers are unaffected, but you are one short of the twelve Google requires.`,
          `A rescue tester can be placed now and will start their own fourteen days. Placing one costs rescue credits and takes a minute.`,
        ],
        cta: { label: 'Request a rescue seat', url: `${site}/pods` },
      };

    case 'feedback_due':
      return {
        subject: `${app}: your report is due`,
        heading: `Time to write up ${app}`,
        body: [
          `You are a week into testing ${app}. Write what you actually found: what broke, what confused you, what you would change. Specific criticism is paid at the same rate as praise, and a developer cannot withhold payment for it.`,
          `Reports take a few minutes and are the part developers remember you for.`,
        ],
        cta: {
          label: 'Write the report',
          url: assignment ? `${site}/tests/${assignment}/feedback` : `${site}/tests`,
        },
      };

    case 'feedback_reviewed':
      return {
        subject: `Your report on ${app} was reviewed`,
        heading: `${app} reviewed your report`,
        body: [
          `The developer has read your report and the credits have settled. You can see the outcome and their response on your feedback page.`,
          `If the report was marked low effort, that does not reject it: a moderator now arbitrates, and you will hear the result.`,
        ],
        cta: { label: 'See the outcome', url: `${site}/feedback` },
      };

    case 'dispute_opened':
      return {
        subject: `A report on ${app} went to moderation`,
        heading: `A report is being arbitrated`,
        body: [
          `A report attached to ${app} has been marked low effort, which opens a moderator review rather than rejecting it. Nobody can withhold payment for critical feedback on their own.`,
          `A moderator will look at both sides. You do not need to do anything unless we ask.`,
        ],
        cta: { label: 'Open the dispute', url: `${site}/feedback` },
      };

    case 'greenlit':
      return {
        subject: `${app} has met the testing requirement`,
        heading: `${app} is ready to apply`,
        body: [
          `Twelve or more testers stayed opted in for the full ${total} days on ${app}. That is the bar Google Play sets before a personal developer account can apply for production access.`,
          `The readiness page has the exact dates, the tester count and drafts of the three answers the form asks for. All of it comes from closed testing tracks, which do not affect store rankings, ratings or public install counts.`,
        ],
        cta: { label: 'Open readiness', url: `${site}/readiness` },
      };

    default:
      return {
        subject: 'An update from TesterPool',
        heading: 'An update on your pod',
        body: ['Something in your pod changed. Open the dashboard for the detail.'],
        cta: { label: 'Open TesterPool', url: `${site}/dashboard` },
      };
  }
}

/**
 * Several rows for one person become one email, never several. A tester in
 * five pods gets five checkin_due rows every morning; five separate emails
 * would be the fastest possible way to teach them to mute us.
 */
export function renderDigest(
  name: string,
  items: Item[],
  site: string,
): { subject: string; html: string; text: string } {
  const first = items[0];
  const subject = items.length === 1
    ? first.subject
    : `${items.length} things to do today: ${items.map((i) => i.subject).join('; ').slice(0, 120)}`;

  const greeting = `Hi ${name.split(' ')[0] || 'there'},`;
  const sign = 'TesterPool';

  const text = [
    greeting,
    '',
    ...items.flatMap((i) => [
      items.length > 1 ? `— ${i.heading}` : i.heading,
      '',
      ...i.body,
      '',
      `${i.cta.label}: ${i.cta.url}`,
      '',
    ]),
    `${sign}`,
    `Manage what we send you: ${site}/dashboard`,
  ].join('\n');

  const blocks = items.map((i) => `
      <tr><td style="padding:0 0 28px 0">
        <h2 style="margin:0 0 8px 0;font-size:17px;line-height:1.35;font-weight:600;color:#0f1115">${esc(i.heading)}</h2>
        ${i.body.map((p) => `<p style="margin:0 0 10px 0;font-size:15px;line-height:1.55;color:#3d434e">${esc(p)}</p>`).join('')}
        <a href="${esc(i.cta.url)}" style="display:inline-block;margin-top:6px;padding:10px 18px;border-radius:8px;background:#0f1115;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${esc(i.cta.label)}</a>
      </td></tr>`).join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(items.map((i) => i.heading).join(' · '))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e5e2;border-radius:14px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <tr><td style="padding:0 0 20px 0">
          <span style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280">TesterPool</span>
        </td></tr>
        <tr><td style="padding:0 0 20px 0"><p style="margin:0;font-size:15px;color:#3d434e">${esc(greeting)}</p></td></tr>
        ${blocks}
        <tr><td style="border-top:1px solid #eeedea;padding:18px 0 0 0">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8f98">
            You are getting this because you are testing in a TesterPool pod. All activity happens inside closed testing tracks, which do not affect store rankings, ratings or public install counts.
            <br><a href="${esc(site)}/dashboard" style="color:#8a8f98">Manage what we send you</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}
