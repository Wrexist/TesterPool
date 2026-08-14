import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Pill } from '@/components/ui';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { allPosts, formatPublished } from '@/lib/blog';
import { RULES } from '@/lib/economy';

export const metadata: Metadata = {
  title: 'Writing',
  description:
    'What the 12-tester rule actually requires, what Google’s policy says about buying reviews, and how to get an Android app tested without risking the account you are trying to launch from.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Writing · TesterPool',
    description:
      'Straight answers on Google Play’s 12-tester requirement, review policy, and getting an app tested.',
    url: '/blog',
  },
};

export default function BlogIndex() {
  const posts = allPosts();
  const [lead, ...rest] = posts;

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <section className="dotgrid border-b border-[var(--color-line)] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
                Writing
              </div>
              <h1 className="text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl">
                Straight answers about getting an Android app launched
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-[var(--color-dim)]">
                Google Play&rsquo;s {RULES.requiredTesters}-tester requirement is
                badly documented and expensively misunderstood, and most of what is
                written about it is written by people selling something that would
                get your account terminated. These are the posts we wanted to read.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            {lead && (
              <Link href={`/blog/${lead.slug}`} className="group block">
                <Card className="p-6 sm:p-8" hover>
                  <div className="flex flex-wrap items-center gap-3">
                    <Pill tone="green">{lead.topic}</Pill>
                    <span className="num text-xs text-[var(--color-mute)]">
                      {formatPublished(lead.published)} · {lead.minutes} min read
                    </span>
                  </div>
                  <h2 className="mt-4 max-w-3xl text-2xl font-bold leading-tight tracking-tight group-hover:text-[var(--color-accent)] sm:text-3xl">
                    {lead.title}
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-dim)]">
                    {lead.description}
                  </p>
                </Card>
              </Link>
            )}

            {rest.length > 0 && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {rest.map((p) => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="group block">
                    <Card className="flex h-full flex-col p-6" hover>
                      <div className="flex flex-wrap items-center gap-3">
                        <Pill tone="neutral">{p.topic}</Pill>
                        <span className="num text-xs text-[var(--color-mute)]">
                          {formatPublished(p.published)} · {p.minutes} min
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold leading-snug group-hover:text-[var(--color-accent)]">
                        {p.title}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-dim)]">
                        {p.description}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
