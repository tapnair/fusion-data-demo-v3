import React, { useState } from 'react'
import { Box, Typography, IconButton, CircularProgress, Button, Skeleton, Popover } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import BrokenImageIcon from '@mui/icons-material/BrokenImage'
import { useBomThumbnail, WORKING_STATES } from '../../../../hooks/useBomThumbnail'
import type { BomRow } from '../../../../types/bom.types'

export interface BomCellContext {
  toggleRow: (row: BomRow) => void
  loadMore: (loadMoreRow: BomRow) => void
}

export interface BomColumnDef {
  /** Unique stable key for visibility persistence */
  id: string
  /** Column header label */
  header: string
  width?: number
  flex?: number
  /** Extract display value from a BomRow */
  getValue: (row: BomRow) => string | null
  /** Optional custom cell renderer */
  renderCell?: (row: BomRow, ctx: BomCellContext) => React.ReactNode
  /** Cannot be hidden via settings */
  alwaysVisible?: boolean
  /**
   * Reserved for future columns whose data is not in the base BOM query.
   * When true, useBomLoader must fetch the data separately when this column
   * becomes visible. All initial columns are false (data fetched in base query).
   */
  fetchOnDemand?: boolean
}

function BomThumbnailCellInner({ row }: { row: BomRow }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const { loading, error, status, signedUrl } = useBomThumbnail(row.componentId, row.componentState)
  const isWorking = status !== null && WORKING_STATES.includes(status)

  if (error || status === 'FAILED') {
    return React.createElement(BrokenImageIcon, { fontSize: 'small', sx: { color: 'text.disabled' } })
  }

  if (loading || isWorking || !signedUrl) {
    return React.createElement(Skeleton, {
      variant: 'rectangular',
      width: 40,
      height: 40,
      animation: isWorking ? 'pulse' : 'wave',
    })
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('img', {
      src: signedUrl,
      width: 40,
      height: 40,
      style: { objectFit: 'cover' as const, borderRadius: 4 },
      onMouseEnter: (e: React.MouseEvent<HTMLImageElement>) => setAnchorEl(e.currentTarget),
      onMouseLeave: () => setAnchorEl(null),
    }),
    React.createElement(
      Popover,
      {
        open: Boolean(anchorEl),
        anchorEl,
        onClose: () => setAnchorEl(null),
        anchorOrigin: { vertical: 'center', horizontal: 'right' },
        transformOrigin: { vertical: 'center', horizontal: 'left' },
        disableRestoreFocus: true,
        sx: { pointerEvents: 'none' },
      },
      React.createElement(
        Box,
        { sx: { p: 1, bgcolor: 'background.paper' } },
        React.createElement('img', {
          src: signedUrl,
          width: 200,
          height: 200,
          style: { objectFit: 'contain' as const, display: 'block' },
        })
      )
    )
  )
}

function BomThumbnailCell({ row }: { row: BomRow }) {
  if (row.id.startsWith('load-more:')) return null
  return React.createElement(BomThumbnailCellInner, { row })
}

function BomNameCell({ row, ctx }: { row: BomRow; ctx: BomCellContext }) {
  if (row.id.startsWith('load-more:')) {
    return (
      React.createElement(Button, {
        variant: 'text',
        size: 'small',
        onClick: () => ctx.loadMore(row),
        sx: { width: '100%', justifyContent: 'flex-start' },
      }, 'Load more...')
    )
  }

  if (row.hasChildren) {
    return React.createElement(
      Box,
      { sx: { display: 'flex', alignItems: 'center', height: '100%', pl: row.depth * 3 } },
      row.isLoading
        ? React.createElement(CircularProgress, { size: 16, sx: { mx: '6px' } })
        : React.createElement(
            IconButton,
            {
              size: 'small',
              onClick: () => ctx.toggleRow(row),
              sx: { p: 0.25 },
            },
            row.isExpanded
              ? React.createElement(ExpandMoreIcon, { fontSize: 'small' })
              : React.createElement(ChevronRightIcon, { fontSize: 'small' })
          ),
      React.createElement(Typography, { variant: 'body2', noWrap: true }, row.name)
    )
  }

  return React.createElement(
    Box,
    { sx: { display: 'flex', alignItems: 'center', height: '100%', pl: row.depth * 3 } },
    React.createElement(Box, { sx: { width: 28, flexShrink: 0 } }),
    React.createElement(Typography, { variant: 'body2', noWrap: true }, row.name)
  )
}

export const BOM_COLUMNS: BomColumnDef[] = [
  {
    id: 'thumbnail',
    header: 'Thumbnail',
    width: 64,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row) => React.createElement(BomThumbnailCell, { row }),
  },
  {
    id: 'name',
    header: 'Name',
    flex: 2,
    alwaysVisible: true,
    getValue: (row) => row.name,
    renderCell: (row, ctx) => React.createElement(BomNameCell, { row, ctx }),
  },
  {
    id: 'description',
    header: 'Description',
    flex: 2,
    getValue: (row) => row.description,
  },
  {
    id: 'partNumber',
    header: 'P/N',
    width: 160,
    getValue: (row) => row.partNumber,
  },
  {
    id: 'material',
    header: 'Material',
    width: 160,
    getValue: (row) => row.materialName,
  },
]

export const DEFAULT_VISIBLE_COLUMNS = ['thumbnail', 'name', 'description', 'partNumber', 'material']
