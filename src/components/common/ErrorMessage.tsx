/**
 * Error Message Component
 * Displays error messages with optional retry action using MUI
 */

import { Box, Alert, AlertTitle, Button } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'

interface ErrorMessageProps {
  error: Error
  message?: string
  onRetry?: () => void
}

export function ErrorMessage({
  error,
  message = 'An error occurred',
  onRetry,
}: ErrorMessageProps) {
  return (
    <Box sx={{ my: 3 }}>
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry} startIcon={<RefreshIcon />}>
              Retry
            </Button>
          )
        }
      >
        <AlertTitle>{message}</AlertTitle>
        {error?.message || 'An unexpected error occurred'}
      </Alert>
    </Box>
  )
}
