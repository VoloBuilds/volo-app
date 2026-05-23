import { createRemoteJWKSet, jwtVerify } from 'jose';
import { isDevelopment, getEnv } from './env';

export type FirebaseUser = {
  id: string;
  email: string | undefined;
  display_name: string | null;
  photo_url: string | null;
};

function optionalStringClaim(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function profileFromTokenPayload(payload: Record<string, unknown>): Pick<FirebaseUser, 'display_name' | 'photo_url'> {
  return {
    display_name: optionalStringClaim(payload.name),
    photo_url: optionalStringClaim(payload.picture),
  };
}

const getJWKS = () => {
  if (isDevelopment()) {
    // Use emulator JWKS endpoint with dynamic port
    const firebaseAuthHost = getEnv('FIREBASE_AUTH_EMULATOR_HOST') ?? 'localhost:5503';
    const emulatorUrl = firebaseAuthHost.startsWith('http') 
      ? firebaseAuthHost 
      : `http://${firebaseAuthHost}`;
    
    return createRemoteJWKSet(
      new URL(`${emulatorUrl}/www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`)
    );
  } else {
    // Use production Firebase JWKS
    return createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
    );
  }
};

export async function verifyFirebaseToken(token: string, projectId: string): Promise<FirebaseUser> {
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID environment variable is not set');
  }

  // In emulator mode, use simplified token verification
  if (isDevelopment()) {
    try {
      // Decode the token without verification for emulator
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      // Basic validation for emulator tokens
      if (!payload.sub || !payload.aud || payload.aud !== projectId) {
        throw new Error('Invalid token payload');
      }
      
      return {
        id: payload.sub as string,
        email: payload.email as string | undefined,
        ...profileFromTokenPayload(payload as Record<string, unknown>),
      };
    } catch (error) {
      throw new Error('Invalid emulator token');
    }
  }

  // Production token verification
  try {
    const JWKS = getJWKS();
    const issuer = `https://securetoken.google.com/${projectId}`;

    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      audience: projectId,
    });

    return {
      id: payload.sub as string,
      email: payload.email as string | undefined,
      ...profileFromTokenPayload(payload as Record<string, unknown>),
    };
  } catch (error) {
    throw new Error('Invalid token');
  }
} 