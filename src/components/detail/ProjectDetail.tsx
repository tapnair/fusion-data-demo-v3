import { useState, useEffect } from 'react'
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
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial'
import { MfgDataModelClient } from '../../services/api/mfgDataModelClient'
import { useAuth } from '../../context/AuthContext'
import type { NavNode } from '../../types/nav.types'

interface ProjectDetailProps {
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

export function ProjectDetail({ node }: ProjectDetailProps) {
  const { getAccessToken } = useAuth()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const client = new MfgDataModelClient({
      graphqlEndpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT,
      getAccessToken,
    })
    client
      .getProjectDetail(node.entityId)
      .then((res) => setProject(res.project))
      .catch((err) =>
        setError(err instanceof Error ? err : new Error('Failed to load project'))
      )
      .finally(() => setLoading(false))
  }, [node.entityId, getAccessToken])

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
  if (!project) return null

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <FolderSpecialIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h5" fontWeight={600}>
          {project.name}
        </Typography>
      </Box>
      <Chip label="Project" size="small" color="primary" variant="outlined" sx={{ mb: 3 }} />

      {project.thumbnailUrl && (
        <Box
          component="img"
          src={project.thumbnailUrl}
          alt={project.name}
          sx={{ maxWidth: 200, borderRadius: 1, mb: 2, display: 'block' }}
        />
      )}

      <Divider sx={{ mb: 2 }} />

      <MetaRow
        label="Project ID"
        value={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
            >
              {project.id}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy ID'}>
              <IconButton size="small" onClick={() => handleCopy(project.id)}>
                <ContentCopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />

      {project.hub?.name && (
        <MetaRow
          label="Parent Hub"
          value={
            <Typography variant="body2">{project.hub.name}</Typography>
          }
        />
      )}

      {project.alternativeIdentifiers?.dataManagementAPIProjectId && (
        <MetaRow
          label="DM API Project ID"
          value={
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
            >
              {project.alternativeIdentifiers.dataManagementAPIProjectId}
            </Typography>
          }
        />
      )}

      {project.fusionWebUrl && (
        <MetaRow
          label="Fusion Web URL"
          value={
            <Link
              href={project.fusionWebUrl}
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
