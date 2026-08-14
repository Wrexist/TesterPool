# Going live on testerpool.dev

The order matters. DNS first, then Vercel, then the three services that hold a
copy of the origin — Supabase auth, Stripe, and the app's own
`NEXT_PUBLIC_SITE_URL`. Doing Supabase before the domain resolves just means
doing it twice.

Everything below assumes the Vercel project already exists with Root Directory
set to `app`, as `DEPLOY.md` describes. If it does not, do that first.

## 0. What the app does with the origin today

Three code paths read it, and each has a different fallback:

| Path | Reads | Falls back to |
| --- | --- | --- |
| `src/app/layout.tsx` | `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |
| `src/lib/billing.ts` `siteUrl()` | `NEXT_PUBLIC_SITE_URL`, then `VERCEL_URL` | `http://localhost:3000` |
| `src/lib/pods.ts` `referralLink()` | live browser origin, then `NEXT_PUBLIC_SITE_URL` | `https://testerpool.dev` |

`layout.tsx` is the one that bites quietly: `metadataBase` decides what every
Open Graph and canonical URL resolves against. Unset on production and every
link preview points at `localhost:3000`. Nothing errors — the previews are just
wrong, and you find out from someone on Reddit.

Sign-in does not read the variable at all. `LoginForm.tsx` builds
`emailRedirectTo` from `window.location.origin`, so the magic link points at
whatever host the user was actually on. That is why step 3 is an allow-list
entry and not a value to set.

## 1. Point DNS at Vercel

Vercel project → Settings → Domains → Add → `testerpool.dev`.

Add `www.testerpool.dev` in the same step and let Vercel redirect it to the
apex. Pick the apex as the primary; every URL in this repo is written without
`www`.

At the registrar, add whichever record Vercel asks for:

- **Apex** — an `A` record to `76.76.21.21`, or `ALIAS`/`ANAME` to
  `cname.vercel-dns.com` if the registrar supports it. Prefer the ALIAS.
- **www** — `CNAME` to `cname.vercel-dns.com`.

If the registrar offers to move nameservers to Vercel, that also works and is
less fiddly, but it moves MX and TXT records too — do not do it if email for the
domain is already set up elsewhere.

Wait for Vercel to show **Valid Configuration** and issue the certificate. This
is usually minutes, occasionally an hour. Do not continue until the padlock is
real: Supabase and Stripe both reject non-HTTPS origins, and `.dev` is on the
HSTS preload list, so browsers refuse plain HTTP for it outright — a half-issued
certificate looks like a total outage rather than a warning.

Verify:

```bash
dig +short testerpool.dev
curl -sSI https://testerpool.dev | head -1     # expect HTTP/2 200
```

## 2. Set NEXT_PUBLIC_SITE_URL

Vercel → Settings → Environment Variables.

| Scope | Value |
| --- | --- |
| Production | `https://testerpool.dev` |
| Preview | leave unset — it falls back to `VERCEL_URL`, which is correct per branch |
| Development | leave unset — `http://localhost:3000` |

No trailing slash. `siteUrl()` strips one and `metadataBase` tolerates it, but
`referralLink()` string-concatenates and you get a double slash in every invite.

`NEXT_PUBLIC_` variables are inlined at build time, not read at runtime. Setting
this changes nothing until the next production deploy — step 6.

## 3. Add the domain to Supabase auth

Supabase → Authentication → URL Configuration.

**Site URL:** `https://testerpool.dev`

**Redirect URLs** — add, keeping the existing Vercel entries so preview deploys
keep working:

```
https://testerpool.dev/**
https://www.testerpool.dev/**
```

The `/**` suffix is required. `/*` does not match `/auth/callback`, and the
failure mode is a sign-in that completes at the provider and then dies on the
way home with `Invalid web redirect url`. `AUTH-SETUP.md` covers the glob rules.

Nothing changes at Google, GitHub or Apple. Their registered redirect URI points
at `https://yudcncvarndslyyajflr.supabase.co/auth/v1/callback` and is
independent of your domain.

## 4. Repoint Stripe

Only if payments are live. Skip otherwise; the app degrades to "payments are not
configured" and there is nothing to break.

1. Dashboard → Developers → Webhooks → the existing endpoint → update the URL to
   `https://testerpool.dev/api/stripe/webhook`.
2. The signing secret is per endpoint. If you create a new endpoint rather than
   editing the old one, copy the new `whsec_…` into `STRIPE_WEBHOOK_SECRET` on
   Vercel Production, or every event fails signature verification and the route
   returns 500 by design.
3. Settings → Business → Public details: set the website to the new domain. This
   is what shows on the Checkout page and the card statement descriptor.
4. Do this in **live** mode. Test-mode endpoints and secrets are a separate set.

## 5. Email on the domain

`support@testerpool.dev` is hardcoded in `terms/page.tsx`, `privacy/page.tsx`
and the suspended-account message in `auth/callback/route.ts`. Those pages are
public, and the privacy policy names that address as the contact route for a
data request — so the mailbox has to exist before the domain is announced, not
after.

Any hosted mailbox works (Google Workspace, Fastmail, a registrar forwarder).
Add its MX records at the registrar. If you moved nameservers to Vercel in step
1, add them in Vercel's DNS panel instead.

Separately: Supabase's default SMTP sends magic links from a shared Supabase
address with a low rate limit, and it is explicitly not for production. Once the
domain is live, set up a custom SMTP sender (Resend, Postmark, SES) under
Authentication → Emails → SMTP Settings and verify SPF/DKIM for the domain.
Deliverability of the magic link *is* the sign-in flow — if it lands in spam,
the product does not work.

## 6. Deploy, then verify

Actions → **Deploy** → Run workflow → Production. The build inlines the new
`NEXT_PUBLIC_SITE_URL`.

Then walk it:

- [ ] `https://testerpool.dev` loads; `www` redirects to it.
- [ ] View source on the landing page — `og:url` and the canonical link say
      `testerpool.dev`, not `localhost:3000`.
- [ ] Sign in with a magic link end to end, from the new domain. The link in the
      email points at `testerpool.dev/auth/callback`.
- [ ] An authenticated page loads real data — that proves the Supabase env vars
      survived the rebuild.
- [ ] Copy a referral link from the invite panel: `testerpool.dev/login?ref=…`.
- [ ] `/admin/system` is green, confirming the four scheduled jobs are still
      firing. They run on `pg_cron` inside Supabase and are unaffected by any of
      this, so a red light here means something else broke.
- [ ] If Stripe is live: trigger a test event from the Dashboard and confirm a
      200 at the new endpoint.

## What this does not touch

The Supabase project keeps its `yudcncvarndslyyajflr.supabase.co` hostname. A
custom auth domain (`auth.testerpool.dev`) is a paid add-on and buys only a
tidier URL in the address bar during OAuth; every redirect URI at every provider
would have to be re-registered. Not worth it now.

The scheduled jobs, the edge functions and the migration history are all
independent of the domain.
