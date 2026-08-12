'use client';

/**
 * PostHog product analytics. No-ops entirely without
 * NEXT_PUBLIC_POSTHOG_KEY — every call below either never fires (init) or is
 * a guarded no-op (capturePageview), so a deployment that has not created a
 * PostHog project yet behaves exactly as it did before this file existed.
 */
import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

function initPostHog() {
  if (initialized || !KEY || typeof window === 'undefined') return;
  posthog.init(KEY, {
    api_host: HOST,
    // App Router has no built-in route-change event; pageviews are sent
    // manually from PageviewTracker below instead of on every mount.
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: 'identified_only',
  });
  initialized = true;
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (!KEY) return;
    initPostHog();
    const query = searchParams.toString();
    posthog.capture('$pageview', {
      $current_url: query ? `${pathname}?${query}` : pathname,
    });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    initPostHog();
  }, []);

  return (
    <>
      {KEY && (
        <React.Suspense fallback={null}>
          <PageviewTracker />
        </React.Suspense>
      )}
      {children}
    </>
  );
}
