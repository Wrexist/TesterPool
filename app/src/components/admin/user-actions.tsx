'use client';

/**
 * TESTERPOOL — the three things an admin can do to an account.
 *
 * Each one restates the consequence with the real numbers before it will run,
 * and each surfaces the database's own refusal text — "you cannot ban
 * yourself" is more useful than "that did not work".
 */

import * as React from 'react';
import { ConfirmAction } from '@/components/admin/confirm';
import { adminAdjustCredits, adminSetBan, adminSetRole } from '@/app/(app)/admin/actions';
import { ROLE_COPY, type UserRole } from '@/lib/admin';

const ROLES: UserRole[] = ['user', 'moderator', 'admin'];

export function UserActions({
  userId,
  handle,
  credits,
  role,
  isBanned,
  isSelf,
}: {
  userId: string;
  handle: string;
  credits: number;
  role: UserRole;
  isBanned: boolean;
  isSelf: boolean;
}) {
  const [delta, setDelta] = React.useState('');
  const [nextRole, setNextRole] = React.useState<UserRole>(role);

  const parsedDelta = Number.parseInt(delta, 10);
  const validDelta = Number.isInteger(parsedDelta) && parsedDelta !== 0;
  const projected = validDelta ? Math.max(0, credits + parsedDelta) : credits;

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------- credits */}
      <div>
        <h4 className="text-sm font-semibold">Adjust credits</h4>
        <p className="mt-0.5 text-xs text-[var(--color-mute)]">
          Writes an <code className="text-[var(--color-dim)]">admin_adjust</code> row to the append-only
          ledger. Balances are never edited directly.
        </p>
        <div className="mt-2 max-w-xs">
          <label className="label" htmlFor={`delta-${userId}`}>Signed amount</label>
          <input
            id={`delta-${userId}`}
            className="input num"
            inputMode="numeric"
            value={delta}
            onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ''))}
            placeholder="e.g. 40 or -120"
          />
        </div>
        <div className="mt-2">
          <ConfirmAction
            label={validDelta && parsedDelta < 0 ? 'Remove credits' : 'Grant credits'}
            buttonClass={validDelta && parsedDelta < 0 ? 'btn btn-danger' : 'btn btn-secondary'}
            heading={`${parsedDelta > 0 ? 'Grant' : 'Remove'} ${Math.abs(parsedDelta || 0)} credits to @${handle}`}
            confirmLabel="Write the ledger entry"
            disabled={!validDelta}
            disabledHint={!validDelta ? 'Enter a whole, non-zero amount first.' : undefined}
            consequences={[
              `Balance moves from ${credits} to ${projected}.`,
              parsedDelta < 0 && credits + parsedDelta < 0
                ? 'The balance floors at zero, so the removal will be partial.'
                : 'The ledger entry is permanent and visible to the user on their credits page.',
              'The reason you write is stored in the audit log against your account.',
            ].filter(Boolean) as string[]}
            action={(reason) => adminAdjustCredits(userId, parsedDelta, reason)}
            onDone={() => setDelta('')}
          />
        </div>
      </div>

      {/* ---------------------------------------------------------- role */}
      <div className="border-t border-[var(--color-line)] pt-4">
        <h4 className="text-sm font-semibold">Role</h4>
        <p className="mt-0.5 text-xs text-[var(--color-mute)]">{ROLE_COPY[nextRole].note}</p>
        <div className="mt-2 max-w-xs">
          <label className="label" htmlFor={`role-${userId}`}>New role</label>
          <select
            id={`role-${userId}`}
            className="input"
            value={nextRole}
            onChange={(e) => setNextRole(e.target.value as UserRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_COPY[r].label}</option>
            ))}
          </select>
        </div>
        <div className="mt-2">
          <ConfirmAction
            label="Change role"
            heading={`Set @${handle} from ${ROLE_COPY[role].label} to ${ROLE_COPY[nextRole].label}`}
            confirmLabel="Change the role"
            disabled={nextRole === role}
            disabledHint={nextRole === role ? 'Pick a different role first.' : undefined}
            consequences={[
              ROLE_COPY[nextRole].note,
              nextRole === 'admin'
                ? 'They will be able to move credits, ban accounts and retune the economy.'
                : 'Moderator access is kept in sync with the role by a database trigger.',
              isSelf
                ? 'This is your own account. The database refuses a self-demotion, so the only change that will succeed here is one that does not reduce your access.'
                : 'The change takes effect on their next request.',
            ]}
            action={(reason) => adminSetRole(userId, nextRole, reason)}
          />
        </div>
      </div>

      {/* ----------------------------------------------------------- ban */}
      <div className="border-t border-[var(--color-line)] pt-4">
        <h4 className="text-sm font-semibold">{isBanned ? 'Ban status' : 'Ban account'}</h4>
        <p className="mt-0.5 text-xs text-[var(--color-mute)]">
          {isBanned
            ? 'Lifting a ban restores sign-in. It does not give them back the seats they were removed from.'
            : 'A ban drops every seat they hold, which means the developers they were testing for need replacements today.'}
        </p>
        <div className="mt-2">
          {isBanned ? (
            <ConfirmAction
              label="Lift ban"
              buttonClass="btn btn-secondary"
              heading={`Lift the ban on @${handle}`}
              confirmLabel="Lift the ban"
              disabled={isSelf}
              disabledHint={isSelf ? 'The database refuses ban changes on your own account.' : undefined}
              consequences={[
                'They can sign in again immediately.',
                'Seats they held are not restored. They start again like a new member.',
                'The stored ban reason is cleared.',
              ]}
              action={(reason) => adminSetBan(userId, false, reason)}
            />
          ) : (
            <ConfirmAction
              label="Ban account"
              buttonClass="btn btn-danger"
              heading={`Ban @${handle}`}
              confirmLabel="Ban this account"
              disabled={isSelf}
              disabledHint={isSelf ? 'The database refuses a self-ban.' : undefined}
              consequences={[
                'Every seat they currently hold is dropped.',
                'Every active or pending assignment they hold is dropped, so the apps they were testing lose a tester mid-cycle.',
                'The developers relying on those seats will need rescue testers.',
                'The reason is stored on their profile and in the audit log.',
              ]}
              action={(reason) => adminSetBan(userId, true, reason)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
