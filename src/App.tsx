/**
 * Main App Component
 * Sets up routing, authentication, and Weave 3 theming with localStorage persistence
 */

import { useState, useEffect, useMemo } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { ApolloProvider } from '@apollo/client/react'
import type { NormalizedCacheObject } from '@apollo/client/core'
import { CachePersistor, LocalStorageWrapper } from 'apollo3-cache-persist'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { createWeaveTheme } from './theme/createWeaveTheme'
import type { WeaveColorScheme, WeaveDensity } from './theme/types'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NavProvider } from './context/NavContext'
import { QueryLogProvider } from './context/QueryLogContext'
import { useQueryLog } from './context/QueryLogContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { DetailPanel } from './components/detail/DetailPanel'
import { createApolloClient, createCache } from './apollo/client'
import { CACHE_SCHEMA_VERSION, CACHE_SCHEMA_VERSION_KEY } from './apollo/cacheVersion'
import { evictStaleEntries, THUMBNAIL_CACHE_TTL_MS } from './services/thumbnailImageCache'
import Home from './pages/Home'
import Callback from './pages/Callback'
import DebugPage from './pages/DebugPage'
import GraphiQLPage from './pages/GraphiQLPage'
import QueryLogPage from './pages/QueryLogPage'
import './theme/fonts.css'

/** Wraps children with ApolloProvider, creating the client after restoring the persisted cache. */
function ApolloWrapper({ children }: { children: React.ReactNode }) {
  const { getAccessToken, setPersistor } = useAuth()
  const { addEntry } = useQueryLog()
  const [apolloClient, setApolloClient] = useState<ReturnType<typeof createApolloClient> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const cache = createCache()

      const persistor = new CachePersistor<NormalizedCacheObject>({
        cache,
        storage: new LocalStorageWrapper(window.localStorage),
        key: 'fusion-demo-apollo-cache',
        maxSize: 5242880, // 5 MB
        debounce: 1000,
        persistenceMapper: async (data: string) => {
          const parsed = JSON.parse(data)
          // Exclude Thumbnail objects — their signed URLs expire.
          // Thumbnail image caching is handled by a separate IndexedDB plan.
          const filtered = Object.fromEntries(
            Object.entries(parsed).filter(([key]) => !key.startsWith('Thumbnail:'))
          )
          return JSON.stringify(filtered)
        },
      })

      // Restore persisted cache if schema version matches, otherwise purge stale data.
      const storedVersion = localStorage.getItem(CACHE_SCHEMA_VERSION_KEY)
      if (storedVersion === CACHE_SCHEMA_VERSION) {
        await persistor.restore()
      } else {
        await persistor.purge()
        localStorage.setItem(CACHE_SCHEMA_VERSION_KEY, CACHE_SCHEMA_VERSION)
      }

      if (cancelled) return

      // Give AuthContext a reference so logout can call persistor.purge().
      setPersistor(persistor)
      setApolloClient(createApolloClient(cache, getAccessToken, addEntry))
    }

    init().catch(console.error)
    return () => { cancelled = true }
  }, [getAccessToken, addEntry, setPersistor])

  if (!apolloClient) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
}

// localStorage keys for theme persistence
const THEME_STORAGE_KEY = 'weave-color-scheme'
const DENSITY_STORAGE_KEY = 'weave-density'

function App() {
  // Initialize theme from localStorage or use defaults
  const [colorScheme, setColorScheme] = useState<WeaveColorScheme>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return (stored as WeaveColorScheme) || 'light-gray'
  })

  const [density, setDensity] = useState<WeaveDensity>(() => {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY)
    return (stored as WeaveDensity) || 'medium'
  })

  // Persist theme changes to localStorage
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, colorScheme)
  }, [colorScheme])

  useEffect(() => {
    localStorage.setItem(DENSITY_STORAGE_KEY, density)
  }, [density])

  // Purge thumbnail blobs older than 7 days from IndexedDB on each session start
  useEffect(() => {
    evictStaleEntries(THUMBNAIL_CACHE_TTL_MS).catch(console.error)
  }, [])

  // Create theme based on current scheme and density
  const theme = useMemo(
    () => createWeaveTheme({ colorScheme, density }),
    [colorScheme, density]
  )

  return (
    <StyledEngineProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <QueryLogProvider>
            <ApolloWrapper>
              <Router basename={import.meta.env.PROD ? '/fusion-data-demo-v3' : '/'}>
                <NavProvider>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/callback" element={<Callback />} />
                    <Route
                      path="/dashboard/*"
                      element={
                        <ProtectedRoute>
                          <AppShell
                            colorScheme={colorScheme}
                            density={density}
                            onColorSchemeChange={setColorScheme}
                            onDensityChange={setDensity}
                          >
                            <DetailPanel />
                          </AppShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/debug"
                      element={
                        <ProtectedRoute>
                          <DebugPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/query-editor"
                      element={
                        <ProtectedRoute>
                          <AppShell
                            colorScheme={colorScheme}
                            density={density}
                            onColorSchemeChange={setColorScheme}
                            onDensityChange={setDensity}
                            contentSx={{ p: 0, overflow: 'hidden' }}
                          >
                            <GraphiQLPage />
                          </AppShell>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/query-log"
                      element={
                        <ProtectedRoute>
                          <AppShell
                            colorScheme={colorScheme}
                            density={density}
                            onColorSchemeChange={setColorScheme}
                            onDensityChange={setDensity}
                            hideDrawer
                            contentSx={{ p: 0, overflow: 'hidden' }}
                          >
                            <QueryLogPage />
                          </AppShell>
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </NavProvider>
              </Router>
            </ApolloWrapper>
          </QueryLogProvider>
        </AuthProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  )
}

export default App
