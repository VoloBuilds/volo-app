import { initTRPC, TRPCError } from '@trpc/server';
import type { User } from '../schema/users';
import type { DatabaseConnection } from '../lib/db';
import { getDatabase } from '../lib/db';
import { getDatabaseUrl } from '../lib/env';
import { resolveOptionalUserForRequest } from '../lib/auth';

export type TRPCContext = {
  user: User | null;
  db: DatabaseConnection;
};

export async function createTRPCContext(req: Request): Promise<TRPCContext> {
  const db = await getDatabase(getDatabaseUrl());
  const user = await resolveOptionalUserForRequest(req, db);
  return { user, db };
}

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);
