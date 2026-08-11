# Payments

TesterPool takes money through Stripe Checkout. This document is the operator's guide: how
to stand the account up, how to test it without charging anyone, how fulfilment works and
why it is built the way it is, and — the part that matters most for this particular
product — how to make sure the people we are selling to can actually pay.

Nothing here is required to run the application. With no Stripe environment variables set,
the app builds, boots, and works: `/billing` renders an honest "payments are not configured
yet" panel, the purchase buttons are inert, and the API routes return a clear error rather
than a stack trace. The free tier is the spine of the product and it does not depend on any
of this.

## What is being sold

Four things, all defined once in `app/src/lib/billing.ts`, which mirrors the `PLANS` array
in `app/src/lib/economy.ts`. Fast Pod is nineteen dollars per app and buys a guaranteed pod
start within twenty-four hours, eighteen seats instead of fifteen, and a free rescue if
someone drops. Pro is thirty-nine dollars per app and buys twenty seats at reliability
eighty-five and above, two expert testers, unlimited rescues and a reviewed evidence pack.
Rescue is nine dollars as a one-off and buys a single verified replacement tester matched
within six hours, which is the thing a developer needs at eleven at night on day ten when
their count has just fallen under twelve. Credit packs sell the in-app currency to
developers who would rather pay than test; they are priced deliberately above the effective
cash cost of the equivalent tier, because if buying credits were cheaper than buying the
tier, the tiers would be decoration.

Prices are inlined into each Checkout Session as `price_data` rather than referencing Price
objects created in the Stripe Dashboard. That is a deliberate trade. It means a brand new
Stripe account works immediately with no product setup, and it means the catalogue lives in
version control where a price change is a reviewable diff. What it costs us is Stripe's own
product-level reporting, which stays thin. If that ever becomes the thing you need, create
Products and Prices in the Dashboard, put the resulting `price_...` identifiers into the SKU
catalogue, and swap `price_data` for `price` in
`app/src/app/api/stripe/checkout/route.ts`. The rest of the integration is unaffected. The
Checkout Session API reference is at https://docs.stripe.com/api/checkout/sessions/create.

## Creating the Stripe account

Sign up at https://dashboard.stripe.com/register and complete the business profile for
whatever legal entity actually receives the money. Until that profile is complete the
account stays in test mode only, which is fine for development and useless for revenue.

Every Stripe account has two parallel sets of keys, described at
https://docs.stripe.com/keys. Test keys begin `sk_test_` and `pk_test_`; live keys begin
`sk_live_` and `pk_live_`. They address entirely separate ledgers: test-mode customers,
payments, webhook endpoints and webhook signing secrets do not exist in live mode and vice
versa. The billing page reads the prefix of `STRIPE_SECRET_KEY` and shows a "Stripe test
mode" pill when it is not a live key, so nobody demonstrates a fake purchase believing it
was real. Do the entire integration in test mode, using the test cards listed at
https://docs.stripe.com/testing, and only then swap both the secret key and the webhook
signing secret for their live equivalents. There are no placeholder or dummy keys anywhere
in this repository, and there should never be.

## Environment variables

Four variables control the payments layer, and one of them belongs to Supabase rather than
Stripe.

`STRIPE_SECRET_KEY` is the server-side API key. It must never be prefixed `NEXT_PUBLIC_`,
because that prefix inlines a value into the JavaScript bundle and this key can move money.
Its absence is the switch that puts the whole payments layer into its unconfigured state.

`STRIPE_WEBHOOK_SECRET` is the signing secret for the endpoint that receives events. It
begins `whsec_`. Locally it comes from the Stripe CLI; in production it comes from the
endpoint you register in the Dashboard, and it is different for test and live mode and
different again for every endpoint.

`SUPABASE_SERVICE_ROLE_KEY` lets the webhook write to the payments tables. It bypasses row
level security entirely, which is exactly why it is confined to `app/src/app/api/stripe/`
and never imported from a page, a component or a Server Action. The payments tables have no
insert policy for anybody: a user who could write their own `purchases` row could grant
themselves a Pro pod for nothing.

`NEXT_PUBLIC_SITE_URL` is the origin Checkout returns the buyer to. Set it to the real
deployed origin in production, or success and cancel redirects will send people to
localhost.

## The webhook endpoint

The endpoint is `POST /api/stripe/webhook`, so the URL to register is your origin followed
by that path — for example `https://testerpool.dev/api/stripe/webhook`. It must be HTTPS
and publicly reachable in live mode. Register it under the Webhooks tab in Workbench, as
described at https://docs.stripe.com/webhooks.

