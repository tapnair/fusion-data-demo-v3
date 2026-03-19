import { useRef } from 'react'
import { Box, Backdrop, CircularProgress, Typography } from '@mui/material'
import { useApsViewer } from '../../hooks/useApsViewer'

interface ApsViewerProps {
  encodedUrn: string
  isReady: boolean
  getAccessToken: () => Promise<string>
}

export function ApsViewer({ encodedUrn, isReady, getAccessToken }: ApsViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { viewerLoaded, viewerError } = useApsViewer(containerRef, encodedUrn, isReady, getAccessToken)

  return (
    <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
      <Box
        ref={containerRef}
        sx={{ height: '100%', width: '100%' }}
      />
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
  )
}
