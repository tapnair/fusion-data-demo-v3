import React, { useState } from 'react'
import {
  Box,
  Popover,
  FormControlLabel,
  Checkbox,
  Button,
  Menu,
  MenuItem,
  Divider,
  CircularProgress,
  Typography,
} from '@mui/material'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import { BOM_COLUMNS } from './bomColumns'
import type { PropertyDefinition } from '../../../../hooks/useHubBasePropertyDefinitions'

const PRECISION_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '.X' },
  { value: 2, label: '.XX' },
  { value: 3, label: '.XXX' },
  { value: 4, label: '.XXXX' },
  { value: 5, label: '.XXXXX' },
  { value: 6, label: '.XXXXXX' },
]

interface BomColumnSettingsProps {
  visibleColumnIds: string[]
  onChange: (ids: string[]) => void
  sigFigs: number
  onSigFigsChange: (n: number) => void
  basePropertyDefs?: PropertyDefinition[]
  basePropsLoading?: boolean
}

export function BomColumnSettings({
  visibleColumnIds,
  onChange,
  sigFigs,
  onSigFigsChange,
  basePropertyDefs,
  basePropsLoading,
}: BomColumnSettingsProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [precisionAnchorEl, setPrecisionAnchorEl] = useState<HTMLElement | null>(null)

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleToggle = (colId: string) => {
    const col = BOM_COLUMNS.find((c) => c.id === colId)
    if (col?.alwaysVisible) return

    const next = visibleColumnIds.includes(colId)
      ? visibleColumnIds.filter((id) => id !== colId)
      : [...visibleColumnIds, colId]

    const alwaysVisibleIds = BOM_COLUMNS.filter((c) => c.alwaysVisible).map((c) => c.id)
    onChange(Array.from(new Set([...alwaysVisibleIds, ...next])))
  }

  const open = Boolean(anchorEl)
  const popoverId = open ? 'bom-column-settings-popover' : undefined

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
      <Button
        size="small"
        variant="text"
        startIcon={<ViewColumnIcon fontSize="small" />}
        aria-describedby={popoverId}
        onClick={handleOpen}
        sx={{ textTransform: 'none', color: 'text.secondary' }}
      >
        Columns
      </Button>

      <Button
        size="small"
        variant="text"
        onClick={(e) => setPrecisionAnchorEl(e.currentTarget)}
        sx={{ ml: 2, textTransform: 'none', color: 'text.secondary' }}
      >
        Precision
      </Button>
      <Menu
        anchorEl={precisionAnchorEl}
        open={Boolean(precisionAnchorEl)}
        onClose={() => setPrecisionAnchorEl(null)}
      >
        {PRECISION_OPTIONS.map((opt) => (
          <MenuItem
            key={opt.value}
            selected={sigFigs === opt.value}
            onClick={() => {
              onSigFigsChange(opt.value)
              setPrecisionAnchorEl(null)
            }}
          >
            {opt.label}
          </MenuItem>
        ))}
      </Menu>

      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column' }}>
          {BOM_COLUMNS.map((col) => (
            <FormControlLabel
              key={col.id}
              label={col.header}
              control={
                <Checkbox
                  size="small"
                  checked={visibleColumnIds.includes(col.id)}
                  disabled={col.alwaysVisible === true}
                  onChange={() => handleToggle(col.id)}
                />
              }
            />
          ))}
          {(basePropsLoading || (basePropertyDefs && basePropertyDefs.length > 0)) && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ pb: 0.5, display: 'block' }}>
                Base Properties
              </Typography>
              {basePropsLoading && <CircularProgress size={14} sx={{ my: 0.5 }} />}
              {basePropertyDefs?.map(def => {
                const colId = `baseProp:${def.id}`
                return (
                  <FormControlLabel
                    key={colId}
                    label={def.name}
                    control={
                      <Checkbox
                        size="small"
                        checked={visibleColumnIds.includes(colId)}
                        onChange={() => handleToggle(colId)}
                      />
                    }
                  />
                )
              })}
            </>
          )}
        </Box>
      </Popover>
    </Box>
  )
}
