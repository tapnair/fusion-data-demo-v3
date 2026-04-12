/**
 * Auth Callback Component
 * Handles OAuth callback from Autodesk using MUI
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Box, Alert, AlertTitle } from '@mui/material'
import { authService } from '../../context/AuthContext'
import { TokenManager } from '../../services/auth/tokenManager'
import { LoadingSpinner } from '../common/LoadingSpinner'

export function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const callbackUrl = window.location.href
        const tokenResponse = await authService.handleCallback(callbackUrl)
        TokenManager.setToken(tokenResponse)

        if ((window as any).__handleAuthSuccess) {
          (window as any).__handleAuthSuccess(tokenResponse.access_token)
        }

        const redirect = sessionStorage.getItem('post-auth-redirect')
        sessionStorage.removeItem('post-auth-redirect')
        // Use a hard redirect so the app re-initialises with the token already in
        // localStorage. This avoids a React state timing race where ProtectedRoute
        // still sees isAuthenticated=false in the render that follows navigate().
        const base = import.meta.env.BASE_URL // '/fusion-data-demo-v3/' in prod, '/' in dev
        window.location.replace(window.location.origin + (redirect || `${base}dashboard`))
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Authentication failed'
        setError(errorMessage)
        console.error('Callback error:', err)

        setTimeout(() => navigate('/', { replace: true }), 3000)
      }
    }

    handleCallback()
  }, [navigate])

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error">
          <AlertTitle>Authentication Error</AlertTitle>
          {error}
          <Box sx={{ mt: 1 }}>Redirecting to home...</Box>
        </Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <LoadingSpinner message="Processing authentication..." />
    </Container>
  )
}
