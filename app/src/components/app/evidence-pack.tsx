'use client';

import * as React from 'react';
import { Card, Stat, Pill } from '@/components/ui';
import { CopyButton } from '@/components/app/copy-button';
import { IconCheck, IconAlert } from '@/components/app/icons';
import type { EvidenceAnswer } from '@/lib/evidence';
import { RULES } from '@/lib/economy';

/**
 * The artefact that turns 14 days of activity into an approved application.
 * Numbers on the left are read straight from `production_evidence`; the draft
 * answers are generated from the same rows, so nothing here is a claim the
 * developer cannot back up if a reviewer asks.
 */
export function EvidencePack({
  appName,
  stats,
  answers,
  fullText,
}: {
  appName: string;
  stats: {
    testersOptedIn: number;
    testersFull14: number;
    avgDaysActive: number;
    feedbackReports: number;
    significantIssues: number;
  };
  answers: EvidenceAnswer[];
  fullText: string;
}) {
  const [open, setOpen] = React.useState<string | null>(null);
  const meetsBar = stats.testersOptedIn >= RULES.requiredTesters;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Production Evidence Pack</h2>
            <Pill tone={meetsBar ? 'green' : 'amber'}>
              {meetsBar ? 'Meets the 12-tester bar' : `${RULES.requiredTesters - stats.testersOptedIn} short of 12`}
            </Pill>
          </div>
          <p className="mt-1 max-w-xl text-sm text-[var(--color-dim)]">
            The three answers Google&apos;s production access form asks for, drafted from your real
            closed-testing data. Read them, add your specific fixes, then paste them in.
          </p>
        </div>
        <CopyButton
          value={fullText}
          label="Copy application answers"
          doneLabel="Copied all three answers"
          className="btn btn-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-5">
        <Stat label="Testers opted in" value={<span className="num">{stats.testersOptedIn}</span>} sub={`of ${RULES.requiredTesters} required`} />
        <Stat label="Full 14 days" value={<span className="num">{stats.testersFull14}</span>} sub="no gaps" />
        <Stat label="Avg days active" value={<span className="num">{stats.avgDaysActive.toFixed(1)}</span>} sub={`of ${RULES.requiredDays}`} />
        <Stat label="Feedback reports" value={<span className="num">{stats.feedbackReports}</span>} sub="private to you" />
        <Stat label="Significant issues" value={<span className="num">{stats.significantIssues}</span>} sub="severity 2 and up" />
      </div>

      <div className="border-t border-[var(--color-line)]">
        {answers.map((answer) => {
          const isOpen = open === answer.key;
          return (
            <div key={answer.key} className="border-b border-[var(--color-line)] last:border-b-0">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : answer.key)}
              >
                <span className="text-sm font-medium">{answer.question}</span>
                <span className="ml-auto text-xs text-[var(--color-mute)]">{isOpen ? 'Hide' : 'Read draft'}</span>
              </button>
              {isOpen && (
                <div className="px-5 pb-5">
                  <div className="whitespace-pre-wrap rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4 text-sm leading-relaxed text-[var(--color-dim)]">
                    {answer.body}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <CopyButton value={answer.body} label="Copy this answer" className="btn btn-ghost" size={14} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 bg-[var(--color-surface-2)] px-5 py-3 text-xs text-[var(--color-dim)]">
        {meetsBar ? <IconCheck size={14} className="mt-px shrink-0" /> : <IconAlert size={14} className="mt-px shrink-0" />}
        <p>
          {meetsBar
            ? `${appName} clears the tester count. Reviewers also read the engagement answer closely, so keep the daily check-ins running to the last day.`
            : `Keep the pod running. Applying below 12 verified opt-ins is the most common rejection, and a rejection costs you another 14 days.`}
        </p>
      </div>
    </Card>
  );
}
