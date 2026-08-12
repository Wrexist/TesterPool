# Go-live status

Tracks the Phase 0 checklist from `docs/BUILD-PLAN.md` ("before anyone real signs up"). Written
against the live Supabase project `cohort` (`yudcncvarndslyyajflr`) and the state of this repo as
of this pass. Update the checkboxes as items close out; don't re-derive this list from scratch.

## Done

- [x] **`/demo` route deleted.** `app/src/app/demo/` (the passwordless demo sign-in page and its
      hardcoded `testerpool-demo-1234` password) is gone from the repo. `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`
      has been removed from `.env.example`.
- [x] **The 16 seeded `@demo.testerpool.dev` accounts are deleted from the live database.** This
      was bigger than 16 rows: every app (25), pod (2), assignment (210), check-in (1,638),
      feedback report (84), greenlight (9) and all but one credit-ledger row belonged to those
      accounts. `profiles` now has exactly one row — the real account, `isacmolin`. Deleted via
      `delete from auth.users where id in (select id from profiles where tester_email like
      '%@demo.testerpool.dev')`, which cascades through every FK that touches a profile. Migrations:
      `delete_demo_seed_accounts`, `delete_orphaned_demo_pods`.
- [x] **`citext` already lives in the `extensions` schema, not `public`.** Checked via
      `list_extensions` — this item was done at some point before this pass, no action needed.
- [x] **Terms of Service and Privacy Policy are written and linked** (`/terms`, `/privacy`,
      footer, login page) — from the previous pass.
- [x] **Cloudflare Turnstile is wired into the signup form**, code-complete: `src/components/Turnstile.tsx`
      (client widget) and `src/app/api/turnstile/verify/route.ts` (server-side `siteverify` check)
      gate the magic-link form in `LoginForm.tsx`. It is a deliberate no-op — the widget doesn't
      render and the server check passes through — until the two env vars below are set, so this
      does not block signups on a deployment that hasn't configured Turnstile yet.
- [x] **Sentry error tracking is wired in, code-complete but inert.** `instrumentation.ts`,
      `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and
      `next.config.ts` (wrapped with `withSentryConfig`). No-ops without `NEXT_PUBLIC_SENTRY_DSN`.
- [x] **PostHog product analytics is wired in, code-complete but inert.**
      `src/components/PostHogProvider.tsx`, mounted in the root layout, tracks pageviews on route
      change. No-ops without `NEXT_PUBLIC_POSTHOG_KEY`.
- [x] **Found and fixed a real bug while in here:** the migration that was supposed to grant the
      first admin ran `update profiles set role = 'admin' where handle = 'isacm'`, but the real
      account's handle is `isacmolin` — that update matched zero rows. Nobody had admin access to
      `/admin`. Fixed directly on the live profile (migration `grant_first_real_admin`); `isacmolin`
      is admin now.
- [x] **Checked the `admin_*` SECURITY DEFINER functions the security advisor flags as
      "executable by authenticated users."** These are flagged by name only — each one calls
      `perform _require_admin()` as its first line and raises before doing anything if the caller
      isn't an admin (see `app/supabase/migrations/20260810200631_admin_roles_audit_flags.sql`).
      Confirmed as intentional, not a vulnerability.

## Still needs you — dashboard/account actions

These involve rotating credentials or changing account-level security settings, which isn't
something to hand to an assistant with shell and database access. Each is one dashboard visit.

- [ ] **Rotate the Supabase anon key.** Project Settings → API → Legacy anon key → rotate.
      Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` everywhere it's set (Vercel env vars, any
      `.env.local`) immediately after — the old key keeps working until you update those, so do
      this in one sitting.
- [ ] **Enable Supabase leaked-password protection.** Flagged by the security advisor
      (`auth_leaked_password_protection`, WARN). Authentication → Providers → Password → turn on
      "Leaked password protection." One toggle.
      https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- [ ] **Create the Cloudflare Turnstile site** (free) at
      https://dash.cloudflare.com/?to=/:account/turnstile, then set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
      and `TURNSTILE_SECRET_KEY` in your host's env vars. The code is already live and waiting for
      these two values.
- [ ] **Create a Sentry project** (Next.js platform) at sentry.io, then set
      `NEXT_PUBLIC_SENTRY_DSN`. Optionally set `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT`
      too, for source-map upload and readable stack traces — the build works fine without them.
- [ ] **Create a PostHog project** at app.posthog.com, then set `NEXT_PUBLIC_POSTHOG_KEY` (and
      `NEXT_PUBLIC_POSTHOG_HOST` if not using the US cloud).
- [ ] **Push these commits to GitHub yourself.** Same situation as the last handoff
      (`PUSH-TO-GITHUB.md`): this session's git proxy isn't authorized for `Wrexist/TesterPool`, so
      `git push` returns a 403 here no matter what. The commits are sitting locally, ready to pull
      or bundle across.
- [ ] **Verify the edge function secrets are actually set** on the live project — `RESEND_API_KEY`,
      `NOTIFICATION_FROM`, `ANTHROPIC_API_KEY`, and the two Supabase Vault secrets (confirmed
      present: `send_notifications_url`, `cron_secret`). `/admin/system` in the app is the fastest
      way to check — it tells you outright whether delivery or proof triage is unconfigured, per
      `docs/OPERATIONS.md`.

## Left as-is, on purpose

- `app/src/app/launch/page.tsx`'s `PLACEHOLDERS` array is not demo debt — it's the documented
  fallback the Launch Feed renders when there are zero live greenlit apps (which, post-wipe, is
  currently the case). It's clearly marked `live: false` in the query result and the page already
  distinguishes the two states. No action needed; it'll stop rendering once the first real app
  graduates.
- The `0.85` auto-approve confidence threshold (`AUTO_APPROVE_MIN_CONFIDENCE` in
  `supabase/functions/triage-proof/index.ts`) and any per-hour upload ceiling are real tuning
  knobs, but there's no live traffic yet to tune them against. Revisit once real proofs start
  flowing — `docs/OPERATIONS.md` has the queries for outbox/triage health.
