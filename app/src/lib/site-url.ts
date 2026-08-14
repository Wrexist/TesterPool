/**
 * The one canonical origin, resolved once.
 *
 * `sitemap.ts` and `robots.ts` each used to carry their own
 * `process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'`. Two copies of
 * a fallback is two chances to disagree, and the failure is quiet in the worst
 * possible way: a production build with the variable unset publishes a sitemap
 * full of `http://localhost:3000/...` and a robots.txt pointing at the same,
 * which a crawler reads as a site that does not exist.
 *
 * So: in production the variable is required and a missing or malformed value
 * throws at build time. Loud at deploy beats invisible in the index. Vercel's
 * `VERCEL_URL` is accepted as a fallback because preview deployments get one
 * automatically and should be self-consistent rather than pointing at prod.
 */

function normalise(raw: string): string {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  // Throws on a malformed value, which is the point.
  const url = new URL(withScheme);
  return url.origin;
}

export const SITE_URL: string = (() => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return normalise(configured);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return normalise(vercel);

  // Gated on VERCEL_ENV rather than NODE_ENV. `next build` sets NODE_ENV to
  // production for every build, including a developer's local one, so throwing
  // on that would break `npm run build` for anyone without the variable set —
  // trading a metadata bug for a broken build gate. VERCEL_ENV is 'production'
  // only on a real production deployment, which is the one place publishing
  // localhost URLs actually costs something.
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL is not set. Discovery metadata (sitemap.xml, ' +
        'robots.txt, canonical URLs) would be published pointing at localhost.'
    );
  }

  return 'http://localhost:3000';
})();

/** Absolute URL for a site-relative path. `''` yields the bare origin. */
export function absoluteUrl(path = ''): string {
  return `${SITE_URL}${path}`;
}
