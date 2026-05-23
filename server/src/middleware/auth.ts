import { MiddlewareHandler } from 'hono';
import { authenticateBearerRequest } from '../lib/auth';
import { User } from '../schema/users';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const result = await authenticateBearerRequest(c.req.header('Authorization'));
  if (!result.ok) {
    return c.json(result.failure.body, result.failure.status as 401 | 403 | 500);
  }

  c.set('user', result.user);
  await next();
};
