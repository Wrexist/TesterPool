/**
 * TESTERPOOL — presentational parts shared across the admin surface.
 *
 * All server-safe: no state, no effects, inline SVG only. Anything that needs a
 * click lives in a `'use client'` island next to it.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, Pill, cx, type Tone } from '@/components/ui';
import { IconArrow } from '@/components/app/icons';
import { jsonDiff, humanKey, TONE_COPY, type AnnouncementTone, type DiffLine } from '@/lib/admin';

/* ---------------------------------------------------------------- section */

export function Section({
  title,
  note,
  right,
  children,
  className,
}: {
  title: string;
  note?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {note && <p className="mt-0.5 max-w-3xl text-xs text-[var(--color-mute)]">{note}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------- row shell */

export function RowList({ children }: { children: React.ReactNode }) {
  return <Card className="overflow-hidden">{children}</Card>;
}

export function Row({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const body = (
    <div
      className={cx(
        'flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 last:border-b-0',
        href && 'transition-colors hover:bg-[var(--color-surface-2)]',
        className
      )}
    >
      {children}
      {href && <span className="ml-auto shrink-0 text-[var(--color-mute)]"><IconArrow size={15} /></span>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/* -------------------------------------------------------------- sparkline */

export interface SparkPoint {
  label: string;
  value: number;
}

/**
 * Fourteen days of check-ins, drawn small. The shape is the signal: a flat line
 * at zero means the core loop stopped, and that is the first thing to know.
 */
export function Sparkline({
  points,
  width = 280,
  height = 56,
  caption,
}: {
  points: SparkPoint[];
  width?: number;
  height?: number;
  caption?: string;
}) {
  if (points.length === 0) {
    return <p className="text-xs text-[var(--color-mute)]">No check-in history to draw yet.</p>;
  }

  const pad = 4;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);

  const coords = points.map((p, i) => [pad + i * stepX, y(p.value)] as const);
  const path = coords.map(([x, yy], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${yy.toFixed(1)}`).join(' ');
  const area = `${path} L${(pad + (points.length - 1) * stepX).toFixed(1)} ${height - pad} L${pad} ${height - pad} Z`;
  const last = points[points.length - 1];

  return (
    <div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Check-ins per day over the last ${points.length} days, ending at ${last.value}`}
        className="max-w-full"
      >
        <path d={area} fill="color-mix(in oklab, var(--color-accent) 12%, transparent)" />
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map(([x, yy], i) => (
          <circle
            key={i}
            cx={x}
            cy={yy}
            r={i === coords.length - 1 ? 2.6 : 1.4}
            fill={i === coords.length - 1 ? 'var(--color-accent)' : 'color-mix(in oklab, var(--color-accent) 55%, transparent)'}
          >
            <title>{`${points[i].label}: ${points[i].value}`}</title>
          </circle>
        ))}
      </svg>
      {caption && <div className="mt-1 text-[11px] text-[var(--color-mute)]">{caption}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- diff */

const DIFF_TONE: Record<DiffLine['kind'], string> = {
  added: 'var(--color-accent)',
  removed: 'var(--color-danger)',
  changed: 'var(--color-credit)',
  same: 'var(--color-mute)',
};

/** Reads a before/after jsonb pair as sentences, not as a blob of JSON. */
export function DiffView({
  before,
  after,
  emptyNote = 'No field-level change was recorded for this entry.',
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  emptyNote?: string;
}) {
  const lines = jsonDiff(before, after);

  if (lines.length === 0) {
    return <p className="text-xs text-[var(--color-mute)]">{emptyNote}</p>;
  }

  return (
    <dl className="flex flex-col gap-1">
      {lines.map((line) => (
        <div key={line.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
          <dt className="font-medium text-[var(--color-dim)]">{line.label}</dt>
          <dd className="flex items-baseline gap-1.5">
            <span className="num text-[var(--color-mute)] line-through decoration-[var(--color-line-hi)]">
              {line.before ?? 'not set'}
            </span>
            <span aria-hidden className="text-[var(--color-mute)]">&rarr;</span>
            <span className="num font-semibold" style={{ color: DIFF_TONE[line.kind] }}>
              {line.after ?? 'cleared'}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* --------------------------------------------------------- key/value pair */

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-mute)]">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

export { humanKey };

/* ---------------------------------------------------- announcement banner */

const BANNER_STYLE: Record<AnnouncementTone, { border: string; bg: string; color: string }> = {
  info: {
    border: 'var(--color-line-hi)',
    bg: 'var(--color-surface-2)',
    color: 'var(--color-dim)',
  },
  warning: {
    border: 'color-mix(in oklab, var(--color-credit) 40%, transparent)',
    bg: 'color-mix(in oklab, var(--color-credit) 10%, transparent)',
    color: 'var(--color-credit)',
  },
  critical: {
    border: 'color-mix(in oklab, var(--color-danger) 45%, transparent)',
    bg: 'color-mix(in oklab, var(--color-danger) 12%, transparent)',
    color: 'var(--color-danger)',
  },
};

/** Exactly what a signed-in user will see. Used for the live preview and the list. */
export function AnnouncementBanner({ body, tone }: { body: string; tone: AnnouncementTone }) {
  const style = BANNER_STYLE[tone];
  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm"
      style={{ borderColor: style.border, background: style.bg }}
      role="note"
    >
      <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: style.color }}>
        {TONE_COPY[tone].label}
      </span>
      <span className="text-[var(--color-ink)]">{body || 'Your announcement text will appear here.'}</span>
    </div>
  );
}

/* --------------------------------------------------------------- warnings */

export function WarnBox({
  tone = 'amber',
  children,
}: {
  tone?: 'amber' | 'red' | 'neutral';
  children: React.ReactNode;
}) {
  const colour =
    tone === 'red' ? 'var(--color-danger)' : tone === 'amber' ? 'var(--color-credit)' : 'var(--color-mute)';
  return (
    <p
      className="rounded-lg border px-3 py-2 text-xs"
      style={{
        borderColor: `color-mix(in oklab, ${colour} 35%, transparent)`,
        background: `color-mix(in oklab, ${colour} 8%, transparent)`,
        color: tone === 'neutral' ? 'var(--color-dim)' : colour,
      }}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------- count pill */

export function CountPill({ value, tone }: { value: number; tone?: Tone }) {
  return (
    <Pill tone={tone ?? (value > 0 ? 'amber' : 'neutral')}>
      <span className="num">{value}</span>
    </Pill>
  );
}
