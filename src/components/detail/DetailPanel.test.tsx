/**
 * Tests for DetailPanel component — tab visibility per node type.
 *
 * Tab rules (from getAvailableTabs inside DetailPanel.tsx):
 *   hub     → Details, Users
 *   project → Details, Users, Contents
 *   folder  → Details, Users, Contents
 *   item / DesignItem  → Details, BOM, View  (after subtype resolved)
 *   item / DrawingItem → Details, View       (after subtype resolved)
 *
 * We mock every external dependency so we can render the component in
 * isolation and just assert on which <Tab> elements appear.
 */

import { render, screen, act } from '@testing-library/react'
import { DetailPanel } from './DetailPanel'
import { AuthContext } from '../../context/AuthContext'
import type { NavNode } from '../../types/nav.types'

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
// Mock heavy external dependencies
// ---------------------------------------------------------------------------

// NavContext hook — we control selectedNode per test via the mock below
const mockUseNavContext = vi.fn()
vi.mock('../../context/NavContext', () => ({
  useNavContext: () => mockUseNavContext(),
  NavProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Apollo hooks — used by sub-components (HubDetail, UsersTab, etc.)
vi.mock('@apollo/client/react', () => ({
  useQuery: vi.fn(() => ({ loading: false, error: undefined, data: null })),
  useLazyQuery: vi.fn(() => [vi.fn(), { loading: false, data: null }]),
  useMutation: vi.fn(() => [vi.fn(), { loading: false }]),
  useApolloClient: vi.fn(() => ({ query: vi.fn() })),
}))

// NavRouting hook — tries to call window.history APIs
vi.mock('../../hooks/useNavRouting', () => ({
  useNavRouting: vi.fn(),
  getInitialTabFromUrl: vi.fn(() => 'details'),
}))

// Deep link expansion — fires async navigation logic
vi.mock('../../hooks/useDeepLinkExpansion', () => ({
  useDeepLinkExpansion: vi.fn(),
}))

// Base property definitions — GraphQL query
vi.mock('../../hooks/useHubBasePropertyDefinitions', () => ({
  useHubBasePropertyDefinitions: vi.fn(() => ({ definitions: [], loading: false })),
}))

// Sub-components that would try to render real data.
// ItemDetail's mock accepts a configurable subtype so individual tests can
// trigger onTypeResolved at will.
vi.mock('./HubDetail', () => ({
  HubDetail: () => <div data-testid="hub-detail" />,
}))
vi.mock('./ProjectDetail', () => ({
  ProjectDetail: () => <div data-testid="project-detail" />,
}))
vi.mock('./FolderDetail', () => ({
  FolderDetail: () => <div data-testid="folder-detail" />,
}))

// resolveSubtypeWith controls whether the ItemDetail mock fires onTypeResolved.
// Tests that need BOM/View tabs set this before rendering, then reset to null
// in beforeEach.
let resolveSubtypeWith: string | null = null

vi.mock('./ItemDetail', () => ({
  // Calling onTypeResolved synchronously from render is intentional for tests:
  // React will batch the resulting setState and process it before paint, so
  // wrapping the render call in act() is sufficient to see the updated tabs.
  ItemDetail: ({ onTypeResolved }: { onTypeResolved: (t: string) => void }) => {
    if (resolveSubtypeWith) {
      // setTimeout(0) schedules after render so we avoid "setState in render"
      // warnings while still letting the effect settle inside act().
      Promise.resolve().then(() => onTypeResolved(resolveSubtypeWith!))
    }
    return <div data-testid="item-detail" />
  },
}))
vi.mock('./tabs/UsersTab', () => ({
  UsersTab: () => <div data-testid="users-tab" />,
}))
vi.mock('./tabs/ContentsTab', () => ({
  ContentsTab: () => <div data-testid="contents-tab" />,
}))
vi.mock('./tabs/bom/BomTab', () => ({
  BomTab: () => <div data-testid="bom-tab" />,
}))
vi.mock('./tabs/ViewTab', () => ({
  ViewTab: () => <div data-testid="view-tab" />,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuthValue(overrides = {}) {
  return {
    isAuthenticated: true,
    accessToken: 'token',
    user: { id: 'u1', name: 'Test User' },
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

function makeNavValue(selectedNode: NavNode | null) {
  return {
    selectedNode,
    setSelectedNode: vi.fn(),
    expandedItems: [],
    setExpandedItems: vi.fn(),
    nodeChildrenCache: new Map(),
    setNodeChildren: vi.fn(),
    loadingNodes: new Set<string>(),
    setNodeLoading: vi.fn(),
  }
}

function makeNode(type: NavNode['type'], overrides: Partial<NavNode> = {}): NavNode {
  return {
    id: `${type}:test-id`,
    label: `Test ${type}`,
    type,
    entityId: 'test-id',
    hubId: 'hub-1',
    hasChildren: false,
    isLoaded: true,
    ...overrides,
  }
}

function renderDetailPanel(selectedNode: NavNode | null) {
  mockUseNavContext.mockReturnValue(makeNavValue(selectedNode))
  return render(
    <AuthContext.Provider value={makeAuthValue()}>
      <DetailPanel />
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DetailPanel — tab visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveSubtypeWith = null // reset between tests
  })

  it('shows welcome message when no node is selected', () => {
    renderDetailPanel(null)
    expect(screen.getByText(/select a hub/i)).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  describe('hub node', () => {
    it('shows Details and Users tabs', () => {
      renderDetailPanel(makeNode('hub'))
      expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument()
    })

    it('does NOT show BOM or View tabs', () => {
      renderDetailPanel(makeNode('hub'))
      expect(screen.queryByRole('tab', { name: /bom/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /view/i })).not.toBeInTheDocument()
    })

    it('does NOT show Contents tab', () => {
      renderDetailPanel(makeNode('hub'))
      expect(screen.queryByRole('tab', { name: /contents/i })).not.toBeInTheDocument()
    })
  })

  describe('folder node', () => {
    it('shows Details, Users, and Contents tabs', () => {
      renderDetailPanel(makeNode('folder'))
      expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /contents/i })).toBeInTheDocument()
    })

    it('does NOT show BOM or View tabs', () => {
      renderDetailPanel(makeNode('folder'))
      expect(screen.queryByRole('tab', { name: /bom/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /view/i })).not.toBeInTheDocument()
    })
  })

  describe('item node — before subtype resolved', () => {
    it('shows only Details tab initially (subtype not yet resolved)', () => {
      renderDetailPanel(makeNode('item'))
      expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument()
      // BOM and View appear only after onTypeResolved fires
      expect(screen.queryByRole('tab', { name: /bom/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /view/i })).not.toBeInTheDocument()
    })

    it('does NOT show Users or Contents tabs for an item node', () => {
      renderDetailPanel(makeNode('item'))
      expect(screen.queryByRole('tab', { name: /users/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /contents/i })).not.toBeInTheDocument()
    })
  })

  describe('item node — DesignItem subtype resolved via ItemDetail mock', () => {
    it('shows BOM and View tabs when ItemDetail calls onTypeResolved("DesignItem")', async () => {
      // Tell the module-level ItemDetail mock to fire onTypeResolved('DesignItem')
      resolveSubtypeWith = 'DesignItem'

      await act(async () => {
        renderDetailPanel(makeNode('item'))
      })

      // After useEffect fires and state updates settle, BOM and View should appear
      expect(screen.getByRole('tab', { name: /bom/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /view/i })).toBeInTheDocument()
    })
  })

  describe('project node', () => {
    it('shows Details, Users, and Contents tabs', () => {
      renderDetailPanel(makeNode('project'))
      expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /users/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /contents/i })).toBeInTheDocument()
    })

    it('does NOT show BOM or View tabs', () => {
      renderDetailPanel(makeNode('project'))
      expect(screen.queryByRole('tab', { name: /bom/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /view/i })).not.toBeInTheDocument()
    })
  })
})
