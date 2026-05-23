import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User } from 'lucide-react';

export function Settings() {
  const { user, userProfile, profileLoading } = useAuth();
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.display_name ?? '');
    }
  }, [userProfile]);

  const utils = trpc.useUtils();

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: async () => {
      await utils.user.me.invalidate();
    },
  });

  const handleSave = async () => {
    updateMutation.reset();
    await updateMutation.mutateAsync({ display_name: displayName });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile
            </CardTitle>
            <CardDescription>
              Update your personal information and profile details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileLoading ? (
              <p className="text-sm text-muted-foreground">Loading profile…</p>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email ?? ''}
                  readOnly
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email is managed by your sign-in provider and cannot be changed here.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col items-end gap-2">
          {updateMutation.isError ? (
            <p className="text-sm text-destructive">
              {updateMutation.error.message || 'Failed to save profile'}
            </p>
          ) : null}
          <Button
            onClick={() => void handleSave()}
            disabled={updateMutation.isPending || profileLoading}
            className="w-full md:w-auto"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
