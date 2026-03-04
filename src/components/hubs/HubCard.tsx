/**
 * Hub Card Component
 * Displays individual hub information in a card format using MUI
 */

import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  Divider,
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import FolderIcon from '@mui/icons-material/Folder'
import type { Hub } from '../../types/hub.types'

interface HubCardProps {
  hub: Hub
}

export function HubCard({ hub }: HubCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/hubs/${hub.id}`)
  }

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 2,
        },
      }}
      onClick={handleClick}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
          <FolderIcon color="primary" sx={{ mt: 0.5 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" gutterBottom>
              {hub.name}
            </Typography>
            {hub.type && (
              <Chip
                label={hub.type}
                size="small"
                color="primary"
                sx={{ mb: 1 }}
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {hub.hubDataVersion && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            <strong>Data Version:</strong> {hub.hubDataVersion}
          </Typography>
        )}

        {hub.region && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            <strong>Region:</strong> {hub.region}
          </Typography>
        )}

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 1,
            fontSize: '0.75rem',
            wordBreak: 'break-all',
          }}
        >
          <strong>ID:</strong> {hub.id}
        </Typography>

        {hub.attributes && hub.attributes.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Attributes:</strong>
            </Typography>
            {hub.attributes.slice(0, 3).map((attr, index) => (
              <Typography
                key={index}
                variant="caption"
                display="block"
                color="text.secondary"
              >
                {attr.name}: {attr.value}
              </Typography>
            ))}
            {hub.attributes.length > 3 && (
              <Typography variant="caption" color="text.secondary">
                +{hub.attributes.length - 3} more
              </Typography>
            )}
          </Box>
        )}
      </CardContent>

      <CardActions>
        <Button
          size="small"
          endIcon={<ArrowForwardIcon />}
          onClick={(e) => {
            e.stopPropagation()
            handleClick()
          }}
        >
          View Details
        </Button>
      </CardActions>
    </Card>
  )
}
