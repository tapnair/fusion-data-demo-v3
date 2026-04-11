/**
 * Mock AuthProvider for use in tests.
 * Provides the real AuthContext with controllable default values so
 * components that call useAuth() work without a real OAuth flow.
 */
import { ReactNode } from 'react'
import { AuthContext } from '../context/AuthContext'
import type { AuthContextType } from '../context/AuthContext'

export const defaultMockAuthValues: AuthContextType = {
  isAuthenticated: true,
  accessToken: 'mock-access-token',
  user: { id: 'test-user', name: 'Test User' },
  loading: false,
  error: null,
  login: async () => {},
  logout: async () => {},
  getAccessToken: async () => 'mock-access-token',
  setError: () => {},
  setPersistor: () => {},
}

interface MockAuthProviderProps {
  children: ReactNode
  overrides?: Partial<AuthContextType>
}

export function MockAuthProvider({ children, overrides }: MockAuthProviderProps) {
  const value: AuthContextType = { ...defaultMockAuthValues, ...overrides }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
