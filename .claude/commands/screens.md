---
description: Build, serve, and screenshot every route to check the UI visually
---
Capture the current state of the UI and tell me what looks wrong.

1. `cd app && npm run build`, then start it on port 3000 with `nohup npx next start`.
   If the port is busy, kill the stale `next-server` process first.
2. Sign in server-side rather than through the browser: use `@supabase/supabase-js` in a
   Node script to `signInWithPassword` as `isacm@demo.testerpool.dev` /
   `testerpool-demo-1234`, then set the session as a `sb-yudcncvarndslyyajflr-auth-token`
   cookie (value = `base64-` + base64 of the session JSON, chunked at 3180 chars) in a
   Playwright context. The browser cannot reach Supabase directly from this sandbox.
3. Screenshot every route into `shots/` at deviceScaleFactor 2, full page.
4. Actually look at the images with the Read tool. Report only genuine problems —
   misalignment, overflow, unreadable contrast, empty states that should have data,
   anything that reads as broken rather than merely different from your taste.
