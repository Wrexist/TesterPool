# Going live on testerpool.dev

Nine steps, in order. Each one says where to go, what to do, and how to know it
worked. Do not skip ahead — step 3 fails in a confusing way if step 1 has not
finished, and step 9 is what makes steps 2 through 8 take effect.

Assumes the Vercel project already exists with Root Directory set to `app`
(`DEPLOY.md`). Budget an hour, most of it waiting on DNS.

---

## Step 1 — Add the domain in Vercel

**Where:** Vercel project → Settings → Domains

**Do:**
1. Add `testerpool.dev`. Set it as the primary domain.
2. Add `www.testerpool.dev`. Choose "Redirect to testerpool.dev".
3. Copy the DNS records Vercel now shows you.

Apex is primary because every URL in this repo is written without `www`.

---

## Step 2 — Add the DNS records at your registrar

**Where:** wherever you bought the domain → its DNS panel

**Do:** add the two records Vercel gave you. They will be:

| Type | Name | Value |
| --- | --- | --- |
| `ALIAS` or `ANAME` (or `A` if neither is offered) | `@` | `cname.vercel-dns.com` (or `76.76.21.21` for the `A`) |
| `CNAME` | `www` | `cname.vercel-dns.com` |

Prefer `ALIAS`/`ANAME` over `A` if the registrar offers it.

If the registrar instead offers to move nameservers to Vercel, that works and is
less fiddly. Do not do it if email for this domain is already set up somewhere,
because it moves the MX and TXT records too.

**Check:**
```bash
dig +short testerpool.dev
```
Returns an address. Nothing yet is normal for the first few minutes.

---

## Step 3 — Wait for the certificate

**Where:** back in Vercel → Settings → Domains

**Do:** wait until the domain shows **Valid Configuration** and the certificate
is issued. Usually minutes, sometimes an hour.

**Check:**
```bash
curl -sSI https://testerpool.dev | head -1
```
Expect `HTTP/2 200`.

**Do not continue until this passes.** `.dev` is on the HSTS preload list, so
browsers refuse plain HTTP for it entirely — a half-issued certificate looks
like a total outage rather than a warning. Supabase and Stripe also both reject
non-HTTPS origins in the steps below.

---

## Step 4 — Set NEXT_PUBLIC_SITE_URL

**Where:** Vercel → Settings → Environment Variables

**Do:** add one variable, Production scope only.

| Name | Value | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://testerpool.dev` | Production |

No trailing slash. Leave Preview and Development unset — they correctly fall
back to `VERCEL_URL` and `localhost:3000`.

**Why it matters:** `layout.tsx` uses this for `metadataBase`. Unset on
production, every Open Graph image and canonical URL silently resolves against
`localhost:3000`. Nothing errors. The link previews are just wrong, and you find
out from a stranger.

Nothing changes on the live site yet — this is inlined at build time and takes
effect in step 9.

---

## Step 5 — Add the domain to Supabase auth

**Where:** Supabase → Authentication → URL Configuration

**Do:**
1. Set **Site URL** to `https://testerpool.dev`.
2. Under **Redirect URLs**, add these two. Keep the existing Vercel entries so
   preview deploys keep working.

```
https://testerpool.dev/**
https://www.testerpool.dev/**
```

The `/**` suffix is required. `/*` does not match `/auth/callback`, and the
failure mode is a sign-in that succeeds at the provider then dies on the way
home with `Invalid web redirect url`. `AUTH-SETUP.md` covers the glob rules.

**Nothing to change at Google, GitHub or Apple.** Their registered redirect URI
points at `https://yudcncvarndslyyajflr.supabase.co/auth/v1/callback` and has
nothing to do with your domain.

---

## Step 6 — Repoint the Stripe webhook

**Skip this entire step if payments are not live.** The app degrades to
"payments are not configured" and there is nothing to break.

**Where:** Stripe Dashboard, in **live** mode (test mode has a separate set of
endpoints and secrets)

**Do:**
1. Developers → Webhooks → open the existing endpoint → change the URL to
   `https://testerpool.dev/api/stripe/webhook`.
2. **If you created a new endpoint instead of editing the old one:** the signing
   secret is per endpoint. Copy the new `whsec_…` into `STRIPE_WEBHOOK_SECRET`
   on Vercel Production. Skip this and every event fails signature verification
   and the route returns 500, by design.
3. Settings → Business → Public details → set the website to the new domain.
   This is what appears on the Checkout page and the card statement.

---

## Step 7 — Set up support@testerpool.dev

**Where:** any hosted mailbox (Google Workspace, Fastmail, a registrar
forwarder), then your DNS panel for its MX records

**Do:** create the mailbox and add its MX records. If you moved nameservers to
Vercel in step 2, add them in Vercel's DNS panel instead.

**Why before launch, not after:** that address is hardcoded in
`terms/page.tsx`, `privacy/page.tsx`, and the suspended-account message in
`auth/callback/route.ts`. Those pages are public, and the privacy policy names
it as the contact route for a data request.

---

## Step 8 — Set up custom SMTP for magic links

**Where:** Supabase → Authentication → Emails → SMTP Settings

**Do:** point it at a real sender (Resend, Postmark, SES) and verify SPF and
DKIM for the domain.

Supabase's default sender is a shared address with a low rate limit and is
explicitly not for production. Deliverability of the magic link *is* the sign-in
flow. If it lands in spam, the product does not work.

---

## Step 9 — Deploy and verify

**Where:** GitHub → Actions → **Deploy** → Run workflow → target **Production**

This is what bakes in the variable from step 4.

Then walk the list:

- [ ] `https://testerpool.dev` loads, and `www` redirects to it.
- [ ] View source on the landing page. `og:url` and the canonical link say
      `testerpool.dev`, not `localhost:3000`.
- [ ] Sign in end to end with a magic link, starting from the new domain. The
      link in the email points at `testerpool.dev/auth/callback`.
- [ ] An authenticated page shows real data. This proves the Supabase variables
      survived the rebuild.
- [ ] Copy a referral link from the invite panel. It reads
      `testerpool.dev/login?ref=…`.
- [ ] `/admin/system` is green. The four scheduled jobs run on `pg_cron` inside
      Supabase and are unaffected by any of this, so red here means something
      else broke.
- [ ] Stripe only: send a test event from the Dashboard, confirm a 200 at the
      new endpoint.

---

## Reference

### Where the origin is read

Three code paths, three different fallbacks:

| Path | Reads | Falls back to |
| --- | --- | --- |
| `src/app/layout.tsx` | `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |
| `src/lib/billing.ts` `siteUrl()` | `NEXT_PUBLIC_SITE_URL`, then `VERCEL_URL` | `http://localhost:3000` |
| `src/lib/pods.ts` `referralLink()` | live browser origin, then `NEXT_PUBLIC_SITE_URL` | `https://testerpool.dev` |

Sign-in reads none of them. `LoginForm.tsx` builds `emailRedirectTo` from
`window.location.origin`, so the magic link always points at the host the user
is actually on. That is why step 5 is an allow-list entry rather than a value to
configure.

### What this does not touch

The Supabase project keeps its `yudcncvarndslyyajflr.supabase.co` hostname. A
custom auth domain (`auth.testerpool.dev`) is a paid add-on that buys a tidier
URL in the address bar during OAuth, and costs re-registering every redirect URI
at every provider. Not worth it now.

The scheduled jobs, the edge functions and the migration history are all
independent of the domain.
