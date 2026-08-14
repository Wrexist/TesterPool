# Migration and economy tests

Replays the entire migration history against a throwaway Postgres and asserts
the credit economy behaves. No Supabase project, no network, no live data.

The economy is the one part of this product where a bug is not a bad screen but
a wrong balance, and a wrong balance is discovered by the person it robbed. It
gets tests.

## Running

Needs `postgresql-16` (or newer) on the box — `initdb`, `pg_ctl`, `psql`.

```bash
set -euo pipefail
SP=$(mktemp -d) && chmod 777 "$SP"
su postgres -c "initdb -D $SP/pgdata -U postgres --auth=trust"
su postgres -c "pg_ctl -D $SP/pgdata -o '-p 5433 -k $SP' -l $SP/pg.log start"

psql -h "$SP" -p 5433 -U postgres -c "create database tp"
psql -h "$SP" -p 5433 -U postgres \
     -c 'alter database tp set search_path to "$user", public, extensions'

# `create extension pg_cron` / `pg_net` in the jobs migration need a control
# file to exist even though the extension itself does nothing here. The stub
# file creates the cron.* and net.* objects by hand, but it cannot write to the
# extension directory from SQL, so this part happens in the shell.
EXT=$(pg_config --sharedir)/extension
for e in pg_cron pg_net; do
  printf "comment = 'stub'\ndefault_version = '1.0'\nrelocatable = true\n" > "$EXT/$e.control"
  printf -- "-- empty: objects come from 00-supabase-stub.sql\n" > "$EXT/$e--1.0.sql"
done

# Stubs, then the real migrations, then the tests.
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/00-supabase-stub.sql
psql -h "$SP" -p 5433 -U postgres -d tp \
     -c "drop extension citext cascade; create extension citext with schema public"
# No `|| break` — a migration that fails must stop the run, not leave the tests
# asserting against half a schema.
for f in supabase/migrations/*.sql; do
  psql -h "$SP" -p 5433 -U postgres -d tp -v ON_ERROR_STOP=1 -q -f "$f"
done

# In order: 01 clears the fixtures and creates what 02 and 03 build on.
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/01-economy.sql
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/02-install-cap.sql
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/03-proof-intake.sql
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/04-marketplace.sql
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/05-payment-locks.sql
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/06-showcase.sql
psql -h "$SP" -p 5433 -U postgres -d tp -f supabase/tests/07-activities.sql
```

`04` asserts the marketplace projection: what is listed to whom, and that a member
browsing the directory cannot read the opt-in link or package name of an app they hold
no assignment on.

`05` runs as `authenticated` rather than as the table
owner, because the exploits it asserts against are only reachable from a signed-in
session. It covers the two money printers found on 13 Aug 2026: writing your own
`opt_in_verified_at`, and inserting your own pre-approved proof.

`06` asserts the anonymous showcase behind the public `/pool` page: which apps a
stranger is shown, that the `public_preview` opt-out withdraws one, that the limit is
clamped, and — the half that matters — that the projection carries no package name,
opt-in link, Google Group, tester instruction, id, owner or score. Its last assertions
run as `anon` for real, because a grant test executed as the table owner would pass
against a function `anon` cannot actually reach.

`07` asserts activities — a seat with no pod. The happy path and, more to the point,
the five refusals, because `start_activity` seats a member against a developer's
balance without pod matching having checked that balance first: your own app, a
duplicate seat, a listing past its `activity_target`, an owner who cannot cover the
whole 40, and the flag. It also asserts the two transfers are the identical 10 and 30
a pod seat moves, that `submit_checkin` works on a pod-less seat, and — as
`authenticated`, for the reason `05` gives — that a direct insert into `assignments`
is still refused. Run it after `01`; it uses `01`'s fixtures and clears the daily
report cap `02` deliberately fills.

All seven files abort on the first failed assertion and print `ALL ... PASSED`
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

## What 03-proof-intake.sql asserts

An approved opt-in proof moves credits, which makes the proof path a payment
path. These are the assertions standing between it and a money printer.

The hole this closed: `recordOptInProof` used to take a confidence score as an
argument **from the browser** and auto-approve anything at or above 0.85. The
score came from a stub in the wizard that guessed from the file's size and
name — no model was ever involved. Any signed-in user could POST a 0.99 and
stamp their own opt-in, which now mints 10 credits and charges a stranger.

So the file proves, in order: a submitted proof is always `pending` and carries
no confidence; a pre-approved row cannot be inserted even holding the owner
role; you cannot submit against somebody else's assignment; you cannot claim an
object under another member's storage prefix; you cannot claim a path with no
object behind it; twenty-five uploads in an hour do not all land.

Then the payment half: only an approved proof stamps the opt-in, the stamp is
idempotent, and a tester who is already at their daily allowance is *deferred*
rather than exploding — their proof stays approved and the next sweep pays them.

## Adding a test

Assertions go through `assert_eq(got, want, what)`, defined at the top of
`01-economy.sql`. It raises on mismatch, so a failing file stops at the first
problem and prints what it wanted. Balances start at the signup grant, so assert
payments as a delta from a baseline rather than an absolute — see the `baseline`
temp table in 03.

Run all six files in order: 01 clears the fixtures and creates the pod and the
creator that 02 and 03 build on, 04 creates the `Market %` apps that 06 reuses, and 05
restores what it changes.

## Known gap: concurrency

The daily caps count rows and then write, so two simultaneous requests could
both pass the same boundary. The fix is a per-tester `pg_advisory_xact_lock`
taken before the count, in both `guard_daily_review_cap` and
`guard_daily_install_cap`.

`01-economy.sql` asserts that lock exists and comes before the count, by reading
the trigger bodies out of `pg_get_functiondef`. It does **not** prove the lock
works under real contention: that needs two connections held open against each
other, and this harness is one `psql` session running files in order. Driving it
properly means a shell orchestrator with background processes and sleeps, which
would make the suite flaky exactly where it most needs to be trustworthy.

So the structural assertion is the guard against the regression that is actually
likely — somebody removing the lock line in a later refactor — and true
concurrent behaviour is unverified here. If you add a second harness that can
hold two sessions, this is the first thing to point it at.
