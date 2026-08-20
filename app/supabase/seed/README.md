# Demo data

`demo-network.sql` populates a database with a fictional network: eight
developers, sixteen listings across both stores, and a day's worth of installs
and reports so the feed, the 24H strip and the activity flow can be walked
through instead of described.

It is **not** a migration, and it is deliberately not in `migrations/`.

Migrations are schema and they are replayed in full by `supabase/tests/` against
a throwaway Postgres before every change to the economy. Seed data replayed into
that database would change the counts the tests assert on, so the suite would
start failing for a reason that has nothing to do with the code under test — and
the usual repair for that is to edit the assertion, which is how a test stops
being one.

## Running it

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed/demo-network.sql
```

Safe to run twice: every insert is keyed on a fixed id and does nothing on
conflict, and the activity block returns early when it finds seats already
there.

## What it will not do

**It mints no credits.** Every balance is written through `award_credits`, which
appends to `credit_ledger` in the same statement, so a seeded network reconciles
exactly like a real one and `ledger_drift()` stays empty. Setting
`profiles.credits` directly would have been two lines shorter and would have
made the ledger lie.

**It creates no way to sign in.** The demo developers have `auth.users` rows
because `profiles.id` references that table, but no password and no
`auth.identities` row, so none of them is a login. Sign in as yourself.

**It charges the publishers.** The seeded installs and reports move credits out
of the balances the seed granted, at the same 10 and 30 the real path pays,
because they run through the same triggers. A publisher's balance going down is
the seed working.
