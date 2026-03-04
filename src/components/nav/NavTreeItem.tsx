import { Box, CircularProgress, Typography } from '@mui/material'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial'
import FolderIcon from '@mui/icons-material/Folder'
import DesignServicesIcon from '@mui/icons-material/DesignServices'
import ArticleIcon from '@mui/icons-material/Article'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { NavNodeType } from '../../types/nav.types'

function NodeIcon({ type }: { type: NavNodeType }) {
  const sx = { fontSize: 16 }
  switch (type) {
    case 'hub':
      return <AccountTreeIcon sx={{ ...sx, color: 'primary.main' }} />
    case 'project':
      return <FolderSpecialIcon sx={{ ...sx, color: 'warning.main' }} />
    case 'folder':
      return <FolderIcon sx={{ ...sx, color: 'info.main' }} />
    case 'item':
      return <DesignServicesIcon sx={{ ...sx, color: 'text.secondary' }} />
    case 'load-more':
      return <MoreHorizIcon sx={{ ...sx, color: 'text.secondary' }} />
    default:
      return <ArticleIcon sx={{ ...sx }} />
  }
}

interface NavTreeItemProps {
  itemId: string
  label: string
  nodeType: NavNodeType
  isLoading?: boolean
  children?: React.ReactNode
}

export function NavTreeItem({
  itemId,
  label,
  nodeType,
  isLoading,
  children,
}: NavTreeItemProps) {
  const itemLabel = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}>
      {isLoading ? (
        <CircularProgress size={14} thickness={4} />
      ) : (
        <NodeIcon type={nodeType} />
      )}
      <Typography
        variant="body2"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 200,
          ...(nodeType === 'load-more' && {
            color: 'text.secondary',
            fontStyle: 'italic',
          }),
        }}
      >
        {label}
      </Typography>
    </Box>
  )

  return (
    <TreeItem itemId={itemId} label={itemLabel}>
      {children}
    </TreeItem>
  )
}
