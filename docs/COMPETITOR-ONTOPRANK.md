# OnTopRank — competitive read

Date: 14 Aug 2026.

**Method, and its limits.** `ontoprank.com`, `app.ontoprank.com` and
`ontoprank-reviews.web.app` are all blocked by this environment's egress proxy, so none of
this comes from a live crawl. Every quotation below is their own marketing copy as
returned by search-engine snapshots. Treat the feature list as reliable and anything about
prices, dashboard layout or the signed-in product as unverified — the app itself was never
seen. Someone should open the site on a normal machine and correct the gaps marked
**[unverified]**.

---

## 1. The headline finding

OnTopRank sells the thing TesterPool refuses to sell, and says so on the tin:

> **"Buy App Installs & Reviews the Real Way"**
>
> "OnTopRank gets your Android or iOS app real installs and honest reviews through a
> developer exchange — no bots, no bans, no fake reviews."
>
> "You install fellow developers' apps and leave honest feedback, earning **+10 stars per
> install and +20 per review**. Then you spend your stars to put your own app in front of
> the community."

Those are **public store reviews**, paid for in stars. That is an incentivised review under
Google Play's Ratings, Reviews and Installs policy and Apple's App Store Review Guideline
1.2 / 3.x, whatever the reviews say and however sincerely they are written. The payment is
the violation, not the sentiment.

Their own content policy says so, on their own site:

> "Reviews must reflect your genuine, first-hand experience. **Fake, paid, or incentivized
> content is prohibited** and will be removed."

Both statements cannot be true at once. A review you were paid twenty stars for is
incentivised content by the definition printed two clicks away from the checkout. That
contradiction is the single most important fact in this document, and §4 is what to do
with it.

---

## 2. What they have that we do not

Ordered by how much I would want it.

| # | They have | We have | Worth copying? |
|---|---|---|---|
| 1 | **iOS as well as Android** — "your Android or iOS app" | Android only; the schema has a `platform` enum and the marketplace filters on it, but nothing markets iOS | **Yes.** Biggest honest gap on this list. Apple has no 12-tester rule, so the pod mechanic does not transfer — but "get your app reviewed by 14 developers before you ship" transfers perfectly, and TestFlight is the closed-track equivalent. |
| 2 | **A content engine** — `/blog/app-review-exchange` and similar, ranking for the exact searches this audience types | Zero blog. No indexable content beyond the landing page, `/launch` and `/readiness` | **Yes, urgently.** This is how they are found. See §4.1. |
| 3 | **Feed boost as a product** — "boost to the top of the feed whenever you launch an update" | `/market` has no promotion mechanic, and no paid placement | **Probably.** It is a clean credit sink that does not touch a store surface. Would need care: placement must not become a ranking, and the sort must stay honest. |
| 4 | **A guarantee, stated numerically** — "up to 14 **guaranteed** real installs and reviews" | We say 15 seats and a buffer, and hedge everywhere else | **The framing, yes; the word "guaranteed", carefully.** Ours is arguably stronger — 15 seats so three can vanish — but we never put a number next to a promise. |
| 5 | **AI review-suggestion generator** — "Generate on-brand, editable review suggestions tuned to your app's tone and key features, so testers always know what to highlight" | Nothing, deliberately | **No. Never.** See §3. |
| 6 | **Separate marketing site and app** (`ontoprank.com` vs `app.ontoprank.com`) | One Next.js app serving both | Cosmetic. Ours is fine and cheaper. |
| 7 | **[unverified]** A dashboard, points wallet, and feed UI | We have all three equivalents (`/dashboard`, `/credits`, `/market`) | Cannot compare without seeing theirs. |

Things they claim that we already do at least as well: screenshot verification of every
contribution, a points economy, a fixed-size cohort (their "Testing Pack" is 15 developers
for 15 days — our pod is 15 seats for 14 days, which is the number Google actually
requires), and "free to start, no subscription".

---

## 3. What we must not copy, and why it matters commercially

