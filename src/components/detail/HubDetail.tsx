import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Link,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { useLazyQuery } from '@apollo/client/react'
import { GET_HUB_DETAIL } from '../../graphql/queries/hubs'
import type { NavNode } from '../../types/nav.types'

interface HubDetailProps {
  node: NavNode
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 1.5, alignItems: 'flex-start' }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ minWidth: 130, pt: 0.25, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Box>{value}</Box>
    </Box>
  )
}

export function HubDetail({ node }: HubDetailProps) {
  const [copied, setCopied] = useState(false)
  const [fetchHub, { data, loading, error }] = useLazyQuery<any>(GET_HUB_DETAIL)

  useEffect(() => {
    fetchHub({ variables: { hubId: node.entityId } })
  }, [node.entityId, fetchHub])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
        <CircularProgress />
      </Box>
    )
  }
  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error.message}
      </Alert>
    )
  }

  const hub = data?.hub
  if (!hub) return null

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <AccountTreeIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h5" fontWeight={600}>
          {hub.name}
        </Typography>
      </Box>
      <Chip label="Hub" size="small" color="primary" variant="outlined" sx={{ mb: 3 }} />

      <Divider sx={{ mb: 2 }} />

      <MetaRow
        label="Hub ID"
        value={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
            >
              {hub.id}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy ID'}>
              <IconButton size="small" onClick={() => handleCopy(hub.id)}>
                <ContentCopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />

      {hub.alternativeIdentifiers?.dataManagementAPIHubId && (
        <MetaRow
          label="DM API Hub ID"
          value={
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
            >
              {hub.alternativeIdentifiers.dataManagementAPIHubId}
            </Typography>
          }
        />
      )}

      {hub.fusionWebUrl && (
        <MetaRow
          label="Fusion Web URL"
          value={
            <Link
              href={hub.fusionWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              Open in Fusion <OpenInNewIcon sx={{ fontSize: 14 }} />
            </Link>
          }
        />
      )}
    </Box>
  )
}
