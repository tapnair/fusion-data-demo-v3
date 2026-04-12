/**
 * Protected Route Component
 * Redirects to home if not authenticated
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-spinner">
        <p>Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    const dest = window.location.pathname + window.location.search
    if (dest && dest !== '/') {
      sessionStorage.setItem('post-auth-redirect', dest)
    }
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
