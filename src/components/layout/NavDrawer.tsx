import { Box, Drawer, Typography, Divider, useTheme } from '@mui/material'
import { NavTree } from '../nav/NavTree'

const DRAWER_WIDTH = 300

interface NavDrawerProps {
  open: boolean
  filterV2Hubs: boolean
}

export function NavDrawer({ open, filterV2Hubs }: NavDrawerProps) {
  const theme = useTheme()

  return (
    <Drawer
      variant="permanent"
      open={open}
      sx={{
        width: open ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? DRAWER_WIDTH : 0,
          boxSizing: 'border-box',
          position: 'relative',
          height: '100%',
          overflow: open ? 'auto' : 'hidden',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: open
              ? theme.transitions.duration.enteringScreen
              : theme.transitions.duration.leavingScreen,
          }),
          borderRight: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
        },
      }}
    >
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', minHeight: 48 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          Navigation
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ overflow: 'auto', flex: 1 }}>
        <NavTree filterV2Hubs={filterV2Hubs} />
      </Box>
    </Drawer>
  )
}
