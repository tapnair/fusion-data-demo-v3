import { Box, Typography } from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { useNavContext } from '../../context/NavContext'
import { HubDetail } from './HubDetail'
import { ProjectDetail } from './ProjectDetail'
import { FolderDetail } from './FolderDetail'
import { ItemDetail } from './ItemDetail'
import { useAuth } from '../../context/AuthContext'

export function DetailPanel() {
  const { selectedNode } = useNavContext()
  const { user } = useAuth()

  if (!selectedNode) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
          color: 'text.secondary',
        }}
      >
        <AccountTreeIcon sx={{ fontSize: 64, opacity: 0.3 }} />
        <Typography variant="h6" color="text.secondary">
          {user ? `Welcome, ${user.name}` : 'Welcome'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select a hub in the left panel to begin
        </Typography>
      </Box>
    )
  }

  switch (selectedNode.type) {
    case 'hub':
      return <HubDetail node={selectedNode} />
    case 'project':
      return <ProjectDetail node={selectedNode} />
    case 'folder':
      return <FolderDetail node={selectedNode} />
    case 'item':
      return <ItemDetail node={selectedNode} />
    default:
      return null
  }
}
