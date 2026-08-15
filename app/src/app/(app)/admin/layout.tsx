import * as React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Pill } from '@/components/ui';
import { IconShield } from '@/components/app/icons';
import { AdminTabs, type AdminTab } from '@/components/admin/tabs';
import { roleOf } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — TesterPool' };

/**
 * The admin shell.
 *
 * A non-admin gets `notFound()`, not a redirect. A redirect tells the visitor
 * the route exists and that they are the wrong person; a 404 tells them
 * nothing, which is the correct amount of information to give.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) notFound();

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('handle, display_name, role')
    .eq('id', user.id)
    .maybeSingle();

  const profile = profileRow as { handle: string; display_name: string | null; role: string | null } | null;
  if (roleOf(profile?.role) !== 'admin') notFound();

  // Queue sizes on the tabs, so the reason to open a tab is visible from any
  // other tab. Read failures degrade to no badge rather than to a broken page.
  const [{ count: proofCount }, { count: disputeCount }] = await Promise.all([
    supabase.from('proofs').select('id', { count: 'exact', head: true }).in('status', ['pending', 'escalated']),
    supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  const tabs: AdminTab[] = [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/economy', label: 'Economy' },
    { href: '/admin/moderation', label: 'Moderation', badge: (proofCount ?? 0) + (disputeCount ?? 0) },
    { href: '/admin/store-reviews', label: 'Store reviews' },
    { href: '/admin/fraud', label: 'Fraud' },
    { href: '/admin/flags', label: 'Flags' },
    { href: '/admin/audit', label: 'Audit log' },
    { href: '/admin/system', label: 'System' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <IconShield size={22} /> Admin
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-dim)]">
            Everything on this surface moves real balances and real people&apos;s work.
            Every action here is written to an append-only audit log against your name.
          </p>
        </div>
        <div
          className="flex items-center gap-2 rounded-full border px-3 py-1.5"
          style={{
            borderColor: 'color-mix(in oklab, var(--color-credit) 40%, transparent)',
            background: 'color-mix(in oklab, var(--color-credit) 10%, transparent)',
          }}
          title="You are operating with admin privileges. Actions are attributed to this account."
        >
          <span
            className="inline-block rounded-full"
            style={{ width: 6, height: 6, background: 'var(--color-credit)' }}
            aria-hidden
          />
          <span className="text-xs font-semibold text-[var(--color-credit)]">
            Acting as admin
          </span>
          <span className="text-xs text-[var(--color-dim)]">
            @{profile?.handle ?? 'unknown'}
          </span>
        </div>
      </header>

      <AdminTabs tabs={tabs} />

      {children}

      <footer className="border-t border-[var(--color-line)] pt-4">
        <Pill tone="neutral">Audited</Pill>
        <span className="ml-2 text-xs text-[var(--color-mute)]">
          Credit adjustments, role changes, bans, economy edits, flag toggles and seat interventions are all
          recorded in <code className="text-[var(--color-dim)]">admin_actions</code>, which has no update or
          delete path.
        </span>
      </footer>
    </div>
  );
}
