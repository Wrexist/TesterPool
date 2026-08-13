# Marketplace v2 — the mobile-first plan

Reference: `app.ontoprank.com`, screenshotted 13 Aug 2026. This document is the
plan to restructure TesterPool's marketplace along the same lines, mobile first,
because a phone browser is where nearly every developer will meet this product.

It is written to be handed to a coding session. Every screen names the files it
touches, every schema change names the migration it needs, and the decisions
that are yours rather than mine are collected at the end.

---

## 1. What the reference gets right

Four things, and they are the reason it reads better than what we have:

1. **It is a job board, not a directory.** The home screen is a list of *work
   available to me right now*, each row ending in the reward. Ours is a
   catalogue: it tells you about apps but never says "here is 40 credits, this
   is what you do for it".
2. **The unit of work is visible and finite.** Install → Test → Review, three
   numbered steps, one screen, with the reward attached to the whole thing. Our
   equivalent work is spread across `/market`, `/tests`, `/tests/[id]/optin` and
   `/tests/[id]/feedback` with no single screen that says what the job is.
3. **Rows, not cards, on a phone.** A 56px icon, two lines of text, a platform
   chip and a reward chip. Six fit on a screen. Our cards fit two.
4. **The supply gate is stated as a task, not an error.** "You need 30 credits
   to receive activities → Earn 30 credits" is the same fact as our
   `credits_paused`, phrased as the next thing to do.

Almost all of this is presentation. The machinery underneath — proof screenshots,
private reports, a conserved credit economy, an owner balance that pauses an app
when it runs dry — we already have and they had to build. That is the good news
in this document: v2 is mostly a re-skin of parts that exist.

---

## 2. The one thing we do not copy

Their step 3, on an iOS app, is: install from the **public App Store**, then
**write a review**, and get **+30** for it. Their step 1 asks for a screenshot of
the App Store page as proof of a public install.

That is an incentivised public install and an incentivised store review. It is
prohibited by [Google Play's Ratings, Reviews and Installs
policy](https://support.google.com/googleplay/android-developer/answer/9898684)
and by App Store Review guideline 1.1.6 / 3.1, and it is precisely the failure
mode `CLAUDE.md` invariant 1 exists to make unrepresentable in our schema. We do
not build it, we do not build a version of it with softer wording, and the
schema keeps no column that could store it.

**What replaces it, one for one:**

| Their step | Ours | Already built? |
| --- | --- | --- |
| Install from the public store | Join the **closed test** — Play closed-testing opt-in, or TestFlight on iOS | `apps.opt_in_url` |
| Screenshot to claim the install | Same, and the same vision triage | `proofs`, `submit_proof`, `triage-proof` |
| "Test" | Use it, log the day | `checkins`, `submit_checkin` |
| Write a **review** | Write a **private structured report** to the developer | `feedback`, `review_feedback` |
| +30 for the pair | +10 install, +30 report = **+40** | `EARN`, `CHARGE` |

The difference a user sees is one word — *report* rather than *review* — and one
link, to a closed track rather than a store page. The difference legally is the
whole product. Nothing in the plan below is weakened by it.

---

## 3. The decision this plan is built on

You said it twice: *"app store for review and install apps should be a different
tab than pods — make these two separate features."* This plan takes that
literally, and it is the substantive change.

**Two products, one economy:**

- **Activities (the marketplace).** One-off, self-serve. A tester picks any app
  that is open, joins its closed test, uses it, files one report. Pays +40,
  charged to that app's owner. No cohort, no fourteen days, no commitment. This
  is what the reference does and it is why their home screen has something on it
  for everyone.
- **Pods (unchanged).** The 14-consecutive-day, 12-tester cohort that clears
  Google's production-access gate. Committed, matched, escrowed, with dropout
  penalties and rescue seats. This is the thing people pay for.

Activities are the **supply engine** — they give a new tester something to do in
their first five minutes, and give an app owner installs before their pod fills.
Pods are the **product** — the thing with a deadline attached. Today we only
have the second, which is why the marketplace has nothing for a browsing tester
to actually *do*.

This does not weaken compliance: an activity install is still a closed-track
opt-in, and an activity report is still private. It does mean the marketplace
can seat someone without a pod, which is a real economic change — the guards for
it are in §6.

---

## 4. Information architecture

### Bottom tab bar (phone) — four tabs, matching the reference

| Tab | Route | What it is |
| --- | --- | --- |
| **Home** | `/` (authed) or `/home` | The feed. Stats strip, "add your app" prompt, filter chips, **Apps to test** list. |
| **Pods** | `/pods` | The 14-day product. Your pod, forming pods, seats, the clock. |
| **My apps** | `/apps` | Your listings, their activity, the credit gate, Add app. |
| **Profile** | `/u/[handle]` | Credits, reliability, badges, billing, settings, sign out. |

The reference's "Packs" tab is a credit-pack store; ours folds into Profile →
Credits, because we sell plans as well as packs and two purchase surfaces on a
phone is one too many.

The desktop rail keeps today's fuller list (Dashboard, Marketplace, My tests,
Pods, Feedback, …). The four tabs are the phone shape only — `nav.tsx` already
supports this split via the `mobile` flag added earlier.

