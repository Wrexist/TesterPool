import * as React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  Card, Pill, Avatar, EmptyState, CreditChip, ReliabilityGauge, TierBadge, StreakStrip, cx,
} from '@/components/ui';
import { Section, KeyValue, WarnBox } from '@/components/admin/parts';
import { UserActions } from '@/components/admin/user-actions';
import { fmtDate, fmtRelative, ledgerLabel, podDay, stripFor, tierOf, n, SEAT_HEALTH_COPY, seatHealth } from '@/lib/pods';
import { RULES } from '@/lib/economy';
import { num, roleOf, ROLE_COPY, type AdminUserRow, type UserRole } from '@/lib/admin';
import type { AppRow, LedgerEntry, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

type SortKey = 'handle' | 'credits' | 'reliability' | 'created_at' | 'active_tests' | 'rejected_reports';

const SORTS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'handle', label: 'User', numeric: false },
  { key: 'credits', label: 'Credits', numeric: true },
  { key: 'reliability', label: 'Reliability', numeric: true },
  { key: 'active_tests', label: 'Active tests', numeric: true },
  { key: 'rejected_reports', label: 'Rejected', numeric: true },
  { key: 'created_at', label: 'Joined', numeric: true },
];

interface Params {
  q?: string;
  role?: string;
  banned?: string;
  tier?: string;
  sort?: string;
  dir?: string;
  user?: string;
}

