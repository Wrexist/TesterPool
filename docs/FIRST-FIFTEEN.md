# Recruiting the first fifteen

The cold-start problem, and the only honest way through it.

## Why fifteen, and why hand-recruited

A group needs 15 to start. Below that, nobody's clock runs and every early arrival is
waiting on strangers who have not signed up yet. That makes the first fifteen categorically
different from every later member: they are not customers of a working network, they are
the people who make it exist.

So they get recruited one at a time, by a person, with a specific ask. Not a launch post
into the void. Fifteen good conversations beats five hundred impressions, and it is roughly
a week of evenings.

**Do not start public marketing until the first group has finished.** The blog, the SEO,
the Product Hunt post — all of it converts better when `/pool` can show a real count and
`/launch` has a real app on it. Spending your first traffic on an empty network wastes the
one audience that is hardest to get back.

## Who to ask

Every one of these is full of people with the exact problem, today:

| Where | What it is | Notes |
| --- | --- | --- |
| **r/androiddev** | The head of the market | Read the rules before posting — self-promo is restricted, but "I built this because I hit the 12-tester wall" threads do fine when they are honest and answer questions |
| **r/AndroidAppTesters**, **r/betatests** | Explicitly for this exact swap | The most direct fit. Already full of manual 12-tester swap threads |
| **Indie Hackers** | Founders shipping small things | The "what are you working on" threads |
| **Android dev Discords** | Real-time, high trust | Where swap threads actually get organised today |
| **X / Bluesky #androiddev** | Low yield, low cost | Worth one post, not a strategy |
| **Google Play Console community** | People asking about production access | Answer their actual question first. Always |

The last row matters most and is the slowest: find the threads where someone is asking
*"how do I get 12 testers"* and answer it properly, without pitching. The blog post is
written to be that answer. A link at the end, once you have been useful.

## The ask

Short, specific, and honest about the stage. Something like:

> I built TesterPool because I hit the 12-tester wall and every option I found was either
> a swap thread with no follow-through or a service selling reviews that would get my
> account terminated.
>
> It works like this: 15 developers list an app each, install everyone else's, and each
> send one structured review. Everyone's 14-day clock runs on the same days, so one
> fortnight clears the requirement for all fifteen. Everything happens inside closed
> testing tracks — no store reviews, no ratings, nothing that touches your listing.
>
> I'm filling the first group now. There are N seats left. It is free, and I'm not going
> to pretend there's a track record yet — you'd be in the first one, which is exactly why
> I'm asking people directly rather than running ads.

Adjust N from `/pool`. Never round it up.

### What not to say

- No invented numbers, no "hundreds of developers". `/pool` shows the real count and a
  visitor will check it.
- Don't promise store reviews or ratings, ever — see `docs/COMPETITOR-ONTOPRANK.md` §3.
- Don't say "guaranteed" about the 12 testers. Say 15 seats, so three can vanish.
- Don't call it a beta to lower expectations and then also claim it is proven. Pick one.

## What to have ready before you send the first message

- [ ] `NEXT_PUBLIC_SITE_URL` set on Vercel Production, or every shared link previews wrong
- [ ] Your own app listed, with a working opt-in link — you are seat one
- [ ] `/pool` reachable and showing a real seat count
- [ ] The email path tested end to end on a throwaway address: magic link, then a check-in
      reminder actually arriving
- [ ] A way to be reached that is not a form — the first fifteen will have questions, and
      answering them fast is most of what converts them

## Running the first group

Concierge it. Do not automate anything that a message can do better at this size.

1. **Set a start date and hold it.** "We start Monday" converts; "when it fills" does not.
2. **Message each member on day 0** with what they need to do and when.
3. **Watch the count every day.** `/admin/system` is the smoke alarm; a dropout on day 6 is
   recoverable, a dropout you notice on day 13 is not.
4. **Ask each of them, at the end, for one sentence you can quote** — with their name and
   a link to their app. That is what replaces the founding-group section on the landing
   page, and it will be the first real social proof the site has ever had.
5. **Write up what broke.** The first cycle is the only chance to see the product through
   the eyes of people who have never used it.

## After it finishes

That is the moment the marketing plan in `docs/COMPETITOR-ONTOPRANK.md` §4 becomes worth
running: `/launch` has a real app on it, `/pool` has real activity, and you have testimonials
from people who will let you use their names. Then push the blog.
