import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, Pill } from '@/components/ui';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { POSTS, postBySlug, otherPosts, formatPublished, isPostSlug } from '@/lib/blog';
import { BODIES } from '@/app/blog/content';

/** Static at build time; the registry in lib/blog.ts is the only source. */
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: post.published,
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // `isPostSlug` narrows the route param to a key `BODIES` is declared over, so
  // the catalogue and the bodies cannot drift apart without a type error.
  if (!isPostSlug(slug)) notFound();
  const post = postBySlug(slug);
  const Body = BODIES[slug];
  if (!post || !Body) notFound();

  const more = otherPosts(slug);

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <article>
          <header className="border-b border-[var(--color-line)] px-4 py-14 sm:px-6 sm:py-16">
            <div className="mx-auto max-w-6xl">
              <Link
                href="/blog"
                className="text-[13px] font-medium text-[var(--color-mute)] transition-colors hover:text-[var(--color-ink)]"
              >
                ← Writing
              </Link>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Pill tone="green">{post.topic}</Pill>
                <span className="num text-xs text-[var(--color-mute)]">
                  {formatPublished(post.published)} · {post.minutes} min read
                </span>
              </div>
              <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-[1.12] tracking-tight sm:text-[2.75rem]">
                {post.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-dim)]">
                {post.description}
              </p>
            </div>
          </header>

          <div className="px-4 py-14 sm:px-6 sm:py-16">
            <div className="mx-auto max-w-6xl">
              <div className="prose">
                <Body />
              </div>
            </div>
          </div>
        </article>

        <section className="border-t border-[var(--color-line)] px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <Card className="p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight">
                See what is open to testers right now
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-dim)]">
                Every app in the pool is in a closed testing track and looking for
                testers. No account needed to look.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/pool" className="btn btn-primary">
                  Browse the pool
                </Link>
                <Link href="/#report" className="btn btn-secondary">
                  See what a review looks like
                </Link>
              </div>
            </Card>

            {more.length > 0 && (
              <>
                <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                  More writing
                </h2>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {more.map((p) => (
                    <Link key={p.slug} href={`/blog/${p.slug}`} className="group block">
                      <Card className="flex h-full flex-col p-5" hover>
                        <span className="num text-[11px] text-[var(--color-mute)]">
                          {p.minutes} min · {p.topic}
                        </span>
                        <h3 className="mt-2 text-[15px] font-semibold leading-snug group-hover:text-[var(--color-accent)]">
                          {p.title}
                        </h3>
                      </Card>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
