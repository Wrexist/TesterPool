/**
 * TESTERPOOL — one app, as it appears in the marketplace grid.
 *
 * A card says four things and stops: what it is, which store it is for, whether
 * it is open to testers, and where you already stand with it. Everything a
 * previous draft also carried — focus areas, the category as a pill, the
 * seat count, the day number — either belongs on the app's own page or on
 * listing detail, and putting it here made nine cards read as a wall.
 *
 * The store is a logo, not a word. A developer recognises the robot and the
 * apple at a glance and reads "Android" a beat later, so the glyph is badged on
 * the icon where it cannot be missed.
 *
 * No rating, no score, no average — reports are private between a tester and
 * the developer, and a number out of five beside an app icon is a rating board,
 * which this product is deliberately incapable of being.
 */

import Link from 'next/link';
import { Card, Pill } from '@/components/ui';
import { SaveButton } from '@/app/(app)/market/save-button';
import { IconAndroid, IconApple } from '@/components/app/icons';
import { RewardChip } from '@/components/app/app-row';
import { cardChip, isListingOnly, rewardFor, type MarketApp } from '@/lib/market';
import { n } from '@/lib/format';

/** Deterministic tint from the name, so an app with no icon still looks like itself. */
export function AppIcon({
  name, src, size = 48, platform,
}: {
  name: string;
  src?: string | null;
  size?: number;
  /** Draws the store logo as a badge on the corner. */
  platform?: 'android' | 'ios';
}) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const badge = Math.round(size * 0.42);

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src} alt="" width={size} height={size}
          className="rounded-xl object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="inline-flex items-center justify-center rounded-xl font-bold"
          style={{
            width: size, height: size, fontSize: size * 0.42,
            background: `oklch(0.93 0.05 ${hue})`, color: `oklch(0.45 0.12 ${hue})`,
          }}
        >
          {name.trim()[0]?.toUpperCase() ?? '?'}
        </span>
      )}

      {platform && (
        <span
          className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full border-2 border-[var(--color-surface)]"
          style={{
            width: badge, height: badge,
            background: 'var(--color-surface-2)',
            color: platform === 'ios' ? 'var(--color-ink)' : 'var(--color-accent)',
          }}
          title={platform === 'ios' ? 'iOS' : 'Android'}
        >
          {platform === 'ios'
            ? <IconApple size={Math.round(badge * 0.62)} />
            : <IconAndroid size={Math.round(badge * 0.66)} />}
        </span>
      )}
    </span>
  );
}

export function AppCard({ app }: { app: MarketApp }) {
  const chip = cardChip(app);
  const reward = rewardFor(app);

  return (
    <Card hover className="relative flex flex-col p-5">
      <div className="absolute right-4 top-4">
        <SaveButton appId={app.id} initial={!!app.watching} />
      </div>

      <Link href={`/market/${app.id}`} className="flex flex-1 flex-col gap-4">
        <div className="flex items-start gap-3.5 pr-10">
          <AppIcon
            name={app.name}
            src={app.icon_url}
            platform={isListingOnly(app) ? 'ios' : 'android'}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold leading-tight">{app.name}</h3>
            <p className="mt-1 truncate text-[13px] text-[var(--color-dim)]">
              {app.tagline || 'No description yet.'}
            </p>
            <p className="mt-1.5 truncate text-[11px] text-[var(--color-mute)]">
              {app.category || 'Uncategorised'} · @{app.owner_handle ?? 'unknown'}
            </p>
          </div>
        </div>

        {/* Status on the left, what the work pays on the right — the same pair
            the phone row ends with, so a card and a row say the same thing. */}
        <div className="flex items-center justify-between gap-2">
          <Pill tone={chip.tone}>{chip.label}</Pill>
          {reward && <RewardChip amount={reward} size="sm" />}
        </div>

        {/* mt-auto: cards in a row end their numbers on the same line whatever
            the chips above wrapped to. */}
        <div className="mt-auto flex items-center gap-5 border-t border-[var(--color-line)] pt-3.5">
          <Metric label="testers" value={n(app.testers_active)} />
          <Metric label="full 14" value={n(app.testers_full)} />
          <Metric label="reports" value={n(app.reports)} />
        </div>
      </Link>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="num text-[15px] font-bold leading-none">{value}</span>
      <span className="text-[11px] text-[var(--color-mute)]">{label}</span>
    </span>
  );
}
