/**
 * TESTERPOOL — shared primitives.
 * The signature components are StreakStrip (14 days at a glance),
 * ReliabilityGauge (the trust number) and CreditChip (the currency).
 */
import * as React from 'react';
import { reliabilityBand, TIERS, type TierKey } from '@/lib/economy';

/* ------------------------------------------------------------------ utils */
export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------- card */
export function Card({
  className, children, hover = false, ...rest
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cx('card', hover && 'card-hover', className)} {...rest}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- pill */
const PILL_TONES = {
  neutral: 'color:var(--color-dim);border-color:var(--color-line);background:var(--color-surface-2)',
  green:   'color:var(--color-android);border-color:color-mix(in oklab,var(--color-android) 30%,transparent);background:var(--color-android-soft)',
  amber:   'color:#9A6510;border-color:color-mix(in oklab,var(--color-credit) 40%,transparent);background:var(--color-credit-soft)',
  red:     'color:var(--color-danger);border-color:color-mix(in oklab,var(--color-danger) 32%,transparent);background:color-mix(in oklab,var(--color-danger) 10%,transparent)',
  violet:  'color:var(--color-accent);border-color:transparent;background:var(--color-accent-soft)',
} as const;

export type Tone = keyof typeof PILL_TONES;

function toneStyle(tone: Tone): React.CSSProperties {
  return Object.fromEntries(
    PILL_TONES[tone].split(';').map((d) => {
      const [k, v] = d.split(':');
      return [k.replace(/-./g, (m) => m[1].toUpperCase()), v];
    })
  ) as React.CSSProperties;
}

export function Pill({
  tone = 'neutral', children, className,
}: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('pill', className)} style={toneStyle(tone)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ credit chip */
export function CreditChip({
  amount, size = 'md', signed = false,
}: { amount: number; size?: 'sm' | 'md' | 'lg'; signed?: boolean }) {
  const px = { sm: 11, md: 13, lg: 17 }[size];
  const positive = amount >= 0;
  return (
    <span
      className="num inline-flex items-center gap-1 font-semibold"
      style={{
        fontSize: px,
        color: signed && !positive ? 'var(--color-dim)' : 'var(--color-credit)',
      }}
    >
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z"
          stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        />
      </svg>
      {signed && positive ? '+' : ''}
      {amount.toLocaleString()}
    </span>
  );
}

/* ----------------------------------------------------------- streak strip */
export type DayState = 'done' | 'today' | 'missed' | 'future';

/**
 * The single most important component in the product. A developer must be able
 * to see, in one glance and without reading, whether their 14-day clock is
 * intact — because a broken clock costs them a month.
 */
export function StreakStrip({
  days, total = 14, size = 12, gap = 3,
}: { days: DayState[]; total?: number; size?: number; gap?: number }) {
  const cells: DayState[] = Array.from({ length: total }, (_, i) => days[i] ?? 'future');
  return (
    <div className="flex items-center" style={{ gap }} role="img"
         aria-label={`${cells.filter((d) => d === 'done').length} of ${total} days checked in`}>
      {cells.map((state, i) => (
        <span
          key={i}
          title={`Day ${i + 1}`}
          style={{
            width: size, height: size, borderRadius: Math.max(2, size / 4),
            background:
              state === 'done'   ? 'var(--color-accent)'
            : state === 'today'  ? 'transparent'
            : state === 'missed' ? 'color-mix(in oklab, var(--color-danger) 55%, transparent)'
            :                      'var(--color-surface-2)',
            border:
              state === 'today' ? '1.5px solid var(--color-accent)'
            : state === 'future' ? '1px solid var(--color-line)'
            : 'none',
            boxShadow: state === 'done' ? '0 0 6px color-mix(in oklab, var(--color-accent) 35%, transparent)' : undefined,
          }}
        />
      ))}
    </div>
  );
}

/** Build a strip from a plain check-in count. */
export function streakFromCount(done: number, currentDay: number, total = 14): DayState[] {
  return Array.from({ length: total }, (_, i) => {
    const day = i + 1;
    if (day <= done) return 'done';
    if (day === currentDay) return 'today';
    if (day < currentDay) return 'missed';
    return 'future';
  });
}

/* ------------------------------------------------------- reliability gauge */
/**
 * The reliability score, as a 270° arc with the gap at the bottom.
 *
 * Three things were wrong with the first version and all three were about the
 * label rather than the arc:
 *
 *  - Everything was hardcoded to the 88px default. `r = size/2 - 7` and a fixed
 *    6px stroke meant that at 64px the ring nearly touched its own bounding box,
 *    and at 132px it read as a hairline. Both scale with `size` now.
 *  - The number and the band label were centred as a block inside the FULL
 *    square, which put the label straight into the arc's bottom opening. The
 *    text is nudged up by a fraction of the radius so it sits inside the ring
 *    rather than across its gap.
 *  - `9px` uppercase with `tracking-wide` is below the size where letter-spacing
 *    helps legibility; it made "BUILDING" look like texture. The label scales
 *    too, and drops out entirely below the size where it could be read.
 *
 * The track keeps a butt cap and the fill keeps a round one, deliberately: a
 * round cap on both made the empty track look like it had a value of about 3.
 */
export function ReliabilityGauge({
  score, size = 88, label = true,
}: { score: number; size?: number; label?: boolean }) {
  const band = reliabilityBand(score);
  const value = Math.max(0, Math.min(100, score));

  const stroke = Math.max(4, Math.round(size * 0.075));
  const r = (size - stroke) / 2 - Math.round(size * 0.03);
  const c = 2 * Math.PI * r;
  const sweep = 0.75;                       // 270°, opening at the bottom
  const len = c * sweep;
  const filled = len * value / 100;

  /*
   * The longest band word is "BUILDING" — eight characters — and it has to fit
   * inside the ring, not across it. Below about 72px there is no font size that
   * both clears the minimum legible 8.5px and stays inside the arc, so the word
   * is dropped and the number grows to fill the space it was using. Callers who
   * want the band at a small size have the colour, which carries the same three
   * states without needing any width at all.
   */
  const showLabel = label && size >= 72;
  const numberSize = showLabel ? size / 3.2 : size / 2.6;
  const labelSize = Math.max(8.5, size * 0.105);

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Reliability ${Math.round(value)} of 100 — ${band.label}`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }} aria-hidden>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--color-surface-2)" strokeWidth={stroke} strokeLinecap="butt"
          strokeDasharray={`${len} ${c}`}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={band.color} strokeWidth={stroke} strokeLinecap="round"
          // A zero score should draw nothing at all; a round cap on a
          // zero-length dash still paints a dot the size of the stroke.
          strokeDasharray={`${filled} ${c}`}
          style={{
            opacity: value > 0 ? 1 : 0,
            transition: 'stroke-dasharray .7s cubic-bezier(.2,.8,.2,1), stroke .3s',
          }}
        />
      </svg>

      {/* Nudged up so the two lines sit inside the ring instead of straddling
          the opening at the bottom. */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center leading-none"
        style={{ transform: `translateY(-${Math.round(size * 0.045)}px)` }}
      >
        <span
          className="num font-bold tabular-nums"
          style={{ fontSize: numberSize, color: band.color, lineHeight: 1 }}
        >
          {Math.round(value)}
        </span>
        {showLabel && (
          <span
            className="font-semibold uppercase text-[var(--color-mute)]"
            style={{
              fontSize: labelSize,
              letterSpacing: '.04em',
              marginTop: Math.round(size * 0.05),
              lineHeight: 1,
            }}
          >
            {band.label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ progress ring */
export function ProgressRing({
  value, max, size = 150, stroke = 10, caption, sub,
}: { value: number; max: number; size?: number; stroke?: number; caption?: string; sub?: string }) {
  const r = size / 2 - stroke / 2 - 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="var(--color-accent)" strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={`${c * pct} ${c}`}
                style={{ transition: 'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="num font-bold leading-none" style={{ fontSize: size / 4.5 }}>
          {value}<span className="text-[var(--color-mute)]">/{max}</span>
        </div>
        {caption && <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-dim)]">{caption}</div>}
        {sub && <div className="mt-0.5 text-[11px] text-[var(--color-mute)]">{sub}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ tier badge */
export function TierBadge({ tier, size = 'md' }: { tier: TierKey; size?: 'sm' | 'md' }) {
  const t = TIERS[tier];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wide',
        size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      )}
      style={{ color: t.color, borderColor: t.ring, background: `color-mix(in oklab, ${t.color} 9%, transparent)` }}
    >
      <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: t.color }} />
      {t.label}
    </span>
  );
}

/* ------------------------------------------------------------- stat tile */
export function Stat({
  label, value, sub, tone,
}: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">{label}</div>
      <div className="num mt-1 text-2xl font-bold leading-none" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--color-dim)]">{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- avatar */
export function Avatar({
  name, src, size = 32, ring,
}: { name: string; src?: string | null; size?: number; ring?: string }) {
  const initials = name.split(/[\s_-]+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('');
  const hue = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} width={size} height={size}
         className="rounded-full object-cover"
         style={{ width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }} />
  ) : (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: `oklch(0.93 0.045 ${hue})`, color: `oklch(0.44 0.11 ${hue})`,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
    >
      {initials || '?'}
    </span>
  );
}

/* ------------------------------------------------------------ disclosure */
/**
 * Optional detail, folded away until asked for. Native details/summary, so it
 * works with no JavaScript and stays keyboard-operable for free.
 *
 * Anything a user can skip belongs in here rather than on the page: a form that
 * shows eight fields at once reads as eight required fields.
 */
export function Disclosure({
  summary, hint, children, open = false, className,
}: {
  summary: string;
  hint?: string;
  children: React.ReactNode;
  open?: boolean;
  className?: string;
}) {
  return (
    <details className={cx('disclosure', className)} open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 text-sm font-semibold text-[var(--color-dim)] transition-colors hover:text-[var(--color-ink)]">
        <svg
          className="disclosure-chevron shrink-0 transition-transform"
          width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden
        >
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {summary}
        {hint && <span className="font-normal text-[var(--color-mute)]">{hint}</span>}
      </summary>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </details>
  );
}

/* --------------------------------------------------------------- section */
export function EmptyState({
  icon, title, body, action,
}: { icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-line)] px-6 py-14 text-center">
      {icon && <div className="mb-3 text-[var(--color-mute)]">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-dim)]">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
