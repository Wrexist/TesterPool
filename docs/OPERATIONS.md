# Operations

This document covers the parts of TesterPool that run when nobody is watching: the scheduled
jobs inside Postgres, the two edge functions that talk to the outside world, the secrets they
need, and what each of them does when a secret is missing. Read it before changing a schedule
or adding a provider key.

## The machine, and when each part of it runs

Four scheduled jobs exist, all defined with `pg_cron` and all evaluated in UTC. You can see them
at any time with `select jobname, schedule, active from cron.job order by jobname`.

`pod-lifecycle` runs hourly at seven minutes past the hour, calling `job_pod_lifecycle()`. It
starts any forming pod whose seats have all filled, which means creating the assignment rows that
pair every tester with every other member's app, locking the pod, moving members to active and
enqueuing a `pod_started` notification for each of them. In the same pass it closes pods whose
end date has arrived, releases the escrowed opt-in credits to testers who logged at least twelve
of the fourteen days, awards the `first_pod` and `perfect_14` badges, and recomputes reliability
for every account that is not banned. The seven-minute offset exists so that it never contends
with anything scheduled on the hour.

`clock-watch` runs every six hours on the hour, calling `job_clock_watch()`. This is the job that
protects the product's central promise. It enqueues a `checkin_due` notification for every active
assignment that has not been logged today, warns a tester whose last check-in was two or three
days ago with `streak_at_risk`, warns the affected app owner with `seat_at_risk`, converts four
consecutive missed days into a dropped assignment and tells the owner with `rescue_needed`, and
asks for a written report once a tester passes day seven. Every insert carries a `dedupe_key`,
so running the job twice in one day produces no duplicates.

`nightly` runs at 02:20 UTC, calling `job_nightly()`. It counts ledger drift by comparing the
append-only `credit_ledger` against the cached `profiles.credits` projection, prunes notifications
that were delivered more than thirty days ago, drops `job_runs` rows older than ninety days,
recomputes how many shipped apps each tester helped, and runs `analyze`. It reports itself as
unhealthy, meaning `ok = false`, when ledger drift is non-zero, which is the single most important
alarm in the system.

`send-notifications` runs every fifteen minutes, calling `send_notifications_tick()`. Unlike the
other three it does no work itself: it reads the function URL and the shared secret out of Vault
and uses `pg_net` to POST to the `send-notifications` edge function, which drains the outbox.
Fifteen minutes is chosen against the unit of urgency in this product, which is a day. A reminder
that arrives a quarter of an hour late costs nothing, while the short interval means that a mail
provider outage drains within an hour of clearing rather than waiting for the next six-hourly
sweep. Because `pg_net` is asynchronous, the tick records only that it dispatched a request; the
edge function records what was actually delivered.

The second edge function, `triage-proof`, is not scheduled. It is invoked with a `proof_id` when
a screenshot arrives, and it can be replayed by hand for any proof at any time.

## Checking that it is all healthy

Every job writes a row to `job_runs` containing its name, an `ok` boolean, a JSON detail blob and
a duration. That table is the first place to look. A useful summary is

```sql
select job, max(ran_at) as last_run, bool_and(ok) as all_ok
  from job_runs where ran_at > now() - interval '24 hours' group by job order by job;
```

and anything whose `last_run` is older than its schedule allows is a real problem, as is any row
with `ok = false`. Note the two distinct names for the sender: `send_notifications_dispatch` is
written by Postgres when it fires the request, and `send_notifications` is written by the edge
function when it finishes, with the counts of what it claimed and sent in its detail. Seeing the
first without the second means Postgres is reaching out and the function is not answering.

The admin area renders all of this on one screen at `/admin/system`, which is the interface you
should reach for first. It derives a single verdict — healthy, degraded or broken — from each job's
own schedule rather than a fixed threshold, so a job is called late only when it has missed a
meaningful multiple of its own cadence. It also draws the distinction that matters most in the
outbox: delivery paused because a key is absent looks nothing like delivery failing, and the page
says which one is happening. The queries in this section remain useful when you are working
directly against the database or when the app itself is the thing that is down.

For the outbox specifically, `select count(*) filter (where sent_at is null and failed_at is null)
as pending, count(*) filter (where failed_at is not null) as dead, max(attempts) from notifications`
tells you whether delivery is keeping up. A pending count that grows steadily while
`send_notifications` rows keep appearing in `job_runs` usually means delivery is unconfigured
rather than broken; read the `detail` blob, which says so in plain language.

## Secrets, and what breaks without each one

Two secrets live in Supabase Vault because the cron command that uses them is stored in the
readable `cron.job` table. The first is `send_notifications_url`, which holds
`https://yudcncvarndslyyajflr.supabase.co/functions/v1/send-notifications`. The second is
`cron_secret`, a random string of at least thirty-two characters that Postgres sends as a bearer
token and the edge functions verify through the `cron_secret_matches` function. Create them once
with `vault.create_secret(value, name, description)` and rotate them later with
`vault.update_secret`; nothing else has to change when you do, and a rotated secret takes effect
on the next tick. Until both exist the scheduled job is a deliberate no-op: it logs a skip to
`job_runs` every fifteen minutes with the names of the secrets it is waiting for and sends
nothing. That is the intended state before launch.

