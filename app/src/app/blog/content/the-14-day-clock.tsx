import * as React from 'react';
import Link from 'next/link';
import { RULES } from '@/lib/economy';

export default function Body() {
  return (
    <>
      <p>
        The most expensive misunderstanding in Google Play&rsquo;s production
        access requirement is that it asks for {RULES.requiredTesters} testers.
        It does not. It asks for {RULES.requiredTesters} testers{' '}
        <em>on the same day, {RULES.requiredDays} days running</em>. Those are
        very different requirements, and the Play Console does not clearly show
        you which one you are currently failing.
      </p>

      <h2>Continuous means continuous</h2>
      <p>
        Picture fifteen people opted in on day one. On day nine, one of them
        clears out some apps and leaves the track. You are at fourteen, which is
        still comfortably above {RULES.requiredTesters}, so nothing about your
        situation feels wrong.
      </p>
      <p>
        Now picture the same fifteen, except four of them leave on day nine. You
        are at eleven. The continuous count that matters is not
        &ldquo;{RULES.requiredDays} days somewhere in your history&rdquo;; it is a
        window in which the number never dropped below{' '}
        {RULES.requiredTesters}. Falling to eleven for one day means the qualifying
        window has to start over, and the {RULES.requiredDays}-day count begins
        again from the day you got back to twelve.
      </p>
      <p>
        You find out weeks later, when the application is rejected. That is the
        single most common way an indie launch slips a month.
      </p>

      <h2>Why you cannot see it happening</h2>
      <p>
        The Play Console shows you a tester list and an opt-in count. It does not
        show you a per-tester timeline, and it does not show a live counter of
        &ldquo;consecutive days at or above {RULES.requiredTesters}&rdquo;. There
        is no alert when someone leaves. Opt-outs are silent by design &mdash; a
        tester leaving a closed track is a normal thing for a user to do, not an
        event the console treats as notable.
      </p>
      <p>
        So the failure is invisible at exactly the moment it happens, and legible
        only at the moment it is too late to fix.
      </p>

      <h2>Engagement is a second, unstated bar</h2>
      <p>
        Applications get rejected for low engagement even when the count held.
        The production access form asks what you learned from testing and how
        engaged your testers were, and {RULES.requiredTesters} silent installs is
        a rejection with extra steps.
      </p>
      <p>
        This is the part where paid single-install testers fail hardest. They
        satisfy the number and produce nothing you can write in the box.
      </p>

      <h2>What to do about it</h2>
      <ul>
        <li>
          <strong>Over-seat.</strong> Recruit meaningfully more than{' '}
          {RULES.requiredTesters}. At {RULES.podSeats} you can lose three people
          and still clear the bar without the window resetting.
        </li>
        <li>
          <strong>Understand what a replacement does and does not fix.</strong> A
          new tester does not inherit the departed one&rsquo;s history &mdash;
          Google counts testers who have each been opted in continuously for the
          last {RULES.requiredDays} days, so a replacement starts their own count
          from zero. Replacing someone keeps your roster healthy for the next
          window; it does not repair the one they broke. The buffer is what saves
          the current cycle, which is why it matters more than the reaction time.
        </li>
        <li>
          <strong>Check the count daily anyway.</strong> Knowing on day nine that
          you have dropped to eleven means you restart deliberately, with a full
          roster, instead of discovering it in a rejection email five weeks later.
        </li>
        <li>
          <strong>Collect written feedback as you go.</strong> You need it for
          the application, and reconstructing it from memory on day fifteen shows.
        </li>
      </ul>

      <h2>The shape of a cycle that works</h2>
      <p>
        Everyone starts on the same day, so the window is one window rather than
        fifteen overlapping ones. There is a buffer above the requirement. Someone
        watches the count every day. When a seat empties it gets refilled within
        hours, not days. And the feedback arrives in writing during the cycle
        rather than being remembered at the end of it.
      </p>
      <p>
        That is what a pod is.{' '}
        <Link href="/pool">See what is currently open to testers</Link>, or read{' '}
        <Link href="/blog/how-to-get-12-testers">
          the full comparison of ways to reach {RULES.requiredTesters}
        </Link>
        .
      </p>
    </>
  );
}
