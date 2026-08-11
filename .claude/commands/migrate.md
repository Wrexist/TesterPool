---
description: Write and apply a Supabase migration safely
argument-hint: [what the migration should do]
---
Write and apply a migration for: $ARGUMENTS

Rules, in order:

1. Read `app/supabase/migrations/` first so you match existing naming, types and style.
2. Write the SQL to a new numbered file in that directory, with comments explaining *why*,
   not what.
3. Apply it with the Supabase `apply_migration` tool against project `yudcncvarndslyyajflr`.
4. Every new function gets `set search_path = public, extensions` — `pgcrypto` is not in
   `public` and omitting `extensions` throws at runtime.
5. Every new `SECURITY DEFINER` function gets an explicit
   `revoke execute ... from anon, authenticated, public`, then a `grant` only to the roles
   that genuinely need it. Supabase exposes every `public` function over REST.
6. New RLS policies must never subquery a table whose own policies reference this one —
   that causes 42P17 recursion and silently returns zero rows. Use the `SECURITY DEFINER`
   helpers instead.
7. Enable RLS on any new table, and write its policies in the same migration.
8. Run the security advisors afterwards and fix anything new.
