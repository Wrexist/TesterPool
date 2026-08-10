# TesterPool — stack, services and build plan

## 1. What is already built and running

A working Next.js 16 application with a live Postgres database, not a mockup.

**Database** — Supabase project `testerpool` (`yudcncvarndslyyajflr`, eu-north-1, free tier). Fifteen tables, three views, twelve RPCs, row-level security on every table, and a storage bucket for screenshot proofs with owner-scoped policies. Seeded with sixteen developers, sixteen apps, one pod at day 9 of 14, 210 assignments, 1,638 check-ins, 84 feedback reports, six open disputes and nine greenlit apps.

**App** — Next.js 16 App Router, React 19, Tailwind v4, TypeScript strict, `@supabase/ssr`. Twenty routes, type-clean, production build passing.

Public: landing, readiness checker, launch feed, greenlight share pages with server-rendered Open Graph images, login, auth callback.
Authenticated: dashboard, my tests, opt-in wizard, feedback form, creator feedback inbox, pod browser, credits and referrals, leaderboard, public profiles, moderation dashboard.

**Three real bugs were found and fixed during verification**, which is worth knowing because they would each have been production incidents:

1. `pgcrypto` lives in the `extensions` schema on Supabase, so functions pinned to `search_path = public` could not resolve `gen_random_bytes()`. The first real signup would have thrown.
2. Supabase exposes every `public` function as a REST endpoint. `award_credits` and `spend_credits` are `SECURITY DEFINER` and take an arbitrary user id and delta, so **any signed-in user could have minted themselves unlimited credits** with a single POST. `EXECUTE` is now revoked from `anon` and `authenticated` on all internal primitives, and `start_pod` gained its own membership check.
3. The `apps` and `assignments` RLS policies referenced each other, producing infinite recursion. Every authenticated read of apps, assignments and feedback silently returned zero rows. Cross-table lookups now go through `SECURITY DEFINER` helpers.

## 2. Stack, and why

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | **Next.js 16, App Router** | Server components mean the dashboard's six queries run in one round trip. Server-rendered OG images are first-class, which the Greenlight loop depends on. Not Flutter Web: OnTopRank's `noindex` app is invisible to search, and this product's growth is link-driven. |
| Language | TypeScript strict | |
| Styling | **Tailwind v4** with CSS custom properties | Tokens live in one `@theme` block, shared by the app and the standalone design system. |
| Components | Hand-rolled primitives, no library | The signature components — the 14-day streak strip, the reliability gauge, the progress ring — do not exist in any library, and everything else is a button. |
| Database, auth, storage | **Supabase** (Postgres, RLS, GoTrue, Storage) | RLS lets the security model live in the database rather than in every route, which matters when both a creator and a tester read the same row with different rights. Postgres also gives real transactional integrity on the credit ledger, which Firestore would not. |
| Business logic | Postgres functions + Next Server Actions | Credit movement, check-ins and arbitration are `SECURITY DEFINER` functions so balance and ledger can never diverge. |
| Hosting | **Vercel** | |
| Payments | **Stripe** Checkout + Customer Portal | Paddle or LemonSqueezy are the alternative if merchant-of-record VAT handling matters more than fees. Given the buyer base, **add UPI, Razorpay and PayPal** — TesterBee accepting UPI is not a detail, it is most of the market. |

## 3. Services and integrations to add

**Needed for launch**

- **Stripe** — Checkout for Fast Pod, Pro, Rescue and credit packs. Webhook to `spend_credits`/entitlements. Free plan; 2.9% + 30¢.
- **Resend** or **Postmark** — transactional email. The daily check-in reminder is not a nicety, it is the product: a missed day costs someone else a month. ~$20/mo.
- **Web Push** (VAPID, no vendor) or **OneSignal** free tier — same reason, higher conversion than email.
- **Upstash QStash** or **Vercel Cron** — the daily jobs: reminders, pod state transitions, at-risk detection, escrow release, reliability recomputation. Free to ~$10/mo.
- **Anthropic or OpenAI vision API** — screenshot proof triage. High-confidence passes auto-approve, the rest queue for a human. Keeps moderation load sublinear. ~$0.003 per proof.
- **Sentry** — error tracking. Free tier is enough initially.
- **PostHog** — product analytics and funnels. Self-hostable; free to 1M events.
- **Cloudflare Turnstile** — signup abuse. Free.
- **Twilio Verify** or Supabase phone auth — one account per human. ~$0.05 per verification, and worth every cent against sybils.

