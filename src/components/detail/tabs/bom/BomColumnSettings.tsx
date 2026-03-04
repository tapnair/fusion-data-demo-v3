import React, { useState } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Popover,
  FormControlLabel,
  Checkbox,
} from '@mui/material'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import { BOM_COLUMNS } from './bomColumns'

interface BomColumnSettingsProps {
  visibleColumnIds: string[]
  onChange: (ids: string[]) => void
}

export function BomColumnSettings({ visibleColumnIds, onChange }: BomColumnSettingsProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)

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
      <IconButton
        size="small"
        aria-describedby={popoverId}
        onClick={handleOpen}
        aria-label="Column visibility"
      >
        <ViewColumnIcon fontSize="small" />
      </IconButton>
      <Typography variant="body2" sx={{ ml: 0.5 }}>
        Columns
      </Typography>

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
        </Box>
      </Popover>
    </Box>
  )
}
