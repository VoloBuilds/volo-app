import { verifyFirebaseToken } from './firebase-auth';
import { getDatabase } from './db';
import { eq, sql } from 'drizzle-orm';
import { users, type User } from '../schema/users';
import type { DatabaseConnection } from './db';
import { getFirebaseProjectId, getDatabaseUrl, getAllowAnonymousUsers } from './env';

export type AuthFailure = { status: number; body: Record<string, unknown> };

/**
 * Verifies a Firebase ID token, enforces anonymous policy, upserts `app.users`, and returns the row.
 */
export async function upsertUserFromIdToken(
  token: string,
  db: DatabaseConnection
): Promise<User> {
  const firebaseProjectId = getFirebaseProjectId();
  const firebaseUser = await verifyFirebaseToken(token, firebaseProjectId);

  const allowAnonymous = getAllowAnonymousUsers();
  const isAnonymousUser = !firebaseUser.email;
  if (!allowAnonymous && isAnonymousUser) {
    const err = new Error('FORBIDDEN_ANONYMOUS');
    (err as { code?: string }).code = 'FORBIDDEN_ANONYMOUS';
    throw err;
  }

  const firebaseUserId = firebaseUser.id;
  const email = firebaseUser.email || null;
  const displayName = firebaseUser.display_name;
  const photoUrl = firebaseUser.photo_url;

  await db
    .insert(users)
    .values({
      id: firebaseUserId,
      email,
      display_name: displayName,
      photo_url: photoUrl,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        photo_url: photoUrl,
        display_name: sql`COALESCE(${users.display_name}, excluded.display_name)`,
        updated_at: new Date(),
      },
    });

  const [user] = await db.select().from(users).where(eq(users.id, firebaseUserId)).limit(1);
  if (!user) {
    console.error('User not found after insert attempt for ID:', firebaseUserId);
    const err = new Error('USER_CREATE_FAILED');
    (err as { code?: string }).code = 'USER_CREATE_FAILED';
    throw err;
  }

  return user;
}

/**
 * Full Bearer authentication for Hono `authMiddleware` (401/403/500 responses).
 */
export async function authenticateBearerRequest(
  authHeader: string | undefined
): Promise<{ ok: true; user: User } | { ok: false; failure: AuthFailure }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, failure: { status: 401, body: { error: 'Authentication required' } } };
  }

  const token = authHeader.split('Bearer ')[1];
  const db = await getDatabase(getDatabaseUrl());

  try {
    const user = await upsertUserFromIdToken(token, db);
    return { ok: true, user };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'FORBIDDEN_ANONYMOUS') {
      return {
        ok: false,
        failure: { status: 403, body: { error: 'Anonymous users are not allowed. Please sign in.' } },
      };
    }
    if (error instanceof Error && error.message === 'USER_CREATE_FAILED') {
      return { ok: false, failure: { status: 500, body: { error: 'User creation failed' } } };
    }
    console.error('Authentication error:', error);
    return { ok: false, failure: { status: 401, body: { error: 'Authentication failed' } } };
  }
}

/**
 * Optional auth for tRPC: missing/invalid token → `user: null`; valid token → upserted `User`.
 */
export async function resolveOptionalUserForRequest(
  req: Request,
  db: DatabaseConnection
): Promise<User | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    return await upsertUserFromIdToken(token, db);
  } catch {
    return null;
  }
}
