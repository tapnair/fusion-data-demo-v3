import React, { useState } from 'react'
import { Box, Typography, IconButton, CircularProgress, Button, Skeleton, Popover } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import BrokenImageIcon from '@mui/icons-material/BrokenImage'
import { useBomThumbnail, WORKING_STATES } from '../../../../hooks/useBomThumbnail'
import type { BomRow } from '../../../../types/bom.types'
import type { PropertyDefinition } from '../../../../hooks/useHubBasePropertyDefinitions'
import {
  type BasePropertiesCapableContext,
  type ComponentColumnDef,
  PHYSICAL_PROPERTY_COLUMNS,
  makeBasePropertyColumn as _makeBasePropertyColumn,
} from '../../../shared/componentColumns'
import { EditableTextCell } from '../../../shared/EditableTextCell'

export interface BomCellContext extends BasePropertiesCapableContext {
  toggleRow: (row: BomRow) => void
  loadMore: (loadMoreRow: BomRow) => void
  /** Decimal places used when formatting physical property displayValues (0–6). */
  sigFigs: number
  staleBasePropsKeys: Set<string>
  clearStaleKey: (key: string) => void
  setBaseProperty: (
    componentId: string,
    componentState: string | null,
    definitionId: string,
    specification: string | null,
    rawValue: string
  ) => Promise<void>
  thumbnailGeneration: number
}

export type BomColumnDef = ComponentColumnDef<BomRow, BomCellContext>

function BomThumbnailCellInner({ row, thumbnailGeneration }: { row: BomRow; thumbnailGeneration: number }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const { loading, error, status, signedUrl, objectUrl, refetchOnce } = useBomThumbnail(row.componentId, row.componentState, thumbnailGeneration)
  const isWorking = status !== null && WORKING_STATES.includes(status)
  // Use cached blob URL when available; fall back to signedUrl directly for <img> tags
  // (fetch() is blocked by CORS on some hosts but <img src> is not).
  const displayUrl = objectUrl ?? signedUrl

  if (error || status === 'FAILED') {
    return React.createElement(BrokenImageIcon, { fontSize: 'small', sx: { color: 'text.disabled' } })
  }

  if (loading || isWorking || !displayUrl) {
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
      src: displayUrl,
      width: 40,
      height: 40,
      style: { objectFit: 'cover' as const, borderRadius: 4 },
      onMouseEnter: (e: React.MouseEvent<HTMLImageElement>) => setAnchorEl(e.currentTarget),
      onMouseLeave: () => setAnchorEl(null),
      onError: () => {
        if (displayUrl === signedUrl) refetchOnce()
      },
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
          src: displayUrl,
          width: 200,
          height: 200,
          style: { objectFit: 'contain' as const, display: 'block' },
        })
      )
    )
  )
}

function BomThumbnailCell({ row, thumbnailGeneration }: { row: BomRow; thumbnailGeneration: number }) {
  if (row.id.startsWith('load-more:')) return null
  return React.createElement(BomThumbnailCellInner, { row, thumbnailGeneration })
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
    width: 72,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row, ctx) => React.createElement(BomThumbnailCell, { row, thumbnailGeneration: ctx.thumbnailGeneration }),
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
    renderCell: (row, ctx) =>
      React.createElement(EditableTextCell, {
        value: row.description,
        readOnly: !ctx.setDescription,
        onCommit: (next: string) => ctx.setDescription!(row.componentId, next),
      }),
  },
  {
    id: 'partNumber',
    header: 'P/N',
    width: 220,
    getValue: (row) => row.partNumber,
  },
  {
    id: 'material',
    header: 'Material',
    width: 120,
    getValue: (row) => row.materialName,
  },
  ...(PHYSICAL_PROPERTY_COLUMNS as unknown as BomColumnDef[]),
]

export const DEFAULT_VISIBLE_COLUMNS = ['thumbnail', 'name', 'description', 'partNumber', 'material']

export function makeBasePropertyColumn(def: PropertyDefinition): BomColumnDef {
  return _makeBasePropertyColumn<BomRow, BomCellContext>(def)
}
