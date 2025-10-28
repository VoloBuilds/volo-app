import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { auth, googleProvider } from "@/lib/firebase"
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPopup,
  EmailAuthProvider,
  GoogleAuthProvider
} from "firebase/auth"
import { useAuth } from "@/lib/auth-context"
import { Loader2, UserPlus, LogIn } from "lucide-react"

const GoogleIcon = () => (
  <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showExistingAccountPrompt, setShowExistingAccountPrompt] = useState(false)
  const { user, forceRefresh } = useAuth()
  
  // Default to "register" tab for anonymous users, "signin" for others
  const defaultTab = user?.isAnonymous ? "register" : "signin"
  const [activeTab, setActiveTab] = useState(defaultTab)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    
    try {
      const currentUser = auth.currentUser;
      
      // First, always try to sign in with existing account
      try {
        await signInWithEmailAndPassword(auth, email, password);
        return; // Exit early if sign-in succeeds
      } catch (signInErr: any) {
        // If user doesn't exist, decide whether to create or upgrade
        if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
          // Account doesn't exist - check if we should upgrade anonymous user
          if (currentUser && currentUser.isAnonymous) {
            // Upgrade anonymous user with email/password
            const credential = EmailAuthProvider.credential(email, password);
            const result = await linkWithCredential(currentUser, credential);
            
            // Force refresh the user data and token to get the updated email
            await result.user.reload();
            await result.user.getIdToken(true); // Force token refresh
            
            // Force auth context to refresh with updated user data
            forceRefresh();
          } else {
            // No anonymous user - create new account
            await createUserWithEmailAndPassword(auth, email, password);
          }
        } else {
          // Other sign-in errors (wrong password, etc.)
          throw signInErr;
        }
      }
    } catch (err: any) {
      setError(`Authentication failed: ${err.message}`);
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError("")
    
    try {
      const currentUser = auth.currentUser;
      
      // If user is anonymous, always try to upgrade/link first (regardless of tab)
      if (currentUser && currentUser.isAnonymous) {
        // Try to link (upgrade anonymous user, preserves data)
        try {
          const provider = new GoogleAuthProvider();
          const result = await linkWithPopup(currentUser, provider);
          
          // Success! Anonymous user upgraded, data preserved
          await result.user.reload();
          await result.user.getIdToken(true); // Force token refresh
          forceRefresh();
          return;
        } catch (linkError: any) {
          if (linkError.code === 'auth/credential-already-in-use' || 
              linkError.code === 'auth/account-exists-with-different-credential') {
            // Google account already exists - show prompt for user to confirm
            setShowExistingAccountPrompt(true);
            console.log('Google account exists, showing user prompt');
            return;
          } else {
            // Other linking errors
            setError("Failed to link Google account.");
            console.error('Google link error:', linkError);
            return;
          }
        }
      } else {
        // Non-anonymous users: Regular sign-in
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err: any) {
      setError("Failed to sign in with Google.");
      console.error('Google auth error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSignIntoExistingAccount = async () => {
    setIsLoading(true)
    setError("")
    setShowExistingAccountPrompt(false)
    
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError("Failed to sign in with Google.");
      console.error('Google auth error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-[450px]">
      <CardHeader>
        <CardTitle>Authentication</CardTitle>
        <CardDescription>Choose how you'd like to access your account.</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="register" className="flex items-center gap-2 text-base">
              <UserPlus className="w-4 h-4" />
              Register
            </TabsTrigger>
            <TabsTrigger value="signin" className="flex items-center gap-2 text-base">
              <LogIn className="w-4 h-4" />
              Sign In
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <TabsContent value="register" className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  {user?.isAnonymous ? "Upgrade your account to save your progress" : "Create a new account"}
                </p>
              </div>
              
              <Button 
                type="button" 
                variant="outline" 
                className="w-full bg-white hover:bg-gray-50 text-gray-900 hover:text-gray-900 dark:bg-white dark:hover:bg-gray-50 dark:text-gray-900 dark:hover:text-gray-900 flex gap-2 items-center justify-center"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    Create account with Google
                  </>
                )}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or with email</span>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <Input
                    id="email"
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Input
                    id="password"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signin" className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Sign in to your existing account
                </p>
              </div>
              
              <Button 
                type="button" 
                variant="outline" 
                className="w-full bg-white hover:bg-gray-50 text-gray-900 hover:text-gray-900 dark:bg-white dark:hover:bg-gray-50 dark:text-gray-900 dark:hover:text-gray-900 flex gap-2 items-center justify-center"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    Sign in with Google
                  </>
                )}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or with email</span>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <Input
                    id="signin-email"
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Input
                    id="signin-password"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </TabsContent>
          </div>
        </Tabs>
        
        {/* Error Display */}
        {error && (
          <div className="p-3 border rounded-lg bg-red-50 border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        
        {/* Existing Account Prompt */}
        {showExistingAccountPrompt && (
          <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Existing Google Account Detected</h4>
            <p className="text-sm text-blue-800 mb-3">
              This Google account already exists. Signing in will switch to your existing account 
              (your current session will be lost).
            </p>
            <div className="flex gap-2">
              <Button 
                type="button"
                size="sm"
                onClick={handleSignIntoExistingAccount}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign into existing account"
                )}
              </Button>
              <Button 
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowExistingAccountPrompt(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
