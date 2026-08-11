import type { Metadata } from 'next';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern using TesterPool to form closed-testing pods, earn and spend credits, and buy paid plans.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = 'August 11, 2026';

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-lg font-semibold tracking-tight text-[var(--color-ink)] first:mt-0">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-[var(--color-dim)]">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--color-dim)]">{children}</ul>;
}

export default function TermsPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">Legal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-[var(--color-mute)]">Effective {EFFECTIVE_DATE}</p>

          <Card className="mt-8 p-6 sm:p-8">
            <P>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your use of TesterPool, a service
              operated by TesterPool Labs (&ldquo;TesterPool,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;)
              that coordinates closed-testing pods for Android developers who need to satisfy Google
              Play&rsquo;s closed testing requirements. By creating an account or using the service you
              agree to these Terms. If you do not agree, do not use TesterPool.
            </P>

            <H2>1. What TesterPool is</H2>
            <P>
              TesterPool matches developers into pods so each app in the pod can reach the tester count
              and duration Google Play requires for its closed testing track. We are not affiliated with,
              endorsed by, or sponsored by Google LLC. Android and Google Play are trademarks of Google
              LLC. TesterPool does not submit apps to Google Play, does not guarantee that any app will
              pass Google&rsquo;s review, and is not a party to the relationship between you and Google.
            </P>
            <P>
              TesterPool does not collect, publish, or facilitate public app store ratings or reviews of
              any kind, for any app, at any time. Feedback exchanged inside a pod is private and structured,
              and is never submitted to Google Play, any other store, or any public destination on your
              behalf.
            </P>

            <H2>2. Eligibility and accounts</H2>
            <P>
              You must be at least 18 years old and able to form a binding contract to use TesterPool. You
              may sign in with a magic link, or with a Google, GitHub, or Apple account. You are responsible
              for keeping your account credentials secure and for all activity under your account. One
              person may not operate multiple accounts to manipulate pod matching, credits, or the
              Reliability Score described below.
            </P>

            <H2>3. Pods, testing, and the 12/14 mechanic</H2>
            <P>
              A pod seats up to fifteen developers so that each app can clear Google&rsquo;s bar of twelve
              testers opted in for fourteen consecutive days, even if a few seats drop out along the way.
              When you join a pod as a tester you agree to:
            </P>
            <Ul>
              <li>
                Provide the Google account email that will actually be added to the developer&rsquo;s
                closed-testing track (your &ldquo;tester email&rdquo;). This is often different from the
                email you log in to TesterPool with, especially if you sign in with GitHub or with Apple&rsquo;s
                private relay.
              </li>
              <li>Opt in to the app&rsquo;s closed track and keep the app installed for the full window.</li>
              <li>Complete the daily check-ins and any structured feedback the developer requests.</li>
              <li>
                Give honest, private feedback. You may never post, or agree to post, a public review or
                rating in exchange for anything of value — doing so violates Google Play&rsquo;s policies
                and these Terms.
              </li>
            </Ul>
            <P>
              When you join a pod as a developer, you agree that your app and its listing comply with
              Google Play&rsquo;s Developer Program Policies, that you will not ask testers for public
              reviews, ratings, or store feedback of any kind, and that you will not request payment,
              sensitive personal data, or anything outside what your published listing discloses.
            </P>

            <H2>4. Credits</H2>
            <P>
              Credits are a non-cash unit used only inside TesterPool to price optional upgrades such as
              buffer seats, rescue testers, and priority matching. Credits have no cash value, cannot be
              purchased for cash directly, are not redeemable for money, are non-transferable between
              accounts, and may be adjusted or forfeited if we suspend or terminate your account for
              violating these Terms.
            </P>

            <H2>5. Paid plans and purchases</H2>
            <P>
              Some upgrades (for example Fast Pod, Pro, and Rescue seats) are one-time, per-app purchases
              billed through Stripe. TesterPool does not store your card number; Stripe processes payment
              and is subject to its own terms and privacy policy. Purchasing a paid plan changes how
              quickly or reliably a pod forms — it does not guarantee Google Play approval, a specific
              number of testers who complete every day, or any particular business outcome. Refund
              requests are handled case by case; email{' '}
              <a
                href="mailto:support@testerpool.dev"
                className="text-[var(--color-ink)] underline decoration-[var(--color-line-hi)] underline-offset-2"
              >
                support@testerpool.dev
              </a>.
            </P>

            <H2>6. Reliability Score and moderation</H2>
            <P>
              We calculate a Reliability Score from your in-pod behavior — opt-ins, check-ins, feedback
              quality, and dropouts — and use it to decide which pods you can join and how prominently
              you&rsquo;re matched. We monitor for fraud and abuse (fake accounts, scripted check-ins,
              collusion to fake completion, and similar). We may warn, suspend, or terminate accounts that
              violate these Terms, attempt to manipulate the Reliability Score or credit economy, or put
              other users&rsquo; Google Play accounts at risk.
            </P>

            <H2>7. Prohibited conduct</H2>
            <Ul>
              <li>Buying, selling, or trading public reviews, ratings, or store feedback.</li>
              <li>Creating multiple accounts, or using bots or scripts, to game matching or credits.</li>
              <li>Uploading malware, or apps designed to deceive testers or violate platform policies.</li>
              <li>Harassing, threatening, or attempting to collect personal data from other users beyond what a pod requires.</li>
              <li>Reverse engineering, scraping, or interfering with the service&rsquo;s normal operation.</li>
            </Ul>

            <H2>8. Disclaimers</H2>
            <P>
              TesterPool is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; We do not
              guarantee that any pod will fill, that any tester will complete the full window, or that
              Google will approve your app for production access. Google Play&rsquo;s policies and review
              outcomes are entirely outside our control and can change at any time.
            </P>

            <H2>9. Limitation of liability</H2>
            <P>
              To the fullest extent permitted by law, TesterPool Labs will not be liable for indirect,
              incidental, special, consequential, or punitive damages, or for lost profits or lost data,
              arising from your use of the service. Our total liability for any claim relating to
              TesterPool will not exceed the amount you paid us in the twelve months before the claim
              arose.
            </P>

            <H2>10. Termination</H2>
            <P>
              You may stop using TesterPool and request account deletion at any time. We may suspend or
              terminate accounts that violate these Terms, with or without notice, particularly where
              continued access risks other users&rsquo; Google Play accounts or the integrity of the
              pod system.
            </P>

            <H2>11. Changes to these Terms</H2>
            <P>
              We may update these Terms as the product changes. If we make material changes we will
              update the effective date above and, where appropriate, notify you in the app or by email.
              Continued use after a change means you accept the updated Terms.
            </P>

            <H2>12. Contact</H2>
            <P>
              Questions about these Terms? Email{' '}
              <a
                href="mailto:support@testerpool.dev"
                className="text-[var(--color-ink)] underline decoration-[var(--color-line-hi)] underline-offset-2"
              >
                support@testerpool.dev
              </a>.
            </P>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
