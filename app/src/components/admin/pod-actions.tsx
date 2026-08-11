'use client';

/**
 * TESTERPOOL — pod interventions.
 *
 * Every one of these changes the plan for roughly fifteen people at once, so
 * each confirmation names the number of people affected rather than the number
 * of rows updated.
 */

import * as React from 'react';
import { ConfirmAction } from '@/components/admin/confirm';
import { adminPodAction } from '@/app/(app)/admin/actions';

export function PodActions({
  podId,
  podLabel,
  status,
  members,
  dayIndex,
  duration,
}: {
  podId: string;
  podLabel: string;
  status: string;
  members: number;
  dayIndex: number;
  duration: number;
}) {
  const [days, setDays] = React.useState('3');
  const parsedDays = Number.parseInt(days, 10);
  const validDays = Number.isInteger(parsedDays) && parsedDays > 0;

  const started = status === 'active';
  const closed = status === 'completed' || status === 'failed';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-2">
        <ConfirmAction
          label="Force start"
          heading={`Force start ${podLabel}`}
          confirmLabel="Start the clock now"
          disabled={started || closed}
          disabledHint={started ? 'This pod is already running.' : closed ? 'This pod is closed.' : undefined}
          consequences={[
            `Day 1 of ${duration} begins immediately for all ${members} members.`,
            'Assignments are created between every member and every other member\'s app, bypassing the usual membership check.',
            'Everyone has a check-in due today. Anyone not expecting to start will miss day 1 and break their streak.',
            'Apps in this pod move to in_pod status.',
          ]}
          action={(reason) => adminPodAction(podId, 'force_start', null, reason)}
        />

        <ConfirmAction
          label="Extend"
          heading={`Extend ${podLabel} by ${validDays ? parsedDays : 0} days`}
          confirmLabel="Extend the pod"
          disabled={closed || !validDays}
          disabledHint={closed ? 'This pod is closed.' : !validDays ? 'Enter a positive number of days.' : undefined}
          consequences={[
            `Duration goes from ${duration} to ${duration + (validDays ? parsedDays : 0)} days, and the end date moves with it.`,
            `All ${members} members now finish later than the date they planned around.`,
            'Testers who had already completed 14 days still hold their streak; the extra days are additional expectation, not a reset.',
            'This does not extend anyone\'s Google Play window. It only extends this pod.',
          ]}
          fields={
            <div className="max-w-[160px]">
              <label className="label" htmlFor={`days-${podId}`}>Days to add</label>
              <input
                id={`days-${podId}`}
                className="input num"
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          }
          action={(reason) => adminPodAction(podId, 'extend', parsedDays, reason)}
        />

        <ConfirmAction
          label="Mark complete"
          heading={`Mark ${podLabel} complete`}
          confirmLabel="Mark it complete"
          disabled={closed}
          disabledHint={closed ? 'This pod is closed.' : undefined}
          consequences={[
            `All active members are graduated and their completed-pod counts go up by one.`,
            dayIndex < duration
              ? `The pod is on day ${dayIndex} of ${duration}. Completing early records a full cycle for testers who did not serve one, which weakens the evidence pack for every app in it.`
              : 'The pod has served its full duration.',
            'This cannot be undone by another action on this screen.',
          ]}
          action={(reason) => adminPodAction(podId, 'complete', null, reason)}
        />

        <ConfirmAction
          label="Cancel"
          buttonClass="btn btn-danger"
          heading={`Cancel ${podLabel}`}
          confirmLabel="Cancel this pod"
          disabled={closed}
          disabledHint={closed ? 'This pod is closed.' : undefined}
          consequences={[
            'The pod is marked failed.',
            'Every app in it returns to the queue and has to wait for a new pod to form.',
            started
              ? `The ${members} members lose the ${dayIndex} days they have already served. Their 14-day clocks start again from zero in the next pod.`
              : 'No days are lost because the pod has not started.',
            'Use this when the pod cannot recover. Extending is usually the smaller harm.',
          ]}
          action={(reason) => adminPodAction(podId, 'cancel', null, reason)}
        />
      </div>
    </div>
  );
}
