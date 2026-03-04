/**
 * Debug Page
 * Helps debug authentication and API issues using MUI
 */

import { useState } from 'react'
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Alert,
  Chip,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import { useAuth } from '../context/AuthContext'
import { Header } from '../components/layout/Header'
import { TokenManager } from '../services/auth/tokenManager'

function DebugPage() {
  const { isAuthenticated, accessToken, user } = useAuth()
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)

  const testGraphQLEndpoint = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const token = await TokenManager.getToken()
      if (!token) {
        setTestResult({ error: 'No access token found' })
        return
      }

      const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT

      const introspectionQuery = `
        query {
          __schema {
            queryType {
              name
            }
          }
        }
      `

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: introspectionQuery,
        }),
      })

      const data = await response.json()
      setTestResult({
        status: response.status,
        statusText: response.statusText,
        data: data,
      })
    } catch (error: any) {
      setTestResult({
        error: error.message,
        stack: error.stack,
      })
    } finally {
      setTesting(false)
    }
  }

  const testHubsQuery = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const token = await TokenManager.getToken()
      if (!token) {
        setTestResult({ error: 'No access token found' })
        return
      }

      const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT

      const hubsQuery = `
        query GetHubs {
          hubs {
            results {
              id
              name
              hubDataVersion
            }
          }
        }
      `

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: hubsQuery,
        }),
      })

      const data = await response.json()
      setTestResult({
        status: response.status,
        statusText: response.statusText,
        data: data,
      })
    } catch (error: any) {
      setTestResult({
        error: error.message,
        stack: error.stack,
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <Header />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Debug Information
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Authentication Status
          </Typography>
          <TableContainer>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Authenticated</TableCell>
                  <TableCell>
                    {isAuthenticated ? (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Yes"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<CancelIcon />}
                        label="No"
                        color="error"
                        size="small"
                      />
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Access Token</TableCell>
                  <TableCell sx={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {accessToken ? `${accessToken.substring(0, 50)}...` : 'None'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                  <TableCell>{user ? JSON.stringify(user) : 'None'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Token Expiry</TableCell>
                  <TableCell>
                    {TokenManager.getTimeUntilExpiry()} seconds remaining
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Environment Variables
          </Typography>
          <TableContainer>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>GraphQL Endpoint</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {import.meta.env.VITE_GRAPHQL_ENDPOINT}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Client ID</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {import.meta.env.VITE_CLIENT_ID}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Scope</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {import.meta.env.VITE_SCOPE}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            API Tests
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={testGraphQLEndpoint}
              disabled={testing || !isAuthenticated}
            >
              Test GraphQL Endpoint
            </Button>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={testHubsQuery}
              disabled={testing || !isAuthenticated}
            >
              Test Hubs Query
            </Button>
          </Box>

          {testResult && (
            <Alert severity={testResult.error ? 'error' : 'success'}>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(testResult, null, 2)}
              </Typography>
            </Alert>
          )}
        </Paper>
      </Container>
    </>
  )
}

export default DebugPage
