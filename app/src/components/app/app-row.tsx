/**
 * TESTERPOOL — one app as a row, which is how a phone should show a list.
 *
 * The grid card is a desktop shape: at 390px wide two of them fill the screen
 * and a developer scrolls past four to see six apps. A row shows six at once,
 * which is the difference between browsing and scrolling.
 *
 * Four things, left to right: the icon, the name and who made it, two chips —
 * store and state — and what the work pays. Nothing else fits on a phone and
 * nothing else is needed to decide whether to tap.
 *
 * The store is a chip here rather than a badge on the icon: at 52px the badge
 * sat on the icon's corner and read as damage. A tinted chip with the logo and
 * the word is what the reference does, and it is legible at a glance.
 */

import Link from 'next/link';
import { Pill, cx } from '@/components/ui';
import { AppIcon } from '@/components/app/app-card';
import { IconArrow, IconAndroid, IconApple } from '@/components/app/icons';
import { cardChip, isListingOnly, rewardFor, type MarketApp } from '@/lib/market';
import { n } from '@/lib/format';

/** What one app's work pays a tester, as the chip that ends every row. */
export function RewardChip({ amount, size = 'md' }: { amount: number; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx(
        'num inline-flex shrink-0 items-center gap-1 rounded-full font-bold',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'
      )}
      style={{
        color: 'var(--color-credit)',
        background: 'color-mix(in oklab, var(--color-credit) 12%, transparent)',
        border: '1px solid color-mix(in oklab, var(--color-credit) 28%, transparent)',
      }}
      title={`Testing this app pays ${amount} credits`}
    >
      <svg width={size === 'sm' ? 10 : 11} height={size === 'sm' ? 10 : 11} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
      +{amount}
    </span>
  );
}

/** The store, as its logo and its name. The most-scanned thing on the row. */
export function PlatformChip({ ios }: { ios: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={
        ios
          ? { color: 'var(--color-ink)', background: 'var(--color-surface-2)' }
          : {
              color: 'var(--color-accent)',
              background: 'color-mix(in oklab, var(--color-accent) 12%, transparent)',
            }
      }
    >
      {ios ? <IconApple size={11} /> : <IconAndroid size={12} />}
      {ios ? 'iOS' : 'Android'}
    </span>
  );
}

export function AppRow({
  app, href, counts = false, bare = false,
}: {
  app: MarketApp;
  href?: string;
  /** Ends the row with what the app has received rather than what it pays. */
  counts?: boolean;
  /**
   * Drops the row's own border, background and rounding so it can sit as the
   * top half of a surface that owns those — `/apps`, where each row carries the
   * owner's activity controls beneath it. Two nested borders a pixel apart read
   * as a rendering fault.
   */
  bare?: boolean;
}) {
  const chip = cardChip(app);
  const reward = rewardFor(app);

  return (
    <Link
      href={href ?? `/market/${app.id}`}
      className={cx(
        'flex items-center gap-3.5 p-3.5 transition-colors',
        bare
          ? 'hover:bg-[var(--color-surface-2)]'
          : 'rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-line-hi)]'
      )}
    >
      <AppIcon name={app.name} src={app.icon_url} size={52} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold leading-tight">{app.name}</div>
        <div className="mt-0.5 truncate text-[13px] text-[var(--color-dim)]">
          {app.owner_display_name || `@${app.owner_handle ?? 'unknown'}`}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <PlatformChip ios={isListingOnly(app)} />
          <Pill tone={chip.tone}>{chip.label}</Pill>
        </div>
      </div>

      {counts ? (
        <span className="shrink-0 text-right text-[11px] text-[var(--color-mute)]">
          <span className="num font-semibold text-[var(--color-dim)]">{n(app.testers_active)}</span> installs
          <br />
          <span className="num font-semibold text-[var(--color-dim)]">{n(app.reports)}</span> reports
        </span>
      ) : reward ? (
        <RewardChip amount={reward} />
      ) : (
        <IconArrow size={16} className="shrink-0 text-[var(--color-mute)]" />
      )}
    </Link>
  );
}
