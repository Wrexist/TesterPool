import * as React from 'react';
import Link from 'next/link';
import { RULES } from '@/lib/economy';

export default function Body() {
  return (
    <>
      <p>
        Both models look the same from a distance: developers do work for each
        other instead of paying an agency, usually mediated by points. The
        difference is where the work lands, and everything else follows from it.
      </p>

      <h2>The one difference that matters</h2>
      <p>
        A <strong>review exchange</strong> puts activity on your public store
        listing &mdash; a rating, a written store review, an install counted
        against your production listing.
      </p>
      <p>
        A <strong>closed-test pod</strong> puts activity inside your closed
        testing track, which is a private distribution channel. Closed-track
        installs and usage do not affect store rankings, public ratings or public
        install counts. They are invisible to the store surface.
      </p>
      <p>
        That single distinction decides the policy question, the durability
        question and the usefulness question, in that order.
      </p>

      <h2>Policy</h2>
      <p>
        Google&rsquo;s Ratings, Reviews and Installs policy prohibits
        incentivising ratings, reviews and installs. A review exchanged for
        points is incentivised by definition &mdash; the trade is the incentive,
        and the honesty of the opinion does not change that.
      </p>
      <p>
        A closed-track opt-in is a materially weaker case against you, because no
        public signal is produced: closed-track feedback does not affect your
        store rating and closed-track installs are not production installs. It is
        not, however, a stated exemption. The policy&rsquo;s language on
        incentivised installs carries no closed-track carve-out, and Google
        expects testers to be real people giving genuine feedback. Anyone
        promising you that a closed track puts you outside the rules is
        overstating a real distinction.
      </p>
      <p>
        There is a structural asymmetry in the risk, too. Store review exchanges
        concentrate accounts that trade public reviews with one another, and
        enforcement against that pattern tends to sweep the cluster rather than
        the individual. The downside is correlated across the membership.{' '}
        <Link href="/blog/can-you-buy-app-reviews">The detail is here.</Link>
      </p>

      <h2>Durability</h2>
      <p>
        Exchanged store reviews get removed, in batches, when they are detected.
        You are renting a number. A closed test, by contrast, produces something
        that cannot be taken back: your account satisfied the{' '}
        {RULES.requiredTesters}-tester requirement, you got production access, and
        that is a one-time gate you never pass through again.
      </p>

      <h2>Usefulness</h2>
      <p>
        A five-star store review says nothing you can act on. It exists to be
        counted, not read. The written report from a closed-track tester says what
        broke, on which device, and what confused them &mdash; and it arrives
        before your users see any of it.
      </p>
      <p>
        This is the part people underrate when comparing the two. The exchange
        gives you a number that decorates a page. The pod gives you a defect list
        from people who ship Android apps for a living.{' '}
        <Link href="/blog/what-a-useful-tester-report-looks-like">
          What one of those looks like.
        </Link>
      </p>

      <h2>Where the exchange model is genuinely better</h2>
      <p>
        Honesty requires saying this: an exchange is faster and asks less of you.
        You can be earning points within minutes, there is no fixed window to
        commit to, and you are not tied to fourteen specific days with fourteen
        specific people. A pod asks for a fortnight of small daily obligations.
      </p>
      <p>
        If speed with no commitment is genuinely what you need, that is the
        trade-off you are making &mdash; and you should make it knowing that the
        thing being sold is the part that violates the policy.
      </p>

      <h2>Choosing</h2>
      <table>
        <thead>
          <tr>
            <th>If your problem is</th>
            <th>The answer is</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>I cannot publish &mdash; I need {RULES.requiredTesters} testers</td>
            <td>A closed-test pod. An exchange does not address this at all.</td>
          </tr>
          <tr>
            <td>My app has bugs I have not found</td>
            <td>A closed-test pod, for the written reports.</td>
          </tr>
          <tr>
            <td>My store listing looks empty</td>
            <td>
              Neither. Ship, then earn reviews from real users. There is no safe
              shortcut to this one.
            </td>
          </tr>
          <tr>
            <td>I want a higher star average this week</td>
            <td>
              Nothing on this page will do that without risking the account.
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        <Link href="/pool">See what is open to testers right now</Link>.
      </p>
    </>
  );
}
