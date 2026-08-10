/**
 * TESTERPOOL — logo. A hexagon built from six nodes: fifteen people arranged into
 * one shape. The centre node is the app being tested.
 */
import * as React from 'react';
import { cx } from '@/components/ui';

const NODES: Array<[number, number]> = [
  [16, 4.4],
  [26, 10.2],
  [26, 21.8],
  [16, 27.6],
  [6, 21.8],
  [6, 10.2],
];

export function LogoMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <g fill="var(--color-accent)">
        {NODES.map(([cx_, cy], i) => (
          <circle key={i} cx={cx_} cy={cy} r={2.5} />
        ))}
        <circle cx={16} cy={16} r={3.4} fillOpacity={0.45} />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cx('text-[15px] font-bold tracking-tight', className)}
      style={{ letterSpacing: '-0.02em' }}
    >
      TesterPool
    </span>
  );
}

export function Logo({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      <Wordmark />
    </span>
  );
}
