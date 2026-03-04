/**
 * Logout Button Component
 * Logs out user and clears session using MUI
 */

import { Button } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuth } from '../../context/AuthContext'

export function LogoutButton() {
  const { logout } = useAuth()

  return (
    <Button
      color="inherit"
      onClick={logout}
      startIcon={<LogoutIcon />}
      sx={{ border: '1px solid rgba(255,255,255,0.3)' }}
    >
      Logout
    </Button>
  )
}