Subscribe to exactly four event types and no more. `checkout.session.completed` is the main
one and fires when a buyer finishes Checkout.
`checkout.session.async_payment_succeeded` fires later for payment methods that are not
instant, where the session completes before the money arrives; UPI and bank-based methods
behave this way and ignoring this event means those buyers pay and receive nothing.
`checkout.session.async_payment_failed` is acknowledged and does nothing, because a failed
delayed payment never granted anything that needs revoking. `charge.refunded` drives the
refund path. Stripe's own guidance is to subscribe narrowly rather than to everything,
because listening to all events puts pointless load on the endpoint; the fulfilment guide
that recommends this set is at https://docs.stripe.com/checkout/fulfillment.

## Testing locally with the Stripe CLI

Install the CLI following https://docs.stripe.com/stripe-cli, then run `stripe login` once
to pair it with your account. With the app running on port 3000, start a listener:

```
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,charge.refunded \
  --forward-to localhost:3000/api/stripe/webhook
```

The first line of output contains a signing secret beginning `whsec_`. Put that in
`.env.local` as `STRIPE_WEBHOOK_SECRET` and restart the dev server. Now click a purchase
button, pay with card number 4242 4242 4242 4242, any future expiry and any three-digit
CVC, and watch the event arrive in the terminal running `stripe listen`. A refund can be
tested by refunding the payment from the Dashboard, which emits `charge.refunded` through
the same listener. `stripe trigger checkout.session.completed` also works but produces a
session with no TesterPool metadata attached, so fulfilment will correctly decline to act on
it; going through real Checkout is the more useful test.

## How fulfilment works, and why it is idempotent

Stripe does not promise exactly-once delivery. It retries a failed delivery for up to three
days with exponential backoff, it can send the same event twice, and it makes no guarantee
about ordering. A delayed payment method sends `checkout.session.completed` and then
`checkout.session.async_payment_succeeded` for the same session, and this handler treats
both as fulfilment triggers. So the same purchase can plausibly arrive at the fulfilment
code three or four times. If fulfilment were not idempotent, a buyer would receive four
thousand credits for one four-thousand-credit pack, and there would be no way to tell that
from a legitimate purchase after the fact.

So the route itself keeps no bookkeeping. It verifies the signature, extracts the metadata
we attached when creating the session, and calls a single Postgres function,
`fulfil_purchase`, defined in `app/supabase/migrations/20260810213000_payments.sql`. That
function is keyed on `purchases.stripe_session_id`, which carries a unique constraint. It
tries to insert the purchase row; if the insert raises a unique violation, another delivery
of the same event won the race, and the function falls through to a locking select on the
same key, waits for that transaction to commit, sees the status is already `fulfilled`, and
returns a receipt saying it did nothing. Calling it twice sequentially, twice concurrently,
or twenty times a week later all produce the same end state.

Credits are granted inside that function through `award_credits(..., 'purchase', ...)` and
never by writing `profiles.credits`. That column is a cached projection of the append-only
`credit_ledger` and a database trigger raises an exception if anything but `award_credits`
or `spend_credits` moves it. This matters more for payments than for anything else in the
product: a webhook is the single easiest place to invent money that has no ledger row behind
it, and the reconciliation view would then show permanent drift with no way to attribute it.

Neither `fulfil_purchase` nor `refund_purchase` is callable by `anon` or `authenticated`.
Supabase publishes every function in the `public` schema as a REST endpoint, so a
`SECURITY DEFINER` function that takes a user id and a credit amount is a money printer if a
signed-in user can POST to it. `EXECUTE` on both is revoked from `anon`, `authenticated` and
`public`, and granted only to `service_role`, which is why the webhook route uses the
service-role key. This is also why the webhook returns a 500 rather than a 200 when the
database call fails — a non-2xx tells Stripe to redeliver, and redelivery is safe.

One implementation detail is worth stating plainly because it is the classic mistake in the
App Router. Signature verification hashes the exact bytes Stripe sent, so the handler reads
`await request.text()` before anything else touches the request. Calling `request.json()`
reparses and reserialises the body and the signature will never match again. There is no
body parser to disable here as there was in the Pages Router, and there is also nothing that
will warn you: the failure shows up as a permanent 400 on every single event in the
Dashboard. Stripe's note on this is under "Verify webhook signatures with official
libraries" at https://docs.stripe.com/webhooks.

## Refunds

Refunds are issued from the Stripe Dashboard, or by the buyer themselves through the
Customer Portal that `POST /api/stripe/portal` opens, if you configure the portal to allow
cancellations. Stripe's refund behaviour is documented at https://docs.stripe.com/refunds:
the original processing fee is not returned, refunds draw on your available Stripe balance,
and the customer typically sees the credit five to ten business days later.

On our side, `charge.refunded` calls `refund_purchase`, which is idempotent for the same
reasons `fulfil_purchase` is. It claws back exactly the credits that purchase granted —
recorded on the row as `credits_granted` rather than recomputed from the current price list,
so repricing a pack cannot rewrite history — and revokes any entitlement from that purchase
that has not been consumed. An entitlement that was already consumed stays consumed. If
someone bought a Fast Pod, the pod ran, fifteen people spent fourteen days testing their
app, and only then did they ask for their money back, the correct outcome is that they get
the refund and the testers keep what they earned. That is a support decision, not a database
one, and the schema is deliberately arranged so that reversing the charge cannot silently
reverse other people's labour.

