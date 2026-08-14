# First sight — repositioning the landing page around the loop

Status: proposal. Nothing in here is built yet.
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

Meanwhile the thing the product actually *is*, day to day — open the marketplace,
install an app from the pool, use it, file one structured report, get paid in credits —
appears nowhere above the fold. It is the loop that produces every pod outcome, it is
what a member does in their first five minutes, and it is the only part of the product
that is interesting to look at before you have committed to anything.

**The reposition: lead with the loop, keep the pod as the payoff.**

---

## 2. The boundary this plan does not cross

The brief says "market the download and review feature". Read literally against a Google
Play audience, "download and review" names the exact thing that gets developer accounts
terminated: incentivised installs and incentivised store reviews, banned under the
[Ratings, Reviews and Installs policy](https://support.google.com/googleplay/android-developer/answer/9898684).
Our entire legal basis is that we do neither.

So the feature gets marketed hard — under wording that cannot be misread. The rules
below are not stylistic; they are the product's compliance posture expressed as copy.

| Never write on a public page | Write instead |
| --- | --- |
| "review", "leave a review", "rate" | **report**, **feedback report**, **write it up** |
| "download" | **install**, **opt in**, **join the closed track** |
| "get reviews for your app" | **get reports from real testers** |
| "5-star", "ratings", stars anywhere | reliability, days held, reports delivered |
| "paid to review" | **credits for testing work** |

Internal identifiers stay as they are — `CHARGE.review`, `review_feedback()`,
`/feedback/review-actions.tsx`. This is about the surface a stranger and a policy
reviewer read, not a rename of the codebase.

Two more standing rules the new sections must obey, inherited from `CLAUDE.md`:

- No score, no average, no star, no rating anywhere in a public app listing. Members
  see **activity** — testers holding, days held, reports delivered.
- Never the phrase "provably compliant". The defensible sentence is: *all activity
  happens inside closed testing tracks, which do not affect store rankings, ratings, or
  public install counts.*

The public marketplace preview in §5 also inherits the withholding rule: `opt_in_url`,
`google_group`, `package_name` and `tester_instructions` are never shown to a visitor
who neither owns the app nor holds an assignment on it. For an app in closed testing the
package name *is* the way into the track, and the way in is granted by a pod, not by a
directory.

---

## 3. The new proposition

> **Install real apps. Send one honest report. That is the whole job.**
>
> Every report you file buys a tester for your own app. Fourteen of them, held for
> fourteen days, is exactly what Google Play asks for before it lets you publish.

The structural change: the pod stops being the headline and becomes the **consequence**.
The page now reads as one causal chain instead of a feature list —

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

Section by section. Replaces the current order
(`hero → problem → how → compare → compliance → reliability → evidence → economy →
pricing → testimonials → faq`).

### 4.1 Hero — the loop, running

**Headline**
> Install an app.
> Write one report.
> **Get tested back.**

**Lede**
> TesterPool is a pool of indie Android developers who test each other's apps inside
> closed testing tracks. You install what other people built, use it for a few days,
> and send one structured report. That work earns credits, and credits buy you the
> twelve testers Google Play requires for fourteen consecutive days before it will
> let you publish.

**Sub-line** (keeps the compliance flag visible from the first screen)
> Closed tracks only. No store reviews, no ratings, no public installs — nothing that
> can get your app pulled.

**CTAs**
- Primary: **Browse the pool** → `/apps` (the new public preview, §5). No signup wall.
- Secondary: **List your app** → `/login`.

Note the inversion: the primary CTA is now a *look*, not a *form*. The signup ask moves
to the point where the visitor has already seen something worth signing up for.

**Hero visual — replace `HeroVisual`.** The Ferndeck progress ring goes. In its place, a
three-beat card that animates once on load and shows the loop as a single motion:

1. a real-looking app row from the marketplace, with an **Install** button
2. the report composer, one rubric prompt visible, one field being typed
3. `+30` landing on the credit chip, and the balance ticking up

Reuse `CreditChip`, `Pill`, `Avatar`, `Card`, `StreakStrip` — no new primitives, inline
SVG only, tokens only. Respect `prefers-reduced-motion` by rendering beat 3 statically.

**Stat strip.** Keep the shape, kill the fiction — see §5.

### 4.2 "The job" — what testing actually involves

Directly under the hero, because the first objection to any earn-credits network is
*how much work is this actually*. Three cards, plain and unglamorous:

| | |
| --- | --- |
| **Opt in** | One tap on a closed-track link. Confirmed by screenshot proof, not by your word. **+10 credits.** |
| **Use it** | Open the app on the days the pod is running. Daily check-in, ten seconds. |
| **Report** | One structured report against the developer's rubric — what broke, what confused you, what you would change. **+30 credits.** |

Closing line under the cards: *A report takes about ten minutes. Fourteen of them over
two weeks is the entire cost of getting your own app to production.*

### 4.3 "What a report looks like" — the new anchor section

The single most persuasive thing this page can show, and it currently shows nothing of
the kind. A real, redacted report rendered exactly as it appears in the product:
the rubric prompts, the tester's answers, the severity tag, the developer's response, the
`approved · +30` stamp.

Alongside it, three claims that separate this from every review-swap site:

- **On-rubric.** The developer sets two or three things they want hammered. The report
  answers those, not "looks nice".
- **Paid the same whether it stings.** A blocker report pays exactly what a glowing one
  pays, and the charge to the developer is flat.
- **Critical feedback cannot be quietly buried.** A developer who flags a report as
  low-effort opens a moderator dispute — it does not reject the report, and it does not
  withhold the tester's credits. *(This is invariant 2 stated as marketing copy, and it
  is our sharpest differentiator against the incumbent.)*

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

Keep, in that order. Two edits:

- The comparison table's "Written feedback" row moves to the top — it is now the lead
  claim, and against review-swap sites we win it outright.
- FAQ gains three entries the new framing invites: *Do I have to test to get tested?*
  *What if the app I'm given is terrible?* *Is this the same as paid reviews?* (The last
  one gets the flat, specific answer — closed tracks, no store surface touched, ever.)

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

That RPC feeds a new public route **`/apps`** — a read-only shelf of what is in the pool
right now, no signup. It is the destination for the hero's primary CTA, it makes the
stat strip clickable and therefore credible, and it gives search engines something
indexable that is not a pitch. Signed-in users hitting `/apps` redirect to
`/market`, which stays exactly as it is.

**Decision needed before building:** whether we are willing to expose app names and
taglines to anonymous visitors at all. The argument for is that a name plus a tagline
leaks nothing that gets anyone into a closed track, and an invisible marketplace
recruits nobody. The argument against is that some developers are building in stealth.
Mitigation, if we want it: an app-level `public_preview` boolean defaulting to true,
with an opt-out in the app settings — one column, one filter in the RPC.

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
| **1 — copy + hero** | New headline, lede, CTAs, the "job" cards, the loop visual, stat strip wired or removed | `app/src/app/page.tsx`, `app/src/components/SiteChrome.tsx` |
| **2 — the report anchor** | §4.3 section, redacted sample report, the three claims | `page.tsx`, possibly one new marketing component |
| **3 — resequencing** | Demote pod section, retarget reliability, move compliance, rewrite economy around conservation | `page.tsx` |
| **4 — public preview** | `market_showcase()` migration + test, `/apps` route, signed-in redirect, hero CTA points at it | `app/supabase/migrations/`, `app/supabase/tests/`, `app/src/app/apps/` |
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
