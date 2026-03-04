/**
 * Login Button Component
 * Initiates PKCE OAuth flow with Autodesk APS using MUI
 */

import { Button, Alert } from '@mui/material'
import LoginIcon from '@mui/icons-material/Login'
import { useAuth } from '../../context/AuthContext'

interface LoginButtonProps {
  variant?: 'text' | 'outlined' | 'contained'
  size?: 'small' | 'medium' | 'large'
}

export function LoginButton({
  variant = 'contained',
  size = 'large',
}: LoginButtonProps) {
  const { login, loading, error } = useAuth()

  const handleLogin = async () => {
    try {
      await login()
    } catch (error) {
      console.error('Login error:', error)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleLogin}
        disabled={loading}
        startIcon={<LoginIcon />}
      >
        {loading ? 'Redirecting...' : 'Login with Autodesk'}
      </Button>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error.message}
        </Alert>
      )}
    </>
  )
}
