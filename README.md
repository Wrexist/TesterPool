# TesterPool

**Get your 12. Keep them 14 days. Ship.**

A compliance-safe growth network for indie Android developers. Google Play requires 12 testers opted in for 14 consecutive days before a new personal developer account can publish to production. TesterPool solves it with **pods** — about fifteen developers who all test each other's apps across the same fourteen days.

It never touches a public store review, a public rating, or a production install. All activity happens inside closed testing tracks, which do not affect store rankings, ratings, or public install counts.

```
docs/STRATEGY.md      Research, teardown, competitor map, economy design, growth loops
docs/BUILD-PLAN.md    Stack, services to add, costs, phased roadmap, metrics
design/               Standalone design system + 11 full screen mockups (open in a browser)
app/                  Next.js 16 + Supabase application
shots/                Screenshots of the running app
```

## Run it

```bash
cd app
cp .env.example .env.local     # Supabase URL + anon key
npm install
npm run dev                    # http://localhost:3000
```

Visit `/demo` to sign in as any seeded developer — they are all in a pod at day 9 of 14, so every screen is populated.

## Before launch

Delete `src/app/demo/`, remove the `@demo.testerpool.dev` accounts, rotate the anon key, enable Supabase leaked-password protection, and add Turnstile to signup. Phase 0 of the build plan has the full list.

## The two rules the codebase enforces

1. **No credit may ever attach to a public store action.** There is no table, column or enum value in the schema capable of representing a public review, a public rating, or a production install. Keep it that way.
2. **A creator can never silently withhold payment for critical feedback.** A "low effort" verdict opens a moderator dispute rather than rejecting the report. Without that, creator approval becomes a positivity machine.
