/**
 * TESTERPOOL — one app, as it appears in the marketplace grid.
 *
 * A card answers four questions in the order a browsing developer asks them:
 * what is it, where is it in its fourteen days, do I already have a stake in
 * it, and how much work has gone through it. It carries no rating and no score
 * — reports are private between a tester and the developer, and a number out
 * of five beside an app icon is a rating board, which this product is
 * deliberately incapable of being.
 */

import Link from 'next/link';
import { Card, Pill, cx } from '@/components/ui';
import { SaveButton } from '@/app/(app)/market/save-button';
import { IconAndroid, IconApple } from '@/components/app/icons';
import { stageOf, relationCopy, isListingOnly, type MarketApp } from '@/lib/market';
import { n } from '@/lib/pods';

/** Deterministic tint from the name, so an app with no icon still looks like itself. */
export function AppIcon({ name, src, size = 44 }: { name: string; src?: string | null; size?: number }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src} alt="" width={size} height={size}
        className="shrink-0 rounded-xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.42,
        background: `oklch(0.33 0.07 ${hue})`, color: `oklch(0.9 0.12 ${hue})`,
      }}
    >
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0">
      <div className="num text-[15px] font-bold leading-none">{value}</div>
      <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">
        {label}
      </div>
    </div>
  );
}

export function AppCard({ app }: { app: MarketApp }) {
  const stage = stageOf(app);
  const relation = relationCopy(app);
  const listingOnly = isListingOnly(app);
  const focus = (app.focus_areas ?? []).slice(0, 2);

  return (
    <Card hover className="relative flex flex-col p-5">
      <div className="absolute right-4 top-4">
        <SaveButton appId={app.id} initial={!!app.watching} />
      </div>

      {/* flex-1 so the link fills the card: without it the mt-auto below has no
          spare height to push against and the numbers stop lining up. */}
      <Link href={`/market/${app.id}`} className="flex flex-1 flex-col gap-4">
        <div className="flex items-start gap-3 pr-10">
          <AppIcon name={app.name} src={app.icon_url} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-semibold leading-tight">{app.name}</h3>
              <span className="shrink-0 text-[var(--color-mute)]" title={listingOnly ? 'iOS' : 'Android'}>
                {listingOnly ? <IconApple size={13} /> : <IconAndroid size={13} />}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--color-dim)]">
              {app.tagline || 'No description yet.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={stage.tone}>{stage.label}</Pill>
          {relation && <Pill tone={relation.tone}>{relation.label}</Pill>}
          {listingOnly && <Pill tone="neutral">Listing only</Pill>}
          {app.category && !listingOnly && <Pill tone="neutral">{app.category}</Pill>}
        </div>

        {/* mt-auto here, not on the footer: a card whose pills wrapped to two
            lines would otherwise sit its numbers a row lower than its
            neighbours, and three cards side by side read as misaligned. */}
        <div
          className={cx(
            'mt-auto grid grid-cols-3 gap-3 rounded-xl border border-[var(--color-line)] px-4 py-3',
            'bg-[var(--color-bg)]'
          )}
        >
          <Metric label="Testers" value={n(app.testers_active)} />
          <Metric label="Full 14" value={n(app.testers_full)} />
          <Metric label="Reports" value={n(app.reports)} />
        </div>

        <div className="flex items-center gap-3 pt-1 text-xs text-[var(--color-mute)]">
          <span className="shrink-0">
            @{app.owner_handle ?? 'unknown'}
            {app.owner_country_code ? ` · ${app.owner_country_code}` : ''}
          </span>
          {focus.length > 0 && (
            <span className="min-w-0 flex-1 truncate text-right">Focus: {focus.join(', ')}</span>
          )}
        </div>
      </Link>
    </Card>
  );
}
