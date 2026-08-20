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

/**
 * What one app's work pays a tester, as the chip that ends every row.
 *
 * Purple and filled-star, matching the balance pill in the header — a developer
 * scanning the list is comparing these against the number they hold, and two
 * different colours for the same currency makes that a translation step.
 */
export function RewardChip({ amount, size = 'md' }: { amount: number; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx(
        'num inline-flex shrink-0 items-center gap-1 rounded-full font-bold',
        size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-[13px]'
      )}
      style={{ color: 'var(--color-accent)', background: 'var(--color-accent-soft)' }}
      title={`Testing this app pays ${amount} credits`}
    >
      <StarGlyph size={size === 'sm' ? 11 : 13} />
      +{amount}
    </span>
  );
}

/** The currency mark. Filled, because a hollow star reads as a rating. */
export function StarGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.6l2.95 5.98 6.6.96-4.77 4.65 1.12 6.57L12 17.62l-5.9 3.1 1.12-6.57L2.45 9.5l6.6-.96L12 2.6Z" />
    </svg>
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
          : { color: 'var(--color-android)', background: 'var(--color-android-soft)' }
      }
    >
      {ios ? <IconApple size={11} /> : <IconAndroid size={12} />}
      {ios ? 'iOS' : 'Android'}
    </span>
  );
}

export function AppRow({
  app, href, counts = false, bare = false, featured = false,
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
  /**
   * Editorial badge. Passed in rather than read off the row because the feed's
   * projection does not carry it: `market_apps` has a long return type defined
   * across three migrations, and widening it for one boolean would mean
   * reproducing the whole body. The page asks `featured_app_ids()` once and
   * hands the answer down.
   */
  featured?: boolean;
}) {
  const chip = cardChip(app);
  const reward = rewardFor(app);

  /*
   * The state pill only appears when the state is worth a word. On a list where
   * almost every row is simply open, a pill on every row is noise that makes
   * the two rows that are NOT open impossible to spot. The category takes the
   * slot the rest of the time, because that is what a tester actually scans by.
   */
  const plain = chip.label.toLowerCase() === 'open';

  return (
    <Link
      href={href ?? `/market/${app.id}`}
      className={cx(
        'flex items-start gap-3.5 p-4 transition-colors',
        bare
          ? 'hover:bg-[var(--color-surface-2)]'
          : 'card card-hover rounded-2xl'
      )}
    >
      <AppIcon name={app.name} src={app.icon_url} size={62} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[16px] font-semibold leading-tight">{app.name}</span>
          {featured && <Pill tone="amber">Featured</Pill>}
        </div>
        <div className="mt-1 truncate text-[14px] text-[var(--color-dim)]">
          {app.owner_display_name || `@${app.owner_handle ?? 'unknown'}`}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <PlatformChip ios={isListingOnly(app)} />
          {plain ? (
            app.category && (
              <span className="truncate text-[13px] text-[var(--color-mute)]">{app.category}</span>
            )
          ) : (
            <Pill tone={chip.tone}>{chip.label}</Pill>
          )}
        </div>
      </div>

      {/* Chevron at the top, value at the bottom: the tap target is the whole
          row, so the arrow is an affordance rather than a control, and it
          belongs on the same line as the name it points at. */}
      <div className="flex shrink-0 flex-col items-end justify-between self-stretch gap-3">
        <IconArrow size={17} className="text-[var(--color-mute)]" />
        {counts ? (
          <span className="text-right text-[11px] text-[var(--color-mute)]">
            <span className="num font-semibold text-[var(--color-dim)]">{n(app.testers_active)}</span> installs
            <br />
            <span className="num font-semibold text-[var(--color-dim)]">{n(app.reports)}</span> reports
          </span>
        ) : reward ? (
          <RewardChip amount={reward} />
        ) : null}
      </div>
    </Link>
  );
}
