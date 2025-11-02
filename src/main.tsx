import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider.tsx'
import SignIn from './pages/SignIn.tsx'
import RequireAuth from './routes/RequireAuth.tsx'

/**
 * Application entry point.
 * Sets up React, routing, and authentication context.
 * 
 * Routing structure:
 * - /signin: Sign in/sign up page (public)
 * - /: Main app (protected, requires authentication)
 * - *: Catch-all redirects to home
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Provide authentication context to entire app */}
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          {/* Protect main app route with RequireAuth */}
          <Route path="/" element={<RequireAuth><App /></RequireAuth>} />
          {/* Redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
