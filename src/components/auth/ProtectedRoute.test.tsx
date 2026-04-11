/**
 * Tests for ProtectedRoute component.
 *
 * ProtectedRoute reads { isAuthenticated, loading } from useAuth() and:
 *   - loading === true  → renders a .loading-spinner div containing <p>Loading...</p>
 *   - !isAuthenticated  → renders <Navigate to="/" replace />
 *   - isAuthenticated   → renders children
 */

import { render, screen } from '@testing-library/react'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthContext } from '../../context/AuthContext'
import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Mock thumbnailImageCache so importing AuthContext doesn't trigger the
// IndexedDB initialisation (which jsdom doesn't support).
// ---------------------------------------------------------------------------
vi.mock('../../services/thumbnailImageCache', () => ({
  clearThumbnailCache: vi.fn(() => Promise.resolve()),
  getThumbnailBlob: vi.fn(() => Promise.resolve(null)),
  setThumbnailBlob: vi.fn(() => Promise.resolve()),
  evictStaleEntries: vi.fn(() => Promise.resolve()),
}))

// ---------------------------------------------------------------------------
// Mock react-router-dom so <Navigate> renders a detectable element instead of
// trying to do real routing (which requires a Router context).
// ---------------------------------------------------------------------------
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate" data-to={to} />
  ),
  useLocation: () => ({ pathname: '/' }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal AuthContext value with sensible defaults for every required field. */
function makeAuthValue(overrides: Partial<{
  isAuthenticated: boolean
  loading: boolean
}> = {}) {
  return {
    isAuthenticated: false,
    accessToken: null,
    user: null,
    loading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    getAccessToken: vi.fn(),
    setError: vi.fn(),
    setPersistor: vi.fn(),
    ...overrides,
  }
}

function renderWithAuth(
  node: ReactNode,
  authOverrides?: Parameters<typeof makeAuthValue>[0]
) {
  return render(
    <AuthContext.Provider value={makeAuthValue(authOverrides)}>
      {node}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProtectedRoute', () => {
  it('renders children when authenticated and not loading', () => {
    renderWithAuth(
      <ProtectedRoute>
        <div data-testid="child">Hello</div>
      </ProtectedRoute>,
      { isAuthenticated: true, loading: false }
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('renders <Navigate to="/"> when not authenticated and not loading', () => {
    renderWithAuth(
      <ProtectedRoute>
        <div data-testid="child">Hello</div>
      </ProtectedRoute>,
      { isAuthenticated: false, loading: false }
    )

    const nav = screen.getByTestId('navigate')
    expect(nav).toBeInTheDocument()
    expect(nav).toHaveAttribute('data-to', '/')
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })

  it('renders a loading indicator when loading is true (regardless of auth state)', () => {
    renderWithAuth(
      <ProtectedRoute>
        <div data-testid="child">Hello</div>
      </ProtectedRoute>,
      { isAuthenticated: false, loading: true }
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })

  it('still shows loading indicator even when isAuthenticated is true but loading', () => {
    renderWithAuth(
      <ProtectedRoute>
        <div data-testid="child">Hello</div>
      </ProtectedRoute>,
      { isAuthenticated: true, loading: true }
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })
})
