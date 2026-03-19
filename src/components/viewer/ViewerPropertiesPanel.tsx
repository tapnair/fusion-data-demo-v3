import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Divider,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import type { ViewerSelection, ViewerProperty } from '../../types/viewerSelection.types'

interface ViewerPropertiesPanelProps {
  selection: ViewerSelection | null
  onClose: () => void
}

interface CategoryGroup {
  category: string
  props: ViewerProperty[]
}

function groupByCategory(
  properties: ViewerProperty[],
  showHidden: boolean,
): CategoryGroup[] {
  const map = new Map<string, ViewerProperty[]>()

  for (const prop of properties) {
    if (!showHidden && prop.hidden) continue
    const cat = prop.displayCategory || 'Other'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(prop)
  }

  const groups: CategoryGroup[] = Array.from(map.entries()).map(
    ([category, props]) => ({ category, props }),
  )

  // Alphabetical sort, empty string and 'Other' float to bottom
  groups.sort((a, b) => {
    const aIsOther = a.category === '' || a.category === 'Other'
    const bIsOther = b.category === '' || b.category === 'Other'
    if (aIsOther && !bIsOther) return 1
    if (!aIsOther && bIsOther) return -1
    return a.category.localeCompare(b.category)
  })

  return groups
}

export function ViewerPropertiesPanel({
  selection,
  onClose,
}: ViewerPropertiesPanelProps) {
  const [showHidden, setShowHidden] = useState(false)

  // Reset showHidden whenever the selection changes
  useEffect(() => {
    setShowHidden(false)
  }, [selection])

  if (!selection) {
    // Render nothing but keep the 320px structure so the parent's CSS
    // transition has content to slide. The parent wrapper handles visibility.
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: 320,
          borderLeft: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      />
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: 320,
        borderLeft: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {selection.name}
        </Typography>

        <Tooltip title="Show hidden properties">
          <IconButton
            size="small"
            onClick={() => setShowHidden((prev) => !prev)}
            aria-label="Show hidden properties"
          >
            {showHidden ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <IconButton size="small" onClick={onClose} aria-label="Close properties panel">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Breadcrumb */}
      <Box sx={{ px: 2, pb: 1, flexShrink: 0, overflow: 'hidden' }}>
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {selection.hierarchyPath.join(' › ')}
        </Typography>
      </Box>

      <Divider />

      {/* Scrollable properties area */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* COMPONENT section — only if parentDbId is non-null */}
        {selection.parentDbId !== null && (
          <>
            <Typography
              variant="overline"
              sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'block', color: 'text.secondary', lineHeight: 1 }}
            >
              COMPONENT
            </Typography>
            {groupByCategory(selection.parentProperties, showHidden).map(({ category, props }, index) => {
              const visibleCount = props.filter((p) => !p.hidden).length

              return (
                <Accordion
                  key={`component-${category || 'Other'}`}
                  disableGutters
                  elevation={0}
                  defaultExpanded={index === 0}
                  sx={{
                    '&:before': { display: 'none' },
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2">
                      {category || 'Other'} ({showHidden ? props.length : visibleCount})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                      }}
                    >
                      {props.map((prop) => (
                        <Box
                          component="div"
                          key={`${prop.attributeName}-${prop.displayName}`}
                          sx={{ display: 'contents' }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              px: 2,
                              py: 0.5,
                              color: prop.hidden ? 'text.disabled' : 'text.secondary',
                              borderBottom: 1,
                              borderColor: 'divider',
                            }}
                          >
                            {prop.displayName}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              px: 2,
                              py: 0.5,
                              color: prop.hidden ? 'text.disabled' : 'text.primary',
                              wordBreak: 'break-word',
                              borderBottom: 1,
                              borderColor: 'divider',
                            }}
                          >
                            {prop.displayValue}
                            {prop.units ? ` ${prop.units}` : ''}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )
            })}
          </>
        )}

        {/* Divider between sections — only when both sections are shown */}
        {selection.parentDbId !== null && <Divider sx={{ my: 1 }} />}

        {/* BODY section — always shown */}
        <Typography
          variant="overline"
          sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'block', color: 'text.secondary', lineHeight: 1 }}
        >
          BODY
        </Typography>
        {groupByCategory(selection.properties, showHidden).map(({ category, props }, index) => {
          const visibleCount = props.filter((p) => !p.hidden).length

          return (
            <Accordion
              key={`body-${category || 'Other'}`}
              disableGutters
              elevation={0}
              defaultExpanded={index === 0}
              sx={{
                '&:before': { display: 'none' },
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">
                  {category || 'Other'} ({showHidden ? props.length : visibleCount})
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                  }}
                >
                  {props.map((prop) => (
                    <Box
                      component="div"
                      key={`${prop.attributeName}-${prop.displayName}`}
                      sx={{ display: 'contents' }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          px: 2,
                          py: 0.5,
                          color: prop.hidden ? 'text.disabled' : 'text.secondary',
                          borderBottom: 1,
                          borderColor: 'divider',
                        }}
                      >
                        {prop.displayName}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          px: 2,
                          py: 0.5,
                          color: prop.hidden ? 'text.disabled' : 'text.primary',
                          wordBreak: 'break-word',
                          borderBottom: 1,
                          borderColor: 'divider',
                        }}
                      >
                        {prop.displayValue}
                        {prop.units ? ` ${prop.units}` : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          )
        })}
      </Box>
    </Box>
  )
}
