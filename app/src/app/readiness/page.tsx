import type { Metadata } from 'next';
import ReadinessChecker from './ReadinessChecker';

export const metadata: Metadata = {
  title: 'Production Access Readiness Checker',
  description:
    'Ten questions that map to the ten ways a Google Play production access application actually gets rejected. Free, no signup, runs entirely in your browser.',
  alternates: { canonical: '/readiness' },
  openGraph: {
    title: 'Production Access Readiness Checker · TesterPool',
    description:
      'Find out which of the ten common rejection reasons is going to get you, in about two minutes.',
    url: '/readiness',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Production Access Readiness Checker · TesterPool',
    description:
      'Find out which of the ten common rejection reasons is going to get you, in about two minutes.',
  },
};

export default function ReadinessPage() {
  return <ReadinessChecker />;
}
