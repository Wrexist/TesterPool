/**
 * Client-side Sentry init. Deliberately a no-op without
 * NEXT_PUBLIC_SENTRY_DSN — set it once a Sentry project exists
 * (sentry.io -> Projects -> Create project (Next.js) -> Client Keys).
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
