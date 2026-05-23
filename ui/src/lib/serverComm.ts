/**
 * Authenticated REST helper for streaming, file upload/download, and other plain HTTP.
 * User profile and other data access use tRPC only (`@/lib/trpc`); there is no REST `/protected/me`.
 */
import { getAuth } from 'firebase/auth';
import { app } from './firebase';

// Fallback for `vite dev` without root run-dev.js; production builds must not rely on this.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500';

interface APIError extends Error {
  status: number;
  code?: string;
  user_id?: string;
}

function createAPIError(status: number, message: string, code?: string, user_id?: string): APIError {
  const error = new Error(message) as APIError;
  error.name = 'APIError';
  error.status = status;
  error.code = code;
  error.user_id = user_id;
  return error;
}

async function getAuthToken(): Promise<string | null> {
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return user.getIdToken();
}

export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));

    throw createAPIError(
      response.status,
      errorData.error || errorData.message || `API request failed: ${response.statusText}`,
      errorData.code,
      errorData.user_id
    );
  }

  return response;
}
