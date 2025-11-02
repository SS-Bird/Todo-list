import { type FormEvent, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { getSignInMethods } from '../services/auth';
import { Navigate, useNavigate } from 'react-router-dom';

/**
 * Sign in/sign up page component.
 * Provides a unified form for both authentication modes with helpful error messages.
 * Automatically redirects authenticated users to the main app.
 */
export default function SignIn() {
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [suggestSignUp, setSuggestSignUp] = useState(false); // Suggest signup if user not found

  /** Handle form submission for both sign in and sign up */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuggestSignUp(false);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      navigate('/'); // Navigate to app on success
    } catch (err: any) {
      const code = err?.code as string | undefined;
      // Handle specific Firebase auth error codes with user-friendly messages
      if (mode === 'signin') {
        if (code === 'auth/user-not-found') {
          setError('No account found for this email. You may need to sign up.');
          setSuggestSignUp(true);
          return;
        }
        // Check if account exists to provide better error message
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
          try {
            const methods = await getSignInMethods(email);
            if (!methods || methods.length === 0) {
              setError('No account found for this email. You may need to sign up.');
              setSuggestSignUp(true);
            } else {
              setError('Incorrect email or password.');
            }
          } catch {
            setError('Authentication failed');
          }
          return;
        }
      }
      // Fallback error handling
      if (typeof err?.message === 'string') {
        setError(err.message);
      } else {
        setError('Authentication failed');
      }
    }
  }

  // Redirect to app if already authenticated
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0b1220' }}>
      <div style={{ width: 360, padding: 24, border: '1px solid #1f2937', borderRadius: 8, background: '#0f172a' }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <form onSubmit={onSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label>
              <div style={{ marginBottom: 6 }}>Email</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 10px' }}
                required
              />
            </label>
            <label>
              <div style={{ marginBottom: 6 }}>Password</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '8px 10px' }}
                required
              />
            </label>
            {error ? <div style={{ color: '#ef4444' }}>{error}</div> : null}
            {suggestSignUp && mode === 'signin' ? (
              <button type="button" onClick={() => setMode('signup')}>
                Create an account with this email
              </button>
            ) : null}
            <button type="submit" disabled={loading}>
              {mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
            <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
              {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


