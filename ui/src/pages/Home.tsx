import { useAuth } from '@/lib/auth-context';

export function Home() {
  const { user, userProfile, profileLoading } = useAuth();

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">Welcome to Your App!</h1>
        <p className="text-muted-foreground">
          This is your application template with authentication and routing ready to go.
        </p>

        {user && profileLoading ? (
          <p>Loading server info...</p>
        ) : userProfile ? (
          <div className="p-4 border rounded-lg max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-2">Server User Info</h2>
            <pre className="text-left bg-muted p-2 rounded text-sm">
              {JSON.stringify({ user: userProfile, message: 'You are authenticated!' }, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-muted-foreground">Sign in to load server user info.</p>
        )}
      </div>
    </div>
  );
}
