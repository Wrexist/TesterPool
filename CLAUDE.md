# TesterPool — project instructions

Read this before writing any code in this repo.

## What this is

A compliance-safe growth network for indie **Android** developers. Google Play requires
**12 testers opted in for 14 consecutive days** before a personal developer account created
after 13 Nov 2023 can publish to production. TesterPool solves it with **pods**: ~15
developers who all test each other's apps across the same 14 days.

The network is the *pool*. One cohort inside it is a *pod*. Keep that vocabulary — users
draw from the pool and sit in a pod.

## The two invariants. Do not break these.

**1. No credit may ever attach to a public store action.**
Google Play's [Ratings, Reviews and Installs policy](https://support.google.com/googleplay/android-developer/answer/9898684)
prohibits incentivized reviews, ratings and installs; Apple's Section 3 does the same.
Everything TesterPool does happens inside **closed testing tracks**, which affect no store
ranking, rating or public install count. That distinction is the entire legal basis of the
product.

The schema deliberately contains no table, column or enum value capable of representing a
public store review, a public rating, or a production install. If a feature request needs
one, the answer is no. Never add: review text fields, star ratings destined for a store,
install-count rewards, review-prompt tooling, or AI-drafted review copy.

**1a. Credits move, they are never minted, and the client never decides a payment.**
A confirmed install transfers 10 from the app owner to the tester; a confirmed report
transfers 30. A full pod costs 560 and pays 560, so doing your share breaks even and the
supply cannot inflate. Nothing that pays out may be triggered by a value the browser
supplied — `submit_proof` exists because `recordOptInProof` once took a confidence score
from the client and approved on it, which was a money printer.

**2. A creator can never silently withhold payment for critical feedback.**
`review_feedback(id, 'low_effort')` opens a moderator dispute — it does not reject the
report. Specific critical feedback is paid at the same rate as praise. Remove that
arbitration step and creator approval becomes a positivity machine, which is exactly the
failure mode of the competitor this product was designed against.

Marketing claims: never say "provably compliant". Say the specific, defensible thing —
*all activity happens inside closed testing tracks, which do not affect store rankings,
ratings, or public install counts.*

## Layout

```
app/
  src/app/                routes — (app)/ is authenticated, everything else public
    (app)/market/         the marketplace: every app in the pool, filtered by
                          scope (testing / report due / mine / saved), platform,
                          stage and category. Reads through market_apps(), never
                          through the apps table. Rows under md, cards above it
    (app)/apps/           my apps: your listings, their counts, and the credit
                          gate stated as a task rather than an error
    (app)/admin/          admin dashboard: overview, users, pods, economy,
                          moderation, fraud, flags, audit, system health
    (app)/billing/        plans, credit packs, purchase history
    api/stripe/           checkout, webhook, portal
  src/components/ui/      design primitives — StreakStrip, ReliabilityGauge, CreditChip…
  src/components/app/     authenticated-surface components (incl. first-run)
  src/components/admin/   admin-only components
  src/lib/economy.ts      earn/spend rates, tiers, plans (mirrors economy_config)
  src/lib/market.ts       marketplace filters, URL parsing, stage/relation copy
  src/lib/pods.ts         pod-day maths, seat health, formatting
  src/lib/evidence.ts     drafts Google's three production-access answers
  src/lib/flags.ts        feature flags, read server-side, fail-safe defaults
  src/lib/billing.ts      SKU catalogue
  supabase/migrations/    the exact applied history — apply in filename order
  supabase/functions/     Deno edge functions: send-notifications, triage-proof
design/                   standalone design system + screen mockups
docs/                     STRATEGY, BUILD-PLAN, AUTH-SETUP, OPERATIONS, PAYMENTS
shots/                    screenshots of the running app
```

## What runs on its own

Four scheduled jobs keep the clock honest. `pod-lifecycle` (hourly at :07) starts full pods,
closes finished ones and releases escrow. `clock-watch` (every 6 hours) enqueues check-in
reminders and detects dropouts. `nightly` (02:20 UTC) reconciles the ledger and prunes.
`send-notifications` (every 15 minutes) drains the outbox by calling the edge function.

`/admin/system` is the smoke alarm for all of it. Check there first when something feels wrong.
`docs/OPERATIONS.md` has the detail.

Pods are behind the `pods_open` flag, which defaults **off**: a pod is a promise
about fourteen specific days, and opening one before there are enough testers to
fill it costs a developer a month. `/pods` says so and points at the marketplace.
Flip the flag in `/admin/flags` when the pool is deep enough — pods already in
flight keep running either way.

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

**The marketplace reads through `market_apps` / `market_app` / `market_counts` /
`market_categories`, never through `apps`.** Those four are `SECURITY DEFINER` and are the
projection that decides what a browsing member may see. They withhold `opt_in_url`,
`google_group`, `package_name` and `tester_instructions` from anyone who neither owns the
app nor holds an assignment on it — for an app in closed testing the package name *is* the
way into the track, and the way in is granted by a pod, not by a directory. They also
surface no scores and no averages, for the reason in invariant 1. Add a column to the
listing only after deciding which of those two rules it lands under.

**Never mutate `profiles.credits` directly.** Go through `award_credits` / `spend_credits`,
which write the append-only `credit_ledger` in the same statement. The ledger is the source
of truth; `profiles.credits` is a cached projection.

RPCs callable by `authenticated`: `join_pod, start_pod, submit_checkin, review_feedback,
arbitrate_dispute, market_apps, market_app, market_counts, market_categories`. Each authorises against `auth.uid()` itself.

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
user with no pod must see a page that guides them, never a blank screen.

## Before launch

See `docs/GO-LIVE.md` for the current status of the Phase 0 checklist from
`docs/BUILD-PLAN.md`.
