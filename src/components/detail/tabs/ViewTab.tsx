import { Box, CircularProgress, Typography, Button } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useAuth } from '../../../context/AuthContext'
import { useViewerTranslation } from '../../../hooks/useViewerTranslation'
import { ApsViewer } from '../../viewer/ApsViewer'
import type { NavNode } from '../../../types/nav.types'

interface ViewTabProps {
  node: NavNode
}

export function ViewTab({ node }: ViewTabProps) {
  const { getAccessToken } = useAuth()
  const { status, progress, error, encodedUrn, retry } = useViewerTranslation(
    node.entityId,
    node.dmProjectId ?? null
  )

  if (status === 'idle' || status === 'submitting') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">Starting translation job…</Typography>
      </Box>
    )
  }

  if (status === 'polling') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          Generating viewable{progress ? `… ${progress}` : '…'}
        </Typography>
      </Box>
    )
  }

  if (status === 'failed') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
        <ErrorOutlineIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
        <Typography variant="body2" color="text.secondary">
          {error ?? 'Translation failed'}
        </Typography>
        <Button variant="outlined" size="small" onClick={retry}>
          Retry
        </Button>
      </Box>
    )
  }

  // status === 'ready'
  return (
    <ApsViewer
      encodedUrn={encodedUrn!}
      isReady={status === 'ready'}
      getAccessToken={getAccessToken}
    />
  )
}
