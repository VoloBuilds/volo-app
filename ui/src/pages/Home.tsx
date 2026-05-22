import { useAuth } from '@/lib/auth-context';
import { trpc } from '@/lib/trpc';

export function Home() {
  const { user } = useAuth();
  const { data, error, isPending } = trpc.user.me.useQuery(undefined, {
    enabled: !!user,
  });

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">Welcome to Your App!</h1>
        <p className="text-muted-foreground">
          This is your application template with authentication and routing ready to go.
        </p>

        {error ? (
          <p className="text-red-500">{error.message || 'Failed to fetch user info from server'}</p>
        ) : data ? (
          <div className="p-4 border rounded-lg max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-2">Server User Info</h2>
            <pre className="text-left bg-muted p-2 rounded text-sm">
              {JSON.stringify({ user: data, message: 'You are authenticated!' }, null, 2)}
            </pre>
          </div>
        ) : isPending && user ? (
          <p>Loading server info...</p>
        ) : (
          <p className="text-muted-foreground">Sign in to load server user info.</p>
        )}
      </div>
    </div>
  );
}