**Worth adding early**

- **Google Play Developer API** — the strategic one. With the creator's OAuth grant you can read closed-track tester state directly instead of trusting screenshots. That is a moat: it makes verification unspoofable, gives real engagement data, and lets you show the developer what Google will see.
- **Plausible** or Vercel Analytics for the marketing site.
- **Crisp** or **Intercom** for support. Trust is the scarcest resource in this category; a visible human helps.

**Deliberately not used**

- No review-related API of any kind. No in-app review SDK, no store review deep links, no rating prompts. The absence is the product.

## 4. Cost

| Stage | Monthly |
|---|---|
| Prototype (now) | **$0** — Supabase and Vercel free tiers |
| Launch, to ~2,000 users | **$45–75** — Supabase Pro $25, Vercel Pro $20, Resend $20, vision API ~$5 |
| ~20,000 users | **$250–450** — plus storage, compute add-ons, push, support tooling |

Against $19–39 per paid app, roughly fifteen Fast Pods a month covers infrastructure at launch scale.

## 5. Roadmap

**Phase 0 — before anyone real signs up (1–2 days)**

Delete the `/demo` route and the seeded `@demo.testerpool.dev` accounts. Rotate the anon key. Enable Supabase leaked-password protection (flagged by the advisor). Move `citext` out of the `public` schema. Add Turnstile to signup. Write real Terms and a Privacy Policy naming Supabase, Vercel and the vision API as processors — and unlike OnTopRank, make sure the Terms do not prohibit the thing the product does. Set up Sentry and PostHog.

**Phase 1 — make one pod work perfectly (2–3 weeks)**

The single measure of success is: does a pod of fifteen developers reliably produce fifteen approvals? Build the cron jobs (reminders, at-risk detection, escrow release, auto-start when a pod fills), the rescue matching flow end to end, real vision-model proof triage, and email plus push notifications. Recruit the first three pods by hand from r/androiddev, r/FlutterDev and Play Console community threads, and moderate them personally. Do not build payments yet.

**Phase 2 — growth loops (2–3 weeks)**

Ship the Readiness Checker properly with schema markup and a share card. Ship the Greenlight card and Launch Feed. Ship referrals with the tithe. Ship the embeddable badge. Instrument the invite-to-fill-your-own-pod loop, which is the primary engine, and measure time-to-fill obsessively. Target: pods fill in under 72 hours.

**Phase 3 — money (2 weeks)**

Only once pods fill reliably. Stripe Checkout, UPI and Razorpay, the four SKUs, entitlement handling, and the refund policy. Price Rescue aggressively — it is bought in a panic.

**Phase 4 — the moat (3–4 weeks)**

Play Developer API integration for unspoofable verification. Reviewed evidence packs. Expert tester tier with vetting. Studio subscription. Category-matched pods so a game gets tested by people who play games.

**Later, if the core works**

Localised onboarding for Hindi, Bahasa and Portuguese. A Fiverr-side presence that converts rather than competes. A public API. Possibly TestFlight distribution for iOS — as a distribution convenience only, never a paid-testing exchange, given guideline 2.2.

## 6. Metrics that matter

Everything else is vanity. Track these:

**Pod fill time** — hours from listing to pod start. Below 72 hours the free tier is genuinely competitive with a $20 Fiverr gig; above it, people buy elsewhere.
**Completion rate** — share of seats reaching 14 of 14. This is the whole product in one number.
**Dropout rate by tier** — validates whether the Reliability Score is doing its job.
**Approval rate** — share of graduated apps that get production access on the first application. This is what you are actually selling, and the number you should eventually put on the landing page.
**Feedback approval and dispute rates** — if disputes climb, the arbitration rubric is wrong.
**Invite rate from under-filled pods** — the primary viral loop.
**Greenlight share rate** — the secondary loop.

## 7. Running it locally

```bash
cd app
cp .env.example .env.local     # fill in the Supabase URL and anon key
npm install
npm run dev                    # http://localhost:3000
```

Migrations are in `app/supabase/migrations/`, applied in filename order. They are already applied to the live project. `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` exposes `/demo`, which signs you in as any seeded developer — remove it before launch.
