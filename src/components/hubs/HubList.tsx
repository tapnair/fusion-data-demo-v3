/**
 * Hub List Component
 * Displays a grid of hub cards
 */

import { Typography, Box } from '@mui/material'
import FolderOffIcon from '@mui/icons-material/FolderOff'
import { HubCard } from './HubCard'
import type { Hub } from '../../types/hub.types'

interface HubListProps {
  hubs: Hub[]
}

export function HubList({ hubs }: HubListProps) {
  if (hubs.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          color: 'text.secondary',
        }}
      >
        <FolderOffIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
        <Typography variant="h6" gutterBottom>
          No hubs available
        </Typography>
        <Typography variant="body2">
          Please check your Autodesk account permissions
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
        },
        gap: 3,
      }}
    >
      {hubs.map((hub) => (
        <HubCard key={hub.id} hub={hub} />
      ))}
    </Box>
  )
}
