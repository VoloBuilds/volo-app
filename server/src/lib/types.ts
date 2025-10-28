// Shared types for API contracts and data transfer objects

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Error handling
export function createAPIError(message: string, status: number = 500, code?: string): Error {
  const error = new Error(message);
  (error as any).status = status;
  (error as any).code = code;
  return error;
}

