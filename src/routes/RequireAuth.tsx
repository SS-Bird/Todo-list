import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

/**
 * Route guard component that protects routes requiring authentication.
 * Shows loading state while auth is being determined, redirects to sign in if not authenticated.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading while determining auth state
  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading…</div>
      </div>
    );
  }

  // Redirect to sign in if not authenticated, preserving intended destination
  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // Render protected content if authenticated
  return <>{children}</>;
}


