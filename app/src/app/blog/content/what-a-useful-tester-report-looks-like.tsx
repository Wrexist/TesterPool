import * as React from 'react';
import Link from 'next/link';

export default function Body() {
  return (
    <>
      <p>
        Most tester feedback is worthless, and it is usually the developer&rsquo;s
        fault. &ldquo;Looks nice, works well&rdquo; is what you get when you ask
        someone what they thought. You get something you can act on when you ask
        four specific questions instead.
      </p>

      <h2>The four questions</h2>
      <h3>1. First impression</h3>
      <p>
        What did you think this was for, and how long did it take to work out?
        This is the only question whose answer expires &mdash; a tester can never
        see your app for the first time twice, and by day three they have learned
        their way around the thing that confused them on day one. Ask it
        immediately or lose it.
      </p>

      <h3>2. What broke</h3>
      <p>
        Not &ldquo;did anything break&rdquo;, which invites a no. Name the screen,
        the action, and what happened instead. A useful answer reads like:
      </p>
      <blockquote>
        <p>
          Export to Markdown silently does nothing when the note has an
          attachment. No error, no file, no toast.
        </p>
      </blockquote>
      <p>
        Three facts in one sentence: the feature, the condition, and the absence
        of any feedback to the user. That last part is the actual bug &mdash; the
        export failing is a defect, the export failing <em>silently</em> is a
        design decision nobody made.
      </p>

      <h3>3. Reproduction steps</h3>
      <p>
        The difference between a report you can fix this afternoon and a report
        you file under &ldquo;cannot reproduce&rdquo;. Numbered, literal, and
        ideally confirmed on a second device:
      </p>
      <ul>
        <li>New note, type anything</li>
        <li>Attach any image</li>
        <li>Menu → Export → Markdown</li>
        <li>Nothing happens. Repeats on a second device.</li>
      </ul>
      <p>
        Any report claiming a significant issue without these is not actionable,
        and it is reasonable to require them.
      </p>

      <h3>4. One change they would make</h3>
      <p>
        Exactly one. Asking for a list gets you a wishlist; asking for one forces
        a priority judgement, and the thing someone picks when limited to one is
        usually the thing that actually bothered them.
      </p>
      <blockquote>
        <p>
          Move the attachment button out of the overflow menu. I found it by
          accident on day four and I was looking for it on day one.
        </p>
      </blockquote>

      <h2>Two things that make the answers honest</h2>
      <p>
        <strong>Device and OS version, always.</strong> &ldquo;Crashes on
        rotate&rdquo; is a mystery. &ldquo;Crashes on rotate, Redmi Note 12,
        Android 13&rdquo; is a ticket. Most indie developers own two or three
        devices and ship to thousands of configurations; the device string is
        often the most valuable field in the report.
      </p>
      <p>
        <strong>Severity, classified by the tester.</strong> Minor, significant,
        blocker. This is not a rating of your app &mdash; it is a triage label on
        one defect, and it is what lets you read fourteen reports in ten minutes
        instead of an hour.
      </p>

      <h2>The incentive problem, which is the real one</h2>
      <p>
        None of this survives if the person writing it has a reason to be nice.
        If the developer decides whether a report gets paid, every tester learns
        very quickly that praise pays and criticism does not, and within a few
        cycles you have built a machine that produces compliments. The reports
        get shorter, warmer and completely useless, and you will not notice
        because they will all be positive.
      </p>
      <p>
        Two rules prevent it. A critical report has to pay exactly what a glowing
        one pays &mdash; if a blocker costs the developer more, developers learn
        to dispute blockers. And a developer must not be able to unilaterally
        refuse payment for feedback they disliked; disputing a report should open
        an arbitration a third party decides, not reject it.
      </p>
      <p>
        Those two rules are the difference between a feedback system and a
        flattery system, and they are worth checking for in any service you use.
      </p>

      <h2>See a real one</h2>
      <p>
        There is a full redacted report on the front page, rendered exactly as a
        developer receives it &mdash; the four answers, the device, the severity
        tag and the arbitration rule stated plainly.{' '}
        <Link href="/#report">Read it here</Link>, or{' '}
        <Link href="/feed">see which apps are open to testers right now</Link>.
      </p>
    </>
  );
}
