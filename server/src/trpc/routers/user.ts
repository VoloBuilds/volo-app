import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { users } from '../../schema/users';
import { userSelectSchema, userUpdateSchema } from '../../schema/zod';
import { protectedProcedure, router } from '../init';

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => userSelectSchema.parse(ctx.user)),

  update: protectedProcedure.input(userUpdateSchema).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(users)
      .set({
        ...input,
        updated_at: new Date(),
      })
      .where(eq(users.id, ctx.user.id));

    const [row] = await ctx.db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found after update' });
    }
    return userSelectSchema.parse(row);
  }),
});
