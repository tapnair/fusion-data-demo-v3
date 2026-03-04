import { useState } from 'react'
import { Box, Snackbar, Alert } from '@mui/material'
import { Header } from './Header'
import { NavDrawer } from './NavDrawer'
import type { WeaveColorScheme, WeaveDensity } from '../../theme/types'

const DRAWER_STORAGE_KEY = 'nav-drawer-open'
const FILTER_V2_STORAGE_KEY = 'nav-filter-v2-hubs'

interface AppShellProps {
  colorScheme: WeaveColorScheme
  density: WeaveDensity
  onColorSchemeChange: (s: WeaveColorScheme) => void
  onDensityChange: (d: WeaveDensity) => void
  children: React.ReactNode
}

export function AppShell({ colorScheme, density, onColorSchemeChange, onDensityChange, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem(DRAWER_STORAGE_KEY)
    return stored !== null ? stored === 'true' : true  // default open
  })

  const [filterV2Hubs, setFilterV2Hubs] = useState<boolean>(() => {
    const stored = localStorage.getItem(FILTER_V2_STORAGE_KEY)
    return stored !== null ? stored === 'true' : true
  })

  const [showNonCeWarning, setShowNonCeWarning] = useState(false)

  const handleDrawerToggle = () => {
    setDrawerOpen(prev => {
      const next = !prev
      localStorage.setItem(DRAWER_STORAGE_KEY, String(next))
      return next
    })
  }

  const handleFilterV2HubsChange = (value: boolean) => {
    setFilterV2Hubs(value)
    localStorage.setItem(FILTER_V2_STORAGE_KEY, String(value))
    if (!value) setShowNonCeWarning(true)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header
        colorScheme={colorScheme}
        density={density}
        onColorSchemeChange={onColorSchemeChange}
        onDensityChange={onDensityChange}
        onDrawerToggle={handleDrawerToggle}
        filterV2Hubs={filterV2Hubs}
        onFilterV2HubsChange={handleFilterV2HubsChange}
      />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NavDrawer open={drawerOpen} filterV2Hubs={filterV2Hubs} />
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </Box>
      </Box>
      <Snackbar
        open={showNonCeWarning}
        autoHideDuration={6000}
        onClose={() => setShowNonCeWarning(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          onClose={() => setShowNonCeWarning(false)}
          sx={{ width: '100%' }}
        >
          Non-CE Hubs will not behave correctly in this application
        </Alert>
      </Snackbar>
    </Box>
  )
}
