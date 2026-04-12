import { useState, useMemo, useCallback } from 'react'
import { Box, Chip, Typography, Popover, Link } from '@mui/material'
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import { useComponentSearch } from '../../hooks/useComponentSearch'
import { useSearch } from '../../context/SearchContext'
import { useNavContext, useActiveHub } from '../../context/NavContext'
import { useHubBasePropertyDefinitions } from '../../hooks/useHubBasePropertyDefinitions'
import {
  PHYSICAL_PROPERTY_COLUMNS,
  makeBasePropertyColumn,
} from '../shared/componentColumns'
import type { BasePropertiesCapableContext } from '../shared/componentColumns'
import { SearchColumnSettings } from './SearchColumnSettings'
import type { SearchRow, SearchCellContext, SearchColumnDef } from '../../types/search.types'
import type { NavNode } from '../../types/nav.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: string | null): string {
  if (!bytes) return '—'
  const n = parseInt(bytes, 10)
  if (isNaN(n)) return bytes
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

// ---------------------------------------------------------------------------
// Thumbnail cell
// ---------------------------------------------------------------------------

function ThumbnailCell({ row }: { row: SearchRow }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      {row.thumbnailUrl ? (
        <>
          <img
            src={row.thumbnailUrl}
            width={48}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            alt=""
            onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
            onMouseLeave={() => setAnchorEl(null)}
          />
          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
            transformOrigin={{ vertical: 'center', horizontal: 'left' }}
            disableRestoreFocus
            sx={{ pointerEvents: 'none' }}
          >
            <Box sx={{ p: 1, bgcolor: 'background.paper' }}>
              <img
                src={row.thumbnailUrl}
                width={200}
                height={200}
                style={{ objectFit: 'contain', display: 'block' }}
                alt=""
              />
            </Box>
          </Popover>
        </>
      ) : (
        <ImageNotSupportedIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Type chip cell
// ---------------------------------------------------------------------------

type ChipColor = 'primary' | 'success' | 'warning' | 'secondary' | 'default'

function typeChipColor(resultType: string): ChipColor {
  switch (resultType) {
    case 'COMPONENT': return 'primary'
    case 'FILE': return 'success'
    case 'FOLDER': return 'warning'
    case 'MODEL': return 'secondary'
    default: return 'default'
  }
}

function TypeChipCell({ row }: { row: SearchRow }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <Chip
        label={row.objectTypeName || row.resultType}
        size="small"
        color={typeChipColor(row.resultType)}
        variant="outlined"
      />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Matched properties cell
// ---------------------------------------------------------------------------

function MatchedCell({ row }: { row: SearchRow }) {
  if (!row.matches || row.matches.length === 0) return null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', py: 0.5 }}>
      {row.matches.slice(0, 3).map((m, i) => (
        <Typography key={i} variant="caption" color="text.secondary" noWrap>
          <span style={{ opacity: 0.7 }}>{m.matchedPropertyId}: </span>
          {m.matchedText}
        </Typography>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Standard search columns
// ---------------------------------------------------------------------------

const SEARCH_STANDARD_COLUMNS: SearchColumnDef[] = [
  {
    id: 'thumbnail',
    header: 'Thumbnail',
    width: 72,
    renderCell: (row) => <ThumbnailCell row={row} />,
    getValue: () => null,
  },
  {
    id: 'name',
    header: 'Name',
    width: 250,
    alwaysVisible: true,
    getValue: (row) => row.name,
  },
  {
    id: 'type',
    header: 'Type',
    width: 130,
    getValue: (row) => row.objectTypeName,
    renderCell: (row) => <TypeChipCell row={row} />,
  },
  {
    id: 'relevance',
    header: 'Relevance',
    width: 90,
    getValue: (row) =>
      row.relevancyScore != null ? Math.round(row.relevancyScore * 100) + '%' : '—',
  },
  {
    id: 'matched',
    header: 'Matched',
    width: 200,
    getValue: (row) => row.matches?.map(m => m.matchedText).join(', ') ?? '',
    renderCell: (row) => <MatchedCell row={row} />,
  },
  {
    id: 'partNumber',
    header: 'Part Number',
    width: 200,
    getValue: (row) => row.partNumber || (row.resultType !== 'COMPONENT' ? '—' : ''),
  },
  {
    id: 'description',
    header: 'Description',
    width: 200,
    getValue: (row) => row.description || (row.resultType !== 'COMPONENT' ? '—' : ''),
  },
  {
    id: 'material',
    header: 'Material',
    width: 120,
    getValue: (row) => row.materialName || (row.resultType !== 'COMPONENT' ? '—' : ''),
  },
  {
    id: 'path',
    header: 'Path',
    width: 200,
    getValue: (row) => row.folderPath ?? '—',
  },
  {
    id: 'size',
    header: 'Size',
    width: 100,
    getValue: (row) => {
      if (row.resultType === 'FILE') return formatBytes(row.fileSize)
      if (row.resultType === 'FOLDER')
        return row.objectCount != null ? `${row.objectCount} items` : '—'
      return '—'
    },
  },
]

const DEFAULT_SEARCH_VISIBLE_IDS = new Set([
  ...SEARCH_STANDARD_COLUMNS.filter(c => c.id !== 'path').map(c => c.id),
  'parentFolder',
  'parentProject',
])

const COLUMN_VISIBILITY_STORAGE_KEY = 'search-column-visibility'

function loadColumnVisibility(): Set<string> {
  try {
    const saved = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY)
    if (saved) return new Set(JSON.parse(saved) as string[])
  } catch {}
  return new Set(DEFAULT_SEARCH_VISIBLE_IDS)
}

function saveColumnVisibility(ids: Set<string>) {
  try {
    localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {}
}

// ---------------------------------------------------------------------------
// Row navigation hook
// ---------------------------------------------------------------------------

function useRowNavigation() {
  const { setSelectedNode, setExpandedItems, expandedItems } = useNavContext()
  const { activeHubId } = useActiveHub()
  const { closeSearch } = useSearch()

  return useCallback(
    (row: SearchRow) => {
      if (row.resultType === 'COMPONENT' || row.resultType === 'MODEL') {
        // Navigate to the parent design item
        if (!row.parentItemId || !row.parentItemHubId) return
        const hubId = row.parentItemHubId
        const itemNode: NavNode = {
          id: `item:${row.parentItemId}`,
          label: row.name,
          type: 'item',
          entityId: row.parentItemId,
          hubId,
          hasChildren: true,
          isLoaded: false,
          needsTreeExpansion: true,
        }
        setSelectedNode(itemNode)
      } else if (row.resultType === 'FOLDER') {
        const hubId = row.parentItemHubId ?? activeHubId ?? undefined
        const folderNode: NavNode = {
          id: `folder:${row.id}`,
          label: row.name,
          type: 'folder',
          entityId: row.id,
          hubId,
          projectId: row.parentProjectId ?? undefined,
          hasChildren: true,
          isLoaded: false,
          needsTreeExpansion: true,
        }
        setSelectedNode(folderNode)
      } else {
        // FILE — navigate to the item directly
        const hubId = row.parentItemHubId ?? activeHubId ?? undefined
        const itemNode: NavNode = {
          id: `item:${row.id}`,
          label: row.name,
          type: 'item',
          entityId: row.id,
          hubId,
          hasChildren: false,
          isLoaded: false,
          needsTreeExpansion: true,
        }
        setSelectedNode(itemNode)
      }
      closeSearch()
    },
    [setSelectedNode, setExpandedItems, expandedItems, activeHubId, closeSearch]
  )
}

// ---------------------------------------------------------------------------
// SearchResultsGrid
// ---------------------------------------------------------------------------

export function SearchResultsGrid() {
  const { rows, loading } = useComponentSearch()
  const { activeTypeFilters, setActiveTypeFilters, closeSearch } = useSearch()
  const { setSelectedNode } = useNavContext()
  const { activeHubId } = useActiveHub()
  const { definitions: basePropertyDefs } = useHubBasePropertyDefinitions(activeHubId)
  const handleRowClick = useRowNavigation()

  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(loadColumnVisibility)
  const [sigFigs, setSigFigs] = useState(3)

  const handleVisibilityChange = useCallback((id: string, visible: boolean) => {
    setVisibleColumnIds(prev => {
      const next = new Set(prev)
      if (visible) next.add(id)
      else next.delete(id)
      saveColumnVisibility(next)
      return next
    })
  }, [])

  const navigateToNode = useCallback((node: NavNode) => {
    setSelectedNode(node)
    closeSearch()
  }, [setSelectedNode, closeSearch])

  // Build base property columns typed for search (read-only because SearchCellContext has no setBaseProperty)
  const basePropertyColumns = useMemo(
    () =>
      basePropertyDefs.map(def =>
        makeBasePropertyColumn<SearchRow, BasePropertiesCapableContext>(def)
      ),
    [basePropertyDefs]
  )

  const locationColumns: SearchColumnDef[] = useMemo(() => [
    {
      id: 'parentFolder',
      header: 'Parent Folder',
      width: 180,
      getValue: (row) => row.parentFolderName ?? '—',
      renderCell: (row) => {
        if (!row.parentFolderName || !row.parentItemFolderId) return <span>—</span>
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Link
              component="button"
              variant="body2"
              underline="hover"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                navigateToNode({
                  id: `folder:${row.parentItemFolderId}`,
                  label: row.parentFolderName!,
                  type: 'folder',
                  entityId: row.parentItemFolderId!,
                  hubId: row.parentItemHubId ?? undefined,
                  projectId: row.parentProjectId ?? undefined,
                  hasChildren: true,
                  isLoaded: false,
                  needsTreeExpansion: true,
                })
              }}
            >
              {row.parentFolderName}
            </Link>
          </Box>
        )
      },
    },
    {
      id: 'parentProject',
      header: 'Parent Project',
      width: 180,
      getValue: (row) => row.parentProjectName ?? '—',
      renderCell: (row) => {
        if (!row.parentProjectName || !row.parentProjectId) return <span>—</span>
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Link
              component="button"
              variant="body2"
              underline="hover"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                navigateToNode({
                  id: `project:${row.parentProjectId}`,
                  label: row.parentProjectName!,
                  type: 'project',
                  entityId: row.parentProjectId!,
                  hubId: row.parentItemHubId ?? activeHubId ?? undefined,
                  hasChildren: true,
                  isLoaded: false,
                  needsTreeExpansion: true,
                })
              }}
            >
              {row.parentProjectName}
            </Link>
          </Box>
        )
      },
    },
  ], [navigateToNode, activeHubId])

  const allColumns: SearchColumnDef[] = useMemo(
    () => [
      ...SEARCH_STANDARD_COLUMNS,
      ...locationColumns,
      // PHYSICAL_PROPERTY_COLUMNS typed as SearchColumnDef — compatible since SearchRow extends ComponentRow
      ...(PHYSICAL_PROPERTY_COLUMNS as SearchColumnDef[]),
      ...(basePropertyColumns as SearchColumnDef[]),
    ],
    [locationColumns, basePropertyColumns]
  )

  const cellContext: SearchCellContext = useMemo(() => ({ sigFigs }), [sigFigs])

  const gridColumns: GridColDef[] = useMemo(
    () =>
      allColumns
        .filter(c => visibleColumnIds.has(c.id))
        .map(c => ({
          field: c.id,
          headerName: c.header,
          width: c.width,
          flex: c.flex,
          sortable: false,
          valueGetter: (_value: unknown, row: SearchRow) => c.getValue?.(row) ?? '',
          renderCell: c.renderCell
            ? (params: any) => c.renderCell!(params.row as SearchRow, cellContext)
            : undefined,
        })),
    [allColumns, visibleColumnIds, cellContext]
  )

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <SearchColumnSettings
        columns={allColumns}
        visibleColumnIds={visibleColumnIds}
        onVisibilityChange={handleVisibilityChange}
        sigFigs={sigFigs}
        onSigFigsChange={setSigFigs}
        resultCount={rows.length}
        loading={loading}
        activeTypeFilters={activeTypeFilters}
        onTypeFiltersChange={setActiveTypeFilters}
      />
      <DataGrid
        rows={rows}
        columns={gridColumns}
        getRowId={(r: SearchRow) => r.id}
        rowHeight={64}
        hideFooter
        disableColumnMenu
        disableColumnFilter
        loading={loading}
        onRowClick={(params) => handleRowClick(params.row as SearchRow)}
        sx={{ border: 'none', flex: 1, cursor: 'pointer' }}
      />
    </Box>
  )
}
