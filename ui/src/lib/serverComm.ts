import { getAuth } from 'firebase/auth';
import { app } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

// Functional error type instead of class
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

async function fetchWithAuth(
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

// API endpoints
export async function getCurrentUser(): Promise<{
  user: {
    id: string;
    email: string | null;
    display_name: string | null;
    photo_url: string | null;
    created_at: string;
    updated_at: string;
  };
  message: string;
}> {
  const response = await fetchWithAuth('/api/v1/protected/me');
  return response.json();
}

// Example of how to add more API endpoints:
// export async function createChat(data: CreateChatData) {
//   const response = await fetchWithAuth('/api/v1/protected/chats', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify(data),
//   });
//   return response.json();
// }

export const api = {
  getCurrentUser,
  // Add other API endpoints here
}; 