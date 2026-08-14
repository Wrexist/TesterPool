# Deploying

Hosting is Vercel, as `BUILD-PLAN.md` says. Deploys run from
`.github/workflows/deploy.yml`, triggered by hand from the Actions tab.

GitHub Pages is not an option and never will be. Thirty of the thirty-four
routes are server-rendered on demand, and the app also needs a Node runtime for
the session-refresh middleware, every Server Action, and the Stripe webhook
endpoint. Pages serves static files. A static export would leave the landing
page and the readiness checker working and nothing else.

## One-time setup

### 1. Create the Vercel project

Import the repository at [vercel.com/new](https://vercel.com/new), then:

**Set Root Directory to `app`.** The Next application is not at the repository
root. This is the single most common way the first deploy fails, and the error
it produces — "No Next.js version detected" — does not point at the cause.

Framework preset, build command and output directory are all detected correctly
once the root directory is right. Leave them alone.

### 2. Set the environment variables in Vercel

Project → Settings → Environment Variables. `app/.env.example` documents every
one; the two that matter are:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yudcncvarndslyyajflr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon key |

Add them to **both** Production and Preview, or preview deploys will build
successfully and render every page as an empty state.

`NEXT_PUBLIC_SITE_URL` only needs setting once there is a custom domain — it
falls back to `VERCEL_URL`. Leave the three Stripe variables unset until
payments are live; the app is built to degrade to "payments are not configured"
rather than fail.

Do not set `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` on Production. It exposes
`/demo`, which signs anybody in as a seeded account with a shared password.
Preview only, and see `BUILD-PLAN.md` Phase 0.

### 3. Add the three repository secrets

GitHub → Settings → Secrets and variables → Actions → New repository secret.

| Secret | Where it comes from |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Vercel project → Settings → General, as "Team ID" |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General, as "Project ID" |

Both IDs are also written into `.vercel/project.json` if you ever run
`vercel link` locally. That file is gitignored; the IDs are not secret, but
keeping all three in one place is simpler than remembering which is which.
Running `vercel link` once is the most reliable way to get all three right:
whatever ends up in that file is by definition a combination that works.

**On a personal account there is no "Team ID" field.** The org ID is your user
ID, from Account Settings → General, and it starts with `user_`. A team ID
starts with `team_` and a project ID starts with `prj_`; the workflow checks
those three prefixes before it calls Vercel, because a swapped or mistyped ID
otherwise surfaces as `Could not retrieve Project Settings`, which names
neither of them.

**Scope the token to whatever owns the project.** A token created under your
personal account cannot read a team's project, and vice versa — same error
again. If the token's scope selector offered you a choice, the choice matters.

### 4. Allow the deployment URLs in Supabase

Supabase → Authentication → URL Configuration → Redirect URLs. Sign-in
completes at the provider and then fails on the way home without this.

```
https://<your-project>.vercel.app/**
https://*-<your-team-slug>.vercel.app/**
```

The second line covers preview deployments, whose hostnames change per branch.
The `/**` suffix is required — `/*` does not match `/auth/callback`.
`AUTH-SETUP.md` explains the glob rules.

## Running a deploy

Actions → **Deploy** → **Run workflow**. Choose the branch, then the target.

**Preview** is the default. It builds the branch you picked and returns a URL
that touches nothing anyone is using. This is the one to use for "does my change
work".

**Production** replaces the live site. It is a separate choice rather than the
default so that it cannot be reached by pressing enter.

The deployment URL is printed to the run summary.

### What runs before anything ships

The `verify` job runs `npm run lint`, `npm run build` and `npx tsc --noEmit`,
and the deploy job does not start unless all three pass. The build runs before
the typecheck deliberately: `LayoutProps` and the other route helpers are
generated into `.next/types` by the build, so on a clean checkout a typecheck
that runs first fails with `Cannot find name 'LayoutProps'`. That is a missing
build, not a type error.

The deploy uploads the artefact that was just verified (`vercel deploy
--prebuilt`) rather than asking Vercel to rebuild from source, so what ships is
what passed.

### Gating production

Settings → Environments → `production` → add yourself as a required reviewer.
The workflow then pauses before the deploy step and waits for an approval. The
environments are created automatically the first time the workflow runs.

## What the workflow does not touch

**Database migrations.** These are applied separately, through the Supabase MCP
tools or the CLI, in the order described in `CLAUDE.md`. A deploy never runs
DDL, which means a migration and the code that depends on it are two steps:
apply the migration first, deploy second.

**The scheduled jobs.** `pod-lifecycle`, `clock-watch`, `nightly` and
`send-notifications` run on `pg_cron` inside Supabase, not on the host. They
keep running whatever happens to a deployment, and there is nothing to configure
on Vercel for them. `OPERATIONS.md` has the detail; `/admin/system` is where you
find out whether they are actually firing.

## Adding deploy-on-push later

The workflow is `workflow_dispatch` only, by choice. To also deploy every push
to `main`, add:

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
    ...
```

`inputs.environment` is then empty on a push, so the `--prod` flag and the
concurrency group both need a fallback — something like
`${{ inputs.environment || 'production' }}` in the three places it appears.
