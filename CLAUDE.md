# TesterPool — project instructions

Read this before writing any code in this repo.

## What this is

A compliance-safe growth network for indie **Android** developers. Google Play requires
**12 testers opted in for 14 consecutive days** before a personal developer account created
after 13 Nov 2023 can publish to production. TesterPool solves it with a **feed**: you
list your app, other developers pick it up one at a time, each joins your closed track,
uses the app and sends you one private structured report.

**There are no pods.** Cohorts were removed on 14 Aug 2026 — there is no group to fill,
no shared start date and no fourteen-day clock the product schedules. A tester takes a
seat the moment they want it, and the developer pays for that seat out of their balance.
Do not reintroduce cohort vocabulary: no *pod*, *pool*, *group*, *round* or *cohort* in
routes, components, copy or new schema.

Three things still say "pod" and are meant to. They are database and cron identifiers,
not product language, and renaming them needs a migration rather than a find-and-replace:
the `in_pod` value of the `app_status` enum (displayed as "Taking testers"), the
`pod_seat_spend` / `cost_priority_pod` economy keys, the `fast_pod` billing entitlement
(displayed as "Fast Track"), and the `pod-lifecycle` cron job. The blog also keeps one
post with "pods" in an indexed slug, because explaining the mechanism is the point.

The `pods` and `pod_members` tables carry two things now: real history, and **Packs**.
`20260814220000_close_pod_matching.sql` shut cohort matching down — flag false, execute
revoked from every role — because the cohort had been the *only* route to a tester, so a
member without one had no product. `20260814230000_packs.sql` re-opened the same tables,
the same RPCs and the same guards as an *optional* product on its own tab: a developer who
wants Google's whole requirement handled in one go buys a pack instead of taking testers
one at a time. `pod_matching` is true again and `join_pod` / `start_pod` are granted to
`authenticated` (each authorises against `auth.uid()` in its own body).

`admin_pod_action` did **not** come back and must not: the admin screen that drove it is
gone, and a `security definer` function with no caller is an unsupervised REST endpoint.

The feed remains the home screen and the default way work happens. A pack is something a
developer opts into on top of it — never the only route, which is the shape that was
removed.

## The invariants. Do not break these.

**1. Store activities are paid, and that is a policy exposure, not an oversight.**
This invariant used to read *"no credit may ever attach to a public store action"*, and the
schema was built to make one unrepresentable. That was reversed on 15 Aug 2026 on the
product owner's explicit, repeated instruction. `20260814240000_store_reviews.sql` added
`feedback.store_rating` / `store_review_url` / `store_review_text` / `store_review_proof_id`,
the `store_listing` value of `activity_kind`, and the `store_review` proof kind;
`20260815090000_enable_store_reviews.sql` turned the network flag on. A store install pays
10 and a published store review pays 30, out of the publisher's balance.

Do not quietly re-tighten this, and do not quietly widen it either. What it costs is stated
plainly so the next reader is not surprised by it:

Google Play's [Ratings, Reviews and Installs policy](https://support.google.com/googleplay/android-developer/answer/9898684)
prohibits incentivized reviews, ratings and installs; Apple's Section 3 does the same. Paid
store activity is squarely inside what both prohibit, and the closed-testing argument that
was the product's entire legal basis does not cover it, because a public listing is not a
closed track. Enforcement risk lands on the *publisher's* developer account, not only on
TesterPool.

Three gates are what keeps this bounded, and all three are load-bearing:

  1. the `store_reviews` feature flag — network-wide, in `/admin/flags`, off stops new work
     immediately and retracts nothing already published
  2. `apps.accepting_store_reviews` — per app, defaults **false**, the publisher's own
     decision on their own listing, taken one app at a time
  3. a public `store_url` — no listing, no seat

Still never add: AI-drafted review copy, review text the network dictates or supplies, star
ratings chosen by anyone but the tester who installed the app, or any reward that scales
with the rating given. The tester writes what they actually think or they are not paid for
a review; a rating floor would turn this from a policy exposure into a fraud product.

Marketing must not describe store activity as compliant. Closed-track work may still be
described the specific, defensible way — see the bottom of this section.

**1a. Credits move, they are never minted, and the client never decides a payment.**
A confirmed install transfers 10 from the app owner to the tester; a confirmed report
transfers 30. A full cycle — 14 testers on your app, 14 apps tested back — costs 560 and
pays 560, so doing your share breaks even and the supply cannot inflate. Nothing that pays out may be triggered by a value the browser
supplied — `submit_proof` exists because `recordOptInProof` once took a confidence score
from the client and approved on it, which was a money printer.

**2. A creator can never silently withhold payment for critical feedback.**
`review_feedback(id, 'low_effort')` opens a moderator dispute — it does not reject the
report. Specific critical feedback is paid at the same rate as praise. Remove that
arbitration step and creator approval becomes a positivity machine, which is exactly the
failure mode of the competitor this product was designed against.

