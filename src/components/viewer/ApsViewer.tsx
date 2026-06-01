import { useRef } from 'react'
import { Box, Backdrop, CircularProgress, Typography } from '@mui/material'
import { useApsViewer } from '../../hooks/useApsViewer'
import { useViewerSelection } from '../../hooks/useViewerSelection'
import { ViewerPropertiesPanel } from './ViewerPropertiesPanel'

interface ApsViewerProps {
  encodedUrn: string
  isReady: boolean
  getAccessToken: () => Promise<string>
}

export function ApsViewer({ encodedUrn, isReady, getAccessToken }: ApsViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { viewerLoaded, viewerError, viewerRef, viewerInitialized } =
    useApsViewer(containerRef, encodedUrn, isReady, getAccessToken)
  const { selection, rootSelection, selectByDbId } = useViewerSelection(viewerRef, viewerInitialized)

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Viewer canvas */}
      <Box
        ref={containerRef}
        sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}
      >
        <Backdrop
          open={!viewerLoaded && !viewerError}
          sx={{
            position: 'absolute',
            color: 'text.primary',
            bgcolor: 'background.paper',
            zIndex: 1,
          }}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
        {viewerError && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="body2" color="error">{viewerError}</Typography>
          </Box>
        )}
      </Box>

      {/* Always-visible properties panel wrapper */}
      <Box
        sx={{
          width: 380,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <ViewerPropertiesPanel
          selection={selection}
          rootSelection={rootSelection}
          onClose={() => viewerRef.current?.clearSelection()}
          onSelectDbId={selectByDbId}
        />
      </Box>
    </Box>
  )
}
