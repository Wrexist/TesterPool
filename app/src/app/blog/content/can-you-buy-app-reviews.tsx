import * as React from 'react';
import Link from 'next/link';
import { RULES } from '@/lib/economy';

const POLICY =
  'https://support.google.com/googleplay/android-developer/answer/9898684';

export default function Body() {
  return (
    <>
      <p>
        Short answer: no, and the services telling you otherwise are selling you a
        risk they are not pricing. The longer answer is worth your time, because
        the reason people go looking for paid reviews is usually a real problem
        that has a legitimate solution.
      </p>

      <h2>What the policy actually says</h2>
      <p>
        Google Play&rsquo;s{' '}
        <a href={POLICY} target="_blank" rel="noopener noreferrer">
          Ratings, Reviews and Installs policy
        </a>{' '}
        prohibits developers from attempting to manipulate the placement of their
        apps, and names the specific mechanisms: incentivising or paying for
        ratings, reviews or installs. Apple says the same thing in App Store
        Review Guideline 3, in fewer words.
      </p>
      <p>
        The part people misread is <strong>what counts as payment</strong>. It is
        not limited to cash. A review given in exchange for a review, for points,
        for credits, for a gift card, for entry into a draw, or for anything else
        of value is an incentivised review. The exchange is the violation. The
        sincerity of the reviewer does not enter into it, which is why &ldquo;but
        they are real people leaving honest opinions&rdquo; is not the defence it
        sounds like.
      </p>
      <blockquote>
        <p>
          If a review would not have been written without something being given
          for it, it is incentivised. That is the whole test.
        </p>
      </blockquote>

      <h2>What enforcement looks like</h2>
      <p>
        The failure people imagine is that the reviews get deleted. That does
        happen, and it is the mildest outcome. In its 2024 report on Play
        security, Google said it prevented more than 2.36 million
        policy-violating apps from being published and banned over 158,000
        developer accounts. Termination is account-level: every app you have
        published goes with it, and you cannot publish new ones.
      </p>
      <p>
        The part that matters specifically for exchange networks is that risk
        appears to travel. Reporting through early 2026 describes accounts
        inheriting risk by association &mdash; a device fingerprint, an IP subnet,
        a payment method or a phone number that has appeared alongside a
        terminated account carries that history forward. A review-trading network
        is, structurally, a dense graph of exactly those signals. Its downside is
        not distributed across its members independently; it is correlated. If it
        goes wrong, it goes wrong for a lot of people at once, and the people who
        lose their accounts are the developers, not the platform that matched
        them.
      </p>
      <p>
        Notice also that these services tend to carry a content policy stating
        that fake, paid or incentivised content is prohibited. Read that next to
        the product description offering points per review. Both cannot be true.
        The policy is there to be pointed at when enforcement arrives, and it
        points at you.
      </p>

      <h2>What you actually needed</h2>
      <p>
        Almost nobody wants store reviews for their own sake. Underneath the
        request there are usually one of two problems, and both have answers that
        do not put the account at risk.
      </p>

      <h3>&ldquo;I cannot publish yet&rdquo;</h3>
      <p>
        If your developer account was created after 13 November 2023, Google will
        not grant production access until you have run a closed test with at
        least {RULES.requiredTesters} testers opted in continuously for{' '}
        {RULES.requiredDays} days. This is the real blocker for most people
        searching for paid installs, and buying reviews does not solve it at all
        &mdash; closed-track testers are a completely different requirement from
        store ratings.
      </p>
      <p>
        The legitimate route is other developers in the same position.{' '}
        <Link href="/blog/how-to-get-12-testers">
          Every method for getting {RULES.requiredTesters} testers
        </Link>{' '}
        is worth reading before you pay anyone anything.
      </p>

      <h3>&ldquo;My app is not good enough to earn reviews on its own&rdquo;</h3>
      <p>
        This is the honest version of the request, and paid reviews are the worst
        possible answer to it. They tell you nothing, they decay, and they buy you
        a store page that overpromises &mdash; which converts into uninstalls and
        one-star reviews from real users who believed it.
      </p>
      <p>
        What fixes it is critical feedback from people who know what a shipped
        Android app should feel like, before your users arrive. Not a rating.{' '}
        <Link href="/blog/what-a-useful-tester-report-looks-like">
          A written report
        </Link>{' '}
        that names what broke, on which device, and what they would change.
      </p>

      <h2>The line, and where it actually runs</h2>
      <p>
        The clearest thing that can be said is about the store surface. Ratings,
        reviews and production install counts are public signals, and trading for
        any of them is squarely what the policy prohibits. Closed testing tracks
        produce none of those signals: tester feedback there does not affect your
        public rating, and closed-track installs are not production installs.
      </p>
      <p>
        What that does <em>not</em> buy is a blanket exemption, and you should be
        suspicious of anyone who tells you it does. Google&rsquo;s policy language
        on incentivising installs is not written with a closed-track carve-out,
        and Google expects testers to be real people giving genuine feedback
        rather than metrics you assembled. A closed test is a much better place to
        stand than a store listing; it is not a place the rules stop applying.
      </p>
      <p>
        So the honest version is narrow rather than reassuring. TesterPool never
        touches a public rating, review or install count, and it has no mechanism
        that could. It cannot get you a five-star review and will never offer to.
        Read the{' '}
        <a href={POLICY} target="_blank" rel="noopener noreferrer">
          policy
        </a>{' '}
        yourself before trusting anybody&rsquo;s summary of it, including this
        one, and{' '}
        <Link href="/pool">see what is open to testers</Link> if you want to look
        at what we do instead.
      </p>
    </>
  );
}
