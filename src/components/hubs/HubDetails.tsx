/**
 * Hub Details Component
 * Displays detailed information about a specific hub using MUI
 */

import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import type { Hub } from '../../types/hub.types'

interface HubDetailsProps {
  hub: Hub
}

export function HubDetails({ hub }: HubDetailsProps) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <FolderIcon color="primary" sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h4" gutterBottom>
              {hub.name}
            </Typography>
            {hub.type && <Chip label={hub.type} color="primary" />}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Basic Information
        </Typography>

        <Box sx={{ my: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            <strong>Hub ID:</strong>
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
          >
            {hub.id}
          </Typography>
        </Box>

        {hub.hubDataVersion && (
          <Box sx={{ my: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Data Version:</strong>
            </Typography>
            <Typography variant="body2">{hub.hubDataVersion}</Typography>
          </Box>
        )}

        {hub.region && (
          <Box sx={{ my: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Region:</strong>
            </Typography>
            <Typography variant="body2">{hub.region}</Typography>
          </Box>
        )}

        {hub.attributes && hub.attributes.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" gutterBottom>
              Attributes
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>Name</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Value</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hub.attributes.map((attr, index) => (
                    <TableRow key={index}>
                      <TableCell>{attr.name}</TableCell>
                      <TableCell>{attr.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}
