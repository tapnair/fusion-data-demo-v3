/**
 * Logout Button Component
 * Logs out user and clears session using MUI
 */

import { Button, Typography, Box } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuth } from '../../context/AuthContext'

export function LogoutButton() {
  const { logout, user } = useAuth()

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {user && (
        <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
          {user.name}
        </Typography>
      )}
      <Button
        color="inherit"
        onClick={logout}
        startIcon={<LogoutIcon />}
        sx={{ border: '1px solid rgba(255,255,255,0.3)' }}
      >
        Logout
      </Button>
    </Box>
  )
}
