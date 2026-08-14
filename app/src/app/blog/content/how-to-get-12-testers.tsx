import * as React from 'react';
import Link from 'next/link';
import { RULES } from '@/lib/economy';

export default function Body() {
  return (
    <>
      <p>
        Google will not grant production access to a personal developer account
        created after 13 November 2023 until it has run a closed test with at
        least {RULES.requiredTesters} testers opted in continuously for{' '}
        {RULES.requiredDays} days. There are six ways people meet that bar. Here
        is what each one actually costs, including the costs nobody quotes.
      </p>

      <h2>1. Friends and family</h2>
      <p>
        Free, and the default first attempt. It fails for a specific reason:{' '}
        {RULES.requiredTesters} is more people than most developers can reliably
        ask, and the requirement is not a one-time favour. Every one of them has
        to stay opted in for {RULES.requiredDays} consecutive days, and Google
        also looks at engagement when reviewing the application. Enthusiasm lasts
        about four days.
      </p>
      <p>
        <strong>Use it for:</strong> the first three or four seats.{' '}
        <strong>Do not rely on it for:</strong> the last eight.
      </p>

      <h2>2. Reddit, Discord and forum swap threads</h2>
      <p>
        Free, genuinely popular, and the most common route. r/androiddev and
        several Discords run standing threads where developers test each
        other&rsquo;s apps.
      </p>
      <p>
        The catch is that it is unenforced. Nobody tracks whether the person you
        tested for stayed opted in, and there is no consequence when they drop
        out on day six. You will spend real hours recruiting, and you will
        discover a broken streak weeks later when the application is rejected.
        Budget for doing it twice.
      </p>

      <h2>3. Paid gigs on freelance marketplaces</h2>
      <p>
        Typically $5&ndash;$40 per run. Immediate, which is the honest advantage
        of paying a stranger.
      </p>
      <p>
        Two problems. The first is that you cannot see what you are buying: a
        seller with twelve accounts on twelve devices in one flat is a different
        risk profile from twelve real people, and the listing looks identical.
        The second is churn &mdash; a single install followed by fourteen days of
        silence satisfies the letter of the count and fails the engagement
        question Google asks in the application.
      </p>

      <h2>4. Review-swap and install-exchange services</h2>
      <p>
        Avoid. These trade <em>public store</em> reviews and installs for points
        or money, which is an incentivised review under Google&rsquo;s policy
        regardless of how genuine the opinion is. They also do not solve the
        problem you have: closed-track testers and store ratings are different
        requirements, and a five-star review does nothing for your{' '}
        {RULES.requiredTesters}-tester count.
      </p>
      <p>
        <Link href="/blog/can-you-buy-app-reviews">
          The policy detail and what enforcement looks like
        </Link>{' '}
        is worth reading before you sign up to one of these.
      </p>

      <h2>5. Recruiting real users directly</h2>
      <p>
        Landing page, waitlist, a post in a community where your actual audience
        already is. Slow &mdash; usually weeks &mdash; but these are the only
        testers on this list whose feedback tells you whether the product works
        for the people it is for.
      </p>
      <p>
        <strong>Use it for:</strong> the long game, always.{' '}
        <strong>Do not rely on it for:</strong> a deadline four weeks out.
      </p>

      <h2>6. Closed-test pods</h2>
      <p>
        A fixed cohort of developers who all run the same{' '}
        {RULES.requiredDays}-day window together, testing each other. Everyone in
        the group needs the same thing at the same time, which is what makes the
        commitment stick where a swap thread&rsquo;s does not.
      </p>
      <p>
        What to check before joining one: whether it tracks daily engagement or
        only the opt-in, whether it replaces someone who drops out mid-cycle,
        whether it seats more than {RULES.requiredTesters} so a dropout is not
        fatal, and whether it touches the public store surface at all. If it
        offers you store reviews, it is item 4 wearing a different name.
      </p>

      <h2>What to actually do</h2>
      <p>
        Stack them. Take the three or four seats you can get from people you
        know, get the rest from a cohort that has a buffer and a dropout policy,
        and start the slow work of recruiting real users in parallel because that
        is the only one that compounds.
      </p>
      <p>
        The thing to optimise is not reaching {RULES.requiredTesters}. It is
        reaching {RULES.requiredTesters} <em>and not losing one on day nine</em>,
        because{' '}
        <Link href="/blog/the-14-day-clock">the clock resets when you do</Link>{' '}
        and you will not be told.
      </p>
    </>
  );
}
