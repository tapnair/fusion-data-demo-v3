/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { AuthService } from '../services/auth/authService'
import { TokenManager } from '../services/auth/tokenManager'
import { fetchUserInfo, UserInfoError } from '../services/auth/userInfoService'
import { User } from '../types/auth.types'
import type { CachePersistorLike } from '../apollo/cachePersistor'
import { clearThumbnailCache } from '../services/thumbnailImageCache'

export interface AuthContextType {
  isAuthenticated: boolean
  accessToken: string | null
  user: User | null
  loading: boolean
  error: Error | null
  login: () => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => Promise<string>
  setError: (error: Error | null) => void
  setPersistor: (p: CachePersistorLike) => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Create auth service instance with environment variables
const authService = new AuthService({
  clientId: import.meta.env.VITE_CLIENT_ID,
  authUrl: import.meta.env.VITE_AUTH_URL,
  tokenUrl: import.meta.env.VITE_TOKEN_URL,
  redirectUri: import.meta.env.VITE_REDIRECT_URI,
  scope: import.meta.env.VITE_SCOPE,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const persistorRef = useRef<CachePersistorLike | null>(null)

  const setPersistor = useCallback(
    (p: CachePersistorLike) => {
      persistorRef.current = p
    },
    []
  )

  // Check for existing valid token on mount
  useEffect(() => {
    ;(async () => {
      const token = TokenManager.getToken()
      if (token) {
        try {
          const userInfo = await fetchUserInfo(token)
          setAccessToken(token)
          setIsAuthenticated(true)
          setUser(userInfo)
        } catch (err) {
          if (err instanceof UserInfoError && err.status !== 401) {
            // The token itself is still valid — /userinfo just won't tell us who
            // the user is (e.g. 403 when the token lacks the `openid` scope).
            // Discarding the token here would bounce the user straight back to
            // login and loop forever, so stay authenticated with a placeholder.
            setAccessToken(token)
            setIsAuthenticated(true)
            setUser({ id: 'user', name: 'Autodesk User' })
          } else {
            // 401 (or a network failure): the token is stale. Clear it so the
            // user re-authenticates on next login.
            TokenManager.clearToken()
            // Leave isAuthenticated: false — ProtectedRoute redirects to home.
          }
        }
      }
      setLoading(false)
    })()
  }, [])

  /**
   * Initiate login flow
   */
  const login = async (): Promise<void> => {
    try {
      setError(null)
      await authService.login()
      // Note: login() redirects to Autodesk, so code after this won't execute
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Login failed')
      setError(error)
      throw error
    }
  }

  /**
   * Logout user
   */
  const logout = useCallback(async (): Promise<void> => {
    await Promise.all([
      persistorRef.current ? persistorRef.current.purge() : Promise.resolve(),
      clearThumbnailCache(),
    ])
    TokenManager.clearToken()
    setAccessToken(null)
    setIsAuthenticated(false)
    setUser(null)
    authService.logout()
  }, [])

  /**
   * Get current access token
   * Throws error if not authenticated
   */
  const getAccessToken = useCallback(async (): Promise<string> => {
    const token = TokenManager.getToken()

    if (!token) {
      throw new Error('No access token available. Please login.')
    }

    return token
  }, [])

  /**
   * Handle successful authentication (called from callback page)
   */
  const handleAuthSuccess = async (token: string) => {
    setAccessToken(token)
    setIsAuthenticated(true)
    setError(null)
    try {
      const userInfo = await fetchUserInfo(token)
      setUser(userInfo)
    } catch {
      setUser({ id: 'user', name: 'Autodesk User' })
    }
  }

  // Export handleAuthSuccess for use in callback
  ;(window as any).__handleAuthSuccess = handleAuthSuccess

  const value: AuthContextType = {
    isAuthenticated,
    accessToken,
    user,
    loading,
    error,
    login,
    logout,
    getAccessToken,
    setError,
    setPersistor,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Export auth service for use in callback page
 */
export { authService }
