'use client';

/**
 * TESTERPOOL — live economy tuning, one row at a time.
 *
 * The point of this control is the preview, not the input. Typing a number into
 * `daily_checkin` changes what a buffer seat costs in human effort, and the
 * only honest way to make that decision is to see the second-order number
 * before saving. Every figure below is computed from the other live config
 * rows, not written down.
 */

import * as React from 'react';
import { ConfirmAction } from '@/components/admin/confirm';
import { adminSetConfig } from '@/app/(app)/admin/actions';
import { configImpact, type ConfigMap, type WarningLevel } from '@/lib/admin-economy';
import { cx } from '@/components/ui';

const WARN_COLOUR: Record<WarningLevel, string> = {
  danger: 'var(--color-danger)',
  caution: 'var(--color-credit)',
  note: 'var(--color-dim)',
};

export function ConfigEditor({
  configKey,
  value,
  note,
  config,
}: {
  configKey: string;
  value: number;
  note: string | null;
  config: ConfigMap;
}) {
  const [draft, setDraft] = React.useState(String(value));
  const parsed = Number.parseInt(draft, 10);
  const valid = Number.isInteger(parsed) && parsed >= 0;
  const changed = valid && parsed !== value;

  const impact = React.useMemo(
    () => (changed ? configImpact(config, configKey, parsed) : null),
    [changed, config, configKey, parsed]
  );

  return (
    <div className="border-b border-[var(--color-line)] px-4 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <code className="text-sm font-semibold">{configKey}</code>
            <span className="num text-xs text-[var(--color-mute)]">now {value}</span>
          </div>
          {note && <p className="mt-0.5 max-w-2xl text-xs text-[var(--color-dim)]">{note}</p>}
        </div>

        <div className="w-[120px] shrink-0">
          <label className="label" htmlFor={`cfg-${configKey}`}>New value</label>
          <input
            id={`cfg-${configKey}`}
            className="input num"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>

      {!valid && draft !== '' && (
        <p className="mt-2 text-xs text-[var(--color-danger)]">
          Economy values are whole numbers of credits and cannot be negative.
        </p>
      )}

      {impact && (
        <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
          <p className="text-xs font-semibold text-[var(--color-ink)]">{impact.headline}</p>

          <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {impact.lines.map((line) => (
              <div
                key={line.label}
                className={cx('flex flex-wrap items-baseline gap-x-2 text-xs', !line.changed && 'opacity-45')}
              >
                <dt className="text-[var(--color-mute)]">{line.label}</dt>
                <dd className="flex items-baseline gap-1.5">
                  <span className="num text-[var(--color-mute)]">{line.before}</span>
                  <span aria-hidden className="text-[var(--color-mute)]">&rarr;</span>
                  <span
                    className="num font-semibold"
                    style={{ color: line.changed ? 'var(--color-ink)' : 'var(--color-mute)' }}
                  >
                    {line.after}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          {impact.warnings.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1 border-t border-[var(--color-line)] pt-2.5">
              {impact.warnings.map((warning, i) => (
                <li key={i} className="text-xs" style={{ color: WARN_COLOUR[warning.level] }}>
                  {warning.text}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3">
            <ConfirmAction
              compact
              label={`Save ${configKey}`}
              heading={`Set ${configKey} to ${parsed}`}
              confirmLabel="Apply to the live economy"
              consequences={[
                impact.headline,
                'This takes effect on the next credit movement. There is no deploy and no cache to clear.',
                'People mid-cycle finish on the new rate, so the change is retroactive in effect if not in the ledger.',
                'The old and new values are both written to the audit log.',
              ]}
              action={(reason) => adminSetConfig(configKey, parsed, reason)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
