import { useAuthContext } from './AuthProvider';

/**
 * Convenience hook for accessing authentication context.
 * Provides a simpler API than directly using useAuthContext.
 */
export function useAuth() {
  return useAuthContext();
}


