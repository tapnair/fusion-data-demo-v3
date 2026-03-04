import React from 'react'
import { Box, Typography, IconButton, CircularProgress, Button } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
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
      { sx: { display: 'flex', alignItems: 'center', pl: row.depth * 3 } },
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
    { sx: { display: 'flex', alignItems: 'center', pl: row.depth * 3 } },
    React.createElement(Box, { sx: { width: 28, flexShrink: 0 } }),
    React.createElement(Typography, { variant: 'body2', noWrap: true }, row.name)
  )
}

export const BOM_COLUMNS: BomColumnDef[] = [
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

export const DEFAULT_VISIBLE_COLUMNS = ['name', 'description', 'partNumber', 'material']