function buildHref(params: Params, patch: Partial<Params>): string {
  const merged = { ...params, ...patch };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `/admin/users?${qs}` : '/admin/users';
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getUser();
  const viewerId = authData?.user?.id ?? '';

  const q = (params.q ?? '').trim();
  const sort: SortKey = (SORTS.find((s) => s.key === params.sort)?.key ?? 'created_at') as SortKey;
  const ascending = params.dir === 'asc';

  let query = supabase.from('admin_user_rows').select('*');

  if (q) {
    // Commas and parens are the PostgREST filter grammar, so strip them rather
    // than let a search string become a syntax error.
    const safe = q.replace(/[,()*]/g, ' ').trim();
    if (safe) {
      query = query.or(
        `handle.ilike.%${safe}%,display_name.ilike.%${safe}%,tester_email.ilike.%${safe}%`
      );
    }
  }
  if (params.role === 'user' || params.role === 'moderator' || params.role === 'admin') {
    query = query.eq('role', params.role);
  }
  if (params.banned === 'yes') query = query.eq('is_banned', true);
  if (params.banned === 'no') query = query.eq('is_banned', false);
  if (params.tier) query = query.eq('tier', params.tier);

  const { data: rows, error } = await query.order(sort, { ascending, nullsFirst: false }).limit(200);
  const users = (rows ?? []) as AdminUserRow[];

  const selectedId = params.user ?? '';
  const selected = users.find((u) => u.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="User management"
        note="Search by handle, display name or tester email. Every action on a user is logged and none of them are reversible without a second logged action."
      >
        <form method="get" action="/admin/users" className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="label" htmlFor="q">Search</label>
            <input id="q" name="q" className="input" defaultValue={q} placeholder="handle, name or email" />
          </div>
          <div>
            <label className="label" htmlFor="role">Role</label>
            <select id="role" name="role" className="input" defaultValue={params.role ?? ''}>
              <option value="">Any role</option>
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="banned">Banned</label>
            <select id="banned" name="banned" className="input" defaultValue={params.banned ?? ''}>
              <option value="">Any</option>
              <option value="no">Not banned</option>
              <option value="yes">Banned</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tier">Tier</label>
            <select id="tier" name="tier" className="input" defaultValue={params.tier ?? ''}>
              <option value="">Any tier</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </div>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={params.dir ?? 'desc'} />
          <button type="submit" className="btn btn-secondary">Apply</button>
          <Link href="/admin/users" className="btn btn-ghost">Clear</Link>
        </form>
      </Section>

      {error && (
        <WarnBox tone="red">The user query failed: {error.message}</WarnBox>
      )}

      {users.length === 0 ? (
        <EmptyState
          title="No users match"
          body="Nothing in admin_user_rows matches those filters. Clear the search and widen the role or ban filter."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                {SORTS.map((col) => {
                  const active = sort === col.key;
                  const nextDir = active && !ascending ? 'asc' : 'desc';
                  return (
                    <th key={col.key} className={cx('px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide', col.numeric && 'text-right')}>
                      <Link
                        href={buildHref(params, { sort: col.key, dir: nextDir, user: undefined })}
                        className={active ? 'text-[var(--color-ink)]' : 'text-[var(--color-mute)] hover:text-[var(--color-dim)]'}
                      >
                        {col.label}
                        {active && <span aria-hidden> {ascending ? '↑' : '↓'}</span>}
                      </Link>
                    </th>
                  );
                })}
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const role = roleOf(u.role);
                const isSelected = u.id === selectedId;
                return (
                  <tr
                    key={u.id}
                    className={cx(
                      'border-b border-[var(--color-line)] last:border-b-0',
                      isSelected && 'bg-[var(--color-surface-2)]'
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={buildHref(params, { user: isSelected ? undefined : u.id })}
                        className="flex items-center gap-2.5"
                      >
                        <Avatar name={u.display_name || u.handle} src={u.avatar_url} size={28} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{u.display_name || u.handle}</span>
                          <span className="block truncate text-xs text-[var(--color-mute)]">@{u.handle}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="num px-4 py-2.5 text-right">{num(u.credits)}</td>
                    <td className="num px-4 py-2.5 text-right">{num(u.reliability).toFixed(0)}</td>
                    <td className="num px-4 py-2.5 text-right">{num(u.active_tests)}</td>
                    <td className={cx('num px-4 py-2.5 text-right', num(u.rejected_reports) > 0 && 'text-[var(--color-credit)]')}>
                      {num(u.rejected_reports)}
                    </td>
                    <td className="num px-4 py-2.5 text-right text-xs text-[var(--color-dim)]">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <TierBadge tier={tierOf(u.tier)} size="sm" />
                        {role !== 'user' && <Pill tone={ROLE_COPY[role].tone}>{ROLE_COPY[role].label}</Pill>}
                        {u.is_banned && <Pill tone="red">Banned</Pill>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {selected && (
        <UserDetail
          row={selected}
          viewerId={viewerId}
          closeHref={buildHref(params, { user: undefined })}
        />
      )}
      {selectedId && !selected && (
        <WarnBox tone="amber">
          That account is not in the current result set. Clear the filters to open it.
        </WarnBox>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- detail */

async function UserDetail({
  row,
  viewerId,
  closeHref,
}: {
  row: AdminUserRow;
  viewerId: string;
  closeHref: string;
}) {
  const supabase = await createClient();

  const [{ data: profileRow }, { data: appRows }, { data: assignmentRows }, { data: ledgerRows }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', row.id).maybeSingle(),
      supabase.from('apps').select('id, name, status, package_name, created_at').eq('owner_id', row.id).limit(20),
      supabase
        .from('assignments')
        .select('id, status, days_checked_in, opt_in_verified_at, apps(name), pods(code, name, starts_at, duration_days, status)')
        .eq('tester_id', row.id)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('credit_ledger')
        .select('id, delta, balance_after, reason, memo, created_at')
        .eq('user_id', row.id)
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

  const profile = (profileRow ?? null) as Profile | null;
  const apps = (appRows ?? []) as Pick<AppRow, 'id' | 'name' | 'status' | 'package_name' | 'created_at'>[];
  const ledger = (ledgerRows ?? []) as LedgerEntry[];

  type AssignmentRow = {
    id: string;
    status: string;
    days_checked_in: number | null;
    opt_in_verified_at: string | null;
    apps: { name: string } | { name: string }[] | null;
    pods:
      | { code: string | null; name: string | null; starts_at: string | null; duration_days: number | null; status: string }
      | { code: string | null; name: string | null; starts_at: string | null; duration_days: number | null; status: string }[]
      | null;
  };
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const assignments = (assignmentRows ?? []) as AssignmentRow[];

  const role: UserRole = roleOf(row.role);
  const isSelf = row.id === viewerId;

  return (
    <Card className="p-5" id="detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={row.display_name || row.handle} src={row.avatar_url} size={44} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{row.display_name || row.handle}</h2>
              <TierBadge tier={tierOf(row.tier)} />
              {role !== 'user' && <Pill tone={ROLE_COPY[role].tone}>{ROLE_COPY[role].label}</Pill>}
              {row.is_banned && <Pill tone="red">Banned</Pill>}
              {isSelf && <Pill tone="amber">This is you</Pill>}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-mute)]">
              @{row.handle} · joined {fmtDate(row.created_at)} · last check-in {fmtRelative(row.last_checkin_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/u/${row.handle}`} className="btn btn-ghost">Public profile</Link>
          <Link href={closeHref} className="btn btn-ghost">Close</Link>
        </div>
      </div>

      {row.is_banned && row.ban_reason && (
        <div className="mt-3">
          <WarnBox tone="red">Ban reason on file: {row.ban_reason}</WarnBox>
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* ------------------------------------------------------ summary */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <ReliabilityGauge score={num(row.reliability)} size={84} />
            <div className="flex flex-col gap-1.5">
              <CreditChip amount={num(row.credits)} size="lg" />
              <span className="text-xs text-[var(--color-mute)]">
                <span className="num">{num(row.pods_completed)}</span> pods completed ·{' '}
                <span className="num">{num(row.pods_dropped)}</span> dropped
              </span>
              <span className="text-xs text-[var(--color-mute)]">
                streak <span className="num">{num(row.current_streak)}</span> ·{' '}
                <span className="num">{num(row.rejected_reports)}</span> rejected reports
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <KeyValue label="Tester email">
              <span className="break-all text-xs">{row.tester_email ?? 'not set'}</span>
            </KeyValue>
            <KeyValue label="Country">
              <span className="text-xs">{row.country_code ?? 'not set'}</span>
            </KeyValue>
            <KeyValue label="Apps listed">
              <span className="num text-xs">{num(row.apps)}</span>
            </KeyValue>
            <KeyValue label="Referred by">
              <span className="text-xs">{row.referred_by ? 'yes' : 'no'}</span>
            </KeyValue>
          </div>

          {profile && (
            <div className="grid grid-cols-2 gap-3">
              <KeyValue label="Signup IP hash">
                <span className="num break-all text-[11px] text-[var(--color-dim)]">
                  {(profile as unknown as { signup_ip_hash?: string | null }).signup_ip_hash?.slice(0, 16) ?? 'not recorded'}
                </span>
              </KeyValue>
              <KeyValue label="Device hash">
                <span className="num break-all text-[11px] text-[var(--color-dim)]">
                  {(profile as unknown as { device_fp_hash?: string | null }).device_fp_hash?.slice(0, 16) ?? 'not recorded'}
                </span>
              </KeyValue>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------ activity */}
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-semibold">Apps</h3>
            {apps.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--color-mute)]">No apps listed on this account.</p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1">
                {apps.map((app) => (
                  <li key={app.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{app.name}</span>
                    <Pill tone="neutral">{app.status}</Pill>
                    <span className="num text-xs text-[var(--color-mute)]">{app.package_name ?? 'no package name'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Active tests</h3>
            {assignments.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--color-mute)]">This account is not testing anything right now.</p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-2">
                {assignments.map((a) => {
                  const pod = one(a.pods);
                  const app = one(a.apps);
                  const duration = pod?.duration_days ?? RULES.requiredDays;
                  const day = pod?.status === 'active' ? podDay(pod.starts_at, duration) : 0;
                  const health = seatHealth(
                    a.status as never,
                    a.opt_in_verified_at,
                    n(a.days_checked_in),
                    day
                  );
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-2.5">
                      <StreakStrip days={stripFor(n(a.days_checked_in), day, duration)} total={duration} size={9} gap={2} />
                      <span className="text-xs font-medium">{app?.name ?? 'App unavailable'}</span>
                      <Pill tone={SEAT_HEALTH_COPY[health].tone}>{SEAT_HEALTH_COPY[health].label}</Pill>
                      <span className="text-[11px] text-[var(--color-mute)]">
                        {pod?.name || (pod?.code ? `Pod ${pod.code}` : 'No pod')}
                        {day > 0 && <> · day <span className="num">{day}</span></>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Recent ledger</h3>
            {ledger.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--color-mute)]">No ledger entries yet.</p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1">
                {ledger.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-[150px] shrink-0 text-[var(--color-dim)]">{ledgerLabel(entry.reason)}</span>
                    <CreditChip amount={entry.delta} size="sm" signed />
                    <span className="num text-[var(--color-mute)]">balance {entry.balance_after}</span>
                    <span className="text-[var(--color-mute)]">{fmtRelative(entry.created_at)}</span>
                    {entry.memo && <span className="min-w-0 flex-1 truncate text-[var(--color-mute)]">{entry.memo}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-[var(--color-line)] pt-5">
        <UserActions
          userId={row.id}
          handle={row.handle}
          credits={num(row.credits)}
          role={role}
          isBanned={row.is_banned}
          isSelf={isSelf}
        />
      </div>
    </Card>
  );
}
