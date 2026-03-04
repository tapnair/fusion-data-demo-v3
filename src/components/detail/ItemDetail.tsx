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
import DesignServicesIcon from '@mui/icons-material/DesignServices'
import { MfgDataModelClient } from '../../services/api/mfgDataModelClient'
import { useAuth } from '../../context/AuthContext'
import type { NavNode } from '../../types/nav.types'

interface ItemDetailProps {
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ItemDetail({ node }: ItemDetailProps) {
  const { getAccessToken } = useAuth()
  const [item, setItem] = useState<any>(null)
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
      .getItemDetail(node.hubId!, node.entityId)
      .then((res) => setItem(res.item))
      .catch((err) =>
        setError(err instanceof Error ? err : new Error('Failed to load item'))
      )
      .finally(() => setLoading(false))
  }, [node.entityId, node.hubId, getAccessToken])

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
  if (!item) return null

  const isDesignItem = item.__typename === 'DesignItem'
  const typeLabel = item.extensionType ?? item.__typename ?? 'Item'
  const component = item.tipRootModel?.component

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <DesignServicesIcon sx={{ color: 'secondary.main', fontSize: 28 }} />
        <Typography variant="h5" fontWeight={600}>
          {item.name}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Chip label={typeLabel} size="small" color="secondary" variant="outlined" />
        {isDesignItem && item.isConfiguration && (
          <Chip label="Configuration" size="small" color="info" />
        )}
      </Box>

      {isDesignItem && item.thumbnail?.signedUrl && (
        <Box
          component="img"
          src={item.thumbnail.signedUrl}
          alt={item.name}
          sx={{ maxWidth: 200, borderRadius: 1, mb: 2, display: 'block' }}
        />
      )}

      <Divider sx={{ mb: 2 }} />

      {item.size != null && (
        <MetaRow
          label="File Size"
          value={
            <Typography variant="body2">{formatFileSize(item.size)}</Typography>
          }
        />
      )}

      {item.mimeType && (
        <MetaRow
          label="MIME Type"
          value={
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {item.mimeType}
            </Typography>
          }
        />
      )}

      {item.createdOn && (
        <MetaRow
          label="Created On"
          value={
            <Typography variant="body2">
              {formatDateTime(item.createdOn)}
              {item.createdBy?.userName ? ` by ${item.createdBy.name}` : ''}
            </Typography>
          }
        />
      )}

      {item.lastModifiedOn && (
        <MetaRow
          label="Last Modified"
          value={
            <Typography variant="body2">
              {formatDateTime(item.lastModifiedOn)}
              {item.lastModifiedBy?.userName ? ` by ${item.lastModifiedBy.name}` : ''}
            </Typography>
          }
        />
      )}

      {item.parentFolder?.name && (
        <MetaRow
          label="Parent Folder"
          value={
            <Typography variant="body2">{item.parentFolder.name}</Typography>
          }
        />
      )}

      {item.project?.name && (
        <MetaRow
          label="Project"
          value={
            <Typography variant="body2">{item.project.name}</Typography>
          }
        />
      )}

      {item.fusionWebUrl && (
        <MetaRow
          label="Fusion Web URL"
          value={
            <Link
              href={item.fusionWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              Open in Fusion <OpenInNewIcon sx={{ fontSize: 14 }} />
            </Link>
          }
        />
      )}

      {isDesignItem && component && (
        <>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Component
          </Typography>
          <Divider sx={{ mb: 1.5 }} />
          {component.name?.value && (
            <MetaRow
              label="Name"
              value={
                <Typography variant="body2">{component.name.value}</Typography>
              }
            />
          )}
          {component.partNumber?.value && (
            <MetaRow
              label="Part Number"
              value={
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {component.partNumber.value}
                </Typography>
              }
            />
          )}
          {component.description?.value && (
            <MetaRow
              label="Description"
              value={
                <Typography variant="body2">{component.description.value}</Typography>
              }
            />
          )}
        </>
      )}
    </Box>
  )
}
