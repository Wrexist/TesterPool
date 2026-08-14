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

**Where:** STRATO → DNS. The apex record goes under **A-post → hantera**, the
`www` one under **TXT- och CNAME-poster → hantera**.

**Do:** add the two records Vercel gave you. They will be:

| Type | Name | Value |
| --- | --- | --- |
| `ALIAS` or `ANAME` (or `A` if neither is offered) | `@` | `cname.vercel-dns.com` (or `76.76.21.21` for the `A`) |
| `CNAME` | `www` | `cname.vercel-dns.com` |

Prefer `ALIAS`/`ANAME` over `A` if the registrar offers it.

**Do not move the nameservers to Vercel.** It is the tidier option on a bare
domain, but mail for this domain lives on STRATO's DNS — moving the nameservers
takes the MX and TXT records with it and silently breaks everything in steps 7
and 8.

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

## Step 7 — Mail: MX and the three TXT records

**Where:** STRATO → DNS

The domain is registered at STRATO, whose panel differs from the generic
instructions above in three ways worth writing down.

**MX-post → hantera:**

| Field | Value |
| --- | --- |
| Primär e-postserver | Egen e-postserver |
| Värdnamn | `hi.deomail.com` |
| Prioritet | `hög` (STRATO's word for 10) |
| Backup-e-postserver | **Inaktivera** |

The backup setting is the trap. Left on "STRATO e-postserver" the domain
publishes a second MX, and mail that does not reach DeoMail on the first
attempt lands in a STRATO mailbox nobody reads. It does not look like a
failure; the mail simply is not there.

**TXT- och CNAME-poster → hantera.** Two toggles at the top of that page
generate records of their own and must both be off, or you end up with two
`_dmarc` records and two `v=spf1` records, which invalidates both pairs:

- STRATO DMARC → `Ingen STRATO DMARC-regel`
- STRATO SPF-regel → `Ingen STRATO SPF-regel`

Then add three TXT records. The Prefix field appends `.testerpool.dev` itself,
so enter only the prefix:

| Prefix | Value |
| --- | --- |
| *(empty)* | `v=spf1 mx ~all` |
| `dkim._domainkey` | the key from DeoMail, one line, no quotes |
| `_dmarc` | `v=DMARC1; p=quarantine; adkim=s; aspf=s` |

`v=spf1 mx ~all` authorises whatever the MX points at. That is deliberate: it
means the sending provider and the receiving provider are the same host, and no
`include:` has to be maintained. It also means **anything sending as this domain
must go through DeoMail** — see step 8.

**Check:** MXToolbox on `testerpool.dev` — `mx:`, `spf:`, `dmarc:`, and
`dkim:testerpool.dev:dkim`. Two MX rows for `hi.deomail.com` with the same
priority are one record with an IPv4 and an IPv6 address, not a duplicate.

Then create the `support@testerpool.dev` mailbox in DeoMail. That exact address
appears eleven times in the codebase, and the privacy policy names it as the
contact route for a data request, so it has to exist before launch.

---

## Step 8 — Point both senders at DeoMail

The app sends mail from two places, and both have to use DeoMail. Sending
through anything else fails SPF, and with `p=quarantine` and `aspf=s` the mail
is quarantined rather than bounced — you get no error, users get nothing.

**8a. Magic links.** Supabase → Authentication → Emails → SMTP Settings. Fill in
DeoMail's SMTP host, port, username and password; sender `support@testerpool.dev`,
sender name `TesterPool`. Raise the auth rate limit on the same page — the
default is sized for Supabase's shared sender.

Supabase's built-in sender is explicitly not for production, and here the magic
link *is* the sign-in flow. If it lands in spam, nobody can log in.

**8b. Pod reminders.** The `send-notifications` edge function sends over SMTP.
Set four secrets on it:

```bash
supabase secrets set \
  SMTP_HOST=<deomail smtp host> \
  SMTP_USER=<username> \
  SMTP_PASSWORD=<password> \
  NOTIFICATION_FROM='TesterPool <support@testerpool.dev>' \
  SITE_URL=https://testerpool.dev
```

`SMTP_PORT` defaults to 587 with STARTTLS; set it to 465 only if DeoMail
requires implicit TLS. Miss any of the four and the function stays in dry-run:
it renders every email, logs what it would have sent, and hands the rows back
unconsumed. Nothing is lost and nothing is sent — see `OPERATIONS.md`.

`SITE_URL` is worth setting explicitly even though it now defaults correctly. It
is the origin in every deep link in every reminder, and a wrong value still
sends — it just sends people somewhere else.

**Check:** send a mail to `support@testerpool.dev` and reply from it. In Gmail,
open the reply → Show original → `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`. That
is the only proof that counts; a DNS checker only says the records exist.

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
