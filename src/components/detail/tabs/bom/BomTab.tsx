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
import { loadSettings, saveSettings } from '../../../../settings'

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

  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(
    () => loadSettings().bomVisibleColumns ?? DEFAULT_VISIBLE_COLUMNS
  )

  const [sigFigs, setSigFigs] = useState<number>(
    () => loadSettings().bomSigFigs ?? 3
  )

  const handleColumnChange = (ids: string[]) => {
    setVisibleColumnIds(ids)
    saveSettings({ bomVisibleColumns: ids })
  }

  const handleSigFigsChange = (n: number) => {
    setSigFigs(n)
    saveSettings({ bomSigFigs: n })
  }

  const cellContext: BomCellContext = useMemo(
    () => ({ toggleRow, loadMore, sigFigs }),
    [toggleRow, loadMore, sigFigs]
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
      <BomColumnSettings
        visibleColumnIds={visibleColumnIds}
        onChange={handleColumnChange}
        sigFigs={sigFigs}
        onSigFigsChange={handleSigFigsChange}
      />
      <DataGrid
        rows={rows}
        columns={gridColumns}
        getRowId={(r: BomRow) => r.id}
        hideFooter
        disableColumnMenu
        density={DENSITY_MAP[theme.density as WeaveDensity] ?? 'standard'}
        sx={{ border: 'none', flex: 1 }}
      />
    </Box>
  )
}
