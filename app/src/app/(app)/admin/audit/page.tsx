import * as React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, Pill, Avatar, EmptyState, cx } from '@/components/ui';
import { Section, DiffView, WarnBox } from '@/components/admin/parts';
import { fmtDateTime } from '@/lib/format';
import { auditLabel, auditTone, AUDIT_ACTION_COPY, type AdminActionRow } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

interface Params {
  actor?: string;
  action?: string;
  page?: string;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let query = supabase.from('admin_actions').select('*', { count: 'exact' });
  if (params.actor) query = query.eq('actor_id', params.actor);
  if (params.action) query = query.eq('action', params.action);

  const [{ data: rows, count, error }, { data: adminRows }] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1),
    supabase.from('profiles').select('id, handle, display_name, avatar_url').in('role', ['admin', 'moderator']).limit(100),
  ]);

  const entries = (rows ?? []) as AdminActionRow[];
  const admins = (adminRows ?? []) as { id: string; handle: string; display_name: string | null; avatar_url: string | null }[];

  // Resolve any actor or profile target not covered by the admin list, so a
  // former admin's entries still read as a person rather than a uuid.
  const missingIds = [
    ...new Set(
      [
        ...entries.map((e) => e.actor_id),
        ...entries.filter((e) => e.target_type === 'profile').map((e) => e.target_id),
      ].filter((id): id is string => !!id && !admins.some((a) => a.id === id))
    ),
  ];
  const { data: extraRows } = missingIds.length
    ? await supabase.from('profiles').select('id, handle, display_name, avatar_url').in('id', missingIds)
    : { data: [] };

  const people = new Map(
    [...admins, ...((extraRows ?? []) as typeof admins)].map((p) => [p.id, p])
  );

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (patch: Partial<Params>) => {
    const merged = { ...params, ...patch };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, String(value));
    const qs = search.toString();
    return qs ? `/admin/audit?${qs}` : '/admin/audit';
  };

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Audit log"
        note="Append-only. There is no update path and no delete path on admin_actions, for any role including this one. That is the entire point of it: an admin cannot quietly undo their own record."
      >
        <form method="get" action="/admin/audit" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="actor">Actor</label>
            <select id="actor" name="actor" className="input" defaultValue={params.actor ?? ''}>
              <option value="">Any actor</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>@{a.handle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="action">Action</label>
            <select id="action" name="action" className="input" defaultValue={params.action ?? ''}>
              <option value="">Any action</option>
              {Object.keys(AUDIT_ACTION_COPY).map((key) => (
                <option key={key} value={key}>{auditLabel(key)}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-secondary">Filter</button>
          <Link href="/admin/audit" className="btn btn-ghost">Clear</Link>
          <span className="ml-auto text-xs text-[var(--color-mute)]">
            <span className="num">{total}</span> entries · page <span className="num">{page}</span> of{' '}
            <span className="num">{pages}</span>
          </span>
        </form>
      </Section>

      {error && <WarnBox tone="red">The audit log could not be read: {error.message}</WarnBox>}

      {entries.length === 0 ? (
        <EmptyState
          title="No matching entries"
          body="Nothing in admin_actions matches this filter. An empty log on a fresh install means no admin has changed anything yet."
        />
      ) : (
        <Card className="overflow-hidden">
          {entries.map((entry) => {
            const actor = entry.actor_id ? people.get(entry.actor_id) : undefined;
            const target = entry.target_type === 'profile' && entry.target_id ? people.get(entry.target_id) : undefined;
            return (
              <div key={entry.id} className="border-b border-[var(--color-line)] px-4 py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={auditTone(entry.action)}>{auditLabel(entry.action)}</Pill>
                  <span className="flex items-center gap-1.5 text-xs">
                    <Avatar name={actor?.display_name || actor?.handle || 'Admin'} src={actor?.avatar_url} size={20} />
                    <span className="text-[var(--color-dim)]">@{actor?.handle ?? 'unknown actor'}</span>
                  </span>
                  {target && (
                    <>
                      <span aria-hidden className="text-[var(--color-mute)]">&rarr;</span>
                      <Link
                        href={`/admin/users?q=${encodeURIComponent(target.handle)}`}
                        className="text-xs font-medium text-[var(--color-dim)] hover:text-[var(--color-accent)]"
                      >
                        @{target.handle}
                      </Link>
                    </>
                  )}
                  {!target && entry.target_type && (
                    <span className="text-xs text-[var(--color-mute)]">{entry.target_type}</span>
                  )}
                  <span className="ml-auto text-xs text-[var(--color-mute)]">{fmtDateTime(entry.created_at)}</span>
                </div>

                <div className="mt-2 pl-1">
                  <DiffView
                    before={entry.before}
                    after={entry.after}
                    emptyNote="This action records no field-level change — the reason below is the record."
                  />
                </div>

                {entry.reason && (
                  <p className="mt-1.5 pl-1 text-xs text-[var(--color-dim)]">
                    <span className="text-[var(--color-mute)]">Reason: </span>
                    {entry.reason}
                  </p>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <nav className="flex items-center justify-between" aria-label="Audit log pages">
        <Link
          href={href({ page: String(Math.max(1, page - 1)) })}
          className={cx('btn btn-ghost', page <= 1 && 'pointer-events-none opacity-40')}
          aria-disabled={page <= 1}
        >
          Newer
        </Link>
        <span className="text-xs text-[var(--color-mute)]">
          showing <span className="num">{entries.length}</span> of <span className="num">{total}</span>
        </span>
        <Link
          href={href({ page: String(Math.min(pages, page + 1)) })}
          className={cx('btn btn-ghost', page >= pages && 'pointer-events-none opacity-40')}
          aria-disabled={page >= pages}
        >
          Older
        </Link>
      </nav>
    </div>
  );
}
