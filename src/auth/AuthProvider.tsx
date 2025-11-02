import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { signInWithEmail, signOutUser, signUpWithEmail } from '../services/auth';

/**
 * Authentication context type.
 * Provides user state, loading state, and authentication methods.
 */
export type AuthContextValue = {
  user: User | null; // Current authenticated user (null if not signed in)
  loading: boolean; // Whether auth state is still being determined
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Authentication context provider.
 * Manages user authentication state and provides auth methods to child components.
 * Uses Firebase onAuthStateChanged for real-time auth state updates.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub(); // Cleanup subscription on unmount
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async signIn(email: string, password: string) {
      await signInWithEmail(email, password);
    },
    async signUp(email: string, password: string) {
      await signUpWithEmail(email, password);
    },
    async signOut() {
      await signOutUser();
    },
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context.
 * Throws error if used outside AuthProvider.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within <AuthProvider>');
  return ctx;
}


