import React, { useState } from 'react'
import { Box, Typography, IconButton, CircularProgress, Button, Skeleton, Popover, TextField } from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import BrokenImageIcon from '@mui/icons-material/BrokenImage'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import LockIcon from '@mui/icons-material/Lock'
import { useBomThumbnail, WORKING_STATES } from '../../../../hooks/useBomThumbnail'
import { useBomPhysicalProperties, PHYSICAL_PROPS_WORKING_STATES } from '../../../../hooks/useBomPhysicalProperties'
import type { BomRow } from '../../../../types/bom.types'
import { useApolloClient } from '@apollo/client/react'
import { useBomBaseProperties } from '../../../../hooks/useBomBaseProperties'
import type { PropertyDefinition } from '../../../../hooks/useHubBasePropertyDefinitions'
import {
  GET_ROOT_COMPONENT_BASE_PROPERTIES,
  GET_COMPONENT_BASE_PROPERTIES,
} from '../../../../graphql/queries/baseProperties'

export interface BomCellContext {
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

const UNIT_ABBREVIATIONS: Record<string, string> = {
  // Mass
  'kilograms': 'kg',
  'grams': 'g',
  'pounds': 'lb',
  'ounces': 'oz',
  // Length
  'centimeters': 'cm',
  'millimeters': 'mm',
  'meters': 'm',
  'inches': 'in',
  'feet': 'ft',
  // Volume
  'cubic centimeters': 'cm³',
  'cubic millimeters': 'mm³',
  'cubic meters': 'm³',
  'cubic inches': 'in³',
  'cubic feet': 'ft³',
  'liters': 'L',
  // Area
  'square centimeters': 'cm²',
  'square millimeters': 'mm²',
  'square meters': 'm²',
  'square inches': 'in²',
  'square feet': 'ft²',
  // Density
  'kilograms per cubic centimeter': 'kg/cm³',
  'grams per cubic centimeter': 'g/cm³',
  'kilograms per cubic meter': 'kg/m³',
  'grams per cubic meter': 'g/m³',
  'pounds per cubic inch': 'lb/in³',
}

/**
 * Formats a physical property for display.
 * Parses the numeric part from displayValue, applies decimalPlaces, and
 * appends an abbreviated unit derived from definition.units.name.
 */
function formatDisplayValue(
  displayValue: string | null,
  unitName: string | null,
  decimalPlaces: number
): string | null {
  if (!displayValue) return null
  const match = displayValue.match(/^([-\d.]+)/)
  if (!match) return displayValue
  const num = parseFloat(match[1])
  if (isNaN(num)) return displayValue
  const formatted = num.toFixed(decimalPlaces)
  if (!unitName) return formatted
  const abbrev = UNIT_ABBREVIATIONS[unitName.toLowerCase()] ?? unitName
  return `${formatted} ${abbrev}`
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

function BomThumbnailCellInner({ row, thumbnailGeneration }: { row: BomRow; thumbnailGeneration: number }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const { loading, error, status, signedUrl } = useBomThumbnail(row.componentId, row.componentState, thumbnailGeneration)
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

function BomThumbnailCell({ row, thumbnailGeneration }: { row: BomRow; thumbnailGeneration: number }) {
  if (row.id.startsWith('load-more:')) return null
  return React.createElement(BomThumbnailCellInner, { row, thumbnailGeneration })
}

type PhysPropsAccessor = (physProps: any) => { displayValue: string | null; unitName: string | null } | null

function BomPhysicalPropertiesCellInner({
  row,
  accessor,
  sigFigs,
}: {
  row: BomRow
  accessor: PhysPropsAccessor
  sigFigs: number
}) {
  const { loading, error, physProps } = useBomPhysicalProperties(row.componentId, row.componentState)
  const isWorking = physProps?.status && PHYSICAL_PROPS_WORKING_STATES.includes(physProps.status)
  const isTerminalFailure = physProps?.status === 'FAILED' || physProps?.status === 'CANCELLED'

  if (!loading && !error && physProps === null) return null

  if (loading || isWorking) {
    return React.createElement(CircularProgress, { size: 12, sx: { color: 'text.disabled' } })
  }

  if (error || isTerminalFailure) {
    return React.createElement(ErrorOutlineIcon, { fontSize: 'small', sx: { color: 'text.disabled' } })
  }

  const result = accessor(physProps)
  const value = result
    ? formatDisplayValue(result.displayValue, result.unitName, sigFigs)
    : null
  if (!value) return null

  return React.createElement(Typography, { variant: 'body2' }, value)
}

function BomPhysicalPropertiesCell({
  row,
  accessor,
  sigFigs,
}: {
  row: BomRow
  accessor: PhysPropsAccessor
  sigFigs: number
}) {
  if (row.id.startsWith('load-more:')) return null
  return React.createElement(
    Box,
    { sx: { display: 'flex', alignItems: 'center', height: '100%' } },
    React.createElement(BomPhysicalPropertiesCellInner, { row, accessor, sigFigs })
  )
}

function BomBoundingBoxCellInner({ row, sigFigs }: { row: BomRow; sigFigs: number }) {
  const { loading, error, physProps } = useBomPhysicalProperties(row.componentId, row.componentState)
  const isWorking = physProps?.status && PHYSICAL_PROPS_WORKING_STATES.includes(physProps.status)
  const isTerminalFailure = physProps?.status === 'FAILED' || physProps?.status === 'CANCELLED'

  if (!loading && !error && physProps === null) return null

  if (loading || isWorking) {
    return React.createElement(CircularProgress, { size: 12, sx: { color: 'text.disabled' } })
  }

  if (error || isTerminalFailure) {
    return React.createElement(ErrorOutlineIcon, { fontSize: 'small', sx: { color: 'text.disabled' } })
  }

  const bb = physProps?.boundingBox
  if (!bb) return null

  const fmt = (prop: any) =>
    formatDisplayValue(prop?.displayValue ?? null, prop?.definition?.units?.name ?? null, sigFigs)

  const lines: string[] = [
    fmt(bb.length),
    fmt(bb.width),
    fmt(bb.height),
  ]
    .filter((v): v is string => v !== null)
    .map((v, i) => `${'LWH'[i]}: ${v}`)

  if (!lines.length) return null

  return React.createElement(
    Box,
    { sx: { lineHeight: 1.4 } },
    ...lines.map(line =>
      React.createElement(Typography, { key: line, variant: 'caption', display: 'block' }, line)
    )
  )
}

function BomBoundingBoxCell({ row, sigFigs }: { row: BomRow; sigFigs: number }) {
  if (row.id.startsWith('load-more:')) return null
  return React.createElement(
    Box,
    { sx: { display: 'flex', alignItems: 'center', height: '100%' } },
    React.createElement(BomBoundingBoxCellInner, { row, sigFigs })
  )
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

function BomBasePropCellInner({
  row,
  definition,
  ctx,
}: {
  row: BomRow
  definition: PropertyDefinition
  ctx: BomCellContext
}) {
  const componentKey = `${row.componentId}:${row.componentState ?? 'root'}`
  const isStale = ctx.staleBasePropsKeys.has(componentKey)
  const { loading, error, valueMap } = useBomBaseProperties(row.componentId, row.componentState)
  const client = useApolloClient()

  const [editing, setEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState('')
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [optimisticValue, setOptimisticValue] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isStale) return
    const query = row.componentState === null
      ? GET_ROOT_COMPONENT_BASE_PROPERTIES
      : GET_COMPONENT_BASE_PROPERTIES
    const variables = row.componentState === null
      ? { componentId: row.componentId }
      : { componentId: row.componentId, state: row.componentState }
    client.query({ query, variables, fetchPolicy: 'network-only' })
      .finally(() => ctx.clearStaleKey(componentKey))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStale])

  if (loading && !Object.keys(valueMap).length) {
    return React.createElement(CircularProgress, { size: 12, sx: { color: 'text.disabled' } })
  }
  if (error) {
    return React.createElement(ErrorOutlineIcon, { fontSize: 'small', sx: { color: 'text.disabled' } })
  }

  const displayValue = optimisticValue ?? valueMap[definition.id] ?? null
  const isReadOnly = definition.isReadOnly === true

  // Read-only: show value + lock icon
  if (isReadOnly) {
    return React.createElement(
      Box,
      { sx: { display: 'flex', alignItems: 'center', gap: 0.5 } },
      displayValue
        ? React.createElement(Typography, { variant: 'body2', noWrap: true }, displayValue)
        : null,
      React.createElement(LockIcon, { sx: { fontSize: 12, color: 'text.disabled', flexShrink: 0 } })
    )
  }

  // Saving state: greyed out value + spinner
  if (saving) {
    return React.createElement(
      Box,
      { sx: { display: 'flex', alignItems: 'center', gap: 0.5, pointerEvents: 'none' } },
      React.createElement(Typography, { variant: 'body2', noWrap: true, sx: { color: 'text.disabled' } }, displayValue ?? ''),
      React.createElement(CircularProgress, { size: 10, sx: { color: 'text.disabled', flexShrink: 0 } })
    )
  }

  // Edit mode: TextField
  if (editing) {
    const handleCommit = async () => {
      const trimmed = editValue.trim()
      // Basic validation: for numeric specs reject empty → treat as cancel
      if (trimmed === '') {
        setEditing(false)
        setValidationError(null)
        return
      }
      setEditing(false)
      setValidationError(null)
      setOptimisticValue(trimmed)
      setSaving(true)
      try {
        await ctx.setBaseProperty(row.componentId, row.componentState, definition.id, definition.specification, trimmed)
      } catch (err: any) {
        setOptimisticValue(null)
        setValidationError(err?.message ?? 'Save failed')
      } finally {
        setSaving(false)
      }
    }

    return React.createElement(
      Box,
      { sx: { width: '100%' } },
      React.createElement(TextField, {
        size: 'small',
        variant: 'standard',
        value: editValue,
        autoFocus: true,
        error: !!validationError,
        helperText: validationError ?? undefined,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value),
        onBlur: handleCommit,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter') { e.preventDefault(); handleCommit() }
          if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); setValidationError(null) }
        },
        sx: { width: '100%' },
        inputProps: { style: { fontSize: '0.875rem' } },
      })
    )
  }

  // Display mode: clickable to enter edit mode
  return React.createElement(
    Box,
    {
      onClick: () => {
        setEditValue(displayValue ?? '')
        setValidationError(null)
        setEditing(true)
      },
      sx: {
        cursor: 'text',
        width: '100%',
        minHeight: 24,
        '&:hover': { outline: '1px solid', outlineColor: 'divider', borderRadius: 0.5 },
      },
    },
    displayValue
      ? React.createElement(Typography, { variant: 'body2', noWrap: true }, displayValue)
      : null
  )
}