Marketing claims: never say "provably compliant". The old line — *all activity happens
inside closed testing tracks, which do not affect store rankings, ratings, or public
install counts* — is no longer true of the product as a whole and must not be used as a
blanket claim. It is still exactly true of closed-track work, so scope it to that and say
nothing of the kind about store activities.

## Layout

```
app/
  src/app/                routes — (app)/ is authenticated, everything else public
    (app)/market/         the feed: every app taking testers, filtered by scope
                          (testing / report due / mine / saved), platform, stage
                          and category. Reads through market_apps(), never
                          through the apps table. Rows under md, cards above it
    (app)/apps/           my apps: your listings, their counts, and the credit
                          gate stated as a task rather than an error
    (app)/admin/          admin dashboard: overview, users, economy, moderation,
                          fraud, flags, audit, system health
    (app)/billing/        plans, credit packs, purchase history
    api/stripe/           checkout, webhook, portal
  src/components/ui/      design primitives — StreakStrip, ReliabilityGauge, CreditChip…
  src/components/app/     authenticated-surface components (incl. first-run)
  src/components/admin/   admin-only components
  src/lib/economy.ts      earn/spend rates, tiers, plans (mirrors economy_config)
  src/lib/market.ts       feed filters, URL parsing, stage/relation copy
  src/lib/format.ts       dates, ledger labels, status copy, validators
  src/lib/evidence.ts     drafts Google's three production-access answers
  src/lib/flags.ts        feature flags, read server-side, fail-safe defaults
  src/lib/billing.ts      SKU catalogue
  supabase/migrations/    the exact applied history — apply in filename order
  supabase/functions/     Deno edge functions: send-notifications, triage-proof
  src/app/feed/           the public browse page (was /pool; 308 redirect kept)
design/                   standalone design system + screen mockups
docs/                     STRATEGY, BUILD-PLAN, AUTH-SETUP, OPERATIONS, PAYMENTS
shots/                    screenshots of the running app
```

## What runs on its own

Four scheduled jobs keep the books honest. `pod-lifecycle` (hourly at :07) releases escrow,
awards badges and recomputes reliability — the cron name is historical, there are no cohorts
left for it to advance. `clock-watch` (every 6 hours) enqueues reminders and turns a
long-abandoned seat into a dropout. `nightly` (02:20 UTC) reconciles the ledger and prunes.
`send-notifications` (every 15 minutes) drains the outbox by calling the edge function.

`/admin/system` is the smoke alarm for all of it. Check there first when something feels wrong.
`docs/OPERATIONS.md` has the detail.

The feed is gated by the `activities` flag, which `start_activity` enforces inside the
database and `market_apps` mirrors into `activity_open`. Turn it off in `/admin/flags` and
the button, the row and the RPC all move together, because a gate the UI keeps and the RPC
does not is not a gate. Work already started keeps running either way.

`app/AGENTS.md` and `app/CLAUDE.md` are generated by `next dev` — leave them alone and
commit them if they change.

## Commands

```bash
cd app
npm run dev          # http://localhost:3000
npm run build        # must pass before you call anything done
npx tsc --noEmit     # must be clean
npm run lint
```

`/demo` and the `@demo.testerpool.dev` accounts are gone — they were real logins with a
password written down in this file, and once credits became a transfer each one was a way to
drain a stranger's balance. Sign in with a magic link like everyone else. Do not reintroduce a
passwordless demo sign-in route against the production database.

`supabase/tests/` replays the whole migration history against a throwaway Postgres and asserts
the economy and the proof pipeline. Run it before touching either.

## Database

Supabase project `cohort` (ref `yudcncvarndslyyajflr`, eu-north-1). The project name still
says cohort; the schema and data are TesterPool.

Core tables: `profiles, apps, pods, pod_members, assignments, proofs, checkins, feedback,
disputes, credit_ledger, greenlights, badges, user_badges, referrals, economy_config,
app_watchlist`.
Views: `leaderboard, pod_health, production_evidence`.

**The feed reads through `market_apps` / `market_app` / `market_counts` /
`market_categories` / `market_pulse`, never through `apps`.** Those five are
`SECURITY DEFINER` and are the projection that decides what a browsing member may see. They
withhold `opt_in_url`, `google_group`, `package_name` and `tester_instructions` from anyone
who neither owns the app nor holds an assignment on it — for an app in closed testing the
package name *is* the way into the track, and the way in is granted by taking the job, not
by browsing a directory. `package_name` reappears once an app is `graduated`, because by then the listing
is public and there is no track left to protect. They also
surface no scores and no averages, for the reason in invariant 1. Add a column to the
listing only after deciding which of those two rules it lands under.

**Never mutate `profiles.credits` directly.** Go through `award_credits` / `spend_credits`,
which write the append-only `credit_ledger` in the same statement. The ledger is the source
of truth; `profiles.credits` is a cached projection.

