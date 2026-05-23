# Your Volo App

Full-stack app built with React + Hono + PostgreSQL. Created with [create-volo-app](https://github.com/VoloBuilds/create-volo-app).

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, ShadCN
- **Backend:** Hono (Node.js), tRPC, Drizzle ORM
- **Auth:** Firebase Authentication
- **Database:** PostgreSQL (embedded locally, Neon/Supabase/custom in production)
- **Deployment:** Cloudflare Workers (API + static assets)

## Development

```bash
pnpm run dev
```

Starts the UI, API server, embedded PostgreSQL, and Firebase Auth emulator. Ports are assigned automatically in a **5500 block** (defaults: API on `5500`, UI on `5501`, Postgres from `5502`, Firebase Auth emulator on `5503`).

The local UI talks to the local API via `ui/.env.local` (`VITE_API_URL=http://localhost:5500`). Root `pnpm run dev` overrides this with dynamic ports automatically.

To aim the local UI at a different backend, set `VITE_API_URL` in `ui/.env.local`, or pass `--api-url` when starting Vite manually.

### Individual commands

```bash
cd ui && pnpm dev          # Frontend only
cd server && pnpm dev      # Backend only
cd ui && pnpm build        # Build frontend
cd server && pnpm run deploy  # Deploy backend
```

## Project Structure

```
├── ui/                    # React frontend
│   ├── src/
│   │   ├── components/    # UI components (ShadCN)
│   │   ├── lib/           # Utilities, auth, tRPC client
│   │   └── App.tsx
│   └── package.json
├── server/                # Hono API backend
│   ├── src/
│   │   ├── trpc/          # tRPC router and procedures
│   │   ├── middleware/    # Auth middleware
│   │   ├── schema/        # Drizzle database schema
│   │   └── api.ts         # REST routes
│   ├── .env
│   └── package.json
├── data/                  # Local dev data (Postgres, Firebase emulator)
└── scripts/               # Dev tooling
```

## Connecting Production Services

By default everything runs locally. Connect production services when ready:

```bash
pnpm connect:database           # Interactive database provider selection
pnpm connect:database:neon      # Neon PostgreSQL
pnpm connect:database:supabase  # Supabase PostgreSQL
pnpm connect:database:custom    # Custom PostgreSQL

pnpm connect:auth               # Production Firebase Auth
pnpm connect:deploy             # Cloudflare Workers deployment

pnpm connection:status          # Check what's connected
```

Connecting a service updates your `.env` files and creates a backup of the previous config.

## Adding API Routes

**tRPC (required for typed data):** User profile and other database-backed operations live under `/trpc/*`. Add procedures in `server/src/trpc/routers/` and register them in `router.ts`. Derive input/output schemas from Drizzle in `server/src/schema/zod.ts`.

**REST (non-data HTTP only):** Use REST for streaming, file upload/download, webhooks, or other plain HTTP that does not fit tRPC. Add routes in `server/src/api.ts`:

```typescript
api.get('/your-route', (c) => {
  return c.json({ message: 'Hello!' });
});
```

Use `authMiddleware` from `server/src/middleware/auth.ts` when a REST route needs Firebase auth. There is no REST user profile endpoint — use `trpc.user.me` and related procedures instead.

## Database

Uses Drizzle ORM. Schema lives in `server/src/schema/`.

```bash
cd server && pnpm db:push    # Push schema changes to database
```

**After Cloudflare deploy is connected** (`pnpm connect:deploy` or scaffold with `--deploy`), root `pnpm run dev` switches to **Wrangler dev** and does **not** start embedded PostgreSQL. To develop with the local embedded database, run **`pnpm dev:node`** instead (added when deploy is connected).

## UI Components

```bash
cd ui && npx shadcn@latest add [component]
```

Browse available components at [ui.shadcn.com](https://ui.shadcn.com).

## Deployment

Prerequisite: run `pnpm connect:deploy` (or scaffold with `--deploy` / a `volo-config.json` deploy section).

Connecting Cloudflare deploy updates the server to use **Wrangler dev**. After that, root **`pnpm run dev`** simulates the Workers runtime and expects a **remote** `DATABASE_URL` — it will not start embedded PostgreSQL. For local development with the embedded database, use **`pnpm dev:node`**.

Deploy both API and UI to Cloudflare Workers:

```bash
pnpm run deploy
```

This deploys the API first, writes `ui/.env.production` with the production API URL, then deploys the UI.

`ui/.env.local` is for local dev only — editing it does not change production builds. To change the production API URL, edit `ui/.env.production` or re-run `pnpm run deploy`.

Or deploy individually from the repo root:

```bash
pnpm --filter server run deploy    # API Worker
pnpm --filter ui run deploy        # UI Worker (static assets; requires ui/.env.production)
```

Set these environment variables in the Cloudflare Workers dashboard for the API Worker:

- `DATABASE_URL` - Database connection string
- `FIREBASE_PROJECT_ID` - Firebase project ID

After deploying, add your Workers domain to Firebase Console > Authentication > Settings > Authorized domains.

## Troubleshooting

**Backend won't start:** Check `server/.env` and run `pnpm install`.

**Database errors:** Run `cd server && pnpm db:push` to test the connection.

**Frontend build errors:** Clear caches with `cd ui && rm -rf node_modules .vite dist && pnpm install`.

**Auth issues (local):** The Firebase emulator starts automatically with `pnpm dev`. Emulator data is in `data/firebase-emulator/` and backed up automatically.

**Auth issues (production):** Verify `ui/src/lib/firebase-config.json`, `server/.env`, and authorized domains in Firebase Console.

**UI works locally but production app hits wrong API:** Check `ui/.env.production`, not `.env.local`. Re-run `pnpm run deploy`.

**UI production build fails on VITE_API_URL:** Run `pnpm run deploy` from the project root, or set `VITE_API_URL` in `ui/.env.production` manually after `pnpm --filter server run deploy`.
