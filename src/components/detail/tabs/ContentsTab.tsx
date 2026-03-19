import { useCallback } from 'react'
import { Box, Typography } from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef, GridRowParams } from '@mui/x-data-grid'
import { useTheme } from '@mui/material/styles'
import { useFolderContents } from '../../../hooks/useFolderContents'
import { useNavContext } from '../../../context/NavContext'
import type { NavNode } from '../../../types/nav.types'
import type { ContentRow } from '../../../types/folderContents.types'
import type { WeaveDensity } from '../../../theme/types'

// ── Formatters ──────────────────────────────────────────────────────────────

const EXTENSION_TYPE_LABELS: Record<string, string> = {
  'autodesk.fusion360:Design':  'Fusion Design',
  'autodesk.fusion360:Drawing': 'Fusion Drawing',
  'autodesk.fusion360:Library': 'Fusion Library',
  'autodesk.fusion:Nest':       'Fusion Nest',
  'autodesk.cam:Operation':     'CAM Operation',
  'autodesk.bim360:Document':   'BIM360 Document',
}

function formatExtensionType(extensionType: string | null): string {
  if (!extensionType) return '—'
  if (EXTENSION_TYPE_LABELS[extensionType]) return EXTENSION_TYPE_LABELS[extensionType]
  const segment = extensionType.split(':').pop() ?? extensionType
  return segment.replace(/([A-Z])/g, ' $1').trim()
}

function formatBytes(sizeStr: string | null): string {
  if (!sizeStr) return '—'
  const bytes = parseInt(sizeStr, 10)
  if (isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

function formatSize(row: ContentRow): string {
  if (row.kind === 'folder') {
    return row.objectCount != null && row.objectCount > 0
      ? `${row.objectCount} items`
      : '—'
  }
  return formatBytes(row.size)
}

function formatType(row: ContentRow): string {
  if (row.kind === 'folder') return 'Folder'
  return formatExtensionType(row.itemType)
}

// ── Column definitions ───────────────────────────────────────────────────────

const CONTENT_COLUMNS: GridColDef[] = [
  {
    field: '__icon',
    headerName: '',
    width: 40,
    sortable: false,
    resizable: false,
    disableColumnMenu: true,
    renderCell: (params) => {
      const row = params.row as ContentRow
      return row.kind === 'folder'
        ? <FolderIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        : <InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
    },
  },
  {
    field: 'name',
    headerName: 'Name',
    flex: 2,
    sortable: false,
  },
  {
    field: 'itemType',
    headerName: 'Type',
    width: 160,
    sortable: false,
    valueGetter: (_value: unknown, row: ContentRow) => formatType(row),
  },
  {
    field: 'lastModifiedOn',
    headerName: 'Modified',
    width: 160,
    sortable: false,
    valueGetter: (_value: unknown, row: ContentRow) => formatDate(row.lastModifiedOn),
  },
  {
    field: 'size',
    headerName: 'Size',
    width: 100,
    sortable: false,
    valueGetter: (_value: unknown, row: ContentRow) => formatSize(row),
  },
]

const DENSITY_MAP: Record<WeaveDensity, 'compact' | 'standard' | 'comfortable'> = {
  high: 'compact',
  medium: 'standard',
  low: 'comfortable',
}

// ── Component ────────────────────────────────────────────────────────────────

export function ContentsTab({ node }: { node: NavNode }) {
  const theme = useTheme()
  const { rows, loading, error } = useFolderContents(node)
  const { setSelectedNode, nodeChildrenCache, expandedItems, setExpandedItems } = useNavContext()

  const handleRowClick = useCallback((params: GridRowParams) => {
    const row = params.row as ContentRow
    const cached = nodeChildrenCache.get(node.id)
    const existing = cached?.find(n => n.entityId === row.id)

    if (existing) {
      setSelectedNode(existing)
      if (!expandedItems.includes(node.id)) {
        setExpandedItems([...expandedItems, node.id])
      }
    } else {
      const navNode: NavNode = {
        id: `${row.kind === 'folder' ? 'folder' : 'item'}:${row.id}`,
        label: row.name,
        type: row.kind === 'folder' ? 'folder' : 'item',
        entityId: row.id,
        hubId: node.hubId,
        projectId: node.type === 'project' ? node.entityId : node.projectId,
        parentFolderId: node.type === 'folder' ? node.entityId : undefined,
        hasChildren: row.kind === 'folder',
        isLoaded: false,
        parentNodeId: node.id,
      }
      setSelectedNode(navNode)
      if (!expandedItems.includes(node.id)) {
        setExpandedItems([...expandedItems, node.id])
      }
    }
  }, [node, nodeChildrenCache, expandedItems, setSelectedNode, setExpandedItems])

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">{error.message}</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <DataGrid
        rows={rows}
        columns={CONTENT_COLUMNS}
        getRowId={(r) => (r as ContentRow).id}
        hideFooter
        disableColumnMenu
        loading={loading}
        density={DENSITY_MAP[theme.density as WeaveDensity] ?? 'standard'}
        onRowClick={handleRowClick}
        sx={{ border: 'none', flex: 1, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
      />
    </Box>
  )
}
