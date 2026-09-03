# Base44 Dev Environment

## What this is
A browser control console for a Mineflayer Minecraft bot. Single Node process
serves the Express 5 API **and** the Vite React SPA (middleware mode) on port 3000.

## Run
```
docker compose -f docker-compose.base44.yml up -d
```
- `db` — PostgreSQL 16 (auth sessions, users, saved Minecraft accounts).
- `setup` — one-shot `npm install` into the shared `node_modules` volume.
- `migrate` — one-shot `drizzle-kit push` (schema). Best-effort; web does not wait on it.
- `web` — `npm run dev` → `tsx server.ts` (Express + Vite middleware, port 3000).

Verify: `curl -sf http://localhost:3000/api/healthz` → `{"status":"ok"}`.

## Stack / setup notes
- npm workspaces (root `package.json`); project was authored for pnpm, so the
  Dockerfile sets `npm config set legacy-peer-deps true` to tolerate peer-dep ranges.
- `postinstall` creates `node_modules/@workspace/*` symlinks to `lib/*` and
  `artifacts/*`. The `node_modules` named volume preserves them across restarts.
- Node 22 base image (cached). Runtime libs for the `canvas` native addon
  (cairo/pango/jpeg/gif/rsvg) are installed in `Dockerfile.base44`.
- Vite runs in middleware mode (`hmr: false`); edits show on browser refresh.
  Express binds `0.0.0.0`, so the preview's external hostname works without
  extra `allowedHosts` config.

## Env
- `DATABASE_URL`, `SESSION_SECRET` — local infra, set inline in compose.
- `ISSUER_URL` / `REPL_ID` — optional Replit OIDC for login. Not required to
  boot; the bot console works unauthenticated. No external secrets are needed
  to run the app.

## Where things live
- `server.ts` — dev entry (Express + Vite middleware).
- `artifacts/api-server/src/app.ts` — Express app, routes under `/api`.
- `artifacts/api-server/src/lib/minecraft-bot.ts` — in-memory bot session + logs.
- `artifacts/api-server/src/lib/minecraft-accounts.ts` — accounts (JSON file +
  optional DB mirror); passwords encrypted with `SESSION_SECRET`.
- `artifacts/minecraft-bot/src/pages/home.tsx` — the console UI.
- `lib/db/src/schema/` — Drizzle schema (auth + minecraft-accounts).
