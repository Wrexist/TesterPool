---
description: Full verification pass — types, lint, build, and Supabase security advisors
---
Run the complete verification pass on TesterPool and report only what is broken.

1. `cd app && npx tsc --noEmit` — must be clean.
2. `cd app && npm run lint`
3. `cd app && npm run build` — must succeed.
4. Check the Supabase security advisors for project `yudcncvarndslyyajflr`.

For any advisor warning, decide whether it is intentional. These are known and accepted:
the user-facing RPCs (`join_pod`, `start_pod`, `submit_checkin`, `review_feedback`,
`arbitrate_dispute`) and the RLS predicate helpers (`owns_app`, `tests_app`,
`owns_assignment_app`, `is_assignment_tester`, `is_feedback_tester`, `is_mod`) are
deliberately callable by `authenticated` — each authorises against `auth.uid()` itself.

Anything else callable by `anon`, and anything that moves credits being callable at all,
is a bug — fix it. Report findings concisely; do not paste build output.
