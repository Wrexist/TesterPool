# Auth provider setup

TesterPool signs people in four ways: an emailed magic link, Google, GitHub and Apple.
The magic link works out of the box. The three OAuth providers do nothing until they are
registered with the provider and configured in the Supabase dashboard. Until then the
button either does not render (Apple and GitHub are behind feature flags) or fails with
`Unsupported provider: provider is not enabled`.

This document is the runbook for that configuration. Every console URL and field name
below was checked against primary documentation; sources are listed at the end of each
section. The consoles are redesigned regularly, so if a label has moved, trust the linked
source over this file and correct this file afterwards.

## What the app already does

- `src/app/login/page.tsx` is a server component. It reads the `feature_flags` table
  through `src/lib/flags.ts` and passes `apple_login`, `github_login` and `signups_open`
  into the client form.
- `src/app/login/LoginForm.tsx` calls
  `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })` where `redirectTo`
  is `${origin}/auth/callback` plus the `?ref=` referral code when one is present.
- `src/app/auth/callback/route.ts` exchanges the code for a session, forwards `?ref=`,
  refuses any `?next=` that is not a same-origin relative path, signs out banned accounts,
  and returns a cancelled provider dialog to `/login` without an error message.

Two flags gate the new buttons. Both default to `false` in `src/lib/flags.ts` when the
table cannot be read, which means a database problem hides a provider rather than showing
a button that dead-ends. Leave `apple_login` and `github_login` disabled until the
corresponding section below is complete:

```sql
update public.feature_flags set enabled = true, updated_at = now() where key = 'github_login';
update public.feature_flags set enabled = true, updated_at = now() where key = 'apple_login';
```

**The seed ships both flags enabled.** So on a seeded project the buttons are already on
screen before any provider has been registered, and all three dead-end — Google has no flag
at all and is always offered. Turn them off until you have finished the section for each,
then turn them back on one at a time:

```sql
update public.feature_flags set enabled = false, updated_at = now()
 where key in ('github_login', 'apple_login');
```

## Supabase URL configuration

Do this first. It applies to every provider, and a missing entry here is the single most
common cause of a sign-in that completes at the provider and then fails on the way home.

Open the Supabase dashboard, then **Authentication → URL Configuration**.

**Site URL.** The default redirect target when a call does not pass `redirectTo`. Set it to
the production origin, `https://testerpool.dev`. Do not leave it at `http://localhost:3000`
in a production project.

**Redirect URLs.** An allow list. The `redirectTo` value the browser sends must match an
entry here or Supabase refuses the redirect. Add all of:

```
http://localhost:3000/**
https://testerpool.dev/**
https://*-<your-vercel-team-slug>.vercel.app/**
```

The third line covers Vercel preview deployments, whose hostnames change on every branch.
Supabase matches these patterns with glob syntax where `.` and `/` are separators: `*`
matches a run of characters containing no separator, `**` matches any run of characters at
all, and `?` matches a single non-separator character. That is why the path suffix must be
`/**` and not `/*` — `/*` would not match `/auth/callback`.

The provider-side redirect URI is a different thing and never changes: it is always the
Supabase callback, `https://<project-ref>.supabase.co/auth/v1/callback`. For this project
`<project-ref>` is `yudcncvarndslyyajflr`. The app's own `/auth/callback` route is never
registered with Google, GitHub or Apple.

Sources:
- https://supabase.com/docs/guides/auth/redirect-urls

## Google

Free. No developer program, no annual fee, no review for a basic sign-in scope set.

1. Open the Google Cloud console at https://console.cloud.google.com/home/dashboard and
   create a project, or select an existing one.
