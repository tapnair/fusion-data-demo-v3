import React from 'react'
import { Box, Typography, CircularProgress, TextField } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import LockIcon from '@mui/icons-material/Lock'
import { useBomPhysicalProperties, PHYSICAL_PROPS_WORKING_STATES } from '../../hooks/useBomPhysicalProperties'
import { useBomBaseProperties } from '../../hooks/useBomBaseProperties'
import { useApolloClient } from '@apollo/client/react'
import {
  GET_ROOT_COMPONENT_BASE_PROPERTIES,
  GET_COMPONENT_BASE_PROPERTIES,
} from '../../graphql/queries/baseProperties'
import type { PropertyDefinition } from '../../hooks/useHubBasePropertyDefinitions'

// ---------------------------------------------------------------------------
// Core shared row shape
// ---------------------------------------------------------------------------

/** Minimum shape required by shared column renderers. */
export interface ComponentRow {
  id: string
  componentId: string
  componentState: string | null  // null for root/working composition
  name: string
  partNumber: string
  description: string
  materialName: string
}

// ---------------------------------------------------------------------------
// Context interfaces
// ---------------------------------------------------------------------------

/** Base context available to all shared column renderers. */
export interface ComponentCellContext {
  sigFigs: number
}

/**
 * Extended context for columns that can display/edit base properties.
 * When `setBaseProperty` is omitted, cells are rendered read-only.
 */
export interface BasePropertiesCapableContext extends ComponentCellContext {
  setBaseProperty?: (
    componentId: string,
    componentState: string | null,
    definitionId: string,
    specification: string | null,
    rawValue: string
  ) => Promise<void>
  staleBasePropsKeys?: Set<string>
  clearStaleKey?: (key: string) => void
}

// ---------------------------------------------------------------------------
// Column definition type
// ---------------------------------------------------------------------------

export interface ComponentColumnDef<
  TRow extends ComponentRow = ComponentRow,
  TContext extends ComponentCellContext = ComponentCellContext
> {
  /** Unique stable key for visibility persistence */
  id: string
  /** Column header label */
  header: string
  width?: number
  flex?: number
  /** Cannot be hidden via settings */
  alwaysVisible?: boolean
  /** Extract display value from a row */
  getValue?: (row: TRow) => string | null
  /** Optional custom cell renderer */
  renderCell?: (row: TRow, ctx: TContext) => React.ReactNode
  /**
   * When true, the data for this column is not fetched in the base query
   * and must be fetched separately when the column becomes visible.
   */
  fetchOnDemand?: boolean
}

// ---------------------------------------------------------------------------
// Utility: unit abbreviations & display formatting
// ---------------------------------------------------------------------------

export const UNIT_ABBREVIATIONS: Record<string, string> = {
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
export function formatDisplayValue(
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

// ---------------------------------------------------------------------------
// Physical property cell components (shared, formerly Bom-prefixed)
// ---------------------------------------------------------------------------

type PhysPropsAccessor = (physProps: any) => { displayValue: string | null; unitName: string | null } | null

function PhysicalPropertiesCellInner({
  row,
  accessor,
  sigFigs,
}: {
  row: ComponentRow
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

export function PhysicalPropertiesCell({
  row,
  accessor,
  sigFigs,
}: {
  row: ComponentRow
  accessor: PhysPropsAccessor
  sigFigs: number
}) {
  if (row.id.startsWith('load-more:')) return null
  return React.createElement(
    Box,
    { sx: { display: 'flex', alignItems: 'center', height: '100%' } },
    React.createElement(PhysicalPropertiesCellInner, { row, accessor, sigFigs })
  )
}

// ---------------------------------------------------------------------------
// Bounding box cell components (shared, formerly Bom-prefixed)
// ---------------------------------------------------------------------------

function BoundingBoxCellInner({ row, sigFigs }: { row: ComponentRow; sigFigs: number }) {
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

export function BoundingBoxCell({ row, sigFigs }: { row: ComponentRow; sigFigs: number }) {
  if (row.id.startsWith('load-more:')) return null
  return React.createElement(
    Box,
    { sx: { display: 'flex', alignItems: 'center', height: '100%' } },
    React.createElement(BoundingBoxCellInner, { row, sigFigs })
  )
}

// ---------------------------------------------------------------------------
// Physical property column definitions (shared)
// ---------------------------------------------------------------------------

export const PHYSICAL_PROPERTY_COLUMNS: ComponentColumnDef[] = [
  {
    id: 'mass',
    header: 'Mass',
    width: 175,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row, ctx) => React.createElement(PhysicalPropertiesCell, {
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
    renderCell: (row, ctx) => React.createElement(PhysicalPropertiesCell, {
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
    renderCell: (row, ctx) => React.createElement(PhysicalPropertiesCell, {
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
    renderCell: (row, ctx) => React.createElement(PhysicalPropertiesCell, {
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
    renderCell: (row, ctx) => React.createElement(BoundingBoxCell, { row, sigFigs: ctx.sigFigs }),
  },
]

// ---------------------------------------------------------------------------
// Base property cell components (shared, formerly Bom-prefixed)
// ---------------------------------------------------------------------------

function BasePropCellInner({
  row,
  definition,
  ctx,
}: {
  row: ComponentRow
  definition: PropertyDefinition
  ctx: BasePropertiesCapableContext
}) {
  const componentKey = `${row.componentId}:${row.componentState ?? 'root'}`
  const isStale = ctx.staleBasePropsKeys?.has(componentKey) ?? false
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
      .finally(() => ctx.clearStaleKey?.(componentKey))
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
  // Also treat as read-only if context does not provide setBaseProperty (e.g. search results)
  const effectivelyReadOnly = isReadOnly || !ctx.setBaseProperty

  // Read-only: show value + lock icon (only show lock if truly read-only by definition)
  if (effectivelyReadOnly) {
    return React.createElement(
      Box,
      { sx: { display: 'flex', alignItems: 'center', gap: 0.5 } },
      displayValue
        ? React.createElement(Typography, { variant: 'body2', noWrap: true }, displayValue)
        : null,
      isReadOnly
        ? React.createElement(LockIcon, { sx: { fontSize: 12, color: 'text.disabled', flexShrink: 0 } })
        : null
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
        await ctx.setBaseProperty!(row.componentId, row.componentState, definition.id, definition.specification, trimmed)
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

export function BasePropCell({
  row,
  definition,
  ctx,
}: {
  row: ComponentRow
  definition: PropertyDefinition
  ctx: BasePropertiesCapableContext
}) {
  if (row.id.startsWith('load-more:')) return null
  return React.createElement(
    Box,
    { sx: { display: 'flex', alignItems: 'center', height: '100%' } },
    React.createElement(BasePropCellInner, { row, definition, ctx })
  )
}

// ---------------------------------------------------------------------------
// makeBasePropertyColumn factory (shared)
// ---------------------------------------------------------------------------

export function makeBasePropertyColumn<
  TRow extends ComponentRow = ComponentRow,
  TContext extends BasePropertiesCapableContext = BasePropertiesCapableContext
>(def: PropertyDefinition): ComponentColumnDef<TRow, TContext> {
  return {
    id: `baseProp:${def.id}`,
    header: def.name,
    flex: 1,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row, ctx) =>
      React.createElement(BasePropCell, { row, definition: def, ctx }),
  }
}
