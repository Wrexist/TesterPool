# Runbook: turn on Google, GitHub and Apple sign-in

Written to be handed to an agent (Claude Cowork) and worked top to bottom. Every value
that can be filled in already has been. `AUTH-SETUP.md` is the reference for anything this
runbook compresses; where the two disagree, trust `AUTH-SETUP.md` and fix this file.

## Read this first

**Nothing here is a code change.** All three providers are already implemented and
deployed. They fail because no OAuth client has been registered and pasted into Supabase.
The work is console work.

**The agent cannot finish this alone, and should not pretend to.** Google, GitHub, Apple
and Supabase all sit behind a login, most with two-factor. Every phase below marks exactly
where the agent stops and the human takes the keyboard. An agent that reaches a sign-in
wall should say so and wait, not work around it.

**Secrets never enter chat, a file, or a commit.** Client secrets go from the provider's
console straight into the Supabase dashboard field. If a secret has already been pasted
somewhere it should not be, rotate it in the provider console rather than deleting the
message.

### Fill this in before starting

| Placeholder | Value |
| --- | --- |
| `VERCEL_URL` | `https://__________.vercel.app` — your Vercel production URL |

Everything else is known:

| Thing | Value |
| --- | --- |
| Supabase project ref | `yudcncvarndslyyajflr` |
| **Provider callback URL** (all three providers) | `https://yudcncvarndslyyajflr.supabase.co/auth/v1/callback` |
| Supabase providers page | https://supabase.com/dashboard/project/yudcncvarndslyyajflr/auth/providers |
| Supabase URL config page | https://supabase.com/dashboard/project/yudcncvarndslyyajflr/auth/url-configuration |
| Supabase SQL editor | https://supabase.com/dashboard/project/yudcncvarndslyyajflr/sql/new |

The callback URL is the single value that does most of the work. It is the same for Google,
GitHub and Apple. It is **not** the app's own `/auth/callback`, and it is not the Vercel
URL. Getting this wrong is the most common failure and produces `redirect_uri_mismatch`.

### What you get for the effort

| Provider | Cost | Time | Expires |
| --- | --- | --- | --- |
| Google | Free | ~15 min | No |
| GitHub | Free | ~5 min | No |
| Apple | **$99/year** Apple Developer Program | ~45 min | **Secret dies every 6 months** |

Do Google and GitHub first. Decide on Apple afterwards — Phase 4 explains what you are
signing up for, and skipping it is a legitimate answer.

---

## Phase 0 — Stop the live site dead-ending

Right now `apple_login` and `github_login` are `true` in `feature_flags`, set by the seed.
So all three buttons are on the login screen and all three fail. Turn the two off while the
work happens; they come back on one at a time as each provider is finished.

Run in the Supabase SQL editor (or via the Supabase MCP tools if the agent has them):

```sql
update public.feature_flags
   set enabled = false, updated_at = now()
 where key in ('github_login', 'apple_login');
```

Google has no flag and cannot be hidden this way — it stays on the screen and stays broken
until Phase 2. That is the reason to do Phase 2 first.

**Verify:** reload `VERCEL_URL/login`. Only the Google button and the email form remain.

---

## Phase 1 — Point Supabase at the deployment

Everything downstream depends on this, and skipping it produces a sign-in that completes at
the provider and then fails on the way home.

Open the **Supabase URL config page**.

1. **Site URL** — set to `VERCEL_URL`. If it still reads `http://localhost:3000`, that is
   an active bug: a failed sign-in on a phone gets redirected to localhost and hangs, which
   looks exactly like the app freezing.
2. **Redirect URLs** — add both:

   ```
   VERCEL_URL/**
   https://*-<your-vercel-team-slug>.vercel.app/**
   ```

   The second line covers preview deployments, whose hostname changes per branch. The
   `/**` suffix is required: `/*` does not match `/auth/callback`.
3. Save.

**Verify:** the email magic link should already work end to end. Send yourself one from
`VERCEL_URL/login` and confirm it lands on `/dashboard`. If that works, the redirect
plumbing is correct and any remaining failure is provider-side.

**Human gate:** signing in to the Supabase dashboard.

---

## Phase 2 — Google

Free, no review needed for these scopes.

