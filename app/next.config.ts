import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // `/pool` was the public browse page and is in the sitemap at priority
      // 0.9, so it has inbound links and index entries. It is `/feed` now;
      // 308 keeps both.
      { source: '/pool', destination: '/feed', permanent: true },
      // `/pods` is gone entirely. The feed is what it pointed people at.
      { source: '/pods', destination: '/market', permanent: true },
    ];
  },
};

// Safe with no Sentry project configured: without SENTRY_AUTH_TOKEN (and
// NEXT_PUBLIC_SENTRY_DSN unset at runtime, see instrumentation-client.ts)
// this just skips the source-map upload step and builds normally.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
