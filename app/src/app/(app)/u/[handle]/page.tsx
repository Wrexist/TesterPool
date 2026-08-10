import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Avatar, TierBadge, ReliabilityGauge, Stat, Pill, EmptyState, StreakStrip } from '@/components/ui';
import { IconArrow } from '@/components/app/icons';
import { fmtDate, n, tierOf } from '@/lib/pods';
import { RULES } from '@/lib/economy';
import type { Badge, Greenlight, Profile, UserBadge } from '@/lib/types';

export const dynamic = 'force-dynamic';

type BadgeRow = UserBadge & { badges: Badge | Badge[] | null };

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${handle} — TesterPool` };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('handle', handle)
    .maybeSingle();

  const profile = profileRow as Profile | null;
  if (!profile) notFound();

  const [{ data: badgeRows }, { data: ownGreenlights }, { count: approvedReports }] = await Promise.all([
    supabase.from('user_badges').select('*, badges(*)').eq('user_id', profile.id),
    supabase
      .from('greenlights')
      .select('*')
      .eq('user_id', profile.id)
      .order('approved_at', { ascending: false })
      .limit(12),
    supabase
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('tester_id', profile.id)
      .in('status', ['approved', 'arbitrated']),
  ]);

  // Apps this person helped ship as a tester. Assignments are only readable by
  // the tester, the app owner and moderators, so on someone else's profile this
  // legitimately comes back empty and the page shows their own launches instead.
  let helpedShip: Greenlight[] = [];
  const { data: assignmentRows } = await supabase
    .from('assignments')
    .select('app_id')
    .eq('tester_id', profile.id);
  const appIds = [...new Set(((assignmentRows ?? []) as { app_id: string }[]).map((a) => a.app_id))];
  if (appIds.length) {
    const { data } = await supabase
      .from('greenlights')
      .select('*')
      .in('app_id', appIds)
      .order('approved_at', { ascending: false })
      .limit(12);
    helpedShip = (data ?? []) as Greenlight[];
  }

  const badges = (badgeRows ?? []) as BadgeRow[];
  const launches = (ownGreenlights ?? []) as Greenlight[];
  const reports = approvedReports ?? 0;
  const isMe = auth?.user?.id === profile.id;

  return (
    <div className="flex flex-col gap-6">
      <Card className="dotgrid p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={profile.display_name || profile.handle} src={profile.avatar_url} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {profile.display_name || profile.handle}
              </h1>
              <TierBadge tier={tierOf(profile.tier)} />
              {isMe && <Pill tone="green">This is you</Pill>}
            </div>
            <p className="mt-0.5 text-sm text-[var(--color-mute)]">
              @{profile.handle}{profile.country_code ? ` · ${profile.country_code}` : ''} · joined {fmtDate(profile.created_at)}
            </p>
            {profile.bio && <p className="mt-2 max-w-xl text-sm text-[var(--color-dim)]">{profile.bio}</p>}
          </div>
          <ReliabilityGauge score={n(profile.reliability)} size={104} />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Pods completed" value={<span className="num">{n(profile.pods_completed)}</span>} />
        <Stat label="Apps helped ship" value={<span className="num">{n(profile.apps_helped_ship)}</span>} />
        <Stat label="Approved reports" value={<span className="num">{reports}</span>} />
        <Stat label="Longest streak" value={<span className="num">{n(profile.longest_streak)}</span>} sub="consecutive days" />
        <Stat
          label="Dropouts"
          value={<span className="num">{n(profile.pods_dropped)}</span>}
          tone={n(profile.pods_dropped) > 0 ? 'var(--color-danger)' : undefined}
          sub={n(profile.pods_dropped) === 0 ? 'never broke a clock' : 'clocks broken'}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
          Current streak
        </h2>
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <StreakStrip
            days={Array.from({ length: RULES.requiredDays }, (_, i) =>
              i < Math.min(n(profile.current_streak), RULES.requiredDays) ? 'done' : 'future'
            )}
            size={14}
          />
          <span className="text-sm text-[var(--color-dim)]">
            <span className="num font-semibold text-[var(--color-ink)]">{n(profile.current_streak)}</span> days
            running · best <span className="num font-semibold text-[var(--color-ink)]">{n(profile.longest_streak)}</span>
          </span>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">Badges</h2>
        {badges.length === 0 ? (
          <EmptyState
            title="No badges yet"
            body="Badges are earned, not given: a completed pod, a perfect fourteen, a rescue, a blocker found with reproduction steps."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {badges.map((row) => {
              const badge = Array.isArray(row.badges) ? row.badges[0] ?? null : row.badges;
              if (!badge) return null;
              return (
                <Card key={row.badge_key} hover className="p-4">
                  <div
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: 'color-mix(in oklab, var(--color-violet) 14%, transparent)' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="m12 3 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.4 6.7 19.2l1.1-5.9L3.5 9.2l5.9-.8L12 3Z"
                            stroke="var(--color-violet)" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="mt-2 text-sm font-semibold">{badge.label}</div>
                  <p className="mt-0.5 text-xs text-[var(--color-dim)]">{badge.description}</p>
                  <p className="mt-1.5 text-[11px] text-[var(--color-mute)]">Earned {fmtDate(row.earned_at)}</p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
          Greenlights
        </h2>
        {launches.length === 0 && helpedShip.length === 0 ? (
          <EmptyState
            title="No greenlights recorded"
            body="A greenlight is logged when an app in a pod is approved for production access. They appear here for everyone who helped."
            action={<Link href="/pods" className="btn btn-secondary">Find a pod <IconArrow size={15} /></Link>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...launches, ...helpedShip.filter((g) => !launches.some((l) => l.id === g.id))].map((g) => (
              <Card key={g.id} hover className="p-4">
                <div className="flex items-center gap-2">
                  <Pill tone="green">Production access</Pill>
                  {g.first_try && <Pill tone="violet">First try</Pill>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-dim)]">
                  <span><span className="num">{n(g.testers_count)}</span> testers</span>
                  <span><span className="num">{n(g.feedback_count)}</span> reports</span>
                  <span><span className="num">{n(g.engagement_pct)}%</span> engagement</span>
                </div>
                <div className="mt-2 text-[11px] text-[var(--color-mute)]">Approved {fmtDate(g.approved_at)}</div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
