# Two bets from the competitive read

Date: 14 Aug 2026. Companion to `docs/COMPETITOR-ONTOPRANK.md`.

Both of these are scoped rather than built, because both change product economics in ways
that need a decision before code. The blog engine did not — that is why it shipped first.

---

# 1. iOS

## What does not transfer

The pod exists to satisfy a Google Play rule: 12 testers opted in continuously for 14 days
before production access. **Apple has no equivalent requirement.** TestFlight external
testing needs Beta App Review, but there is no tester count and no consecutive-day clock to
clear. So on iOS the pod is not solving anything, and shipping it there would be selling a
cure for a disease Apple does not have.

Everything else transfers, and it is the half we just repositioned the whole site around:
*get your app reviewed by developers who ship, before your users see it.* That is platform-
neutral. It is also the part iOS developers have no good option for today.

## Concretely, what breaks

| Thing | Why it breaks | Fix |
| --- | --- | --- |
| `RULES.requiredTesters` / `requiredDays` | Play-specific constants used as if universal | Move behind a per-platform rules object; iOS gets no day requirement |
| `lib/pods.ts` pod-day maths | Assumes a 14-day shared clock | A shorter iOS round needs its own length, or none |
| `lib/evidence.ts` | Drafts Google's three production-access answers | Meaningless on iOS; hide the Evidence Pack for iOS apps |
| `opt_in_url` validation | Expects `play.google.com/apps/testing/<pkg>` | Accept `testflight.apple.com/join/<code>` |
| `min_android_version` | Android-only column | Needs an iOS sibling, or generalise to `min_os_version` |
| Opt-in proof screenshots | Triage is trained on the Play opt-in screen | TestFlight's accept screen looks nothing like it — retrain or relax |
| `package_name` withholding | The reason it is withheld is that it is the way into a Play closed track | A TestFlight join code is the same kind of secret; same rule applies |

The data model is *not* the blocker: `apps.platform` is already an enum with `ios` in it and
the marketplace already filters on it. Matching, proof triage and the constants are.

## Recommendation

Ship iOS as **review rounds**, not pods. A round is a cohort of N developers who install
each other's TestFlight builds and each file one structured review inside a fixed window.
No day count, no streak, no dropout penalty tied to a clock that does not exist — the whole
reliability apparatus stays, because it is what makes the reviews worth reading, but the
14-day machinery does not come along.

That keeps one economy, one marketplace, one review format and one reliability score across
both platforms, and it avoids explaining a 14-day rule to people it does not apply to.

**Sequence:** per-platform rules object → TestFlight link validation → round matching →
proof triage → surface it. Nothing before the rules object is safe, because the constants
are currently assumed global in about a dozen places.

**The argument against doing it now:** Android is the position we just spent this whole
repositioning sharpening, and the 12-tester rule is the sharpest wedge we have. iOS
developers have a real problem but a less urgent one — nobody is *blocked from publishing*.
Splitting focus before the Android loop is demonstrably working is the risk. My read is
that this is a Q+1 bet, not a now bet, and that the blog is the better use of the same
week.

---

# 2. Feed boost

## What it is

Spend credits to put your listing at the top of `/market` for a period. The competitor
sells the same thing ("boost to the top of the feed whenever you launch an update").

## Why it is safe, and where the line is

`/market` is our own internal marketplace. It is not a store surface — no ranking, no
rating, no public install count is affected by anything that happens there. Paying for
placement inside a private directory is ordinary product, not manipulation.

The line, and it is a real one: **a boost may buy attention, never outcomes.** Paying to be
seen first is fine. Paying for more testers than a pod seats, or paying to have your
reviews arrive faster, or paying to influence what a review says, is not. The moment a
payment changes the *content or count* of feedback rather than the *order of a list*, it is
the positivity machine again.

Three guardrails:

1. **Labelled, always.** A boosted row says so. An unlabelled paid placement is a lie about
   why something is where it is, and it is the exact habit that makes a directory
   untrustworthy.
2. **Boost cannot be the only sort.** Every other sort in `lib/market.ts` must still be
   reachable and must still ignore boosts entirely.
3. **No boost surface carries a score.** Same rule as everything else in the marketplace —
   `market.ts` already refuses to render averages, and a "top" list must not become a
   ranking board by the back door.

## The economics need a decision first

This is the part that must not be hand-waved. Credits **move** and are never minted — that
conservation property is what stops the currency inflating and is stated on the landing
page. But it is not quite the whole truth:

- `EARN.signupGrant` (600) **is** minted, once, per new member.
- Spends like `COST.priorityPod` leave a member's balance and, if they are burned rather
  than transferred, **shrink** the supply.

So the real design is: grants mint, transfers conserve, sinks burn — and the system is
stable only if sinks roughly offset grants over time. A boost is a new sink, and adding one
without knowing the current mint/burn ratio is how an economy quietly deflates until doing
your share no longer breaks even.

**Before building it, answer:** what is the current net mint rate per active member per
month, and where do existing spends actually land — a platform account, or nowhere? If the
answer is "nowhere", every sink is deflationary and the boost needs to be sized against the
grant rather than guessed. `/admin/economy` should already be able to show this.

## Recommendation

Build it, after the economics question is answered, and price it as a **transfer to a
platform account** rather than a burn unless the mint/burn numbers say otherwise. It is a
good credit sink, a legitimate reason to buy credits, and it costs nothing in policy risk —
which makes it the rare feature we can copy from them wholesale.

---

## What was not done, and why

`docs/COMPETITOR-ONTOPRANK.md` §4 listed five actions. Three shipped (the content engine,
the numeric promise, the comparison row) and one needed nothing (not softening the
disambiguation). These two are the remainder, and both are written up rather than built
because iOS needs a focus decision and the boost needs a number from `/admin/economy`.
Neither is a coin-flip I should make alone.
