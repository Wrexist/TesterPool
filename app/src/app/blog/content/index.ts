/**
 * Slug → body component. The other half of the registry in `lib/blog.ts`:
 * that file holds what a post *is*, this one holds what it *says*.
 *
 * Statically imported rather than lazily resolved, so a slug with no body is a
 * type error at build time instead of a 404 someone finds in production.
 */
import type * as React from 'react';
import type { PostSlug } from '@/lib/blog';

import CanYouBuyAppReviews from './can-you-buy-app-reviews';
import HowToGet12Testers from './how-to-get-12-testers';
import The14DayClock from './the-14-day-clock';
import ReviewExchangeVsPods from './review-exchange-vs-closed-test-pods';
import UsefulTesterReport from './what-a-useful-tester-report-looks-like';

export const BODIES: Record<PostSlug, React.ComponentType> = {
  'can-you-buy-app-reviews': CanYouBuyAppReviews,
  'how-to-get-12-testers': HowToGet12Testers,
  'the-14-day-clock': The14DayClock,
  'review-exchange-vs-closed-test-pods': ReviewExchangeVsPods,
  'what-a-useful-tester-report-looks-like': UsefulTesterReport,
};
