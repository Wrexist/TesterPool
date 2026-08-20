import { AppDetail } from '@/app/(app)/market/[id]/app-detail';
import type { MarketAppDetail } from '@/lib/market';

export const metadata = {
  title: 'App Details — prototype',
  robots: { index: false, follow: false },
};

/**
 * PROTOTYPE ROUTE — the rebuilt App Details screen, against a fixture.
 *
 * Outside `(app)/` so it needs no session, `noindex`, and linked from nothing:
 * it exists so the screen can be looked at and screenshotted without a
 * database, which is the only way to review a layout while the schema it reads
 * is still waiting to be applied.
 *
 * It renders the REAL component with a fake row rather than a copy of its
 * markup. A prototype that reimplements the screen proves nothing about the
 * screen — the two drift the first time either is touched, and the prototype is
 * the one nobody remembers to update.
 *
 * The buttons are live and will fail: there is no session behind them. That is
 * the honest cost of rendering the real component, and it is cheaper than the
 * lie a mocked-up copy would tell.
 */

const BASE: MarketAppDetail = {
  id: '00000000-0000-4000-a000-0000000000ff',
  name: 'Sudøku',
  tagline: 'Enjoy Sudoku the way it should be played-fast, intuitive and completely offline.',
  category: 'Games',
  platform: 'ios',
  icon_url: null,
  store_url: 'https://apps.apple.com/app/id1000000001',
  status: 'in_pod',
  focus_areas: null,
  min_android_version: null,
  created_at: new Date().toISOString(),
  graduated_at: null,
  owner_id: '00000000-0000-4000-a000-0000000000fe',
  owner_handle: 'benjaminb',
  owner_display_name: 'Benjamin Tobias Blankenhorn',
  owner_avatar_url: null,
  owner_country_code: 'DE',
  owner_reliability: 96,
  owner_tier: 'gold',
  testers_active: 7,
  testers_full: 4,
  reports: 12,
  pod_status: null,
  pod_day: null,
  pod_seats_left: null,
  relation: 'none',
  assignment_id: null,
  days_checked_in: 0,
  report_due: false,
  watching: false,
  activity_open: false,
  activity_seats_left: 6,
  is_activity: false,
  total_count: 1,
  description:
    'Enjoy Sudoku the way it should be played-fast, intuitive and completely offline.\n\n'
    + 'Solve unlimited Sudoku puzzles generated directly on your device. Four difficulty '
    + 'levels, a clean board that stays readable one-handed, and no account, no advertising '
    + 'and no network call at any point.',
  tester_instructions: null,
  opt_in_url: null,
  package_name: null,
  opt_in_verified: false,
  owner_apps: 2,
  owner_pods_completed: 41,
  owner_apps_helped_ship: 7,
  featured: false,
  owner_last_seen_at: new Date(Date.now() - 9 * 60_000).toISOString(),
  can_message: true,
  unread: 0,
} as MarketAppDetail;

/** The same listing after the install has been verified. */
const INSTALLED: MarketAppDetail = {
  ...BASE,
  relation: 'testing',
  assignment_id: '00000000-0000-4000-a000-0000000000fd',
  opt_in_verified: true,
};

export default function AppDetailPreview() {
  return (
    <main className="flex flex-col gap-10 px-4 py-6">
      <section>
        <p className="mx-auto mb-3 max-w-[720px] text-[12px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          Step one — nothing claimed yet
        </p>
        <AppDetail app={BASE} storeOpen />
      </section>

      <hr className="border-[var(--color-line)]" />

      <section>
        <p className="mx-auto mb-3 max-w-[720px] text-[12px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          Step two — install verified, review unlocked
        </p>
        <AppDetail app={INSTALLED} storeOpen />
      </section>
    </main>
  );
}
