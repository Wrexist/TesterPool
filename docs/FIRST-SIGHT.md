# First sight — repositioning the landing page around the reviews

Status: **phases 1–4 shipped** — hero repositioned around the reviews a developer
receives, the review anchor section, the store-review FAQ conversion, honest stat strip,
site metadata, the resequencing, and the public `/pool` preview. Phase 5
(instrumentation) is the only one still outstanding.
Owner: marketing surface (`app/src/app/page.tsx`, `SiteChrome`, `/launch`, `/readiness`).

---

## 1. What is wrong with the page we have

The hero sells **the pod**. "Get your 12. Keep them 14 days. Ship." is a good sentence
about a mechanic, and the mechanic is the wrong thing to lead with, for three reasons.

**It leads with an obligation, not an offer.** The first concrete thing the page asks a
visitor to picture is fifteen strangers, a fourteen-day commitment, and a shared clock
they can break. That is the *price* of TesterPool, stated before the product. The
Ferndeck hero card reinforces it — a progress ring at day 9 of 14 is a picture of
waiting.

**It only speaks to one side of a two-sided network.** Every word above the fold is
addressed to a developer who needs testers. Nobody is addressed as the person who
*does the testing* — yet that is the side that has to be full before the other side
works at all. A pool with no testers has no pods.

**Nothing is available before signup.** "Start free" and "Check if you're ready" are
both forms. A visitor cannot see a single real app, a single real report, or any
evidence the network exists. The `1,247 / 38 / 9,318` strip is hardcoded and reads as
decoration precisely because it is unattached to anything the visitor can click.

Meanwhile the thing a developer actually wants — fourteen people who ship Android apps
for a living, telling them what is wrong with theirs — appears nowhere above the fold.
Neither does the loop that produces it. The page opens on the cost and never states the
offer.

**The reposition: lead with the reviews a developer receives. The loop is how they pay
for them; the pod is the shape the payment takes. Both are price, and price goes second.**

---

## 2. The boundary, and the demand on the other side of it

Two true things are in tension here, and the page has to hold both.

**People arrive wanting store reviews.** That is the search they type and the thing they
believe they need. Positioning that refuses to say the word "review" fails to meet them,
and the earlier draft of this document over-corrected into exactly that.

