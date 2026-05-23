import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { trpcServer } from '@hono/trpc-server';
import { setEnvContext } from './lib/env';
import { appRouter } from './trpc/router';
import { createTRPCContext } from './trpc/init';

type Env = {
  RUNTIME?: string;
  [key: string]: unknown;
};

const app = new Hono<{ Bindings: Env }>();

// In Node.js environment, set environment context from process.env
if (typeof process !== 'undefined' && process.env) {
  setEnvContext(process.env);
}

// Environment context middleware - detect runtime using RUNTIME env var
app.use('*', async (c, next) => {
  if (c.env?.RUNTIME === 'cloudflare') {
    setEnvContext(c.env);
  }

  await next();
});

// Middleware
app.use('*', logger());
app.use('*', cors());

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: async (_opts, c) => createTRPCContext(c.req.raw),
  })
);

// Health check route - public
app.get('/', (c) => c.json({ status: 'ok', message: 'API is running' }));

// REST routes for non-data HTTP only (streaming, files, webhooks). User/data access is tRPC-only.
const api = new Hono();

api.get('/hello', (c) => {
  return c.json({
    message: 'Hello from Hono!',
  });
});

app.route('/api/v1', api);

export default app;
