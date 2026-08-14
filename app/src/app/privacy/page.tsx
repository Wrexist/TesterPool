import type { Metadata } from 'next';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import { Card } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What TesterPool collects, why, and how it is used to run closed testing, calculate Reliability Score, and process payments.',
  alternates: { canonical: '/privacy' },
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

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">Legal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-[var(--color-mute)]">Effective {EFFECTIVE_DATE}</p>

          <Card className="mt-8 p-6 sm:p-8">
            <P>
              This Privacy Policy explains what information TesterPool Labs (&ldquo;TesterPool,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects when you use TesterPool, why we collect it, and
              the choices you have. It applies to the TesterPool website and app.
            </P>

            <H2>1. Information we collect</H2>
            <P>
              <strong className="font-semibold text-[var(--color-ink)]">Account information.</strong>{' '}
              When you sign in with Google, GitHub, or Apple, or with an email magic link, we receive your
              name, email address, and profile photo from that provider. We do not receive or store your
              password for any of these providers.
            </P>
            <P>
              <strong className="font-semibold text-[var(--color-ink)]">Tester email.</strong> Separately
              from your login email, we ask testers for the Google account email that will actually be
              added to a developer&rsquo;s closed-testing track. This is stored as its own field precisely
              because it is often different from your login email — for example, if you sign in with
              GitHub, or with an Apple account that uses Apple&rsquo;s private email relay
              (an address ending in <code className="text-[13px]">@privaterelay.appleid.com</code>), that
              login address cannot be used to opt in to a Google Play track. We use the tester email only
              to share it with the developer of the app you are testing, so they can add you to their
              track.
            </P>
            <P>
              <strong className="font-semibold text-[var(--color-ink)]">Activity data.</strong> Testing
              assignments, opt-in confirmations, daily check-ins, streaks, structured feedback you write,
              and the inputs used to compute your Reliability Score.
            </P>
            <P>
              <strong className="font-semibold text-[var(--color-ink)]">Payment data.</strong> If you buy
              a paid plan, Stripe processes the payment and shares limited transaction details with us
              (amount, status, the plan purchased). We never see or store your full card number.
            </P>
            <P>
              <strong className="font-semibold text-[var(--color-ink)]">Technical data.</strong> IP
              address, browser, device, and similar log data, used for security, fraud prevention, and
              debugging.
            </P>

            <H2>2. How we use information</H2>
            <Ul>
              <li>Operate the exchange — listing apps, tracking opt-ins and sessions, and surfacing your feedback to the developer you tested for (and theirs to you, where you are the developer).</li>
              <li>Calculate your Reliability Score and detect fraud, collusion, or abuse of the testing and credit system.</li>
              <li>Process payments for paid plans through Stripe.</li>
              <li>Send transactional email — check-in reminders, opt-in verification, account and billing notices.</li>
              <li>Provide customer support and respond to requests sent to support@testerpool.dev.</li>
              <li>Maintain the security and integrity of the service.</li>
            </Ul>

            <H2>3. What we don&rsquo;t do</H2>
            <Ul>
              <li>We never sell your personal information to advertisers or data brokers.</li>
              <li>We never post, or help anyone post, a public review or rating on your behalf, on Google Play or anywhere else — TesterPool does not collect public reviews or ratings at all.</li>
              <li>We never share your tester email outside the specific app you opted in to test.</li>
            </Ul>

            <H2>4. Who we share information with</H2>
            <P>
              We share the minimum needed to run the service: your tester email with the developer of the
              app you opted in to test (and, symmetrically, testers&rsquo; feedback with you if you are the
              developer); payment details with Stripe to process purchases; and infrastructure providers
              (such as our database and hosting providers) who process data on our behalf under contract.
              We do not share your information with advertisers.
            </P>

            <H2>5. Data retention</H2>
            <P>
              We keep your account and activity data while your account is active, and for a limited period
              afterward where needed for fraud prevention, dispute resolution, or legal compliance. You can
              request deletion at any time — see &ldquo;Your rights&rdquo; below.
            </P>

            <H2>6. Your rights</H2>
            <P>
              You can access, correct, export, or delete your data by emailing{' '}
              <a
                href="mailto:support@testerpool.dev"
                className="text-[var(--color-ink)] underline decoration-[var(--color-line-hi)] underline-offset-2"
              >
                support@testerpool.dev
              </a>
              . Depending on where you live, you may have additional rights under laws such as the GDPR or
              CCPA; we will honor requests consistent with applicable law. Deleting your account removes
              your profile and stops you taking on new work; some records may be retained briefly where
              required for fraud prevention or legal obligations.
            </P>

            <H2>7. Security</H2>
            <P>
              We use industry-standard safeguards — encryption in transit, access controls, and provider-
              managed authentication (Google, GitHub, Apple) rather than storing passwords ourselves — to
              protect your information. No method of transmission or storage is perfectly secure, and we
              cannot guarantee absolute security.
            </P>

            <H2>8. Children</H2>
            <P>
              TesterPool is not directed to, and may not be used by, anyone under 18.
            </P>

            <H2>9. International users</H2>
            <P>
              We may process and store information in countries other than the one you live in. Where we
              do, we take steps to protect it consistent with this Policy.
            </P>

            <H2>10. Changes to this Policy</H2>
            <P>
              We may update this Policy as the product changes. If we make material changes we will update
              the effective date above and, where appropriate, notify you in the app or by email.
            </P>

            <H2>11. Contact</H2>
            <P>
              Questions about this Policy, or a privacy request? Email{' '}
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
