/**
 * Home Page
 * Landing page with login functionality using MUI
 */

import { Navigate } from 'react-router-dom'
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Paper,
  Stack,
} from '@mui/material'
import SecurityIcon from '@mui/icons-material/Security'
import BusinessIcon from '@mui/icons-material/Business'
import DataObjectIcon from '@mui/icons-material/DataObject'
import { useAuth } from '../context/AuthContext'
import { LoginButton } from '../components/auth/LoginButton'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

function Home() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <LoadingSpinner />
      </Container>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography
          variant="h2"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            color: 'primary.main',
          }}
        >
          Fusion Data Demo
        </Typography>
        <Typography
          variant="h5"
          color="text.secondary"
          sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}
        >
          Access Autodesk Manufacturing Data Model with secure PKCE
          authentication
        </Typography>
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={4}
        sx={{ mb: 6 }}
      >
        <Card sx={{ flex: 1, textAlign: 'center' }}>
          <CardContent sx={{ py: 4 }}>
            <SecurityIcon color="primary" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Secure Authentication
            </Typography>
            <Typography variant="body2" color="text.secondary">
              OAuth 2.0 PKCE flow with Autodesk Platform Services
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, textAlign: 'center' }}>
          <CardContent sx={{ py: 4 }}>
            <BusinessIcon color="primary" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Hub Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View and manage your Autodesk hubs
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, textAlign: 'center' }}>
          <CardContent sx={{ py: 4 }}>
            <DataObjectIcon color="primary" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Manufacturing Data
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Access components, BOMs, and design data via GraphQL
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <LoginButton />
      </Box>

      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
        <Typography variant="body2" color="text.secondary">
          Powered by <strong>Vite</strong>, <strong>React</strong>,{' '}
          <strong>Material-UI</strong>, and <strong>Autodesk APS</strong>
        </Typography>
      </Paper>
    </Container>
  )
}

export default Home
