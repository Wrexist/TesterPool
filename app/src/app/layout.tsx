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

const DESCRIPTION =
  'Google Play needs 12 testers for 14 consecutive days. TesterPool puts you in a pod of 15 developers who test each other for the same 14 days — no money, no policy risk, no ghosting.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'TesterPool — Get your 12. Keep them 14 days. Ship.',
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
  ],
  openGraph: {
    type: 'website',
    siteName: 'TesterPool',
    url: SITE_URL,
    title: 'TesterPool — Get your 12. Keep them 14 days. Ship.',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TesterPool — Get your 12. Keep them 14 days. Ship.',
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
