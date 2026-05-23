import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth } from './firebase'
import type { UserSelect } from '@server/schema/zod'
import { getTRPCVanillaClient } from './trpc'

// Constants
const LOGOUT_RESET_DELAY_MS = 1000;

type UserProfile = UserSelect

type AuthContextType = {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  logout: () => void
  forceRefresh: () => void
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userProfile: null,
  loading: true,
  profileLoading: true,
  logout: () => {},
  forceRefresh: () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [isLoggedOut, setIsLoggedOut] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const fetchUserProfile = useCallback(async () => {
    try {
      setProfileLoading(true)
      const me = await getTRPCVanillaClient().user.me.query()
      setUserProfile(me)
    } catch (error) {
      const unauthorized =
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        (error as { data?: { code?: string } }).data?.code === 'UNAUTHORIZED'
      if (!unauthorized) {
        console.error('Failed to fetch user profile:', error)
      }
      setUserProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    // Create a flag to track if this effect is still active
    let isActive = true;

    setLoading(true);

    // onAuthStateChanged is synchronous and returns unsubscribe immediately,
    // so we capture it directly to avoid the race condition where cleanup
    // runs before .then() resolves.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // If this effect has been cleaned up, ignore the callback
      if (!isActive) {
        return;
      }
      
      setUser(user)
      setLoading(false)
      
      if (!user) {
        // Check if anonymous users are allowed (defaults to true if not set)
        const allowAnonymous = import.meta.env.VITE_ALLOW_ANONYMOUS_USERS !== 'false';
        
        // Create anonymous user if allowed (and not explicitly logged out)
        if (!isLoggedOut && allowAnonymous) {
          try {
            await signInAnonymously(auth);
          } catch (error) {
            console.error('Failed to create anonymous user:', error);
            if (isActive) {
              setUserProfile(null);
              setProfileLoading(false);
            }
          }
        } else {
          // Anonymous users not allowed or user logged out
          if (isActive) {
            setUserProfile(null);
            setProfileLoading(false);
          }
          
          // If logout occurred, reset state after delay
          if (isLoggedOut) {
            setTimeout(() => {
              if (isActive) {
                setIsLoggedOut(false);
              }
            }, LOGOUT_RESET_DELAY_MS);
          }
        }
      } else {
        // Reset logout state when user successfully logs in
        if (isActive) {
          setIsLoggedOut(false);
        }
        
        // Upsert and load server profile for any Firebase session (including anonymous).
        if (!isLoggedOut && isActive) {
          void fetchUserProfile();
        } else if (isActive) {
          setUserProfile(null);
          setProfileLoading(false);
        }
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [isLoggedOut, refreshTrigger, fetchUserProfile])

  const logout = () => {
    setIsLoggedOut(true);
  }

  const forceRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile,
      loading, 
      profileLoading,
      logout,
      forceRefresh
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
