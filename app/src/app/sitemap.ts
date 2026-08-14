import type { MetadataRoute } from 'next';
import { allPosts } from '@/lib/blog';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Only the public surface. Everything under `(app)` is behind auth and has
 * nothing to offer a crawler, and `/pool` is deliberately in here because it is
 * the one page that shows what the network contains rather than describing it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: Array<{ path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '', priority: 1, freq: 'weekly' },
    { path: '/pool', priority: 0.9, freq: 'daily' },
    { path: '/blog', priority: 0.8, freq: 'weekly' },
    { path: '/readiness', priority: 0.7, freq: 'monthly' },
    { path: '/launch', priority: 0.6, freq: 'daily' },
    { path: '/terms', priority: 0.2, freq: 'yearly' },
    { path: '/privacy', priority: 0.2, freq: 'yearly' },
  ];

  const now = new Date();

  return [
    ...staticPages.map((p) => ({
      url: `${SITE_URL}${p.path}`,
      lastModified: now,
      changeFrequency: p.freq,
      priority: p.priority,
    })),
    ...allPosts().map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(`${p.published}T00:00:00Z`),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
