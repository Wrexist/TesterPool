# Migration and economy tests

Replays the entire migration history against a throwaway Postgres and asserts
the credit economy behaves. No Supabase project, no network, no live data.

The economy is the one part of this product where a bug is not a bad screen but
a wrong balance, and a wrong balance is discovered by the person it robbed. It
gets tests.

## Running

Needs `postgresql-16` (or newer) on the box — `initdb`, `pg_ctl`, `psql`.

```bash
SP=$(mktemp -d) && chmod 777 "$SP"
su postgres -c "initdb -D $SP/pgdata -U postgres --auth=trust"
su postgres -c "pg_ctl -D $SP/pgdata -o '-p 5433 -k $SP' -l $SP/pg.log start"

psql -h "$SP" -p 5433 -U postgres -c "create database tp"
psql -h "$SP" -p 5433 -U postgres \
     -c 'alter database tp set search_path to "$user", public, extensions'

# Stubs, then the real migrations, then the tests.
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/00-supabase-stub.sql
psql -h "$SP" -p 5433 -U postgres -d tp \
     -c "drop extension citext cascade; create extension citext with schema public"
for f in supabase/migrations/*.sql; do
  psql -h "$SP" -p 5433 -U postgres -d tp -v ON_ERROR_STOP=1 -q -f "$f" || break
done
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/01-economy.sql
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/02-install-cap.sql
```

Both test files abort on the first failed assertion and print `ALL ... PASSED`
at the end if nothing is wrong.

## What the stub provides

Stock Postgres has none of the Supabase furniture the migrations assume:
`auth.uid()`, the `anon`/`authenticated`/`service_role` roles, the `extensions`
schema, `pg_cron`, `pg_net`, `vault.secrets`, storage tables. `00-supabase-stub.sql`
creates just enough of each for the DDL to resolve.

Two details matter and are easy to get wrong:

- **`search_path` must include `extensions`.** Supabase sets it at the database
  level. Without it `core.sql` fails on `gen_random_bytes` while creating the
  `referral_code` default — the same trap that produced the pgcrypto fix
  migration in the first place.
- **`citext` starts in `public`.** That is where the original project had it, and
  `20260810203347_move_citext_out_of_public.sql` is the migration that moves it.
  Installing it into `extensions` up front makes that migration a no-op and hides
  whatever it was going to catch.

`pg_cron` and `pg_net` are stubbed as empty extensions whose objects the stub
file creates by hand, so the scheduling migrations run without either extension
being installed.

## What 01-economy.sql asserts

The transfer, both directions: a confirmed install moves 10 from the app owner
to the tester, a confirmed report moves 30, and neither pays twice if the row is
touched again.

The two invariants:

- A blocker-severity report costs the developer exactly what praise costs. If
  this ever fails, creator review has become a positivity machine.
- The tester is paid in full even when the owner cannot cover it. The owner goes
  to zero, never negative, their app is paused, and they are told why.

Conservation: every ledger sums to its balance, with no drift between
`credit_ledger` and `profiles.credits`.

And the throttle: ten reports land, the eleventh is refused, a draft is still
allowed at the cap, the paid pass lifts it, and an expired pass does not.
