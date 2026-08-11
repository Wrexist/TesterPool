import * as React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, EmptyState } from '@/components/ui';
import { Section, WarnBox, AnnouncementBanner } from '@/components/admin/parts';
import { FlagToggle } from '@/components/admin/flag-toggle';
import { AnnouncementComposer, AnnouncementRetire } from '@/components/admin/announcement-composer';
import { fmtDateTime, fmtRelative } from '@/lib/pods';
import { KILL_SWITCHES, toneOf, type AnnouncementRow, type FeatureFlagRow } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminFlagsPage() {
  const supabase = await createClient();

  const [{ data: flagRows, error: flagError }, { data: announcementRows }] = await Promise.all([
    supabase.from('feature_flags').select('*').order('key'),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(30),
  ]);

  const flags = (flagRows ?? []) as FeatureFlagRow[];
  const announcements = (announcementRows ?? []) as AnnouncementRow[];

  const killSwitches = flags.filter((f) => KILL_SWITCHES.has(f.key));
  const rest = flags.filter((f) => !KILL_SWITCHES.has(f.key));
  const disabledKillSwitches = killSwitches.filter((f) => !f.enabled);

  return (
    <div className="flex flex-col gap-8">
      {disabledKillSwitches.length > 0 && (
        <WarnBox tone="red">
          {disabledKillSwitches.map((f) => f.key).join(' and ')}{' '}
          {disabledKillSwitches.length === 1 ? 'is' : 'are'} currently off. Part of the core loop is frozen
          for every user right now.
        </WarnBox>
      )}

      <Section
        title="Kill switches"
        note="These two stop the product working. Nothing else on this page has that reach."
      >
        {flagError && <WarnBox tone="red">Could not read feature_flags: {flagError.message}</WarnBox>}
        {killSwitches.length === 0 ? (
          <Card className="px-4 py-5">
            <p className="text-sm text-[var(--color-mute)]">
              Neither pod_matching nor checkins_open exists in feature_flags. Nothing here to freeze.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden" style={{ borderColor: 'color-mix(in oklab, var(--color-danger) 30%, transparent)' }}>
            {killSwitches.map((flag) => (
              <FlagToggle key={flag.key} flagKey={flag.key} enabled={flag.enabled} description={flag.description} />
            ))}
          </Card>
        )}
      </Section>

      <Section
        title="Feature flags"
        note="Read on every request. A toggle here takes effect immediately and needs no deploy."
      >
        {rest.length === 0 ? (
          <EmptyState title="No feature flags" body="feature_flags came back empty. Nothing to toggle." />
        ) : (
          <Card className="overflow-hidden">
            {rest.map((flag) => (
              <FlagToggle key={flag.key} flagKey={flag.key} enabled={flag.enabled} description={flag.description} />
            ))}
          </Card>
        )}
        {flags.length > 0 && (
          <p className="mt-2 text-xs text-[var(--color-mute)]">
            Last change {fmtRelative(flags.map((f) => f.updated_at).filter(Boolean).sort().reverse()[0])}.
          </p>
        )}
      </Section>

      <Section
        title="New announcement"
        note="Shown to every signed-in user until it is retired. Say what is happening and what they should do about it."
      >
        <Card className="p-5">
          <AnnouncementComposer />
        </Card>
      </Section>

      <Section
        title="Announcements"
        note="Retiring an announcement hides it. The row stays, so the record of what was said and when survives."
      >
        {announcements.length === 0 ? (
          <EmptyState
            title="Nothing announced"
            body="No announcement has been published. Users see an unbroken dashboard, which is the right default."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {announcements.map((row) => (
              <Card key={row.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Pill tone={row.active ? 'green' : 'neutral'}>{row.active ? 'Live' : 'Retired'}</Pill>
                  <span className="text-xs text-[var(--color-mute)]">{fmtDateTime(row.created_at)}</span>
                  <span className="ml-auto">
                    <AnnouncementRetire id={row.id} active={row.active} />
                  </span>
                </div>
                <AnnouncementBanner body={row.body} tone={toneOf(row.tone)} />
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
