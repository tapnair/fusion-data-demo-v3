/**
 * Dashboard Page
 * Main dashboard that displays user hubs after authentication using MUI
 */

import {
  Container,
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import { useAuth } from '../context/AuthContext'
import { useHubs } from '../hooks/useHubs'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { ErrorMessage } from '../components/common/ErrorMessage'
import { HubList } from '../components/hubs/HubList'
import { Header } from '../components/layout/Header'
import type { WeaveColorScheme, WeaveDensity } from '../theme/types'

interface DashboardProps {
  colorScheme: WeaveColorScheme
  density: WeaveDensity
  onColorSchemeChange: (scheme: WeaveColorScheme) => void
  onDensityChange: (density: WeaveDensity) => void
}

function Dashboard({
  colorScheme,
  density,
  onColorSchemeChange,
  onDensityChange,
}: DashboardProps) {
  const { user } = useAuth()
  const { hubs, loading, error, refetch } = useHubs()

  return (
    <>
      <Header
        colorScheme={colorScheme}
        density={density}
        onColorSchemeChange={onColorSchemeChange}
        onDensityChange={onDensityChange}
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Dashboard
          </Typography>
          {user && (
            <Typography variant="body1" color="text.secondary">
              Welcome back, {user.name}!
            </Typography>
          )}
        </Box>

        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Your Hubs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select a hub to view projects and manufacturing data
          </Typography>
        </Paper>

        {loading && <LoadingSpinner message="Loading your hubs..." />}

        {error && !loading && (
          <ErrorMessage
            error={error}
            message="Failed to load hubs"
            onRetry={refetch}
          />
        )}

        {!loading && !error && (
          <>
            <Box sx={{ mb: 3 }}>
              <Card
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                }}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <FolderIcon sx={{ fontSize: 48, mb: 1 }} />
                  <Typography variant="h3">{hubs.length}</Typography>
                  <Typography variant="body1">Available Hubs</Typography>
                </CardContent>
              </Card>
            </Box>

            <HubList hubs={hubs} />
          </>
        )}
      </Container>
    </>
  )
}

export default Dashboard
