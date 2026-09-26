# Stride

A keyboard-first project tracker for student teams — Next.js, TypeScript, PostgreSQL.

- **Keyboard-first:** `C` create · `J/K/H/L` navigate · `S` status · `P` priority · `A` assign · `I` assign to me · `Ctrl+K` palette · `Ctrl+Z` undo · `G B / G A / G S` go to board / activity / settings · `?` all shortcuts
- **Workspaces & roles:** admin / member / viewer, enforced in the service layer (non-members get 404)
- **Activity log & undo:** every write appends an event; undo re-applies the `before` state with a version check
- **Conflict-safe writes:** every issue carries a `version`; stale writes get `409` + the current issue
- **GitHub:** a merged PR saying “Fixes DEMO-12” moves the issue to Done (signed webhooks)
- **Measured:** client and server timings land in the `metrics` table → `/admin` → `BENCHMARKS.md`

This is **v1** — the deliberately simple baseline. See `BENCHMARKS.md` for what each improvement round changes.

## Run locally

Requirements: Node 20+, pnpm 9, Docker Desktop.

```bash
pnpm install
cp .env.example .env.local      # then set AUTH_SECRET (command is in the file)
pnpm db:up                      # Postgres 17 on localhost:5433
pnpm db:migrate
pnpm db:seed                    # demo workspace at /w/demo
pnpm dev                        # http://localhost:3000
```

Sign in with **Dev login** as `alice@stride.test` (admin), `bob@stride.test` (member) or `carol@stride.test` (viewer).
Use a second browser profile / incognito window to be a second user.

Production mode on your machine: `pnpm build && pnpm start`.

### Gmail invites + Google sign-in

**1. Send invite emails from your Gmail** (free, no domain needed)

1. Turn on 2-Step Verification for your Google account.
2. Create an App Password at <https://myaccount.google.com/apppasswords> (name it "Stride").
3. In `.env.local` set `GMAIL_USER=you@gmail.com` and `GMAIL_APP_PASSWORD=<the 16 characters>`, then restart the app.
4. Settings → Invite teammates → type their Gmail → **Send invite**. Settings shows a green "emailed from …" banner when it's working.

**2. Let people sign in with Google**

1. <https://console.cloud.google.com> → create a project → *APIs & Services → OAuth consent screen* → External → fill in app name + your email.
   While the app is in **Testing**, only emails you add under *Test users* can sign in — add your teammates (or click *Publish app*; basic email/profile scopes don't need review).
2. *Credentials → Create credentials → OAuth client ID → Web application.*
   Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (add `https://<your-app>.vercel.app/api/auth/callback/google` later).
3. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in `.env.local`, restart. A **Continue with Google** button appears on the login and invite pages.

**The flow:** teammate gets the email → clicks **Accept invite** → invite page → **Continue with Google** (their Gmail is pre-selected) → back on the invite page → **Accept & join** → lands on the board.

> While running on `localhost`, invite links only open on your own computer. After deploying to Vercel (set `APP_URL`), they work for anyone.

### Test the GitHub integration locally

The seed links repo `stride-demo/app` with secret `dev-webhook-secret`:

```bash
pnpm webhook:test --title="Fixes DEMO-3"
pnpm webhook:test --title="Fixes DEMO-3" --repeat=3   # replays the same delivery
```

### Tests

```bash
pnpm test                          # Vitest: unit + service/integration tests (uses stride_test DB)
pnpm exec playwright install chromium   # once
pnpm test:e2e                      # Playwright: two-user sync, permissions, keyboard flows
```

Benchmark dataset: `pnpm db:seed --issues=10000`.

## Deploy to Vercel (free)

1. **Neon:** create a project → copy the **pooled** connection string (`DATABASE_URL`) and the **direct** one (`DATABASE_URL_UNPOOLED`).
2. Run migrations against Neon once: `DATABASE_URL_UNPOOLED=... pnpm db:migrate`.
3. **OAuth:** create a GitHub OAuth app (callback `https://<your-app>.vercel.app/api/auth/callback/github`) and/or Google OAuth client (callback `.../api/auth/callback/google`).
4. **Vercel:** import the GitHub repo, then set env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID/SECRET` (and/or Google), `APP_URL=https://<your-app>.vercel.app`, `ADMIN_EMAILS`, optionally `RESEND_API_KEY` + `EMAIL_FROM`.
   **Do not set `ALLOW_DEV_LOGIN`** on public deployments (it's also hard-disabled when `VERCEL_ENV=production`).
5. Deploy. Every PR gets a preview URL; CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build.

## Architecture

```
src/
  app/            pages (RSC) + /api route handlers (thin: parse → ctx → service)
  server/
    services/     business rules: validation (Zod), authorization, transactions, events
    authz.ts      requireRole(): the single permission gate
    db/           Drizzle schema + client
    integrations/ GitHub signatures/ref parsing, Resend email
  client/         TanStack Query hooks, Zustand UI store, command registry + hotkeys, metrics
  components/     board (dnd-kit), issue panel, command palette (cmdk), UI primitives
  lib/            shared types, constants, Zod schemas
drizzle/          SQL migrations
scripts/          seed, local webhook sender
tests/            unit/, integration/ (real Postgres), e2e/ (Playwright)
```