### What happens to today's routes

- `/market` → becomes **Home**. Keeps its URL and filters; gains the feed layout.
- `/tests` → stays, but is reachable from Home rather than from the tab bar: an
  in-progress activity appears at the top of the feed as "Continue".
- `/dashboard` → becomes the per-app screen under **My apps**, not a tab.

---

## 5. Screen by screen

### 5.1 Home — `/market`

Top to bottom, phone width:

1. **Greeting + credit chip + notifications.** `Good evening, Isac` with the
   balance as a tappable chip → Credits. Bell with unread count from
   `notifications`.
2. **24h stats strip.** `180 active · 237 installs · 192 reports` — one row,
   muted, network-wide, last 24 hours. New RPC `market_pulse()` (§7).
   *Why it matters:* it is the only proof on the screen that the network is
   alive, and a marketplace that looks empty is a marketplace nobody joins.
3. **"List your app" prompt** — dashed card, only when you have no listing, or
   when a listing is paused for credits.
4. **Filter chips**, horizontally scrollable: `All · Android · iOS · Open ·
   My apps · Saved`, with the platform logos we already ship. Search collapses
   to an icon that expands the field, as in the reference.
5. **Continue** — any activity you have started and not finished, pinned above
   the feed with its next step. This is the single highest-value row on the
   screen and the reference does not have it.
6. **Apps to test** — the list.

