import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * The authenticated surface is disallowed rather than left to `noindex`: those
 * routes are behind auth anyway, so a crawler following them only burns budget
 * on redirects to the login page. `/g/` is the shareable greenlight card, which
 * should be indexable — it is a public artefact by design.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/api/',
        '/apps',
        '/billing',
        '/credits',
        '/dashboard',
        '/feedback',
        '/leaderboard',
        '/market',
        '/mod',
        '/onboarding',
        '/pods',
        '/tests',
        '/auth/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
