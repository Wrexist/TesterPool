'use client';

/**
 * TESTERPOOL — feature flag toggle.
 *
 * Two of these flags stop the core loop. Turning one off is not a preference
 * change, it is an outage you chose, so the confirmation says so in those
 * words before it will run.
 */

import * as React from 'react';
import { ConfirmAction } from '@/components/admin/confirm';
import { adminSetFlag } from '@/app/(app)/admin/actions';
import { Pill } from '@/components/ui';
import { FLAG_CONSEQUENCE, KILL_SWITCHES } from '@/lib/admin';

export function FlagToggle({
  flagKey,
  enabled,
  description,
}: {
  flagKey: string;
  enabled: boolean;
  description: string | null;
}) {
  const isKillSwitch = KILL_SWITCHES.has(flagKey);
  const consequence = FLAG_CONSEQUENCE[flagKey] ?? 'The effect of this flag is not documented in the UI. Check where it is read before changing it.';
  const next = !enabled;

  return (
    <div className="border-b border-[var(--color-line)] px-4 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-sm font-semibold">{flagKey}</code>
            <Pill tone={enabled ? 'green' : 'neutral'}>{enabled ? 'On' : 'Off'}</Pill>
            {isKillSwitch && <Pill tone="red">Kill switch</Pill>}
          </div>
          {description && <p className="mt-0.5 max-w-2xl text-xs text-[var(--color-dim)]">{description}</p>}
          <p className="mt-1 max-w-2xl text-xs text-[var(--color-mute)]">{consequence}</p>
        </div>

        <div className="shrink-0">
          <ConfirmAction
            compact
            label={enabled ? 'Turn off' : 'Turn on'}
            buttonClass={enabled && isKillSwitch ? 'btn btn-danger' : 'btn btn-secondary'}
            heading={`Turn ${flagKey} ${next ? 'on' : 'off'}`}
            confirmLabel={next ? 'Turn it on' : 'Turn it off'}
            consequences={[
              consequence,
              isKillSwitch && !next
                ? 'This is a kill switch. Turning it off freezes part of the core loop for every user until it is turned back on.'
                : 'The change takes effect on the next request. There is no deploy.',
              'The previous and new state are both written to the audit log with your reason.',
            ]}
            action={(reason) => adminSetFlag(flagKey, next, reason)}
          />
        </div>
      </div>
    </div>
  );
}