1. Go to https://console.cloud.google.com/home/dashboard and create or select a project.
2. Configure the consent screen:
   - **Branding** (https://console.cloud.google.com/auth/branding) — app name, support
     email, and the homepage, privacy and terms links.
   - **Audience** (https://console.cloud.google.com/auth/audience) — an external app
     starts in testing mode with a fixed list of test users. Add yourself now, and publish
     before real users arrive or they are refused.
   - **Scopes** (https://console.cloud.google.com/auth/scopes) — `openid`,
     `.../auth/userinfo.email`, `.../auth/userinfo.profile`. All three are non-sensitive
     and need no Google verification.
3. **Clients** (https://console.cloud.google.com/auth/clients) → create OAuth client ID →
   application type **Web application**.
4. **Authorised JavaScript origins** — add `http://localhost:3000` and `VERCEL_URL`.
   Google accepts no wildcards here, so branch preview hostnames cannot be listed. Test
   Google on the production URL.
5. **Authorised redirect URIs** — add exactly one:

   ```
   https://yudcncvarndslyyajflr.supabase.co/auth/v1/callback
   ```

6. Copy the **Client ID** and **Client secret**.
7. Supabase providers page → expand **Google** → enable → paste both → save.

**Verify without a browser.** This asks Supabase directly whether the provider is live:

```bash
curl -sSI "https://yudcncvarndslyyajflr.supabase.co/auth/v1/authorize?provider=google" | head -20
```

- Working: a `302` whose `location:` points at `accounts.google.com`.
- Not working: a response containing `provider is not enabled`.

**Then verify for real:** open `VERCEL_URL/login` and sign in with Google. You should land
on `/dashboard` with a new account and 150 credits. Google can take a few minutes to
propagate a console change, so one retry before panicking is reasonable.

**Human gates:** Google account sign-in; the consent screen text is a judgement call.

---

## Phase 3 — GitHub

Free, five minutes.

1. https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. **Application name** — `TesterPool`. This is what users see on the consent screen.
3. **Homepage URL** — `VERCEL_URL`.
4. **Authorization callback URL** — the same Supabase callback:

   ```
   https://yudcncvarndslyyajflr.supabase.co/auth/v1/callback
   ```

5. Leave **Enable Device Flow** unchecked.
6. Register, copy the **Client ID**, then **Generate a new client secret**. GitHub shows
   the secret once — put it into Supabase before leaving the page.
7. Supabase providers page → expand **GitHub** → enable → paste both → save.
8. Turn the flag back on:

   ```sql
   update public.feature_flags
      set enabled = true, updated_at = now()
    where key = 'github_login';
   ```

**Verify:**

```bash
curl -sSI "https://yudcncvarndslyyajflr.supabase.co/auth/v1/authorize?provider=github" | head -20
```

`location:` should point at `github.com/login/oauth/authorize`. Then sign in for real from
`VERCEL_URL/login`.

A GitHub OAuth App accepts exactly one callback URL. That is why every environment routes
through the Supabase callback and distinguishes itself with `redirectTo` instead.

**Human gate:** GitHub sign-in, and the secret must be handled by whoever is at the
keyboard.

---

## Phase 4 — Apple (optional, and the expensive one)

**Stop and decide before starting.** Apple costs **$99 per year** for the Developer
Program, takes about eight sub-steps, and its client secret is a JWT that **expires after
at most six months**. When it expires every Apple sign-in fails at once while the other
providers keep working. Someone has to regenerate it from the `.p8` file and put a calendar
reminder in place. That maintenance is the real cost, not the $99.

If Apple is not load-bearing, leave `apple_login` set to `false` and stop here. The button
stays hidden and nothing looks broken.

If you are proceeding, **follow `AUTH-SETUP.md` § Apple in full** rather than a summary —
it covers the Team ID, App ID, the Services ID that becomes the `client_id`, email relay
sources, the `.p8` private key, generating the client secret JWT, the Supabase fields, and
how private relay addresses interact with `profiles.tester_email`. Each of those has a way
to go wrong that a condensed version would hide.

The two values that differ from the other providers:

- Apple's **Domains** field takes a bare domain, no scheme: `<your-project>.vercel.app`
- Apple's **Return URLs** field takes the full callback:
  `https://yudcncvarndslyyajflr.supabase.co/auth/v1/callback`

When it works, turn the flag on:

```sql
update public.feature_flags
   set enabled = true, updated_at = now()
 where key = 'apple_login';
```

**Human gates:** the whole phase. It involves a paid enrolment, a downloaded private key,
and Apple's two-factor.

---

## Phase 5 — Confirm the whole thing

1. All three `curl` checks return a `302` to the provider's own domain.
2. On `VERCEL_URL/login`, each enabled button completes a real sign-in and lands on
   `/dashboard`.
3. Cancelling a provider dialog returns to `/login` with no error shown. That is
   deliberate — a cancellation is a decision, not a fault.
4. Flag state matches reality:

   ```sql
   select key, enabled from public.feature_flags
    where key in ('github_login', 'apple_login');
   ```

   A flag is `true` only if that provider is genuinely configured. A `true` flag on an
   unconfigured provider is exactly the state that started all this.

## If something fails

`AUTH-SETUP.md` § Troubleshooting maps every error these consoles produce to its cause —
`redirect_uri_mismatch`, `requested path is invalid`, `invalid_client`, Apple's expired
secret, and the rest. Check there before changing anything.

Since the login screen now has a ten-second guard, a button that stalls will re-enable
itself and say what it thinks is wrong. Believe it: the message names the likely cause and
points at the email link, which works throughout all of this.

## Rolling back

Nothing here is destructive. To return to the starting state: disable the provider in the
Supabase providers page and set its flag to `false`. The OAuth clients in the Google,
GitHub and Apple consoles can be left in place — they do nothing until Supabase holds their
credentials.
