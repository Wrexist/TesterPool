/**
 * TESTERPOOL — the writing.
 *
 * This exists because the competition is found through search and we are not.
 * They rank for "app review exchange" and "how to get 12 testers"; we had one
 * indexable page and it was a pitch. The posts here answer the questions this
 * audience actually types, and the most valuable one is the question we are the
 * only people who can answer honestly — whether you can buy app reviews.
 *
 * No MDX and no content dependency. A post is a TSX module exporting a `Body`
 * component, registered below by slug. That keeps posts type-checked, lets them
 * import the same primitives the product uses, and adds nothing to the bundle
 * that `next build` did not already need.
 *
 * Ordering is by `published`, newest first, and nothing here is dated in the
 * future — a blog that posts ahead of its own clock looks automated.
 */

export interface PostMeta {
  slug: string;
  title: string;
  /** Meta description and the index-card subtitle. One sentence. */
  description: string;
  /** ISO date. Shown, and used for ordering and the sitemap. */
  published: string;
  /** Honest estimate. Reading time that flatters the post is a small lie. */
  minutes: number;
  /** The search intent this post is written against. Also the index filter. */
  topic: 'Google Play' | 'Policy' | 'Testing' | 'TesterPool';
}

/**
 * The catalogue. Adding a post means adding an entry here and a file in
 * `src/app/blog/content/<slug>.tsx` — `generateStaticParams` reads this, so a
 * post with no entry is not routable and an entry with no file fails the build.
 */
export const POSTS = [
  {
    slug: 'can-you-buy-app-reviews',
    title: 'Can you buy app reviews? What Google’s policy actually says',
    description:
      'The honest answer, the exact policy language, what enforcement looks like in practice, and what to do instead when what you really need is feedback.',
    published: '2026-08-14',
    minutes: 9,
    topic: 'Policy',
  },
  {
    slug: 'how-to-get-12-testers',
    title: 'How to get 12 testers for Google Play closed testing',
    description:
      'Every method developers actually use, what each one costs in money and risk, and which ones survive contact with the 14-consecutive-day rule.',
    published: '2026-08-13',
    minutes: 11,
    topic: 'Google Play',
  },
  {
    slug: 'the-14-day-clock',
    title: 'The 14-day clock: why it resets, and how to see it before Google does',
    description:
      'The requirement is not 12 testers. It is 12 testers on the same day, fourteen days running — and the Play Console will not show you the difference until it is too late.',
    published: '2026-08-12',
    minutes: 7,
    topic: 'Google Play',
  },
  {
    slug: 'review-exchange-vs-closed-test-pods',
    title: 'App review exchange vs closed-test pods: what each one actually gets you',
    description:
      'Both trade work between developers. Only one of them touches your public store listing, and that difference decides everything else about the two models.',
    published: '2026-08-11',
    minutes: 8,
    topic: 'Policy',
  },
  {
    slug: 'what-a-useful-tester-report-looks-like',
    title: 'What a useful tester report looks like',
    description:
      'A real report, annotated — plus the three prompts that turn “looks nice” into something you can act on before your users find it.',
    published: '2026-08-10',
    minutes: 6,
    topic: 'Testing',
  },
] as const satisfies readonly PostMeta[];

/**
 * Every slug in the catalogue, as a literal union. `BODIES` is keyed by exactly
 * this, so an indexed post with no body — or a body with no index entry — is a
 * type error rather than a 404 somebody finds in production.
 */
export type PostSlug = (typeof POSTS)[number]['slug'];

/** Narrows an arbitrary route param to a known slug. */
export function isPostSlug(slug: string): slug is PostSlug {
  return POSTS.some((p) => p.slug === slug);
}

export function allPosts(): PostMeta[] {
  return [...POSTS].sort((a, b) => b.published.localeCompare(a.published));
}

export function postBySlug(slug: string): PostMeta | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/** Everything except the one being read, newest first, capped. */
export function otherPosts(slug: string, limit = 3): PostMeta[] {
  return allPosts().filter((p) => p.slug !== slug).slice(0, limit);
}

/** 12 August 2026 — spelled, because a slashed date is ambiguous by country. */
export function formatPublished(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
