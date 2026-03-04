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
  ListItemIcon,
  Divider,
  Switch,
  Avatar,
  ButtonBase,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import DashboardIcon from '@mui/icons-material/Dashboard'
import BugReportIcon from '@mui/icons-material/BugReport'
import SettingsIcon from '@mui/icons-material/Settings'
import CheckIcon from '@mui/icons-material/Check'
import MenuIcon from '@mui/icons-material/Menu'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuth } from '../../context/AuthContext'
import type { WeaveColorScheme, WeaveDensity } from '../../theme/types'
import type { User } from '../../types/auth.types'

function getInitials(user: User): string {
  if (user.givenName && user.familyName) {
    return `${user.givenName[0]}${user.familyName[0]}`.toUpperCase()
  }
  return user.name?.[0]?.toUpperCase() ?? '?'
}

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
  const { isAuthenticated, user, logout } = useAuth()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(null)

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
      <Container maxWidth={false} disableGutters sx={{ px: 4 }}>
        <Toolbar disableGutters>
          {/* Left: hamburger + nav buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
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
            {isAuthenticated && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  color="inherit"
                  component={RouterLink}
                  to="/dashboard"
                  startIcon={<DashboardIcon />}
                >
                  Home
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

          {/* Center: title */}
          <Typography
            component={RouterLink}
            to="/"
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              fontWeight: 700,
              fontSize: '1.375rem',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            Fusion Data Demo
          </Typography>

          {/* Right: settings + user */}
          {isAuthenticated && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'flex-end' }}>
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
                  </Menu>
                </>
              )}
              {user && (
                <>
                  <ButtonBase
                    onClick={(e) => setUserMenuAnchorEl(e.currentTarget)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, borderRadius: 1, px: 0.5, py: 0.25 }}
                    aria-label="user menu"
                  >
                    <Avatar
                      src={user.picture}
                      alt={user.name}
                      sx={{ width: 28, height: 28, fontSize: '0.75rem' }}
                    >
                      {getInitials(user)}
                    </Avatar>
                    <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
                      {user.name}
                    </Typography>
                  </ButtonBase>
                  <Menu
                    anchorEl={userMenuAnchorEl}
                    open={Boolean(userMenuAnchorEl)}
                    onClose={() => setUserMenuAnchorEl(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    {onFilterV2HubsChange && (
                      <MenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onFilterV2HubsChange(!filterV2Hubs)
                        }}
                      >
                        <ListItemText primary="CE Hubs Only" />
                        <Switch
                          checked={filterV2Hubs}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onFilterV2HubsChange(e.target.checked)}
                        />
                      </MenuItem>
                    )}
                    <Divider />
                    <MenuItem onClick={() => { setUserMenuAnchorEl(null); logout() }}>
                      <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                      <ListItemText primary="Logout" />
                    </MenuItem>
                  </Menu>
                </>
              )}
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  )
}
