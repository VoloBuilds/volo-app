import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@server/trpc/router';
import { getAuth } from 'firebase/auth';
import { app } from './firebase';

export const trpc = createTRPCReact<AppRouter>();

// Fallback for `vite dev` without root run-dev.js; production builds must not rely on this.
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5500';

const trpcLinks = () => [
  httpBatchLink({
    url: `${apiBaseUrl}/trpc`,
    async headers() {
      const token = await getAuth(app).currentUser?.getIdToken();
      if (!token) {
        return {};
      }
      return { Authorization: `Bearer ${token}` };
    },
  }),
];

export function makeTRPCClient() {
  return trpc.createClient({ links: trpcLinks() });
}

let vanillaClient: ReturnType<typeof createTRPCClient<AppRouter>> | null = null;

/** Same transport as the React tRPC client; use outside React (e.g. auth callbacks). */
export function getTRPCVanillaClient() {
  if (!vanillaClient) {
    vanillaClient = createTRPCClient<AppRouter>({ links: trpcLinks() });
  }
  return vanillaClient;
}
