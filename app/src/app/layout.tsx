import * as React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { PostHogProvider } from '@/components/PostHogProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/*
 * Lead with the loop, not the pod — same reposition as the landing page, and it
 * matters more here, because a search result and a shared link are the actual
 * first sight for most people who ever reach us.
 *
 * The old copy also promised "no money", which the pricing page contradicts.
 * A claim the site itself disproves two clicks later is worse than no claim.
 */
const TITLE = 'TesterPool — Test apps, earn testers, ship on Google Play';

const DESCRIPTION =
  'Install apps from a pool of indie Android developers, send one structured report, and earn the 12 testers Google Play requires you to hold for 14 consecutive days. Closed testing tracks only — no store reviews, no ratings, no policy risk.';

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
