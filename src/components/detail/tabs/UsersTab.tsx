import { Box, Typography } from '@mui/material'

export function UsersTab() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2, pt: 8 }}>
      <Typography variant="h6">Users</Typography>
      <Typography variant="body2" color="text.secondary">Coming soon</Typography>
    </Box>
  )
}