Four environment variables are set on the edge functions themselves. `RESEND_API_KEY` and
`NOTIFICATION_FROM` configure delivery; without either of them the sender runs in dry-run mode,
which means it claims a batch, renders every email, logs what it would have sent, hands the
attempts back so no row is consumed, and returns a summary saying `delivery: unconfigured` with
the missing variable named. It never marks a row as sent that it did not send. `SITE_URL` sets the
origin used in every deep link and defaults to `https://testerpool.dev`; if it is wrong, mail
still goes out but the links point at the wrong host, which is worse than not sending, so check it
first when configuring a staging project. `ANTHROPIC_API_KEY` powers proof triage; without it
`triage-proof` still fetches the image and computes its perceptual hash, still escalates a
screenshot that another account has already uploaded, and then leaves the proof pending with a
verdict of `unconfigured` rather than inventing an opinion. `ANTHROPIC_MODEL` is optional and
overrides the default model id. `CRON_SECRET` is also optional, because the Vault copy is
authoritative; set it only if you want a second accepted token.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform. Both functions are
deployed with JWT verification disabled, because `pg_cron` cannot mint a JWT, and each therefore
checks the caller itself against the service role key, the optional `CRON_SECRET`, and the Vault
secret. A request with no bearer, a wrong bearer, or an ordinary user's access token is rejected
with 401 before any database work happens.

## Replaying a failed batch

A notification that fails delivery keeps its error text, has its `attempts` counter incremented
and its `send_after` pushed out by a growing backoff, and is retried until it reaches five
attempts, at which point `failed_at` is stamped and it stops. Nothing is deleted, so a batch can
always be inspected with `select id, kind, attempts, error, failed_at from notifications where
error is not null order by id desc`.

To replay, decide first whether the cause is fixed. If it is, clear the stamps on the rows you
want back in play with `update notifications set failed_at = null, error = null, attempts = 0,
send_after = now() where failed_at is not null and created_at > now() - interval '2 days'`,
narrowing that predicate to the specific batch rather than the whole table. Then either wait for
the next tick or force one immediately with `select send_notifications_tick()`. You can also call
the function directly with `curl -X POST <url> -H "Authorization: Bearer <cron_secret>" -d
'{"limit": 200}'`, and passing `{"dry_run": true}` renders everything and sends nothing, which is
the safe way to inspect a replay before committing to it. Rows older than the twenty-hour quiet
window for their kind will be picked up; rows inside it are held back deliberately, so a replay
cannot double-mail somebody who already received that kind of message today.

Running two drains at once is safe. `claim_notifications` selects `for update skip locked`, so a
second concurrent invocation walks past the rows the first is holding and claims a different set,
or none at all. This was verified by firing three overlapping requests at the deployed function:
the first claimed all two hundred and eighty pending rows and the second claimed zero.

## Testing an edge function locally

Install the Supabase CLI and run `supabase functions serve send-notifications --no-verify-jwt`
from the `app` directory, which serves the function at
`http://localhost:54321/functions/v1/send-notifications` against whatever project your
`supabase/.env` points at. Put the environment variables in `app/supabase/functions/.env.local`
and pass it with `--env-file`; leave `RESEND_API_KEY` out of that file and every local run is a
dry run, which is what you want while iterating on copy. Invoke it with
`curl -X POST http://localhost:54321/functions/v1/send-notifications -H "Authorization: Bearer
$SUPABASE_SERVICE_ROLE_KEY" -d '{"limit": 5, "dry_run": true}'`, and read the rendered text of each
digest in the function's console output.

Because the whole email is a pure function of a claimed row, the fastest way to review copy is to
claim a few rows in SQL with `select * from claim_notifications(5)`, release them again with
`release_notifications(array[...])`, and feed the shapes you see into `renderItem` from
`templates.ts`. For `triage-proof`, invoke it with a real `proof_id` from the `proofs` table; with
no `ANTHROPIC_API_KEY` set it exercises the signed URL, the download and the perceptual hash and
stops short of the model, which covers most of what usually breaks.

Deployment is done through the Supabase MCP tools or `supabase functions deploy <name>
--no-verify-jwt`. Both functions must keep JWT verification off, or `pg_cron` will stop being able
to reach them.

## What this costs

The sender's own footprint is negligible. Ninety-six invocations a day is under three thousand a
month, against the two million included in a Supabase Pro plan, and each run is a single claim
query, one HTTP request per recipient and one settle query.

Email is the real cost, and the shape of it follows from the digest design: one message per active
tester per day, no matter how many pods they sit in. Assume that roughly forty per cent of
registered users are inside a live pod on any given day, which is generous for a product whose
cycles are fourteen days long. At one thousand users that is about four hundred emails a day, or
twelve thousand a month. Resend's free tier of three thousand a month, which works out at about a
hundred a day, therefore covers roughly the first two to three hundred users and no more; past
that you need Resend's paid entry plan, which at the time of writing costs around twenty dollars a
month for fifty thousand emails and leaves comfortable headroom at one thousand users. At twenty
thousand users the same assumption gives about eight thousand emails a day, or two hundred and
forty thousand a month, which sits in Resend's higher volume tiers at roughly one to two hundred
dollars a month. Check current pricing before quoting these numbers to anyone; the ratios matter
more than the figures, and the important ratio is that digesting keeps the bill proportional to
active testers rather than to assignments, which would otherwise multiply it by fourteen.

Proof triage is priced per screenshot rather than per user. A single vision call carries one phone
screenshot and a short prompt and returns a few dozen tokens, which lands under a cent per proof
on a current Sonnet model. A pod of fifteen produces one opt-in proof per tester per app, so a
completed pod costs a couple of dollars to triage in full. At twenty thousand users the sensible
control is not a cheaper model but a narrower trigger: triage the opt-in proofs, which gate the
fourteen-day clock, and leave routine daily-use screenshots to spot checks. The perceptual hash
costs nothing, runs on every proof regardless, and is what actually catches the reused-screenshot
fraud that matters.
