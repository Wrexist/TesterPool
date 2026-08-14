/**
 * TESTERPOOL — the Production Evidence Pack.
 *
 * Google's production-access form asks three free-text questions. Developers
 * routinely fail on the answers rather than the numbers, because they write
 * "I asked friends" instead of describing a structured test. This builds a
 * truthful draft from the data we actually hold — never a claim we cannot
 * evidence, and never a word about store reviews, ratings, or installs.
 */

import { RULES } from '@/lib/economy';
import type { Feedback, ProductionEvidenceRow } from '@/lib/types';
import { fmtDate, n } from '@/lib/format';

export interface EvidenceInput {
  appName: string;
  evidence: ProductionEvidenceRow | null;
  feedback: Pick<Feedback, 'severity' | 'what_broke' | 'suggestion' | 'status'>[];
}

export interface EvidenceAnswer {
  key: 'recruitment' | 'engagement' | 'feedback';
  question: string;
  body: string;
}

function bullets(items: string[], max = 4): string {
  return items
    .filter((t) => (t ?? '').trim().length > 0)
    .slice(0, max)
    .map((t) => `- ${t.trim().replace(/\s+/g, ' ').slice(0, 220)}`)
    .join('\n');
}

export function buildEvidenceAnswers({ appName, evidence, feedback }: EvidenceInput): EvidenceAnswer[] {
  const assigned = n(evidence?.testers_assigned);
  const optedIn = n(evidence?.testers_opted_in);
  const full14 = n(evidence?.testers_full_14);
  const avgDays = n(evidence?.avg_days_active);
  const reports = n(evidence?.feedback_reports);
  const significant = n(evidence?.significant_issues);
  const started = evidence?.test_started ? fmtDate(evidence.test_started) : null;
  const ended = evidence?.test_ends ? fmtDate(evidence.test_ends) : null;
  const window = started && ended ? `from ${started} to ${ended}` : `over ${RULES.requiredDays} consecutive days`;

  const approved = feedback.filter((f) => f.status === 'approved' || f.status === 'arbitrated');
  const breaks = approved.filter((f) => n(f.severity) >= 2).map((f) => f.what_broke ?? '');
  const suggestions = approved.map((f) => f.suggestion ?? '');

  const recruitment = [
    `Testers for ${appName} were recruited through TesterPool, a closed testing network for independent developers. Each tester is a developer who opted in to the closed testing track voluntarily and was matched to this app by category and availability, not by any personal relationship to me.`,
    `${optedIn} tester${optedIn === 1 ? '' : 's'} completed a verified opt-in to the closed testing track out of ${assigned} matched. Every opt-in was evidenced with a screenshot of the tester's confirmed enrolment before any testing activity was counted.`,
    `Recruitment happened entirely inside the closed testing track. No tester was asked to install from production, to rate the app, or to leave a public review, and no incentive of any kind was tied to a store rating or review.`,
  ].join('\n\n');

  const engagement = [
    `The closed test ran ${window} with ${optedIn} opted-in tester${optedIn === 1 ? '' : 's'}. Testers were asked to open and use the app every day and to log a daily check-in.`,
    `Average active days per tester was ${avgDays.toFixed(1)} of ${RULES.requiredDays}. ${full14} tester${full14 === 1 ? '' : 's'} completed the full ${RULES.requiredDays}-day run without a gap. Daily activity is recorded per tester per day, so engagement is continuous rather than a single install event.`,
    `Testers used a range of Android devices and OS versions, recorded on each report. Where a tester dropped out mid-test, a replacement tester was matched so the testerpool stayed above the ${RULES.requiredTesters}-tester threshold for the full period.`,
  ].join('\n\n');

  const feedbackParts = [
    `We collected ${reports} structured feedback report${reports === 1 ? '' : 's'} from testers. Each report scores usability, performance and clarity from 1 to 5 and includes a first impression, what worked, what broke, reproduction steps, severity, and the tester's device and OS version. Reports are private to me as the developer and are never published anywhere.`,
    significant > 0
      ? `${significant} report${significant === 1 ? '' : 's'} flagged a significant or blocking issue.`
      : `No blocking issues were reported during the test window.`,
  ];

  if (breaks.filter(Boolean).length) {
    feedbackParts.push(`Issues raised by testers:\n${bullets(breaks)}`);
  }
  if (suggestions.filter(Boolean).length) {
    feedbackParts.push(`Improvements testers asked for:\n${bullets(suggestions)}`);
  }
  feedbackParts.push(
    `What changed as a result: [replace this line with the specific fixes and releases you shipped during the test — reviewers look for a concrete link between a reported issue and a build you published].`
  );

  return [
    {
      key: 'recruitment',
      question: 'How did you recruit your testers?',
      body: recruitment,
    },
    {
      key: 'engagement',
      question: 'How were your testers engaged during the testing period?',
      body: engagement,
    },
    {
      key: 'feedback',
      question: 'What feedback did you receive, and what did you change?',
      body: feedbackParts.join('\n\n'),
    },
  ];
}

export function evidenceAsText(appName: string, answers: EvidenceAnswer[]): string {
  const header = `Closed testing summary — ${appName}\nPrepared with TesterPool\n`;
  return [header, ...answers.map((a) => `${a.question}\n\n${a.body}`)].join('\n\n---\n\n');
}
