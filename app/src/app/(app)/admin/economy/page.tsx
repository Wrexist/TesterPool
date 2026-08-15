import * as React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, EmptyState, Stat } from '@/components/ui';
import { Section, DiffView, WarnBox } from '@/components/admin/parts';
import { ConfigEditor } from '@/components/admin/config-editor';
import { fmtDateTime } from '@/lib/format';
import { CONFIG_GROUPS, deriveEconomy, type ConfigMap } from '@/lib/admin-economy';
import { num, type AdminActionRow, type EconomyConfigRow } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminEconomyPage() {
  const supabase = await createClient();

  const [{ data: configRows, error }, { data: auditRows }, { data: actorRows }] = await Promise.all([
    supabase.from('economy_config').select('key, value, note').order('key'),
    supabase
      .from('admin_actions')
      .select('*')
      .eq('action', 'set_config')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('profiles').select('id, handle').eq('role', 'admin').limit(50),
  ]);

  const rows = (configRows ?? []) as EconomyConfigRow[];
  const config: ConfigMap = {};
  for (const row of rows) config[row.key] = num(row.value);

  const derived = deriveEconomy(config);
  const audit = (auditRows ?? []) as AdminActionRow[];
  const actors = new Map<string, string>(
    ((actorRows ?? []) as { id: string; handle: string }[]).map((a) => [a.id, a.handle])
  );

  const known = new Set(CONFIG_GROUPS.flatMap((g) => g.keys));
  const ungrouped = rows.filter((r) => !known.has(r.key));

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Where the economy stands"
        note="Derived from the live config rows. These are the numbers every change below moves."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Full cycle earns"
            value={derived.fullCycle}
            sub="opt-in + 14 check-ins + feedback + streak"
          />
          <Stat
            label="Buffer seat costs"
            value={`${derived.cyclesPerBuffer.toFixed(2)}×`}
            sub="cycles of honest tester work"
            tone={derived.cyclesPerBuffer < 1 ? 'var(--color-danger)' : undefined}
          />
          <Stat
            label="Signup grant buys"
            value={`${derived.freeBufferSeats.toFixed(2)}×`}
            sub="buffer seats, before any work"
            tone={derived.freeBufferSeats >= 1.5 ? 'var(--color-danger)' : undefined}
          />
          <Stat
            label="Earning ceiling"
            value={derived.maxCycleEarnings}
            sub="per 14 days at full concurrency"
          />
        </div>

        {derived.rescuePremium <= 0 && (
          <div className="mt-3">
            <WarnBox tone="red">
              A rescue seat currently costs no more than a buffer seat. Rescues are mid-cycle emergencies and
              have to stay the expensive option, or nobody buys a buffer in advance.
            </WarnBox>
          </div>
        )}
      </Section>

      {error && <WarnBox tone="red">Could not read economy_config: {error.message}</WarnBox>}

      {rows.length === 0 ? (
        <EmptyState
          title="No economy config rows"
          body="economy_config came back empty. Nothing can be tuned until the table is seeded."
        />
      ) : (
        CONFIG_GROUPS.map((group) => {
          const groupRows = group.keys
            .map((key) => rows.find((r) => r.key === key))
            .filter((r): r is EconomyConfigRow => !!r);
          if (groupRows.length === 0) return null;

          return (
            <Section key={group.title} title={group.title} note={group.note}>
              <Card className="overflow-hidden">
                {groupRows.map((row) => (
                  <ConfigEditor
                    key={row.key}
                    configKey={row.key}
                    value={num(row.value)}
                    note={row.note}
                    config={config}
                  />
                ))}
              </Card>
            </Section>
          );
        })
      )}

      {ungrouped.length > 0 && (
        <Section title="Other keys" note="Config rows added since this page was written.">
          <Card className="overflow-hidden">
            {ungrouped.map((row) => (
              <ConfigEditor
                key={row.key}
                configKey={row.key}
                value={num(row.value)}
                note={row.note}
                config={config}
              />
            ))}
          </Card>
        </Section>
      )}

      <Section
        title="Recent economy changes"
        note="Read straight from the audit log. If a rate looks wrong, this is where it changed."
      >
        {audit.length === 0 ? (
          <Card className="px-4 py-6">
            <p className="text-sm text-[var(--color-mute)]">
              No economy change has been recorded yet. The rates are as seeded.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            {audit.map((entry) => (
              <div key={entry.id} className="border-b border-[var(--color-line)] px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="amber">set_config</Pill>
                  <span className="text-xs text-[var(--color-dim)]">
                    @{entry.actor_id ? actors.get(entry.actor_id) ?? 'unknown admin' : 'unknown admin'}
                  </span>
                  <span className="text-xs text-[var(--color-mute)]">{fmtDateTime(entry.created_at)}</span>
                </div>
                <div className="mt-1.5">
                  <DiffView before={entry.before} after={entry.after} />
                </div>
                {entry.reason && (
                  <p className="mt-1 text-xs text-[var(--color-mute)]">Reason: {entry.reason}</p>
                )}
              </div>
            ))}
          </Card>
        )}
      </Section>
    </div>
  );
}
