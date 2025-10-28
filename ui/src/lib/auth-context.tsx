import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth } from './firebase'
import { getCurrentUser } from './serverComm'

// Constants
const LOGOUT_RESET_DELAY_MS = 1000;

// User profile from our backend
interface UserProfile {
  id: string
  email: string | null
  display_name: string | null
  photo_url: string | null
  created_at: string
  updated_at: string
}

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

  useEffect(() => {
    // Create a flag to track if this effect is still active
    let isActive = true;

    const initializeAuth = async () => {
      try {
        setLoading(true);

        // Set up Firebase auth listener
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
            
            // Fetch user profile for authenticated users (non-anonymous with email)
            if (!user.isAnonymous && user.email && !isLoggedOut && isActive) {
              fetchUserProfile();
            } else if (isActive) {
              setUserProfile(null);
              setProfileLoading(false);
            }
          }
        });

        // Store unsubscribe function for cleanup
        return unsubscribe;

      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isActive) {
          setLoading(false);
          setProfileLoading(false);
        }
      }
    };

    let unsubscribe: (() => void) | undefined;

    initializeAuth().then((unsub) => {
      if (unsub && isActive) {
        unsubscribe = unsub;
      }
    });

    return () => {
      isActive = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isLoggedOut, refreshTrigger])

  const logout = () => {
    setIsLoggedOut(true);
  }

  const forceRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  }

  const fetchUserProfile = useCallback(async () => {
    try {
      setProfileLoading(true)
      const response = await getCurrentUser()
      setUserProfile(response.user)
    } catch (error) {
      // Only log profile fetch errors if they're not authentication errors
      // (which can happen during logout when old listeners are still active)
      if (error instanceof Error && !error.message.includes('Authentication required')) {
        console.error('Failed to fetch user profile:', error)
      }
      setUserProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [])  // Empty dependencies since it only uses setState functions

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