2. Go to the Google Auth Platform at https://console.cloud.google.com/auth/overview and
   complete the consent configuration:
   - **Branding** (https://console.cloud.google.com/auth/branding) — application name,
     support email, logo, and the homepage, privacy policy and terms links.
   - **Audience** (https://console.cloud.google.com/auth/audience) — choose who may sign
     in. An external app starts in testing mode with a fixed list of test users; publish
     it before real users arrive, or they will be refused.
   - **Scopes** (https://console.cloud.google.com/auth/scopes) — `openid`,
     `.../auth/userinfo.email` and `.../auth/userinfo.profile`. These three are
     non-sensitive and do not require Google verification.
3. Go to **Clients** (https://console.cloud.google.com/auth/clients) and create a new
   OAuth client ID with application type **Web application**.
4. Under **Authorised JavaScript origins**, add every origin the app is served from:
   `http://localhost:3000`, the Vercel production origin
   (`https://<your-project>.vercel.app`), and `https://testerpool.dev` once the custom
   domain exists. Google does not accept wildcards here, so a preview deployment on a
   branch hostname cannot be listed — test Google sign-in on the production origin, or
   put a stable domain in front of it.
5. Under **Authorised redirect URIs**, add exactly one value:

   ```
   https://yudcncvarndslyyajflr.supabase.co/auth/v1/callback
   ```

   This is the Supabase callback, not the app's `/auth/callback`. It is also shown on the
   Google provider row in the Supabase dashboard, ready to copy.
6. Copy the **Client ID** and **Client secret**.
7. In Supabase, go to **Authentication → Sign In / Providers**, expand **Google**, enable
   it, paste the client ID and client secret, and save.

Sources:
- https://supabase.com/docs/guides/auth/social-login/auth-google

## GitHub

Free. A personal or organisation GitHub account is enough. Register the app under the
organisation if more than one person needs to rotate the secret.

1. Go to https://github.com/settings/developers, open **OAuth Apps** and choose
   **New OAuth App**.
2. **Application name** — what the user sees on the consent screen. Use `TesterPool`.
3. **Homepage URL** — `https://testerpool.dev`.
4. **Authorization callback URL** — the Supabase callback:

   ```
   https://yudcncvarndslyyajflr.supabase.co/auth/v1/callback
   ```

5. Leave **Enable Device Flow** unchecked. TesterPool is a web app and does not use it.
6. Register the application, then copy the **Client ID** and choose
   **Generate a new client secret**. GitHub shows the secret once. Store it before leaving
   the page.
7. In Supabase, go to **Authentication → Sign In / Providers**, expand **GitHub**, enable
   it, paste the client ID and client secret, and save.
8. Set `github_login` to true in `feature_flags`, then sign in with a real GitHub account
   on a preview deployment before enabling it in production.

A GitHub OAuth App accepts exactly one callback URL, which is why every environment routes
through the same Supabase callback and differentiates itself with `redirectTo` instead.

Sources:
- https://supabase.com/docs/guides/auth/social-login/auth-github
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app

## Apple

Apple is the expensive one and the one that breaks on a timer. Read this whole section
before starting.

### Prerequisites and cost

Sign in with Apple for a website requires a paid **Apple Developer Program** membership at
**99 USD per year**. A free Apple developer account cannot create the Services ID or the
signing key this needs. The membership renews annually; if it lapses, the identifiers stop
working and every Apple sign-in fails.

Budget the time as well as the money. Enrolment involves identity verification and, for an
organisation, a D-U-N-S number, and can take several days.

### 1. Team ID

Sign in at https://developer.apple.com/account. The **Team ID** is a ten-character
alphanumeric string shown in the membership details. Write it down; both the Supabase
configuration and the client secret JWT need it.

### 2. App ID

Go to **Certificates, Identifiers & Profiles → Identifiers**
(https://developer.apple.com/account/resources/identifiers/list/bundleId) and register a
new **App ID**. Use a reverse-domain identifier such as `dev.testerpool.app`. In
**Capabilities**, enable **Sign in with Apple**. Leave server-to-server notification
endpoints blank; TesterPool does not consume them.

The App ID exists even though TesterPool ships no iOS app. Apple treats it as the parent
that grants the capability to the Services ID created next.

### 3. Services ID — this is the web client_id

Go to https://developer.apple.com/account/resources/identifiers/list/serviceId and register
a new **Services ID**, for example `dev.testerpool.app.web`. It must differ from the App ID.

Enable **Sign in with Apple** on it and open **Configure**:

- **Primary App ID** — the App ID from step 2.
- **Domains and Subdomains** — `yudcncvarndslyyajflr.supabase.co`. Domain only, with no
  scheme and no path. Apple rejects a value beginning with `https://`.
- **Return URLs** — `https://yudcncvarndslyyajflr.supabase.co/auth/v1/callback`. Full URL,
  HTTPS only. Apple does not accept `localhost` or any plain-HTTP return URL, which is why
  local development also runs through the hosted Supabase callback.

The Services ID identifier is what goes into the Supabase **Client IDs** field. It is the
`client_id` for the web flow. The App ID is not.

### 4. Email relay sources

While in the Services area, register the domains that send mail to users under
**Sign in with Apple for Email Communication**. Apple relays messages sent to a private
relay address only from verified sources. Skip this and account emails to Apple users are
silently dropped.

### 5. Private key (.p8)

Go to **Keys** (https://developer.apple.com/account/resources/authkeys/list) and register a
new key. Give it a name, enable **Sign in with Apple**, configure it against the primary
App ID, and register it.

Download the `AuthKey_XXXXXXXXXX.p8` file. **Apple allows exactly one download.** If it is
lost, the key must be revoked and replaced. Note the ten-character **Key ID** shown on the
same screen. Store the `.p8` in the team password manager, never in the repository.

### 6. Client secret — a JWT that expires

Apple does not issue a static client secret. The secret is a short-lived ES256 JWT that you
sign with the `.p8` key. Its claims are:

| Claim | Value |
| --- | --- |
| `alg` (header) | `ES256` |
| `kid` (header) | the ten-character Key ID from step 5 |
| `iss` | your ten-character Team ID |
| `iat` | issue time, seconds since the epoch |
| `exp` | expiry — **at most `15777000` seconds, six months, in the future** |
| `aud` | `https://appleid.apple.com` |
| `sub` | the Services ID, the same value used as `client_id` |

Apple rejects the token outright if `exp` is more than six months ahead. Supabase publishes
a browser-side generator on its Apple provider page that takes the Team ID, Services ID,
Key ID and `.p8` contents and produces the JWT without the key leaving the browser. It does
not work in Safari; use Firefox or a Chromium browser.

**What happens when it expires:** the secret stops being valid at the instant of `exp`.
Apple then rejects the token exchange with `invalid_client`, and *every* Apple sign-in
fails — new and returning users alike. Nothing in the app detects this, no other provider
is affected, and the failure looks like an outage on our side rather than a lapsed
credential. There is no grace period and no warning email.

So: generate the secret with a six-month expiry, record the exact expiry date, and put a
recurring calendar reminder at **five months** on at least two people. Rotation is a
two-minute job — regenerate the JWT from the same `.p8` and paste it into Supabase — but
only if someone remembers to do it. The `.p8` key itself does not expire; only the JWT does.

### 7. Supabase configuration

In Supabase, go to **Authentication → Sign In / Providers**, expand **Apple**, enable it,
and fill in:

- **Client IDs** — the Services ID. If a native iOS client is ever added, this field takes
  a comma-separated list with the Services ID first.
- **Secret Key (for OAuth)** — the JWT from step 6.

Save, then set `apple_login` to true in `feature_flags` and test with a real Apple Account.

### 8. Private relay, hidden emails, and `tester_email`

When a user signs in with Apple they may choose **Hide My Email**. Apple then issues a
per-app relay address such as `a1b2c3d4e5@privaterelay.appleid.com`, forwards mail to their
real inbox, and never tells us the real address. Apple's guidelines require us to respect
that choice and not ask for a personal address to replace it.

This matters more for TesterPool than for most products, and it is worth being blunt about
why.

Google Play closed testing works by opting in specific **Google account email addresses**.
A tester's Play account address is what the developer pastes into the tester list, and it
is the only address that can accept the opt-in link. An `@privaterelay.appleid.com` address
is not a Google account. Neither, usually, is a GitHub account's primary address, and a
Google login address is only sometimes the address the person actually uses on their phone.

Therefore: **the login email and `profiles.tester_email` are different fields with
different jobs, and the login email must never be assumed usable as a Play tester
address.** Onboarding has to ask for the Play tester address explicitly, label it as the
Google account signed in on the device that will install the build, and verify it. Any
prefill from the login identity is a convenience at best and needs to be presented as a
value to confirm, not a value to accept silently.

Getting this wrong is the most common way a closed test fails. The developer adds twelve
addresses, the testers never see the app because their device is signed in as somebody
else, the fourteen-day clock never starts, and nobody finds out until the deadline. It
costs the pod two weeks.

One place to watch: `src/app/(app)/tests/[id]/optin/page.tsx` currently prefills the
opt-in wizard with `profile?.tester_email ?? user.email ?? ''`. That fallback to the login
email is exactly the assumption described above, and it becomes actively wrong once Apple
private relay addresses are in the user table. Whoever owns that route should make the
fallback empty and require an explicit entry.

Sources:
- https://supabase.com/docs/guides/auth/social-login/auth-apple
- https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
- https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
- https://developer.apple.com/programs/
- https://support.google.com/googleplay/android-developer/answer/9845334

## Button appearance

The three provider buttons are peers: same surface, same height, same type, in the order
Google, GitHub, Apple. That is a deliberate choice and also a requirement — Apple's
guidelines say the Sign in with Apple button must be no smaller than any other sign-in
button on the screen and must not require scrolling to reach.

The rest of what Apple mandates, and how the current implementation satisfies it:

- **Title.** Only `Sign in with Apple`, `Sign up with Apple` or `Continue with Apple` are
  permitted. The button uses `Sign in with Apple`, and the loading state is announced with
  `aria-busy` and a separate status line rather than by rewriting the label.
- **Logo colour.** The logo and title inside the button must both be black or both white,
  never a custom colour. The mark is drawn in `currentColor` and inherits `--color-ink`, so
  it renders white on our dark surface — the variant Apple specifies for dark backgrounds.
- **Corner radius.** Apple asks that the radius match the other buttons in the interface.
  The shared `.btn` radius of 10px does that, and sits inside Apple's permitted 0–50 range.
- **Minimum size.** Minimum 140pt wide and 30pt tall. The button is full width inside a
  `max-w-md` card and roughly 40px tall, so both are met at every breakpoint.
- **Margin.** At least one tenth of the button height around the button. The 8px gap in the
  button stack exceeds that.
- **Artwork.** Never redraw or recolour the Apple logo, and never crop its built-in
  padding.

Sources:
- https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
- https://developer.apple.com/documentation/signinwithapple/displaying-sign-in-with-apple-buttons-on-the-web

## Troubleshooting

**`redirect_uri_mismatch` (Google), or `The redirect_uri is not associated with this
application` (GitHub).** The redirect URI registered with the provider is not the Supabase
callback. It must be `https://<project-ref>.supabase.co/auth/v1/callback` exactly — no
trailing slash, no `www`, HTTPS, and the app's own `/auth/callback` does not belong here.
Google can take a few minutes to propagate a change.

**`{"error":"requested path is invalid"}`.** This is Supabase, not the provider. The
`redirectTo` the browser sent does not match anything in **Authentication → URL
Configuration → Redirect URLs**. Almost always a Vercel preview hostname on a branch, or a
pattern written as `/*` instead of `/**`. Add the correct wildcard, then retry.

**`invalid_client` or `Unable to exchange external code`.** Wrong or stale client secret.
For Google and GitHub, regenerate the secret and paste it into Supabase. Watch for a
trailing space on paste.

**Every Apple sign-in fails at once, other providers fine.** The client secret JWT has
expired. Regenerate it from the `.p8` with a fresh six-month `exp` and update the Apple
provider's Secret Key field. Confirm the calendar reminder still exists afterwards.

**`invalid_request: Invalid web redirect url` from Apple.** The Return URL on the Services
ID is missing, misspelled, or not HTTPS, or the domain was entered with a scheme. Apple's
Domains field takes a bare domain; the Return URLs field takes the full HTTPS URL.

**`Unsupported provider: provider is not enabled`.** The provider is switched off in
Supabase, or the feature flag is on in a project where it was never configured. Check
**Authentication → Sign In / Providers** before touching `feature_flags`.

**Sign-in succeeds but lands back on `/login` with no message.** The user cancelled the
provider dialog. Supabase returns `error=access_denied`, and the callback route deliberately
returns them quietly rather than showing an error. Nothing to fix.

**Sign-in succeeds but lands on `/login` saying the account is suspended.** The account has
`profiles.is_banned = true`. The callback signs the session out before the dashboard can
load. Clear the flag in the database if this was a mistake.

**The referral credit disappears after an OAuth round trip.** The `?ref=` code travels in
the `redirectTo` URL and is re-attached by the callback route on both the success and the
error paths. If it is lost, check that the link the user arrived on actually carried
`?ref=` and that the code is at most 32 characters, which is where `login/page.tsx` trims.
