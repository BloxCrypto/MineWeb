# Minecraft Bot Console

A browser control console for connecting and operating a Mineflayer Minecraft bot.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/minecraft-bot run dev` — run the bot control website
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Bot runtime: Mineflayer, loaded as a server-side runtime dependency

## Where things live

- `artifacts/minecraft-bot/src/pages/home.tsx` — responsive bot console UI
- `artifacts/api-server/src/lib/minecraft-bot.ts` — in-memory Mineflayer session manager and log buffer
- `artifacts/api-server/src/routes/bot.ts` — bot status, connection, disconnect, and chat endpoints
- `lib/api-spec/openapi.yaml` — source of truth for bot API contracts

## Architecture decisions

- Bot state and recent logs are intentionally in memory for a single live control session; no database is needed to operate the bot.
- Mineflayer is externalized from the API bundle so Node loads its CommonJS runtime dependency directly.
- The frontend polls status and logs so the control console remains useful without a WebSocket service.

## Product

- Configure a Minecraft server target, bot username, version, and auth mode.
- Connect or disconnect a Mineflayer bot from the browser.
- Monitor connection state, health, protocol version, XYZ position, last event, and recent logs.
- Send chat messages through the connected bot.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