**The row** (replaces today's card on phones; the card stays on desktop):

```
┌──────────────────────────────────────────────┐
│ ▢56  Budget & Bill Planner              ›    │
│      Planned                                 │
│      [🤖 Android]  Finance          [★ +40]  │
└──────────────────────────────────────────────┘
```

- icon 56px, rounded 14
- line 1: app name, one line, truncated
- line 2: developer display name, muted
- line 3: platform chip (logo + word, tinted green for Android / neutral for
  iOS), category muted, reward chip right-aligned
- whole row is the link; the save bookmark moves to the app screen

Files: `src/components/app/app-row.tsx` (new), `app-card.tsx` (desktop, keep),
`market-view.tsx` renders rows under `md:` and cards above it.

### 5.2 App screen — `/market/[id]`

The reference's best screen, and the one we are furthest from. Sections:

1. **Header** — icon with platform badge, name, developer, platform chip,
   category. Already built.
2. **Your activity** — the stepper. Three states, and the whole card is the
   reward's home:

   ```
   YOUR ACTIVITY                          [★ +40]
   Complete all steps to earn the reward
   ①━━━━━━━━②━━━━━━━━③
   Join      Use it    Report
   ```

   - **Step 1 — Join the closed test.** Button `Get it on Google Play` /
     `Open in TestFlight` using `opt_in_url`, then the screenshot claim, inline.
     Copy adapted from the reference, which is genuinely good: *"Best: the
     tester-list page showing you are opted in — it verifies instantly."* The
     upload is the existing `optin-wizard.tsx`, moved inline here.
   - **Step 2 — Use it.** For an activity: one check-in, that's it. For a pod
     seat: the 14-day `StreakStrip` we already have.
   - **Step 3 — Report.** Locked until step 1 verifies, exactly as the reference
     locks its review. Opens `/tests/[id]/feedback`.

3. **Chat with developer** — §5.5.
4. **Developer profile** link, and **Open in store** only when the app has
   graduated and a public listing exists.
5. **About / what the developer wants looked at / instructions** — existing,
   moved below the fold.

Files: `src/app/(app)/market/[id]/app-detail.tsx`, new
`activity-stepper.tsx`, `claim-install.tsx` (extracted from `optin-wizard.tsx`).

### 5.3 My apps — `/apps`

- **Credit gate card, stated as a task.** `You have 10 ★, you need 40 to receive
  an activity` + `Earn 40 credits` → Home filtered to `Open`. This is our
  `credits_paused` and today it is a quiet amber pill on the dashboard; on a
  phone it must be the first thing on the screen.
- **App rows**: icon, name, platform chip, `Active`/`Paused` state, `2 installs ·
  2 reports`, and `Earn credits to reactivate` when paused.
- **Add app** floating button.
- Tapping an app → today's `/dashboard?app=` content: the pod clock, seat
  health, evidence pack, the feedback inbox for that app.

### 5.4 Profile — `/u/[handle]`

Credits and ledger, reliability gauge, tier, badges, referral link, billing,
notification settings, sign out. Mostly exists; needs the phone layout.

### 5.5 Chat with developer — new

The reference has it and it is the right call: a tester who hits a bug at step 2
currently has nowhere to go, and an owner who gets a vague report cannot ask a
follow-up.

- New table `threads` (app_id, tester_id, unique together) and `messages`
  (thread_id, sender_id, body, created_at, read_at).
- RLS: a row is visible to the thread's tester and to the app's owner, via the
  existing `owns_app()` helper — no cross-table policy references.
- Rate-limited by trigger; text only, no attachments in v1.
- Reuses the `notifications` outbox for "new message" email.

**Guard:** the report a tester files is paid or disputed on its merits.
Nothing said in a chat may gate payment, and `review_feedback` keeps its
moderator dispute path untouched. Chat must not become a channel for "change
your report and I'll approve it" — worth a line in the moderation guide.

---

## 6. The activity model

An activity is an `assignments` row with no pod. That is the smallest possible
change: every downstream thing — proofs, check-ins, feedback, the credit
transfer, the daily caps — already keys off `assignments`.

```sql
alter table assignments alter column pod_id drop not null;
alter table assignments add column kind assignment_kind not null default 'pod';
-- 'pod' | 'activity'
```

New RPC `start_activity(p_app uuid)`, `security definer`, callable by
`authenticated`, which is the only way an activity is created. It must refuse
unless **all** of these hold:

1. The app is `queued` or `in_pod`, not `draft`, not `paused`, not the caller's.
2. The owner's balance covers the whole activity (`CHARGE.install +
   CHARGE.review` = 40). Not just the install — a tester must never do the work
   and find the report unfunded.
3. `not apps.credits_paused`.
4. The caller has no existing assignment on this app (the unique index enforces
   it; the RPC returns a sentence rather than a constraint error).
5. The caller's reliability ≥ `RULES.minReliabilityToJoin`.
6. The caller is under `RULES.maxConcurrentAssignments`.
7. The app has activity slots left — **new**: `apps.activity_target int` and a
   count of open activities against it. Without this, one app with 600 credits
   can be swarmed by fifteen testers in a minute and the owner cannot control
   their own spend.

The daily install/report caps (`guard_daily_install_cap`,
`guard_daily_review_cap`) already apply, because they are triggers on the tables
an activity writes to. That is the farming defence and it needs no change.

**What must not change:** the client never supplies an amount; the price is read
from `economy_config` inside the RPC; credits still move owner → tester and are
never minted. `supabase/tests/01-economy.sql` gets a fifth section asserting an
activity is symmetric exactly as a pod seat is.

---

## 7. New database surface, complete list

| Object | Purpose |
| --- | --- |
| `assignments.kind`, nullable `pod_id` | activity vs pod seat |
| `apps.activity_target` | how many activities the owner wants |
| `start_activity(uuid)` | the only way an activity is created (§6) |
| `market_pulse()` | 24h counts for the stats strip: active testers, installs, reports |
| `market_feed(...)` | `market_apps` + `can_start`, `activity_slots_left`, `next_step` |
| `threads`, `messages` + RLS | chat (§5.5) |
| `apps.testflight_url` | iOS (§8) |

Every new function follows the standing rules: `security definer`,
`set search_path = public, extensions`, `revoke execute … from anon, public`,
grant to `authenticated` only, and no argument that a browser could use to
decide a payment.

---

## 8. iOS, done properly

The reference's iOS flow is public App Store install + public review, which is
the part we refuse. But iOS itself is not the problem — the *store* is.

**TestFlight is the iOS closed track.** It is Apple's own beta channel: builds
are not public, installs do not count toward App Store ranking, and there is no
public rating attached. A tester installing via TestFlight and sending a private
report is doing exactly what an Android tester does in a closed testing track.

So iOS becomes a real, first-class activity track:

- `apps.testflight_url`, validated to `testflight.apple.com/join/…`
- iOS apps take activities: join → use → report, +40, identical economy
- iOS apps still take **no pods**, because there is no 12-tester/14-day gate to
  clear on Apple's side — that mechanic exists to satisfy Google and nothing
  else
- No App Store link, no rating, no review, ever — and `market_app` keeps
  withholding the join link from anyone without an assignment, as it does now

This is the "iOS as its own separate feature" you asked for, and it is a
stronger version of it: iOS gets the whole marketplace, and only the pod — the
Google-specific machine — stays Android.

---

## 9. Build order

**Phase 1 — the phone shape.** No schema. Ships alone and is worth shipping
alone: `app-row.tsx`, the feed layout, the stats strip stubbed from existing
counts, the four-tab bar, the activity stepper rendering *pod* seats only.

**Phase 2 — activities.** The migration in §6, `start_activity`, the claim
inline on the app screen, the reward chip on rows, the credit gate on My apps.
This is the phase that makes the marketplace a job board.

**Phase 3 — iOS.** `testflight_url`, onboarding accepts a TestFlight link, iOS
apps become startable. Small once phase 2 exists.

**Phase 4 — chat, then polish.** Threads, notification settings, and the
`market_pulse` strip on live data.

Phases 1 and 2 are the ones that change how the product feels. 3 and 4 are
additive.

---

## 10. Decisions that are yours

1. **Do activities happen at all?** (§3) Everything from phase 2 onward assumes
   yes. If the answer is no, the marketplace stays a directory and phase 1 is
   the whole plan.
2. **Activity reward: 40, or less?** A pod seat pays 40 for fourteen days of
   attention; an activity pays the same for one session. That is generous and it
   may be right — supply is the constraint early — but it means a tester earns
   more per hour doing activities than holding a pod seat, and pods are the
   product. Options: keep 40 and accept it; drop the activity report to 20; or
   pay activities 40 but give pod completion a bonus funded by the platform.
3. **Default `activity_target`.** I suggest 5 for a new app: enough to be worth
   showing, small enough that an owner cannot be drained by surprise.
4. **Chat in v1 or v2?** It is the largest new surface and the only one with a
   moderation cost.
5. **Does Home replace Dashboard as the post-login landing?** The reference's
   home is the feed. Ours currently lands on the developer's own app, which is
   the right default for someone mid-pod and the wrong one for a new tester.
   Suggest: feed if you have no active pod, dashboard if you do.
