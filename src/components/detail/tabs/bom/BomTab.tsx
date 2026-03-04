import { useState, useMemo } from 'react'
import { Box, Alert, CircularProgress, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import { useBomLoader } from '../../../../hooks/useBomLoader'
import { BomColumnSettings } from './BomColumnSettings'
import { BOM_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from './bomColumns'
import type { BomCellContext } from './bomColumns'
import type { BomRow } from '../../../../types/bom.types'
import type { NavNode } from '../../../../types/nav.types'
import type { WeaveDensity } from '../../../../theme/types'

const STORAGE_KEY = 'bom-visible-columns'

const DENSITY_MAP: Record<WeaveDensity, 'compact' | 'standard' | 'comfortable'> = {
  high: 'compact',
  medium: 'standard',
  low: 'comfortable',
}

interface BomTabProps {
  node: NavNode
}

export function BomTab({ node }: BomTabProps) {
  const theme = useTheme()
  const { rows, loading, error, toggleRow, loadMore } = useBomLoader(node)

  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : DEFAULT_VISIBLE_COLUMNS
  })

  const handleColumnChange = (ids: string[]) => {
    setVisibleColumnIds(ids)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }

  const cellContext: BomCellContext = useMemo(
    () => ({ toggleRow, loadMore }),
    [toggleRow, loadMore]
  )

  const gridColumns: GridColDef[] = useMemo(
    () =>
      BOM_COLUMNS.filter(c => visibleColumnIds.includes(c.id)).map(c => ({
        field: c.id,
        headerName: c.header,
        width: c.width,
        flex: c.flex,
        sortable: false,
        valueGetter: (_value: unknown, row: BomRow) => c.getValue(row) ?? '',
        renderCell: c.renderCell
          ? (params: any) => c.renderCell!(params.row as BomRow, cellContext)
          : undefined,
      })),
    [visibleColumnIds, cellContext]
  )

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
        {error}
      </Alert>
    )
  }

  if (!rows.length) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pt: 8 }}>
        <Typography variant="body2" color="text.secondary">
          No BOM data available
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <DataGrid
        rows={rows}
        columns={gridColumns}
        getRowId={(r: BomRow) => r.id}
        hideFooter
        disableColumnMenu
        density={DENSITY_MAP[theme.density as WeaveDensity] ?? 'standard'}
        slots={{ toolbar: BomColumnSettings }}
        slotProps={{
          toolbar: {
            visibleColumnIds,
            onChange: handleColumnChange,
          } as any,
        }}
        sx={{ border: 'none', flex: 1 }}
      />
    </Box>
  )
}
