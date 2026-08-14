import Link from 'next/link';
import { StarGlyph } from '@/components/app/app-row';
import { n } from '@/lib/format';

/**
 * TESTERPOOL — the greeting header.
 *
 * Four things, and no more: who you are, what you hold, your messages, your
 * alerts. It is the only place the balance appears on every screen, which is
 * why the balance is a link — a number you cannot act on is decoration, and a
 * developer who reads "10" here needs one tap to find out why that is not
 * enough.
 *
 * The greeting is time-of-day rather than a static "Welcome back". It is a
 * small thing and it is the difference between a page and a place.
 */

function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Read outside render: a clock read during render is not idempotent. */
function currentHour(): number {
  return new Date().getHours();
}

function RoundButton({
  href, label, badge, children,
}: {
  href: string;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={badge ? `${label}, ${badge} unread` : label}
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] transition-colors hover:border-[var(--color-line-hi)] hover:bg-[var(--color-surface-2)]"
    >
      {children}
      {!!badge && (
        <span
          className="num absolute -right-1 -top-1 min-w-[22px] rounded-full px-1.5 text-center text-[11px] font-bold leading-[20px]"
          style={{ background: 'var(--color-danger)', color: '#fff' }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

export function AppHeader({
  displayName,
  credits,
  messages = 0,
  alerts = 0,
}: {
  displayName: string;
  credits: number;
  messages?: number;
  alerts?: number;
}) {
  // First name only. "Good evening, Isac Molin" is a form letter; "Good
  // evening, Isac" is a greeting.
  const first = (displayName || '').trim().split(/\s+/)[0] || 'there';

  return (
    <header className="flex items-center gap-2.5 pb-1 pt-1">
      {/* 22px on a phone, because at 26px "Good evening, Isac" truncates to
          "Good evening, …" and drops the only part of it that is about them. */}
      <h1 className="min-w-0 flex-1 truncate text-[22px] font-bold leading-tight tracking-tight sm:text-[26px] md:text-[30px]">
        {greeting(currentHour())}, {first}
      </h1>

      <Link
        href="/credits"
        aria-label={`${n(credits)} credits`}
        className="num inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[15px] font-bold transition-opacity hover:opacity-90"
        style={{ background: 'var(--color-accent)', color: '#fff' }}
      >
        <StarGlyph size={15} />
        {n(credits)}
      </Link>

      <RoundButton href="/feedback" label="Reports on your apps" badge={messages}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 11.6a7.6 7.6 0 0 1-7.6 7.6H8l-4 2.4 1.1-3.2A7.6 7.6 0 1 1 21 11.6Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
          />
          <circle cx="9" cy="11.5" r="1" fill="currentColor" />
          <circle cx="12.5" cy="11.5" r="1" fill="currentColor" />
          <circle cx="16" cy="11.5" r="1" fill="currentColor" />
        </svg>
      </RoundButton>

      <RoundButton href="/tests" label="Work you have open" badge={alerts}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.2a1.3 1.3 0 0 1 1.3 1.3v.6a6 6 0 0 1 4.7 5.86v3.3l1.5 2.5a1 1 0 0 1-.86 1.51H5.36a1 1 0 0 1-.86-1.51L6 13.26v-3.3A6 6 0 0 1 10.7 4.1v-.6A1.3 1.3 0 0 1 12 2.2Z" />
          <path d="M9.6 19.2h4.8a2.4 2.4 0 0 1-4.8 0Z" />
        </svg>
      </RoundButton>
    </header>
  );
}
