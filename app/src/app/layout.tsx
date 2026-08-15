import * as React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { PostHogProvider } from '@/components/PostHogProvider';
import { SITE_URL } from '@/lib/site-url';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

/*
 * Lead with the loop, not the cohort — same reposition as the landing page, and it
 * matters more here, because a search result and a shared link are the actual
 * first sight for most people who ever reach us.
 *
 * The old copy also promised "no money", which the pricing page contradicts.
 * A claim the site itself disproves two clicks later is worse than no claim.
 */
const TITLE = 'TesterPool — Get your Android app reviewed by 14 developers';

/*
 * The keyword list intentionally includes the store-review searches, because
 * that is what a large share of this audience actually types. The page answers
 * them honestly — see the first FAQ entry — rather than either ignoring the
 * demand or pretending to serve it. The description has to carry the
 * disambiguation on its own: in a search result it is all anyone reads.
 */
const DESCRIPTION =
  'List your Android app and 14 indie developers install it, use it for 14 days, and each send you one structured review — what broke, on which device, what they would change. Private reviews inside your closed testing track, never Play Store reviews or ratings. Google Play’s 12-tester requirement is satisfied on the way through.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · TesterPool',
  },
  description: DESCRIPTION,
  applicationName: 'TesterPool',
  keywords: [
    'Google Play 12 testers',
    '14 day closed testing',
    'production access',
    'Android beta testers',
    'closed testing track',
    'app testing exchange',
    'test apps for credits',
    'get reviews for my app',
    'app review exchange',
    'Android app feedback',
  ],
  openGraph: {
    type: 'website',
    siteName: 'TesterPool',
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`dark h-full ${inter.variable} antialiased`}
      // Point the design-token font stack at the self-hosted Inter that
      // next/font just fingerprinted, rather than hoping it is installed.
      style={
        {
          '--font-sans':
            'var(--font-inter), ui-sans-serif, system-ui, -apple-system, sans-serif',
        } as React.CSSProperties
      }
    >
      <body className="flex min-h-full flex-col">
        <PostHogProvider>{children}</PostHogProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