**The AI review writer.** "Review suggestions tuned to your app's tone and key features" is
a tool whose only purpose is to put words the developer chose into a stranger's public
review. Even inside a private feedback system it would be corrosive — it produces reviews
that tell the developer what they already believe. On a public store surface it is
manufactured consensus. `CLAUDE.md` names "AI-drafted review copy" in the never-add list
and that stands.

**Paying for public store reviews or installs.** The entire schema is built to be
*incapable* of representing one. That is not caution, it is the product: it is why
TesterPool can be described to a Play policy reviewer in one sentence without anything
needing to be left out.

**The risk is not theoretical, and it is worse than "your review gets deleted".** Google
removed over 2.3 million apps and terminated hundreds of thousands of developer accounts
in the 2025 enforcement cycles. More pointed for a *network*: reporting through early 2026
describes accounts inheriting risk by association — if a device fingerprint, IP subnet,
payment method or phone number has appeared in connection with a terminated account, a new
account carries that history. A review-exchange network is a graph of exactly those
signals. The failure mode is not one bad review; it is correlated termination across the
membership, and the developers who lose everything are the users, not the platform.

---

## 4. What to actually do

### 4.1 Ship a content engine — highest ROI, lowest risk

They are winning the search, and search is where this audience starts. We have something
better to say and no page saying it. Five posts, each answering a real query, each linking
to `/pool` and `/#report`:

1. *"How to get 12 testers for Google Play closed testing"* — the head term.
2. *"Can you buy app reviews? What Google's policy actually says"* — the conversion post,
   and the one only we can write honestly. Own the risk explanation and the traffic follows.
3. *"App review exchange vs closed-test pods: what each one actually gets you"* — their term.
4. *"The 14-day clock: why it resets and how to see it before Google does"* — our
   `ClockCompare` is already the illustration.
5. *"What a useful tester report looks like"* — publish a real redacted review; §4.2 of
   `FIRST-SIGHT.md` already built the component.

Reuse `SiteNav`/`SiteFooter`, add `/blog/[slug]`, keep it MDX-free and static.

### 4.2 Decide on iOS

The honest version: Apple requires no 12-tester count, so we cannot sell the pod there. We
*can* sell the review exchange — TestFlight, 14 developers, structured private reviews. The
schema already has `platform` on `apps` and the marketplace already filters on it, so the
data model is not the blocker; matching and the pod-day maths are. Scope it before
promising it.

### 4.3 Put a number next to the promise

They say "up to 14 guaranteed". We say "15 seats". Ours is the better deal and the worse
sentence. Somewhere above the fold: **14 reviews, 15 seats, so three people can vanish and
you still clear Google's bar.** The stat strip already carries two of those three numbers.

### 4.4 Aim the comparison table at them by name

`#compare`'s "Review-swap sites" column is now describable with their own copy. The
sharpest row we are not yet using:

> **What happens if it works too well** — TesterPool: nothing, closed tracks are invisible
> to the store. Review-swap sites: a cluster of accounts trading public reviews is the
> pattern enforcement looks for, and termination travels between linked accounts.

Keep it factual and unnamed. We do not need to say "OnTopRank" to win the row, and naming
a competitor invites a fight we gain nothing from.

### 4.5 Do not soften the disambiguation

Their existence is the reason the block under the hero has to stay. A visitor arriving from
their site has been told that paid store reviews are "the real way" and carry "no bans".
The block under our headline is the first thing that tells them otherwise, and it needs to
keep saying which reviews we mean, at body size, above the fold.

---

## 5. Open questions for someone with an unblocked browser

- Actual prices for Testing Packs and star bundles. **[unverified]**
- Whether stars are conserved or minted. If minted, their economy inflates and reviews get
  cheaper over time — a real quality argument for us.
- Whether they support Play's closed-testing track at all, or only production installs. The
  copy says "installs", which on a production listing is the other half of the same policy.
- What their dispute process is when a developer dislikes a review — the invariant-2
  question. If creator approval gates payment with no arbitration, that is the positivity
  machine, and it is our sharpest product difference.
- Whether `ontoprank-reviews.web.app` is a separate legacy product or the same one.