RPCs callable by `authenticated`: `start_activity, set_activity_intake, submit_checkin,
review_feedback, arbitrate_dispute, market_apps, market_app, market_counts,
market_categories, market_pulse, start_store_activity, set_store_review_intake,
store_review_open, join_pod, start_pod`. Each authorises against `auth.uid()` itself.
`admin_pod_action` is revoked from every role and stays that way. `fulfil_purchase` and
`refund_purchase` are deliberately *not* callable by `authenticated` — they move money and
are reached only by the Stripe webhook through the service-role client.

**Every `assignments` row now has a null `pod_id`.** A seat is one member, one app: they
pick anything open, join its closed testing track, use it, file one report, and are paid
10 + 30 out of the owner's balance. `start_activity` is the only way to make one and it
carries every guard — the owner's consent (`apps.accepting_activities`), their remaining
seats (`apps.activity_target`), and their balance, checked for the *whole* 40 before the
seat exists rather than after the tester has done the work. Gated by the `activities` flag,
enforced in the RPC and mirrored into `market_apps.activity_open`, so the button, the row
and the RPC all move together.

**A `graduated` app still takes testers.** Clearing Google's gate ends the requirement — a
shipped app has no production-access bar left to clear — but a live game still has bugs and
a developer who wants to hear about them, and the `live` scope in
`market_apps` is how they are browsed. The route in is unchanged and is the whole boundary
of the feature: the tester joins the closed track the developer runs alongside production,
never the public listing. `start_activity` refuses without `opt_in_url` or `google_group`,
and `app_needs_optin_to_queue` — which predates all of this — already makes a non-draft app
without one impossible, so "install from the store page" is unreachable rather than merely
refused. That constraint is now load-bearing for a reason it was not written for; do not
relax it.

Every lifecycle job joins `assignments` to `pods` on an inner join. That was written to
exclude activities from the cohort clock; now that every seat is one, it means those joins
match nothing and the jobs are effectively no-ops over assignments. Escrow release still
runs off its own path. Anything new that reads `pod_id` off an assignment must handle null,
because it always is — `submit_checkin` and `/tests` both once did not, and the seat was
unworkable from the screen it is worked from.

## Five traps this codebase has already fallen into

These were real bugs, found by verification, already fixed. Do not reintroduce them.

**`pgcrypto` lives in the `extensions` schema on Supabase.** Any function pinned to
`set search_path = public` cannot resolve `gen_random_bytes()` and throws at runtime. Always
use `set search_path = public, extensions`, and fully qualify defaults as
`extensions.gen_random_bytes(...)`.

**Supabase exposes every `public` function as a REST endpoint.** A `SECURITY DEFINER`
function taking a user id and an amount is a money printer if `authenticated` can call it.
After adding any such function: `revoke execute ... from anon, authenticated, public` and
grant only what genuinely needs to be callable.

**RLS policies must not reference each other across tables.** `apps` referencing
`assignments` while `assignments` referenced `apps` produced infinite recursion (42P17) and
every authenticated read silently returned zero rows. Cross-table checks go through the
`SECURITY DEFINER` helpers: `owns_app, tests_app, owns_assignment_app,
is_assignment_tester, is_feedback_tester, is_mod`.

**An RLS policy that says "your own row" says "every column of your own row".**
Supabase exposes every table over REST, so `for update using (tester_id = auth.uid())`
on `assignments` let a tester `PATCH` their own `opt_in_verified_at` and fire the
trigger that pays them and charges the app owner — no screenshot, no moderator.
The same shape on `proofs` let them insert a pre-approved proof for the sweep to
trust. Both are fixed in `20260813200000_lock_payment_columns.sql`, and the rule
is general: **the client may never write a column that a trigger, a job or an RPC
reads when deciding to move credits.** Writes that decide money go through a
`SECURITY DEFINER` RPC; the table itself stays shut, and a guard trigger that
checks `current_user` refuses the write even if a future policy widens again.
`supabase/tests/05-payment-locks.sql` is the regression test and runs as
`authenticated` — as the table owner it would pass against a broken schema.

**Direct inserts into `auth.users` need empty strings, not NULL,** for
`confirmation_token`, `recovery_token`, `email_change*`, `phone_change*` and
`reauthentication_token`. GoTrue scans them into Go strings and NULL yields
"Database error querying schema" on login. A matching `auth.identities` row is also
required.

## Conventions

Server components by default; `'use client'` only where interactivity demands it. Server
Actions live in `src/app/(app)/actions.ts` and return a uniform `ActionResult`.

Reuse the primitives in `src/components/ui`. No component libraries, no icon packages —
inline SVG only. No colour values outside the tokens in `src/app/globals.css`.

Every number a user compares across rows gets `className="num"` (tabular figures).

Every mutation needs a loading state, an error state, and a refreshed or optimistic result.
Never fail silently.

Copy is confident and specific. No emoji, no exclamation marks, no "revolutionize". Write
for a solo developer in Lagos or Jakarta who is four weeks behind schedule.

Handle nulls defensively — this app gets demoed against partially-populated data, and a new
user with nothing listed and nothing taken on must see a page that guides them, never a
blank screen.

## Before launch

See `docs/GO-LIVE.md` for the current status of the Phase 0 checklist from
`docs/BUILD-PLAN.md`.
