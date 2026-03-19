import { useRef, useEffect } from 'react'
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
  const { selection } = useViewerSelection(viewerRef, viewerInitialized)

  // Resize the WebGL canvas after the panel slide transition completes
  useEffect(() => {
    const timer = setTimeout(() => {
      viewerRef.current?.resize()
    }, 320)
    return () => clearTimeout(timer)
  }, [selection, viewerRef])

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

      {/* Sliding properties panel wrapper */}
      <Box
        sx={{
          width: selection ? 320 : 0,
          overflow: 'hidden',
          transition: 'width 300ms ease',
          flexShrink: 0,
        }}
      >
        <ViewerPropertiesPanel
          selection={selection}
          onClose={() => viewerRef.current?.clearSelection()}
        />
      </Box>
    </Box>
  )
}
