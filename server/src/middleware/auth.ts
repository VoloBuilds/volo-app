import { MiddlewareHandler } from 'hono';
import { verifyFirebaseToken } from '../lib/firebase-auth';
import { getDatabase } from '../lib/db';
import { eq } from 'drizzle-orm';
import { User, users } from '../schema/users';
import { getFirebaseProjectId, getDatabaseUrl, getAllowAnonymousUsers } from '../lib/env';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const token = authHeader.split('Bearer ')[1];
    const firebaseProjectId = getFirebaseProjectId();
    const firebaseUser = await verifyFirebaseToken(token, firebaseProjectId);
    
    // Check if anonymous users are allowed
    const allowAnonymous = getAllowAnonymousUsers();
    const isAnonymousUser = !firebaseUser.email;
    
    if (!allowAnonymous && isAnonymousUser) {
      return c.json({ error: 'Anonymous users are not allowed. Please sign in.' }, 403);
    }
    
    const firebaseUserId = firebaseUser.id;
    const email = firebaseUser.email || null;

    const databaseUrl = getDatabaseUrl();
    const db = await getDatabase(databaseUrl);

    // Upsert: insert if not exists, update email if exists and email changed
    await db.insert(users)
      .values({
        id: firebaseUserId,
        email: email,
        display_name: null,
        photo_url: null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: email,
          updated_at: new Date(),
        },
      });

    // Get the user from database
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, firebaseUserId))
      .limit(1);

    if (!user) {
      console.error('User not found after insert attempt for ID:', firebaseUserId);
      return c.json({ error: 'User creation failed' }, 500);
    }

    c.set('user', user);
    await next();
  } catch (error) {
    console.error('Authentication error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}; 