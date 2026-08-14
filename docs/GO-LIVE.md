# Go-live runbook

Everything that has to happen outside the codebase before real people sign up,
in the order it has to happen. Each step says what breaks if you skip it.

Constants used throughout:

| | |
|---|---|
| Supabase project ref | `yudcncvarndslyyajflr` |
| Supabase URL | `https://yudcncvarndslyyajflr.supabase.co` |
| Vercel project | `dynasty-manager/tester-pool` |
| PR to merge | [#3](https://github.com/Wrexist/TesterPool/pull/3) |

**Read step 0 and step 1 together before starting either.** The ordering between
the migrations and the merge is the one thing in here that can take the live app
down, and it is not the order you would guess.

## Status, as of this pass

- **Step 0 is already done, safely.** The `@demo.testerpool.dev` accounts were
  removed directly against the live database before this branch was merged in —
  confirmed down to zero rows outside the one real profile. Migration
  `20260811130000_remove_demo_accounts.sql` is still worth applying: it is
  idempotent (finds nothing, logs a notice, moves on) and it adds the permanent
  `no_demo_accounts` CHECK constraint, which is new protection this database
  did not have yet.
- **A real bug, found and fixed separately:** the original admin-grant migration
  targeted `handle = 'isacm'`, but the live account is `isacmolin` — that update
  matched zero rows, so nobody had admin access. Fixed directly on the live
  profile; `isacmolin` is admin now. Worth knowing if you ever replay that
  migration against a fresh database — the bug is still in the file.
- **Sentry and PostHog are now wired in, code-complete.** `instrumentation.ts`,
  `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`,
  and a `PostHogProvider` in the root layout — all inert until
  `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_POSTHOG_KEY` are set. Supersedes the
  "Still open" note below.

---

## 0. Back up first

One migration deletes rows and cannot be undone: `20260811130000_remove_demo_accounts.sql`
removes the `@demo.testerpool.dev` users and cascades through profiles, apps,
pod_members, assignments, feedback, proofs and the ledger. It also deletes any
pod those accounts were seeded into.

That is the intent — it is seed data, and each account is a published-password
login holding a spendable balance. But take a dump anyway:

```bash
# Connection string: Supabase dashboard -> Project Settings -> Database -> Connection string -> URI
pg_dump "postgresql://postgres:<password>@db.yudcncvarndslyyajflr.supabase.co:5432/postgres" \
  --no-owner --no-privileges -f testerpool-backup-$(date +%Y%m%d).sql
```

If `pg_dump` refuses on a version mismatch, use the dashboard: Database → Backups
→ take a manual backup. On the free tier retention is short, so keep the local
file regardless.

---

## 1. Apply the migrations — BEFORE merging the PR

Five new files, applied in filename order:

```
20260811090000_economy_enum_values.sql        enum values, alone (Postgres will not
                                              let a new enum value be used in the
                                              transaction that added it)
20260811090100_symmetric_credit_economy.sql   the transfer economy, caps, paid pass
20260811120000_proof_intake_hardening.sql     submit_proof, storage policies, sweep
20260811120100_schedule_proof_triage.sql      the cron job
20260811130000_remove_demo_accounts.sql       destructive — see step 0
```

### Why before the merge

The new app code needs `submit_proof`, `testing_quota` and `apps.credits_paused`.
The migrations, in turn, `revoke insert on proofs from authenticated`, which the
*old* code depends on. So whichever you do first, there is a window.

Migrations first is much the smaller window: only screenshot uploads fail, and
they fail with a permission error rather than silently mis-paying. Merge first
and the tests page, the pods page and onboarding all break, because they query
objects that do not exist yet.

So: **apply, verify, then merge.** Minutes apart, not hours.

### Applying

Check what the remote thinks is already applied:

```bash
cd app
supabase link --project-ref yudcncvarndslyyajflr
supabase migration list
```

Read that output carefully before going further. The eighteen pre-existing
migrations were applied to this project directly, so the remote's
`supabase_migrations.schema_migrations` table may be empty or partial. If the
older files show as *not* applied remotely, do **not** let the CLI re-run them —
mark them as already done first:

```bash
# One per pre-existing migration the list shows as unapplied. Timestamps only.
supabase migration repair --status applied 20260810184222
supabase migration repair --status applied 20260810184322
# ...and so on through 20260810230000
```

Then push only the new work:

```bash
supabase db push
```

If you would rather not trust the CLI's history at all, paste the five files in
order into the SQL editor instead. They are plain SQL and safe to run once each.

### Verify before merging

```sql
-- 1. The prices moved.
select key, value from economy_config
 where key in ('opt_in_verified','feedback_approved','install_charge',
               'review_charge','daily_install_cap','signup_grant','daily_checkin')
 order by key;
-- expect: daily_checkin 0, daily_install_cap 10, feedback_approved 30,
--         install_charge 10, opt_in_verified 10, review_charge 30, signup_grant 600

-- 2. The new callables exist.
select proname from pg_proc
 where proname in ('submit_proof','testing_quota','stamp_approved_optins',
                   'has_unlimited_testing','triage_proof_tick')
 order by proname;   -- expect 5 rows

-- 3. The client can no longer write proofs directly. This is the fix.
select has_table_privilege('authenticated','proofs','INSERT');  -- expect false

-- 4. The bucket is private.
select id, public, file_size_limit from storage.buckets where id = 'proofs';
-- expect public = false, 8388608

-- 5. The cron job is scheduled.
select jobname, schedule, active from cron.job where jobname = 'triage-proofs';
```

If all five look right, merge PR #3. Vercel deploys `main` automatically.

---

## 2. Deploy the analyser and give it a key

The `triage-proof` function exists in the repo and has almost certainly never
been deployed. Without the key it still runs — it hashes the image, checks for
reuse, and leaves the proof for a human. That is a safe state, just not a useful
one.

```bash
cd app

# A long random shared bearer between cron and the functions. Generate once and
# keep it — step 3 needs the same value.
openssl rand -hex 32

supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  CRON_SECRET=<the value you just generated> \
  --project-ref yudcncvarndslyyajflr

supabase functions deploy triage-proof --project-ref yudcncvarndslyyajflr
```

Get the Anthropic key from <https://console.anthropic.com> → API keys. Cost is
roughly a third of a cent per screenshot, so a fifteen-person pod running its
full fourteen days is a few cents.

`ANTHROPIC_MODEL` is optional and defaults to a current Claude model. Set it only
to pin a specific snapshot.

Check it deployed:

```bash
supabase functions list --project-ref yudcncvarndslyyajflr
```

### One gotcha: two callers, two kinds of credential

`triage-proof` is invoked from two places, and they authenticate differently:

- the Next server, inline after an upload, with the **service-role key** (a JWT);
- pg_cron, on the sweep, with the **`cron_secret`** (an opaque random string).

The function itself accepts both — `authorised()` checks the service key, then
`CRON_SECRET`, then the Vault copy. What can still refuse the cron call is the
Supabase **gateway**, which verifies a JWT before the function ever runs and will
reject an opaque string with a 401 you never see in the function's logs.

`send-notifications` is already invoked the same way, so if that one delivers,
this one will too. If the sweep silently dispatches and nothing happens, that is
the first thing to check:

```bash
supabase functions deploy triage-proof --no-verify-jwt --project-ref yudcncvarndslyyajflr
```

The function is not left unprotected by that flag — it does its own constant-time
check on both credentials and returns 401 without one.

---

## 3. Two Vault secrets, so cron can reach the function

`cron.job` is a readable table, so no URL or token is written into the job
command. Both are read from Vault when the job fires.

In the SQL editor:

```sql
select vault.create_secret(
  'https://yudcncvarndslyyajflr.supabase.co/functions/v1/triage-proof',
  'triage_proof_url',
  'Endpoint the screenshot analyser is invoked at');

-- Skip this one if it already exists — it is shared with the notification
-- sender. Check first:
--   select name from vault.secrets order by name;
select vault.create_secret(
  '<the same CRON_SECRET from step 2>',
  'cron_secret',
  'Shared bearer between cron and the edge functions');
```

The `cron_secret` value **must** match what you set on the function in step 2, or
every dispatch comes back 401.

Confirm the wiring by firing the job by hand:

```sql
select triage_proof_tick();
```

- `{"skipped": true, ...}` → Vault is not configured; re-read the names above.
- `{"dispatched": 0, "stamp": {...}}` → working, nothing waiting. This is success.

---

## 4. Environment variables on Vercel

Project → Settings → Environment Variables. Set for **Production** and
**Preview** both.

| Name | Value | Why |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` | Without it the app cannot fire triage inline. Proofs still get analysed, but only when cron sweeps — up to five minutes later, instead of while the user is looking at the screen. **Never** prefix this `NEXT_PUBLIC_`. |
| `SUPABASE_FUNCTIONS_URL` | `https://yudcncvarndslyyajflr.supabase.co/functions/v1` | Optional. Derived from the Supabase URL if unset; set it explicitly if you ever use a custom functions domain. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from step 5 | Public by design. |

Redeploy after changing these — Vercel does not apply env changes to an existing
deployment.

---

## 5. Turnstile — both halves or it is decoration

The widget in the browser proves nothing on its own. What enforces it is GoTrue
checking the token against Cloudflare with the **secret** key. A site key with no
secret configured in Supabase is a CAPTCHA that anyone can skip by not solving it.

1. <https://dash.cloudflare.com> → Turnstile → Add widget.
   - Widget name: `testerpool-signin`
   - Domains: your production domain, plus `localhost` for development
   - Widget mode: **Managed**
2. Copy both keys.
3. Site key → Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (step 4). Redeploy.
4. Secret key → Supabase → Authentication → Bot and Abuse Protection → enable
   CAPTCHA protection, provider **Turnstile**, paste the secret, save.

Test: open the sign-in page in a private window. The widget should render and the
button stay disabled until it resolves. Then confirm the back end is really
enforcing — with the site key temporarily removed from Vercel, a sign-in attempt
should be *rejected by Supabase*, not succeed. If it succeeds, step 4 of this
section did not take.

---

## 6. Leaked-password protection

Supabase → Authentication → Policies (or Providers → Email) → enable **Prevent
use of leaked passwords**. It checks against HaveIBeenPwned on signup.

Thirty seconds, no downtime, no code change. The advisor flags its absence.

Sign-in here is magic-link, so this matters only if you ever enable password
auth — but enable it now so that day is already covered.

---

## 7. Rotate the anon key — last, and read this first

**This signs out every existing session.** Do it when you can tolerate that,
which right now is trivially true and will not be later.

The key was published in the repo's history, so it must be rotated before real
users exist. What "rotating" means depends on which key system the project is on:

- **Legacy (JWT-based `anon` / `service_role`):** Settings → API → JWT Settings →
  rotate the JWT secret. Both keys are re-derived. Every issued token dies.
- **Current (publishable / secret keys):** Settings → API Keys → revoke and
  re-create. Sessions survive here, but any client holding the old key breaks.

Either way, immediately afterwards:

1. Copy the new anon/publishable key.
2. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (Production and Preview).
3. Update `SUPABASE_SERVICE_ROLE_KEY` too if it changed.
4. Redeploy.
5. Load the site and sign in, to prove the new key works.

Keep the dashboard tab open until step 5 passes. If the site is broken and you
have lost the key, you cannot recover it — you can only rotate again.

---

## 8. Smoke test the whole path

With a real account, on a real device:

1. Sign up. Confirm the Turnstile widget appears and blocks the button until solved.
2. Check the starting balance is **600**.
3. List an app. Confirm **Finish setup** enables without an opt-in link.
4. Join a pod. Confirm it asks for the opt-in link there instead.
5. Upload an opt-in screenshot. Watch what happens:

```sql
select id, kind, status, ai_confidence,
       ai_verdict -> 'decision_reason' as why,
       ai_verdict -> 'observed'        as observed
  from proofs order by created_at desc limit 5;
```

   - `auto_approved` with an `observed` sentence → the analyser is live.
   - `pending` with `ai_verdict.triage = 'unconfigured'` → step 2's key is missing.
   - `pending` with `triage = 'failed'` → read `ai_verdict.reason`.
   - `pending` with `ai_verdict` null after five minutes → cron is not reaching
     the function; re-check step 3.

6. Confirm the money moved, and moved *sideways*:

```sql
select p.handle, l.reason, l.delta, l.balance_after, l.created_at
  from credit_ledger l join profiles p on p.id = l.user_id
 order by l.created_at desc limit 10;
```

   A confirmed install must show **two** rows: `+10 opt_in_verified` to the
   tester and `-10 install_charge` to the app owner. One row without the other
   means something is wrong — stop and say so.

7. `/admin/system` should show `triage_proof_dispatch` running every five minutes.

---

## Still open after all this

**Email.** The SMTP secrets are unset, so the outbox drains to nothing. The daily
check-in reminder is not a nicety here: a missed day resets someone else's
fourteen. Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` and `NOTIFICATION_FROM`
on the `send-notifications` function the same way as step 2. `docs/DOMAIN.md`
covers where the credentials come from.

**Auto-renewal for Unlimited.** Sold as a 30-day pass through the existing
one-off Checkout. Real recurring billing needs `mode: 'subscription'` and an
`invoice.paid` handler. The billing page calls it a pass, so the copy is honest
in the meantime.

**Sentry and PostHog.** Code-complete (see "Status" at the top) — still need
`NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_POSTHOG_KEY` from an actual project on
each service before either does anything.

**Two numbers that are guesses.** The vision auto-approve bar is `0.85`
(`AUTO_APPROVE_MIN_CONFIDENCE` in `supabase/functions/triage-proof/index.ts`) and
the upload ceiling is 20/hour (`max_proofs_per_hour` in `economy_config`). Watch
the first few pods and move them:

```sql
-- What the model is actually returning, and what it decided.
select ai_verdict ->> 'decision' as decision,
       round(avg(ai_confidence), 3) as avg_confidence,
       count(*)
  from proofs where ai_confidence is not null
 group by 1 order by 3 desc;
```

If moderators are approving a lot of `pending` proofs unchanged, the bar is too
high. If they are rejecting anything `auto_approved`, it is far too low — raise
it immediately, because those have already been paid.

**The kill switch.** If the analyser starts approving things it should not:

```sql
update feature_flags set enabled = false where key = 'auto_approve_proofs';
```

Every proof then goes to a human. Nothing else in the product stops.
