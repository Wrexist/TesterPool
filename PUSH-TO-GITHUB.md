# Pushing this to github.com/Wrexist/TesterPool

The commit is already made — message, authorship and history are intact, sitting on top of your
existing `main` (`5fe940a Add files via upload`). It could not be pushed from the build sandbox
because that environment only injects git credentials for repositories explicitly authorised for
the session, and this repository was not on that list. Read access worked; write was refused.

Pick whichever of these suits you.

## Option A — the bundle (preserves the commit exactly)

A git bundle is a whole repository in one file. This keeps the commit message and history rather
than squashing everything into a fresh "upload" commit.

```bash
cd /path/where/you/keep/code
git clone https://github.com/Wrexist/TesterPool.git
cd TesterPool
git pull /path/to/testerpool-update.bundle main
git push origin main
```

If `git pull` reports divergence, `git fetch /path/to/testerpool-update.bundle main` followed by
`git reset --hard FETCH_HEAD` gives you exactly the built state, then push.

## Option B — push the files yourself

The full project is in your `TesterPool` folder. From that folder:

```bash
git init                                    # only if it is not already a repo
git remote add origin https://github.com/Wrexist/TesterPool.git
git fetch origin main
git reset --soft origin/main                # keep your files, adopt the existing history
git add -A
git commit -m "Build out admin dashboard, auth providers, payments and automation"
git push origin main
```

## Before you push, check two things

**`app/.env.local` must not go up.** The root `.gitignore` excludes it, but confirm with
`git status --porcelain | grep env` and expect no output. It holds your Supabase URL and anon key.
The anon key is publishable and protected by row-level security, so it is not a disaster if it
leaks, but there is no reason to publish it.

**The full-resolution `shots/` directory is deliberately excluded.** An optimised set lives in
`screenshots/` at about 3 MB total and is what the README displays. The previous upload put the
originals and a 9 MB zip in the repository; this commit removes them.

## What is in the commit

115 files changed, 11,382 insertions. The admin dashboard, all three sign-in providers, Stripe,
the four scheduled jobs and two edge functions, the RLS performance pass, and the four bug fixes
listed in the commit body.
