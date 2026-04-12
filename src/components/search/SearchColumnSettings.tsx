import React, { useState } from 'react'
import {
  Box,
  Button,
  Popover,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
  Typography,
  MenuItem,
  Menu,
  Chip,
  CircularProgress,
} from '@mui/material'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import type { SearchColumnDef } from '../../types/search.types'

const PRECISION_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '.X' },
  { value: 2, label: '.XX' },
  { value: 3, label: '.XXX' },
  { value: 4, label: '.XXXX' },
  { value: 5, label: '.XXXXX' },
  { value: 6, label: '.XXXXXX' },
]

const TYPE_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'Component', value: 'COMPONENT' },
  { label: 'File', value: 'FILE' },
  { label: 'Folder', value: 'FOLDER' },
  { label: 'Model', value: 'MODEL' },
]

interface SearchColumnSettingsProps {
  columns: SearchColumnDef[]
  visibleColumnIds: Set<string>
  onVisibilityChange: (id: string, visible: boolean) => void
  sigFigs: number
  onSigFigsChange: (n: number) => void
  resultCount: number
  loading: boolean
  activeTypeFilters: string[]
  onTypeFiltersChange: (types: string[]) => void
}

export function SearchColumnSettings({
  columns,
  visibleColumnIds,
  onVisibilityChange,
  sigFigs,
  onSigFigsChange,
  resultCount,
  loading,
  activeTypeFilters,
  onTypeFiltersChange,
}: SearchColumnSettingsProps) {
  const [columnsAnchorEl, setColumnsAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [precisionAnchorEl, setPrecisionAnchorEl] = useState<HTMLElement | null>(null)

  const handleColumnsOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setColumnsAnchorEl(event.currentTarget)
  }
  const handleColumnsClose = () => setColumnsAnchorEl(null)

  const handleTypeFilterToggle = (value: string) => {
    if (activeTypeFilters.includes(value)) {
      onTypeFiltersChange(activeTypeFilters.filter(t => t !== value))
    } else {
      onTypeFiltersChange([...activeTypeFilters, value])
    }
  }

  const columnsOpen = Boolean(columnsAnchorEl)
  const columnsPopoverId = columnsOpen ? 'search-column-settings-popover' : undefined

  // Standard columns (non-base-property)
  const standardColumns = columns.filter(c => !c.id.startsWith('baseProp:'))
  const basePropertyColumns = columns.filter(c => c.id.startsWith('baseProp:'))

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 1,
        py: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
        gap: 1,
        flexWrap: 'wrap',
      }}
    >
      {/* Result count */}
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', minWidth: 60 }}>
        {loading ? (
          <CircularProgress size={12} sx={{ mr: 0.5, verticalAlign: 'middle' }} />
        ) : null}
        {!loading && `${resultCount} result${resultCount !== 1 ? 's' : ''}`}
      </Typography>

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Type filter chips */}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        {TYPE_FILTER_OPTIONS.map(opt => {
          const isActive = activeTypeFilters.includes(opt.value)
          return (
            <Chip
              key={opt.value}
              label={opt.label}
              size="small"
              color={isActive ? 'primary' : 'default'}
              variant={isActive ? 'filled' : 'outlined'}
              onClick={() => handleTypeFilterToggle(opt.value)}
              sx={{ cursor: 'pointer' }}
            />
          )
        })}
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* Columns button */}
      <Button
        size="small"
        variant="text"
        startIcon={<ViewColumnIcon fontSize="small" />}
        aria-describedby={columnsPopoverId}
        onClick={handleColumnsOpen}
        sx={{ textTransform: 'none', color: 'text.secondary' }}
      >
        Columns
      </Button>

      {/* Precision button */}
      <Button
        size="small"
        variant="text"
        onClick={(e) => setPrecisionAnchorEl(e.currentTarget)}
        sx={{ textTransform: 'none', color: 'text.secondary' }}
      >
        Precision
      </Button>

      {/* Precision menu */}
      <Menu
        anchorEl={precisionAnchorEl}
        open={Boolean(precisionAnchorEl)}
        onClose={() => setPrecisionAnchorEl(null)}
      >
        {PRECISION_OPTIONS.map(opt => (
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

      {/* Columns popover */}
      <Popover
        id={columnsPopoverId}
        open={columnsOpen}
        anchorEl={columnsAnchorEl}
        onClose={handleColumnsClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', maxHeight: 400, overflowY: 'auto' }}>
          <FormGroup>
            {standardColumns.map(col => (
              <FormControlLabel
                key={col.id}
                label={col.header}
                control={
                  <Checkbox
                    size="small"
                    checked={visibleColumnIds.has(col.id)}
                    disabled={col.alwaysVisible === true}
                    onChange={() => onVisibilityChange(col.id, !visibleColumnIds.has(col.id))}
                  />
                }
              />
            ))}
          </FormGroup>

          {basePropertyColumns.length > 0 && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ pb: 0.5, display: 'block' }}>
                Base Properties
              </Typography>
              <FormGroup>
                {basePropertyColumns.map(col => (
                  <FormControlLabel
                    key={col.id}
                    label={col.header}
                    control={
                      <Checkbox
                        size="small"
                        checked={visibleColumnIds.has(col.id)}
                        onChange={() => onVisibilityChange(col.id, !visibleColumnIds.has(col.id))}
                      />
                    }
                  />
                ))}
              </FormGroup>
            </>
          )}
        </Box>
      </Popover>
    </Box>
  )
}
