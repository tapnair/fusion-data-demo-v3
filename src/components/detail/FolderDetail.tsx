import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  Link,
} from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import FolderIcon from '@mui/icons-material/Folder'
import { MfgDataModelClient } from '../../services/api/mfgDataModelClient'
import { useAuth } from '../../context/AuthContext'
import type { NavNode } from '../../types/nav.types'

interface FolderDetailProps {
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

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
}

export function FolderDetail({ node }: FolderDetailProps) {
  const { getAccessToken } = useAuth()
  const [folder, setFolder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const client = new MfgDataModelClient({
      graphqlEndpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT,
      getAccessToken,
    })
    client
      .getFolderDetail(node.projectId!, node.entityId)
      .then((res) => setFolder(res.folder))
      .catch((err) =>
        setError(err instanceof Error ? err : new Error('Failed to load folder'))
      )
      .finally(() => setLoading(false))
  }, [node.entityId, node.projectId, getAccessToken])

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
  if (!folder) return null

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <FolderIcon sx={{ color: 'warning.main', fontSize: 28 }} />
        <Typography variant="h5" fontWeight={600}>
          {folder.name}
        </Typography>
      </Box>
      <Chip label="Folder" size="small" color="warning" variant="outlined" sx={{ mb: 3 }} />

      <Divider sx={{ mb: 2 }} />

      {folder.path && (
        <MetaRow
          label="Path"
          value={
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
            >
              {folder.path}
            </Typography>
          }
        />
      )}

      {folder.objectCount != null && (
        <MetaRow
          label="Object Count"
          value={
            <Chip
              label={folder.objectCount}
              size="small"
              variant="outlined"
              color="default"
            />
          }
        />
      )}

      {folder.createdOn && (
        <MetaRow
          label="Created On"
          value={
            <Typography variant="body2">
              {formatDateTime(folder.createdOn)}
              {folder.createdBy?.name ? ` by ${folder.createdBy.name}` : ''}
            </Typography>
          }
        />
      )}

      {folder.lastModifiedOn && (
        <MetaRow
          label="Last Modified"
          value={
            <Typography variant="body2">
              {formatDateTime(folder.lastModifiedOn)}
              {folder.lastModifiedBy?.name ? ` by ${folder.lastModifiedBy.name}` : ''}
            </Typography>
          }
        />
      )}

      {folder.parentFolder?.name && (
        <MetaRow
          label="Parent Folder"
          value={
            <Typography variant="body2">{folder.parentFolder.name}</Typography>
          }
        />
      )}

      {folder.project?.name && (
        <MetaRow
          label="Project"
          value={
            <Typography variant="body2">{folder.project.name}</Typography>
          }
        />
      )}

      {folder.fusionWebUrl && (
        <MetaRow
          label="Fusion Web URL"
          value={
            <Link
              href={folder.fusionWebUrl}
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
