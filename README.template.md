# Your Volo App

Full-stack app built with React + Hono + PostgreSQL. Created with `[create-volo-app](https://github.com/VoloBuilds/create-volo-app)`.

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

Starts the UI, API server, embedded PostgreSQL, and Firebase Auth emulator. Ports are assigned automatically (defaults: UI on `5173`, API on `8787`, Postgres from `5433`).

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

## UI Components

```bash
cd ui && npx shadcn-ui@latest add [component]
```

Browse available components at [ui.shadcn.com](https://ui.shadcn.com).

## Deployment

Deploy both API and UI to Cloudflare Workers:

```bash
pnpm run deploy
```

Or deploy individually:

```bash
cd server && pnpm run deploy    # API Worker
cd ui && pnpm run deploy        # UI Worker (static assets)
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