Note that `charge.refunded` fires for partial refunds as well as full ones. The current
implementation treats any refund as a full reversal of the entitlement, which is correct for
a product with no partial-refund story. If partial refunds ever become a thing, read
`refund.created` instead and compare the refunded amount to `amount_cents`.

## Payment method coverage, which matters more here than usual

The buyer base for this product is concentrated in India, Pakistan, Bangladesh, Vietnam,
Nigeria and Indonesia — solo Android developers with personal Play Console accounts opened
after November 2023. That is a very different distribution from a US SaaS product, and it
changes what "accepting payments" has to mean. A checkout page that only takes international
credit cards will lose a large fraction of these buyers not to price but to plumbing.

The important distinction is between where the business is and where the buyer is. Stripe's
availability page at https://stripe.com/global lists roughly fifty countries where a
business can hold a Stripe account. India and Indonesia are listed as preview, requiring a
sales conversation. Nigeria is served through Stripe's acquisition of Paystack rather than
directly. Pakistan, Bangladesh and Vietnam are not listed at all. None of this prevents
buyers in those countries from paying a business incorporated elsewhere; it only constrains
where the receiving entity can be.

UPI is the single highest-leverage thing to enable, and the good news is that it does not
require an Indian Stripe account. Per https://docs.stripe.com/payments/upi, Stripe accounts
in the United States, the United Kingdom, Singapore, Canada, Australia and most of the EU
and EEA can accept UPI from customers located in India. Presentment currency is INR, the
customer authenticates in their own banking or wallet app, and on desktop they scan a QR
code. Refunds are supported for up to sixty days but are asynchronous and can take up to
seven business days, which is worth knowing before promising anyone an instant reversal.
Transactions must fall between one and one hundred thousand rupees, which comfortably covers
every SKU here. Enable it at
https://dashboard.stripe.com/settings/payment_methods and Checkout will surface it
automatically to Indian buyers with no code change, because payment methods are configured
in the Dashboard rather than hardcoded in the session.

Indian cards are the other half of that market. Cross-border card payments from Indian
issuers work through a normally configured Stripe account, but Indian issuers decline more
aggressively on international transactions than most, and RBI rules mean stored cards and
recurring mandates behave differently there. Everything TesterPool sells is a one-off
charge, which sidesteps the recurring-mandate problem entirely — one more reason not to
introduce a subscription tier without thinking hard about this market first.

For the rest of the buyer base, enable whatever local methods Stripe offers for their
region from the same Dashboard page, since Checkout will only display what is both enabled
and relevant to the buyer's location. Consider also enabling Adaptive Pricing
(https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing), which
presents the price in the buyer's local currency instead of dollars. For a nineteen-dollar
purchase from someone weighing it against a month of lost launch time, seeing a familiar
currency measurably reduces abandonment.

Where Stripe genuinely cannot serve a buyer — a Pakistani or Bangladeshi developer with only
a domestic card and no international payment rail — there are two workable answers. The
first is a merchant-of-record platform such as Paddle (https://www.paddle.com) or Lemon
Squeezy (https://www.lemonsqueezy.com), which sells to the customer as the legal seller,
handles the tax registration in every jurisdiction, and typically supports a wider spread of
local methods than a self-serve Stripe account can reach. The cost is a higher percentage
and less control over the checkout surface. The second is a regional processor used
alongside Stripe rather than instead of it: Paystack (https://paystack.com) for Nigeria,
which Stripe owns and which supports Nigerian bank transfer and USSD, and Razorpay
(https://razorpay.com) for India if a domestic entity ever exists to hold the account. Both
would mean a second fulfilment path into the same `fulfil_purchase` function; that function
is keyed on a session identifier and knows nothing about Stripe specifically, so adding a
second processor is a new route and a new signature check, not a schema change.

The last option, and the one to keep in reserve, is that the free tier already works
everywhere. Someone who cannot pay us can still earn every credit the paid tiers grant, by
testing other people's apps for fourteen days. That is not a consolation prize bolted on to
make the pricing page look generous; it is the reason the network has anyone in it at all.

## Sources

https://docs.stripe.com/webhooks —
https://docs.stripe.com/checkout/fulfillment —
https://docs.stripe.com/api/checkout/sessions/create —
https://docs.stripe.com/keys —
https://docs.stripe.com/testing —
https://docs.stripe.com/stripe-cli —
https://docs.stripe.com/refunds —
https://docs.stripe.com/payments/upi —
https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing —
https://stripe.com/global —
https://dashboard.stripe.com/settings/payment_methods