function BomBasePropCell({
  row,
  definition,
  ctx,
}: {
  row: BomRow
  definition: PropertyDefinition
  ctx: BomCellContext
}) {
  if (row.id.startsWith('load-more:')) return null
  return React.createElement(
    Box,
    { sx: { display: 'flex', alignItems: 'center', height: '100%' } },
    React.createElement(BomBasePropCellInner, { row, definition, ctx })
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
  {
    id: 'mass',
    header: 'Mass',
    width: 175,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row, ctx) => React.createElement(BomPhysicalPropertiesCell, {
      row,
      accessor: (p: any) => ({
        displayValue: p?.mass?.displayValue ?? null,
        unitName: p?.mass?.definition?.units?.name ?? null,
      }),
      sigFigs: ctx.sigFigs,
    }),
  },
  {
    id: 'volume',
    header: 'Volume',
    width: 215,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row, ctx) => React.createElement(BomPhysicalPropertiesCell, {
      row,
      accessor: (p: any) => ({
        displayValue: p?.volume?.displayValue ?? null,
        unitName: p?.volume?.definition?.units?.name ?? null,
      }),
      sigFigs: ctx.sigFigs,
    }),
  },
  {
    id: 'density',
    header: 'Density',
    width: 245,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row, ctx) => React.createElement(BomPhysicalPropertiesCell, {
      row,
      accessor: (p: any) => ({
        displayValue: p?.density?.displayValue ?? null,
        unitName: p?.density?.definition?.units?.name ?? null,
      }),
      sigFigs: ctx.sigFigs,
    }),
  },
  {
    id: 'area',
    header: 'Surface Area',
    width: 200,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row, ctx) => React.createElement(BomPhysicalPropertiesCell, {
      row,
      accessor: (p: any) => ({
        displayValue: p?.area?.displayValue ?? null,
        unitName: p?.area?.definition?.units?.name ?? null,
      }),
      sigFigs: ctx.sigFigs,
    }),
  },
  {
    id: 'boundingBox',
    header: 'Bounding Box',
    width: 160,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row, ctx) => React.createElement(BomBoundingBoxCell, { row, sigFigs: ctx.sigFigs }),
  },
]

export const DEFAULT_VISIBLE_COLUMNS = ['thumbnail', 'name', 'description', 'partNumber', 'material']

export function makeBasePropertyColumn(def: PropertyDefinition): BomColumnDef {
  return {
    id: `baseProp:${def.id}`,
    header: def.name,
    flex: 1,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row, ctx) =>
      React.createElement(BomBasePropCell, { row, definition: def, ctx }),
  }
}
