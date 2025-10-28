import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider } from "@/components/theme-provider";
import { LoginForm } from '@/components/login-form';
import { Navbar } from '@/components/navbar';
import { AppSidebar } from '@/components/appSidebar';
import { Home } from '@/pages/Home';
import { Settings } from '@/pages/Settings';
import { Page1 } from '@/pages/Page1';
import { Page2 } from '@/pages/Page2';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";

function AppContent() {
  const { user, loading, profileLoading } = useAuth();
  const [showLoginForAnonymous, setShowLoginForAnonymous] = useState(false);

  // Reset login form state when user upgrades from anonymous to authenticated
  useEffect(() => {
    if (user && !user.isAnonymous) {
      setShowLoginForAnonymous(false);
    }
  }, [user?.isAnonymous]);

  // Show loading while authentication or profile is loading
  if (loading || profileLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  // Determine if login form should be shown
  const allowAnonymous = import.meta.env.VITE_ALLOW_ANONYMOUS_USERS !== 'false';
  
  let shouldShowLogin: boolean;
  if (allowAnonymous) {
    // Anonymous users are allowed - only show login if there's no user at all
    // OR if anonymous user clicked "Sign In" to upgrade
    shouldShowLogin = !user || (user.isAnonymous && showLoginForAnonymous);
  } else {
    // Anonymous users NOT allowed - show login if no user OR if user is anonymous
    // (force authentication with real credentials)
    shouldShowLogin = !user || user.isAnonymous;
  }

  const handleSignInClick = () => {
    setShowLoginForAnonymous(true);
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col w-full min-h-screen bg-background">
        <Navbar onSignInClick={handleSignInClick} />
        {shouldShowLogin ? (
          <main className="flex flex-col items-center justify-center flex-1 p-4">
            <LoginForm />
          </main>
        ) : (
          <div className="flex flex-1">
            <AppSidebar />
            <SidebarInset className="flex-1">
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/page1" element={<Page1 />} />
                  <Route path="/page2" element={<Page2 />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
            </SidebarInset>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="system" 
        enableSystem
        disableTransitionOnChange
        storageKey="volo-app-theme"
      >
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
