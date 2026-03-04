/**
 * Main App Component
 * Sets up routing, authentication, and Weave 3 theming with localStorage persistence
 */

import { useState, useMemo, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { ApolloProvider } from '@apollo/client/react'
import { createWeaveTheme } from './theme/createWeaveTheme'
import type { WeaveColorScheme, WeaveDensity } from './theme/types'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NavProvider } from './context/NavContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { DetailPanel } from './components/detail/DetailPanel'
import { createApolloClient } from './apollo/client'
import Home from './pages/Home'
import Callback from './pages/Callback'
import DebugPage from './pages/DebugPage'
import './theme/fonts.css'

/** Wraps children with ApolloProvider, creating the client from AuthContext. */
function ApolloWrapper({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = useAuth()
  const apolloClient = useMemo(() => createApolloClient(getAccessToken), [getAccessToken])
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
          <ApolloWrapper>
          <Router basename={import.meta.env.PROD ? '/fusion-data-demo-v3' : '/'}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/callback" element={<Callback />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <NavProvider>
                      <AppShell
                        colorScheme={colorScheme}
                        density={density}
                        onColorSchemeChange={setColorScheme}
                        onDensityChange={setDensity}
                      >
                        <DetailPanel />
                      </AppShell>
                    </NavProvider>
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
            </Routes>
          </Router>
          </ApolloWrapper>
        </AuthProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  )
}

export default App
