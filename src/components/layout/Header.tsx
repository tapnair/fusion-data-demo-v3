/**
 * Header Component
 * Main navigation header with authentication status and theme switcher
 */

import { useState } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  IconButton,
  Menu,
  MenuItem,
  ListItemText,
  Divider,
  Switch,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import DashboardIcon from '@mui/icons-material/Dashboard'
import BugReportIcon from '@mui/icons-material/BugReport'
import SettingsIcon from '@mui/icons-material/Settings'
import CheckIcon from '@mui/icons-material/Check'
import MenuIcon from '@mui/icons-material/Menu'
import { useAuth } from '../../context/AuthContext'
import { LogoutButton } from '../auth/LogoutButton'
import type { WeaveColorScheme, WeaveDensity } from '../../theme/types'

interface HeaderProps {
  colorScheme?: WeaveColorScheme
  density?: WeaveDensity
  onColorSchemeChange?: (scheme: WeaveColorScheme) => void
  onDensityChange?: (density: WeaveDensity) => void
  onDrawerToggle?: () => void
  filterV2Hubs?: boolean
  onFilterV2HubsChange?: (value: boolean) => void
}

export function Header({
  colorScheme = 'light-gray',
  density = 'medium',
  onColorSchemeChange,
  onDensityChange,
  onDrawerToggle,
  filterV2Hubs = false,
  onFilterV2HubsChange,
}: HeaderProps) {
  const { isAuthenticated } = useAuth()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleColorSchemeChange = (scheme: WeaveColorScheme) => {
    onColorSchemeChange?.(scheme)
    handleMenuClose()
  }

  const handleDensityChange = (densityValue: WeaveDensity) => {
    onDensityChange?.(densityValue)
    handleMenuClose()
  }

  const showThemeSwitcher = onColorSchemeChange && onDensityChange

  return (
    <AppBar position="static" elevation={2}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {onDrawerToggle && isAuthenticated && (
            <IconButton
              color="inherit"
              aria-label="toggle navigation"
              onClick={onDrawerToggle}
              edge="start"
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Typography
              variant="h6"
              component={RouterLink}
              to="/"
              sx={{
                textDecoration: 'none',
                color: 'inherit',
                fontWeight: 600,
                mr: 4,
              }}
            >
              Fusion Data Demo
            </Typography>

            {isAuthenticated && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/dashboard"
                  startIcon={<DashboardIcon />}
                >
                  Dashboard
                </Button>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/debug"
                  startIcon={<BugReportIcon />}
                >
                  Debug
                </Button>
              </Box>
            )}
          </Box>

          {isAuthenticated && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {showThemeSwitcher && (
                <>
                  <IconButton
                    color="inherit"
                    onClick={handleMenuOpen}
                    aria-label="theme settings"
                  >
                    <SettingsIcon />
                  </IconButton>
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <MenuItem disabled>
                      <ListItemText
                        primary="Color Scheme"
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                      />
                    </MenuItem>
                    <MenuItem onClick={() => handleColorSchemeChange('light-gray')}>
                      <Box sx={{ width: 24, mr: 1 }}>
                        {colorScheme === 'light-gray' && <CheckIcon fontSize="small" />}
                      </Box>
                      <ListItemText primary="Light Gray" />
                    </MenuItem>
                    <MenuItem onClick={() => handleColorSchemeChange('dark-gray')}>
                      <Box sx={{ width: 24, mr: 1 }}>
                        {colorScheme === 'dark-gray' && <CheckIcon fontSize="small" />}
                      </Box>
                      <ListItemText primary="Dark Gray" />
                    </MenuItem>
                    <MenuItem onClick={() => handleColorSchemeChange('dark-blue')}>
                      <Box sx={{ width: 24, mr: 1 }}>
                        {colorScheme === 'dark-blue' && <CheckIcon fontSize="small" />}
                      </Box>
                      <ListItemText primary="Dark Blue" />
                    </MenuItem>

                    <Divider sx={{ my: 1 }} />

                    <MenuItem disabled>
                      <ListItemText
                        primary="Density"
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                      />
                    </MenuItem>
                    <MenuItem onClick={() => handleDensityChange('high')}>
                      <Box sx={{ width: 24, mr: 1 }}>
                        {density === 'high' && <CheckIcon fontSize="small" />}
                      </Box>
                      <ListItemText primary="High (Compact)" />
                    </MenuItem>
                    <MenuItem onClick={() => handleDensityChange('medium')}>
                      <Box sx={{ width: 24, mr: 1 }}>
                        {density === 'medium' && <CheckIcon fontSize="small" />}
                      </Box>
                      <ListItemText primary="Medium" />
                    </MenuItem>
                    <MenuItem onClick={() => handleDensityChange('low')}>
                      <Box sx={{ width: 24, mr: 1 }}>
                        {density === 'low' && <CheckIcon fontSize="small" />}
                      </Box>
                      <ListItemText primary="Low (Comfortable)" />
                    </MenuItem>

                    <Divider sx={{ my: 1 }} />

                    <MenuItem disabled>
                      <ListItemText
                        primary="Filters"
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                      />
                    </MenuItem>
                    <MenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onFilterV2HubsChange?.(!filterV2Hubs)
                      }}
                    >
                      <ListItemText primary="CE Hubs Only" />
                      <Switch
                        checked={filterV2Hubs}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onFilterV2HubsChange?.(e.target.checked)}
                      />
                    </MenuItem>
                  </Menu>
                </>
              )}
              <LogoutButton />
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  )
}
