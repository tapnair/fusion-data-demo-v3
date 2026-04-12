import {
  Box,
  TextField,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  InputAdornment,
  Tooltip,
  Paper,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import { useSearch } from '../../context/SearchContext'
import { useActiveHub } from '../../context/NavContext'

interface SearchBarProps {
  searchableProperties?: Array<{ id: string; propertyDefinition: { name: string; specification: string | null } }>
  propertiesLoading?: boolean
}

export function SearchBar({ searchableProperties = [], propertiesLoading = false }: SearchBarProps) {
  const {
    closeSearch,
    mode,
    setMode,
    query,
    setQuery,
    selectedPropertyId,
    setSelectedPropertyId,
    propertyQueryValues,
    setPropertyQueryValues,
  } = useSearch()
  const { activeHubId } = useActiveHub()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeSearch?.()
  }

  const noHub = !activeHubId

  return (
    <Paper
      elevation={2}
      square
      sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
    >
      {noHub ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon color="disabled" />
          <Typography color="text.secondary" variant="body2">
            Expand a hub in the navigation tree to search within it.
          </Typography>
          <IconButton size="small" onClick={() => closeSearch?.()} sx={{ ml: 'auto' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Row 1: text input + mode toggle + close */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={mode === 'freetext' ? 'Search...' : 'Enter property value...'}
              value={mode === 'freetext' ? (query ?? '') : (propertyQueryValues ?? '')}
              onChange={e =>
                mode === 'freetext' ? setQuery?.(e.target.value) : setPropertyQueryValues?.(e.target.value)
              }
              onKeyDown={handleKeyDown}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_e, v) => {
                if (v) setMode?.(v)
              }}
              size="small"
            >
              <ToggleButton value="freetext">Free text</ToggleButton>
              <ToggleButton value="property">Property</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Close search">
              <IconButton size="small" onClick={() => closeSearch?.()}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {/* Row 2: property picker (only in property mode) */}
          {mode === 'property' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Autocomplete
                sx={{ minWidth: 280 }}
                size="small"
                loading={propertiesLoading}
                options={searchableProperties}
                getOptionLabel={opt => opt.propertyDefinition.name}
                value={searchableProperties.find(p => p.id === selectedPropertyId) ?? null}
                onChange={(_e, v) => setSelectedPropertyId?.(v?.id ?? null)}
                renderInput={params => <TextField {...params} placeholder="Select property..." />}
              />
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                contains
              </Typography>
              <TextField
                size="small"
                placeholder="Value..."
                value={propertyQueryValues ?? ''}
                onChange={e => setPropertyQueryValues?.(e.target.value)}
                onKeyDown={handleKeyDown}
                sx={{ flex: 1 }}
              />
            </Box>
          )}
        </Box>
      )}
    </Paper>
  )
}