**We cannot sell them.** A review traded for anything — money, credits, a review back —
is an incentivised review under the
[Ratings, Reviews and Installs policy](https://support.google.com/googleplay/android-developer/answer/9898684).
Apps are removed and developer accounts terminated for it. Selling that to a solo
developer who is four weeks behind schedule is selling them a risk they cannot price,
and it is the failure this product was built as an alternative to.

So the site **leads with the word and converts the intent**. "Get your app reviewed by 14
developers" is the headline. What follows immediately, above the fold and never below it,
is which reviews we mean: private developer reviews inside a closed testing track, not
Play Store reviews. The first FAQ entry does the same job at length — it names what the
visitor came for, says plainly that no honest service sells it, and points at the two
things actually underneath the request (*I can't publish yet* → the pod; *my app isn't
good enough to earn reviews* → fourteen critical reviews).

That conversion is the entire positioning. It is also better marketing than either
extreme: refusing the word loses the search, and serving it loses the customer their
account.

### Copy rules

| Never write on a public page | Write instead |
| --- | --- |
| "Play Store review", "store rating", "5-star", star glyphs | **review** used only with its qualifier: *private developer review*, *inside your closed testing track* |
| "get reviews for your app" left unqualified | **get your app reviewed by developers** — plus the disambiguation in the same block |
| "download" | **install**, **opt in**, **join the closed track** |
| any average, score-out-of-5, or aggregate beside an app | reliability, days held, reviews delivered |
| "provably compliant" | *all activity happens inside closed testing tracks, which do not affect store rankings, ratings, or public install counts* |

The disambiguation is load-bearing UI, not a disclaimer. It does not move below the fold,
it does not shrink to fine print, and it does not get softened to "compliant" — a reader
who cannot tell which kind of review we mean is a reader we may have just endangered.

Internal identifiers stay as they are: `CHARGE.review`, `review_feedback()`,
`/feedback/review-actions.tsx` already say "review", which now matches the public surface.
The in-app UI still says "report" in places (`(app)/feedback`, the submit form). Worth
aligning to "review" in a later pass so the product and the pitch use one word.

The public marketplace preview in §5 also inherits the withholding rule: `opt_in_url`,
`google_group`, `package_name` and `tester_instructions` are never shown to a visitor
who neither owns the app nor holds an assignment on it. For an app in closed testing the
package name *is* the way into the track, and the way in is granted by a pod, not by a
directory.

---

## 3. The new proposition

> **Get your app reviewed by 14 developers. Then ship it.**
>
> They install it, use it for fourteen days, and each send one structured review — what
> broke, on which device, what they would change. You pay for them by reviewing other
> people's apps, and Google Play's 12-tester requirement is satisfied on the way through.

Order matters: **offer first, price second.** The reviews are what a developer wants; the
loop is what it costs. An earlier draft led with the loop ("install an app, write one
report") and that was still the price before the product, the same mistake the pod hero
made in a friendlier costume.

The pod stops being the headline and becomes the **consequence**. The page now reads as
one causal chain instead of a feature list —

```
you install an app      →  you file one report   →  you earn credits
        ↓                          ↓                       ↓
someone installs yours  ←  you spend credits     ←  12 testers, 14 days  →  you ship
```

Both sides of the network are addressed in the same sentence, because in TesterPool
they are the same person. That is the thing no competitor can copy and the thing the
current page never says out loud.

The credit symmetry is the proof, and it belongs high on the page, not buried in
`#economy`: a confirmed install moves 10 from the app owner to the tester, a confirmed
report moves 30. A full 15-seat pod costs 560 and pays 560. Do your share, break even.
Credits move; they are never minted. That single fact answers "is this a scam", "will I
get spammed with junk", and "what stops freeloaders" at once.

---

## 4. New page architecture

Section by section. The old order was

```
hero → problem → how → compare → compliance → reliability → evidence → economy → pricing → testimonials → faq
```

and the shipped order is

```
hero → report → job → problem → how → compare → reliability → evidence → economy → compliance → pricing → testimonials → faq
```

Two things moved for a reason. The **review anchor and the loop come before the pod**, so
the page states the offer and its price before it explains the mechanism. **Compliance
moved down to sit immediately before pricing**: under a hero that already names both kinds
of review, the compliance section is a confirmation someone reads just before deciding to
pay, not an argument that has to be won mid-page.

### 4.1 Hero — the offer (shipped)

**Headline**
> Get your app reviewed
> by 14 developers.
> **Then ship it.**

Three lines, sized so it stays three at every width. A headline that wraps to four owns
the whole first screen and pushes the proof card below the fold.

**Lede**
> List your app and 14 indie developers install it, use it for 14 days, and each send you
> one structured review — what broke, on which device, what they would change. You hear it
> from people who ship Android apps before you hear it from your users, and Google Play's
> 12-testers-for-14-days requirement is satisfied on the way through.

**The disambiguation block** — a bordered panel, not fine print, immediately under the lede:
> **Private developer reviews, inside your own closed testing track.** Not Play Store
> reviews — those are incentivised the moment they are traded, and Google removes apps for
> it. That is the difference between the reviews you want and the ones that cost you the
> account.

Leads with what you *do* get, because a block that opens on a denial reads as a disclaimer
and disclaimers get skipped. Links the policy directly. See §2 — this element does not move
and does not shrink.

**CTAs.** Still `Start free` / `Check if you're ready`. At phase 4 the primary becomes
**Browse the pool** → `/pool`, so the first ask is a look rather than a form.

**Hero visual — `ReviewsVisual`.** The Ferndeck progress ring is gone, and so is the
intermediate draft that drew the work you do to earn reviews. The card is now the inbox:
three incoming reviews on your app, each with handle, device, severity pill and the first
line of the finding, over "11 of 14 in · day 11 of 14".

No package name, no rubric scores, no aggregate of any kind — see the component's comment
for why each is absent. Reuses `Card`, `Pill`, `Avatar`, `CreditChip`; inline SVG only,
tokens only; stagger is CSS `animate-pop` and reduced motion renders it flat.

**Stat strip.** `14 reviews on your app · 15 seats, so 3 can vanish · 600 credits to
start`, all read from `lib/economy`. Replaced invented traffic figures — see §5.

### 4.2 "What you get back" — the review anchor (shipped)

The most persuasive thing this page can show, and the old page showed nothing of the kind.
A redacted review rendered the way `(app)/feedback` renders a real one: handle, tier, device,
paid chip, severity and status pills, then first impression / what worked / what broke /
reproduction steps / one change they would make.

One deliberate difference from the real card: **no 1–5 rubric scores.** Three numbers out
of five beside an app name on a public page is a rating board, which is the shape invariant
1 keeps the schema unable to represent. The written fields carry the argument anyway.

Alongside it, three claims that separate this from every review-swap site:

- **Written against your rubric, not theirs.** A review that ignores the focus areas does
  not get paid, which is why nobody sends "looks nice".
- **A blocker costs you exactly what a compliment costs.** Flat charge, and the blocker
  bounty is funded by us — finding your worst bug must never cost you most.
- **You cannot quietly refuse to pay for it.** Low-effort opens a moderator dispute; it
  does not reject the review or withhold credits. *(Invariant 2 as marketing copy, and our
  sharpest line against the incumbent.)*

### 4.3 "How you pay for them" — the loop (shipped)

The price, stated after the offer. Three cards — **Opt in** (+10, screenshot-verified),
**Use it** (pays nothing, and says so out loud, because blank reads as an omission when it
is the deliberate part), **Review** (+30, plus a platform-funded blocker bounty).

Closing line: *A review takes about ten minutes. 14 of them across two weeks is the entire
cost of getting your own app to production — 560 credits out as a developer, 560 back in as
a tester.*

### 4.4 "Why you get tested back" — the pod, demoted

Everything the current `#problem` and `#how` sections say, compressed to one section and
reframed as the *reward* for doing the loop. Keep `ClockCompare` — the intact-vs-broken
streak comparison is the best visual on the page and it belongs here, one screen lower,
where it now explains a payoff instead of introducing an obligation.

### 4.5 "Nobody ghosts" — reliability

Keep `#reliability` largely as-is; it is strong. Retarget the opening line from
"why your testers won't vanish" to "why the reports you get are worth reading", so it
serves the new spine.

### 4.6 Compliance

Keep `#compliance`. Move it *above* pricing rather than mid-page, and tighten it to a
single paragraph plus the policy link. Under the new hero it is a confirmation, not an
argument.

### 4.7 Economy → "Credits move, they are never minted"

Rewrite `#economy` around the conservation property rather than the price list. One
diagram: 14 × 40 out as a developer, 14 × 40 in as a tester, net zero. Then the price
list. Keep `PER_APP_EARNINGS`, `FULL_CYCLE_EARNINGS`, `FULL_POD_COST` sourced from
`@/lib/economy` — no hardcoded numbers.

### 4.8 Comparison, evidence, pricing, testimonials, FAQ

Keep, in that order. One edit shipped, two still open:

- **Shipped.** The FAQ now opens with *"I came here to get reviews for my app. Is that
  what this is?"* — the conversion described in §2, and the highest-traffic question this
  page will ever be asked. It names what the visitor came for, states plainly that no
  honest service sells store reviews, and points at the two things actually underneath the
  request: *I can't publish yet* → the pod, *my app isn't good enough to earn reviews* →
  fourteen critical reviews.
- The comparison table's "Written feedback" row should move to the top — it is now the
  lead claim, and against review-swap sites we win it outright.
- FAQ still wants two more the new framing invites: *Do I have to review to get reviewed?*
  and *What if the app I'm given is terrible?*

---

## 5. Real numbers, and the public marketplace preview

Two problems, one solution.

**The fake stats.** `1,247 developers · 38 pods forming · 9,318 apps greenlit` are
hardcoded in `page.tsx`. On a page whose entire pitch is "we are the honest option",
inventing traffic figures is the one unforced error that costs the argument — and
"9,318 apps greenlit" is a claim about outcomes that we would have to defend. Either
wire them to real counts or delete them. There is no third option.

**The empty-marketplace problem.** `market_pulse()` already exists and already computes
the right four numbers — active testers, installs, reports, open apps — with the right
instinct written into its comment: *silence reads as zero*. But it is
`revoke execute … from anon` and callable only by `authenticated`, so the marketing page
cannot use it.

**Proposal: a new `market_showcase()` RPC, callable by `anon`.**

- Returns the same four pulse counts, plus the newest N open listings restricted to
  `name, tagline, category, platform, icon_url, created_at`.
- Returns **nothing** else. No `opt_in_url`, no `google_group`, no `package_name`, no
  `tester_instructions`, no owner identity, no counts per app, and — per invariant 1 —
  no score and no average.
- `security definer`, `set search_path = public, extensions`, and after creation
  `revoke execute … from public` then `grant execute … to anon, authenticated`
  explicitly, per the trap documented in `CLAUDE.md`.
- Excludes banned owners, paused apps, and anything not in `queued` / `in_pod`,
  matching `market_pulse`'s existing filter.
- Needs a regression test in `supabase/tests/` asserting that an `anon` caller gets
  exactly those columns and no track-entry field.

That RPC feeds a new public route **`/pool`** — a read-only shelf of what is in the pool
right now, no signup. It is the destination for the hero's primary CTA, it makes the
stat strip clickable and therefore credible, and it gives search engines something
indexable that is not a pitch. Signed-in users hitting `/pool` redirect to
`/market`, which stays exactly as it is.

*(Not `/apps`, as first drafted: `(app)/apps` already owns that URL — it is the
authenticated "my apps" screen. A public route of the same name would collide.)*

**Decision, taken:** app names and taglines are visible to anonymous visitors, with an
owner opt-out. `apps.public_preview` defaults to true and the showcase filters on it, so
listing is opt-out rather than opt-in — an invisible marketplace recruits nobody, and a
name plus a tagline leaks nothing that gets anyone into a closed track. Stealth builders
can withdraw a single app without leaving the pool.

**Still to build:** the opt-out has no UI yet. The column and the filter are live and
tested; `/apps` needs a toggle on the app settings form so an owner can actually use it.
Until then it is settable only by an admin. That is the one loose end from phase 4.

---

## 6. Navigation and IA

`SiteChrome.NAV` becomes:

```
Browse the pool   → /apps        (new, first — the loop is the product)
How it works      → /#how
Pricing           → /#pricing
Readiness check   → /readiness
Launch feed       → /launch
```

Header CTAs stay `Log in` / `Start free`. Footer gains **Browse the pool** at the top of
the Product column.

`/launch` and `/readiness` are untouched by this plan beyond the nav ordering.

---

## 7. Measurement

PostHog is already wired (`components/PostHogProvider.tsx`). Before shipping, instrument:

- `hero_cta_click` with `{ variant, target }` — separates "browse" from "start free"
- `apps_preview_view`, `apps_preview_scroll_depth`
- `signup_start` with `{ referrer_section }` — which section was last in view
- Funnel: landing → `/apps` → `/login` → first listing created, and the second funnel
  landing → `/apps` → `/login` → first report submitted

The success criterion is not hero click-through. It is **signups that file a report
within 7 days**, because that is the supply the pool runs on. Hold the current page as
the control and run the new one as a variant if traffic supports it; if it does not, ship
the new page and compare fortnight over fortnight.

---

## 8. Phases

| Phase | Work | Files |
| --- | --- | --- |
| ~~**1 — copy + hero**~~ | ~~New headline, lede, CTAs, the "job" cards, the loop visual, stat strip wired or removed~~ **done** | `app/src/app/page.tsx`, `app/src/app/layout.tsx`, `app/src/app/globals.css` |
| ~~**2 — the review anchor**~~ | ~~§4.3 section, redacted sample review, the three claims~~ **done**, plus the store-review FAQ conversion | `app/src/app/page.tsx`, `app/src/app/layout.tsx` |
| ~~**3 — resequencing**~~ | ~~Demote pod section, retarget reliability, move compliance, rewrite economy around conservation~~ **done**, plus the comparison row and nav | `app/src/app/page.tsx`, `app/src/components/SiteChrome.tsx` |
| ~~**4 — public preview**~~ | ~~`market_showcase()` migration + test, route, signed-in redirect, hero CTA~~ **done** as `/pool`, plus a security fix the advisors turned up | `app/supabase/migrations/`, `app/supabase/tests/06-showcase.sql`, `app/src/app/pool/`, `SiteChrome.tsx` |
| **5 — instrumentation** | Events, funnels, then measure | `PostHogProvider`, `page.tsx` |

Phases 1–3 are copy and layout inside one file and carry no schema risk. Phase 4 is the
only one that touches the database and is the only one that needs the §5 decision
answered first. Phases 1–3 ship without it.

Gate on `npm run build` and `npx tsc --noEmit` clean, per `CLAUDE.md`. Phase 4 additionally
gates on `supabase/tests/` passing, since it adds a `security definer` function.

---

## 9. What this plan deliberately does not do

- No public store reviews, ratings, or install counts — not as a feature, not as copy,
  not as an illustration. §2 is not negotiable.
- No "rate this app" affordance in the public preview, and no average of anything.
- No removal of the moderator dispute step in `review_feedback`. The page will now
  *advertise* that step, which makes it harder to quietly remove later — deliberately.
- No change to pods, matching, escrow, or the economy. This is a positioning change with
  one additive read-only RPC behind it.

---

## 9a. What phase 4 turned up

**Four trigger functions were callable by `anon` over REST.** `get_advisors(security)`,
run after applying `market_showcase`, flagged `guard_daily_install_cap`,
`guard_daily_review_cap`, `on_optin_confirmed` and `unpause_on_topup` as executable by
`anon` at `/rest/v1/rpc/<name>`. Two of them decide money — `on_optin_confirmed` is the
trigger that moves 10 credits from an app owner to a tester.

Not exploitable as it stood: PostgreSQL refuses to invoke a `returns trigger` function
outside a trigger context. But that is a property of the return type, not a decision
anyone made, and it violates this repo's own standing rule that a `security definer`
function is revoked unless it genuinely needs to be callable. Fixed in
`20260814150000_revoke_trigger_function_execute.sql`.

Revoking `EXECUTE` does not stop a trigger firing — PostgreSQL checks that privilege when
the trigger is *created*, not each time it fires. Verified before applying, against a
throwaway replay of the full migration history: with the grants removed, an assignment
insert, an opt-in stamp and a feedback insert all still reached their triggers.

**The test harness recipe in `supabase/tests/README.md` did not work.** `create extension
pg_cron` needs a control file to exist even though the stub creates the `cron.*` objects
by hand, and SQL cannot write one. The README now carries the two shell lines that make
the documented run actually run.

**Six nav links wrap at 768px.** They do not overflow — each label quietly stacks into a
three-line column instead, which is why a `scrollWidth > clientWidth` check misses it
entirely. The last two links are now held back until `lg`, and every link is
`whitespace-nowrap` so the next person to add one gets a visible overflow rather than a
silent stack.

---

## 10. Open copy decisions

**The hero announcement chip** still reads *"NEW — Rescue testers now matched in under
6 hours"*. It is a pod claim sitting above a loop headline, so it is now the one line
above the fold that does not serve the spine. It was left alone deliberately: every
replacement worth writing would be a claim about the network that nobody has verified,
and inventing one is the mistake we just removed from the stat strip. Three honest
options, in preference order:

1. Point it at the pool once phase 4 lands — *"N apps open to testers right now"*, read
   live from `market_showcase()`. This is the version the chip is actually for.
2. Retire the chip until there is something true and new to announce.
3. Keep it, and accept that first sight opens on the rescue feature.

**The secondary CTA** is still "Check if you're ready" → `/readiness`. That stays the
right call until `/pool` exists, because it is the only thing on the site today that a
stranger can use without signing up. At phase 4 the pair becomes *Browse the pool*
(primary) and *Start free* (secondary), and the readiness check moves into the nav.
