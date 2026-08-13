import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Safe with no Sentry project configured: without SENTRY_AUTH_TOKEN (and
// NEXT_PUBLIC_SENTRY_DSN unset at runtime, see instrumentation-client.ts)
// this just skips the source-map upload step and builds normally.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
