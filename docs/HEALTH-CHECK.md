# Health check — 11 Aug 2026

Full pass over the repository and the `cohort` Supabase project (`yudcncvarndslyyajflr`):
types, lint, build, every RPC grant, both product invariants, and the applied migration
history against the checked-in one.

Five issues found. All five are fixed.

## Verification

| Check | Before | After |
| --- | --- | --- |
| `npx tsc --noEmit` | clean | clean |
| `npm run lint` | clean | clean |
| `npm run build` | passes | passes |
| Supabase security advisors | 0 errors, 24 warnings | 0 errors, 24 warnings |

Advisor warnings are unchanged in character: the user-facing RPCs, the RLS predicate
helpers and the admin RPCs are deliberately callable by `authenticated`, and each one
authorises against `auth.uid()` or `is_admin()` itself. `purchase_upgrade` joins that list
built to the same rule. The one remaining non-function warning is leaked-password
protection, which is already a Phase 0 item in `BUILD-PLAN.md`.

`tsc --noEmit` fails on a clean checkout until something generates `.next/types` —
`LayoutProps` is a build-time global. Run `npm run build` first. Not a defect.

## What was broken

### 1. Every credit spend in the product failed

`harden_rpc_surface` revoked `EXECUTE` on `spend_credits` from `authenticated`, correctly:
it takes a user id and an amount, so leaving it callable is a money printer. The Server
Action behind the buffer seat, rescue seat, priority pod, expert seat and extra app buttons
went on calling it with the *user's* session — the exact role that had lost the grant.
Every one of those buttons returned `permission denied for function spend_credits`.

The revoke was right; the caller was never updated. Nothing in the type system or the build
could see it, because the boundary is a Postgres grant.

Fixed with `purchase_upgrade(p_key, p_app)`, built to the shape `claim_rescue` already uses:
no user id and no amount cross the wire. The buyer is `auth.uid()`, the price is read from
`economy_config` inside the database, the config key is checked against a fixed allowlist so
it cannot be pointed at another integer row, and an app-scoped purchase must reference an app
the caller owns. Verified against a real seeded account: a buffer seat and a priority pod both
debited and landed in `credit_ledger`; an arbitrary config key returned `bad_request` and spent
nothing; another developer's app raised `not your app`.

### 2. `ledger_drift()` handed every balance to every signed-in user

A `SECURITY DEFINER` function granted to `authenticated`, and unlike its neighbours
`admin_cron_status` and `admin_secret_presence` it carried no `is_admin()` predicate. At
`/rest/v1/rpc/ledger_drift` any signed-in caller got the handle and credit balance of every
account whose cached balance disagreed with its ledger.

The same class of bug the codebase had already caught twice, on `award_credits` and on
`active_entitlement`. Guard added where the two functions beside it already had theirs; the
grant stays, because the admin system page calls it with the admin's own session. A non-admin
now gets zero rows.

### 3. No session refresh — users would be signed out mid-pod

There was no `middleware.ts` anywhere in the app. The only mention of middleware in the whole
project was a comment in `lib/supabase/server.ts` asserting that it refreshes the session.

Supabase access tokens expire hourly. Refreshing one rotates the refresh token, so the new
pair has to be written back to the browser or the next request presents a token already spent;
reuse detection then treats that as theft and revokes the session. A Server Component cannot
write cookies — `server.ts` swallows that failure by design — so without middleware nothing
ever persisted the refresh. On a product whose whole promise is fourteen consecutive daily
check-ins, that is a broken streak, and a broken streak costs somebody a month.

Added `src/middleware.ts`. It refreshes and nothing else: every authorisation guard stays in
the layout that renders the surface it protects, with RLS behind it. A matcher is routing, not
a security boundary.

### 4. The migration directory was not the applied history

`CLAUDE.md` calls `supabase/migrations/` the exact applied history. It was not. Two applied
migrations had no file in the repo at all:

- `20260810215020_clean_default_handles` — the readable-handle generator, so a new user's
  first sight of their own identity is `@firstrun01` rather than `@firstrun01ccba`, plus the
  rule that only prefills a Play tester address when it could plausibly be a Google account.
- `20260810215411_consume_entitlements_in_matching` — `_consume_entitlement`, the
  entitlement-aware `join_pod`, and `claim_rescue`.

The second one is the whole of paid-tier behaviour. A database rebuilt from this repo would
have taken people's money and given them a receipt: Fast Pod and Pro would have granted no
extra seats, no priority and no reliability floor, and `claim_rescue` would not have existed.
Both are now checked in, at their applied version numbers, in an order that resolves cleanly.

Four other files still carry timestamps that differ from the applied version (`payments` is
one local file against two applied migrations). Harmless — dependency order is correct either
way — and left alone rather than churned.

### 5. A build artifact was tracked against the repo's own `.gitignore`

`app/tsconfig.tsbuildinfo` was committed even though `*.tsbuildinfo` is ignored, so every
build dirtied the tree. Removed from the index.

## What was checked and is sound

- **Both product invariants hold.** No table, column or enum can represent a public store
  review, a public rating or a production install, and no surface tries to. `review_feedback`
  still routes `low_effort` to a moderator dispute rather than rejecting the report, so a
  creator cannot silently withhold payment for critical feedback. No "provably compliant"
  claim anywhere; `STRATEGY.md` explicitly forbids it and the marketing copy makes the
  specific, defensible claim instead.
- **The Stripe layer.** Raw body read before anything else, async signature verification,
  idempotent fulfilment keyed on the session id, no 2xx on a database failure, service-role
  key confined to `api/stripe/`, buyer identity taken from the session cookie and never the
  request body.
- **Authorisation.** `(app)/layout.tsx` redirects anonymous users, `(app)/admin/layout.tsx`
  404s non-admins rather than redirecting, `/demo` is behind `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`,
  and the auth callback only honours same-origin relative `next` targets.
- **No function is callable by `anon`.**
- **Every remaining RPC call site** matches a grant the calling role actually holds.
