import { Fragment, useState, useEffect, useMemo, useCallback } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Divider,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Snackbar,
  CircularProgress,
  Popover,
  FormControlLabel,
  Checkbox,
  Skeleton,
  Link,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import BrokenImageIcon from '@mui/icons-material/BrokenImage'
import type { ViewerSelection, ViewerProperty } from '../../types/viewerSelection.types'
import type { BomRow } from '../../types/bom.types'
import { BOM_COLUMNS, makeBasePropertyColumn } from '../detail/tabs/bom/bomColumns'
import type { BomCellContext } from '../detail/tabs/bom/bomColumns'
import { useViewerComponent } from '../../hooks/useViewerComponent'
import { useComponentMutations } from '../../hooks/useComponentMutations'
import { useHubBasePropertyDefinitions } from '../../hooks/useHubBasePropertyDefinitions'
import { useActiveHub } from '../../context/NavContext'
import { useBomThumbnail, WORKING_STATES } from '../../hooks/useBomThumbnail'
import { loadSettings, saveSettings } from '../../settings'

const PANEL_WIDTH = 380
const LABEL_WIDTH = 140
const HERO_SIZE = 120

const ALWAYS_VISIBLE_IDS = ['description', 'partNumber', 'material']
const PHYSICAL_IDS = ['mass', 'volume', 'density', 'area', 'boundingBox']

interface ViewerPropertiesPanelProps {
  selection: ViewerSelection | null
  onClose: () => void
  onSelectDbId: (dbId: number) => void
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

  groups.sort((a, b) => {
    const aIsOther = a.category === '' || a.category === 'Other'
    const bIsOther = b.category === '' || b.category === 'Other'
    if (aIsOther && !bIsOther) return 1
    if (!aIsOther && bIsOther) return -1
    return a.category.localeCompare(b.category)
  })

  return groups
}

function HeroThumbnail({ componentId }: { componentId: string }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const { loading, error, status, signedUrl, objectUrl } = useBomThumbnail(componentId, null, 0)
  const isWorking = status !== null && WORKING_STATES.includes(status)
  const displayUrl = objectUrl ?? signedUrl

  if (error || status === 'FAILED') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: HERO_SIZE }}>
        <BrokenImageIcon sx={{ color: 'text.disabled', fontSize: 48 }} />
      </Box>
    )
  }

  if (loading || isWorking || !displayUrl) {
    return (
      <Skeleton
        variant="rectangular"
        width={HERO_SIZE}
        height={HERO_SIZE}
        animation={isWorking ? 'pulse' : 'wave'}
      />
    )
  }

  return (
    <>
      <img
        src={displayUrl}
        width={HERO_SIZE}
        height={HERO_SIZE}
        style={{ objectFit: 'cover', borderRadius: 4 }}
        onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
        onMouseLeave={() => setAnchorEl(null)}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
        transformOrigin={{ vertical: 'center', horizontal: 'left' }}
        disableRestoreFocus
        sx={{ pointerEvents: 'none' }}
      >
        <Box sx={{ p: 1, bgcolor: 'background.paper' }}>
          <img
            src={displayUrl}
            width={300}
            height={300}
            style={{ objectFit: 'contain', display: 'block' }}
          />
        </Box>
      </Popover>
    </>
  )
}

function PropertyAccordions({
  properties,
  keyPrefix,
  showHidden,
  defaultExpanded,
}: {
  properties: ViewerProperty[]
  keyPrefix: string
  showHidden: boolean
  defaultExpanded: boolean
}) {
  return (
    <>
      {groupByCategory(properties, showHidden).map(({ category, props }, index) => {
        const visibleCount = props.filter((p) => !p.hidden).length
        return (
          <Accordion
            key={`${keyPrefix}-${category || 'Other'}`}
            disableGutters
            elevation={0}
            defaultExpanded={defaultExpanded && index === 0}
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
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
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
  )
}

export function ViewerPropertiesPanel({
  selection,
  onClose,
  onSelectDbId,
}: ViewerPropertiesPanelProps) {
  const [showHidden, setShowHidden] = useState(false)
  const [columnsAnchor, setColumnsAnchor] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setShowHidden(false)
  }, [selection])

  const { activeHubId } = useActiveHub()
  const { definitions: basePropertyDefs } = useHubBasePropertyDefinitions(activeHubId)

  const modelId = selection?.modelId ?? null
  const { row, loading: rowLoading } = useViewerComponent(modelId)
  const { setDescription, setBaseProperty, saveError, clearSaveError } = useComponentMutations()

  const columnRegistry = useMemo(
    () => [
      ...BOM_COLUMNS.filter((c) => c.id !== 'thumbnail' && c.id !== 'name'),
      ...basePropertyDefs.map(makeBasePropertyColumn),
    ],
    [basePropertyDefs]
  )

  const [visibleIds, setVisibleIds] = useState<string[]>(
    () => loadSettings().viewerPanelVisibleColumns ?? columnRegistry.map((c) => c.id)
  )

  useEffect(() => {
    if (loadSettings().viewerPanelVisibleColumns !== undefined) return
    setVisibleIds((prev) => {
      const known = new Set(prev)
      const additions = columnRegistry.map((c) => c.id).filter((id) => !known.has(id))
      return additions.length ? [...prev, ...additions] : prev
    })
  }, [columnRegistry])

  const handleToggleColumn = (id: string) => {
    setVisibleIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      saveSettings({ viewerPanelVisibleColumns: next })
      return next
    })
  }

  const cellContext: BomCellContext = useMemo(
    () => ({
      toggleRow: () => {},
      loadMore: () => {},
      sigFigs: loadSettings().bomSigFigs ?? 3,
      staleBasePropsKeys: new Set<string>(),
      clearStaleKey: () => {},
      setBaseProperty,
      setDescription,
      thumbnailGeneration: 0,
    }),
    [setBaseProperty, setDescription]
  )

  const bomRowForCells = useMemo<BomRow | null>(() => {
    if (!row) return null
    return {
      ...row,
      quantity: null,
      sequenceNumber: 0,
      depth: 0,
      hasChildren: false,
      isExpanded: false,
      isLoading: false,
      parentRowId: null,
      nextCursor: null,
    }
  }, [row])

  const renderHeader = useCallback(
    (opts: { showVisibility: boolean; showColumns: boolean }) => (
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
          {selection?.componentName ?? ''}
        </Typography>

        {opts.showVisibility && (
          <Tooltip title="Show hidden properties">
            <IconButton
              size="small"
              onClick={() => setShowHidden((prev) => !prev)}
              aria-label="Show hidden properties"
            >
              {showHidden ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}

        {opts.showColumns && (
          <Tooltip title="Column settings">
            <IconButton
              size="small"
              onClick={(e) => setColumnsAnchor(e.currentTarget)}
              aria-label="Column settings"
            >
              <ViewColumnIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <IconButton size="small" onClick={onClose} aria-label="Close properties panel">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    ),
    [selection?.componentName, showHidden, onClose]
  )

  if (!selection) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: PANEL_WIDTH,
          borderLeft: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      />
    )
  }

  const isFallback = selection.modelId === null
  const hasRawAccordion = isFallback || selection.body !== null

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: PANEL_WIDTH,
        borderLeft: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {renderHeader({ showVisibility: hasRawAccordion, showColumns: !isFallback })}

      <Box
        sx={{
          px: 2,
          pb: 1,
          flexShrink: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0.5,
          rowGap: 0.25,
        }}
      >
        {selection.hierarchyPath.map((node, i) => {
          const isLast = i === selection.hierarchyPath.length - 1
          return (
            <Fragment key={`${node.dbId}-${i}`}>
              {i > 0 && (
                <Typography variant="caption" color="text.secondary">
                  ›
                </Typography>
              )}
              {isLast ? (
                <Typography variant="caption" sx={{ fontWeight: 600 }} color="text.primary">
                  {node.name}
                </Typography>
              ) : (
                <Link
                  component="button"
                  variant="caption"
                  underline="hover"
                  color="text.secondary"
                  onClick={() => onSelectDbId(node.dbId)}
                  sx={{ textAlign: 'left', p: 0, minWidth: 0 }}
                >
                  {node.name}
                </Link>
              )}
            </Fragment>
          )
        })}
      </Box>

      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {isFallback ? (
          <>
            <Alert severity="info" sx={{ m: 1 }}>
              MFG DM data not available for this component.
            </Alert>
            <Typography
              variant="overline"
              sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'block', color: 'text.secondary', lineHeight: 1 }}
            >
              COMPONENT
            </Typography>
            <PropertyAccordions
              properties={selection.componentProperties}
              keyPrefix="component"
              showHidden={showHidden}
              defaultExpanded
            />
            {selection.body !== null && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography
                  variant="overline"
                  sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'block', color: 'text.secondary', lineHeight: 1 }}
                >
                  BODY
                </Typography>
                <PropertyAccordions
                  properties={selection.body.properties}
                  keyPrefix="body"
                  showHidden={showHidden}
                  defaultExpanded
                />
              </>
            )}
          </>
        ) : rowLoading || !bomRowForCells ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <HeroThumbnail componentId={bomRowForCells.componentId} />
            </Box>

            {(() => {
              const visible = columnRegistry.filter((col) => visibleIds.includes(col.id))
              const alwaysRows = visible.filter((c) =>
                ALWAYS_VISIBLE_IDS.includes(c.id)
              )
              const baseRows = visible.filter((c) => c.id.startsWith('baseProp:'))
              const physicalRows = visible.filter((c) => PHYSICAL_IDS.includes(c.id))

              const renderRow = (col: (typeof visible)[number]) => {
                const rendered = col.renderCell
                  ? col.renderCell(bomRowForCells, cellContext)
                  : (col.getValue?.(bomRowForCells) ?? null)
                return (
                  <Box
                    key={`${col.id}:${bomRowForCells.componentId}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: `${LABEL_WIDTH}px 1fr`,
                      alignItems: 'center',
                      gap: 1,
                      py: 0.75,
                      borderBottom: 1,
                      borderColor: 'divider',
                      minHeight: 32,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {col.header}
                    </Typography>
                    <Box sx={{ minWidth: 0 }}>
                      {typeof rendered === 'string' ? (
                        <Typography variant="body2" noWrap>
                          {rendered}
                        </Typography>
                      ) : (
                        rendered
                      )}
                    </Box>
                  </Box>
                )
              }

              return (
                <>
                  {alwaysRows.length > 0 && (
                    <Box sx={{ px: 2, pb: 1 }}>{alwaysRows.map(renderRow)}</Box>
                  )}

                  {baseRows.length > 0 && (
                    <Accordion
                      disableGutters
                      elevation={0}
                      defaultExpanded
                      sx={{
                        '&:before': { display: 'none' },
                        borderTop: 1,
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2">Base Properties</Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 0, px: 2, pb: 1 }}>
                        {baseRows.map(renderRow)}
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {physicalRows.length > 0 && (
                    <Accordion
                      disableGutters
                      elevation={0}
                      defaultExpanded={false}
                      sx={{
                        '&:before': { display: 'none' },
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2">Physical Properties</Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 0, px: 2, pb: 1 }}>
                        {physicalRows.map(renderRow)}
                      </AccordionDetails>
                    </Accordion>
                  )}
                </>
              )
            })()}

            {selection.body !== null && (
              <>
                <Divider />
                <Accordion
                  disableGutters
                  elevation={0}
                  defaultExpanded={false}
                  sx={{
                    '&:before': { display: 'none' },
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2">Body Properties</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <PropertyAccordions
                      properties={selection.body.properties}
                      keyPrefix="body"
                      showHidden={showHidden}
                      defaultExpanded={false}
                    />
                  </AccordionDetails>
                </Accordion>
              </>
            )}
          </>
        )}
      </Box>

      <Popover
        open={Boolean(columnsAnchor)}
        anchorEl={columnsAnchor}
        onClose={() => setColumnsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', maxHeight: 400, overflowY: 'auto' }}>
          {columnRegistry.map((col) => (
            <FormControlLabel
              key={col.id}
              label={col.header}
              control={
                <Checkbox
                  size="small"
                  checked={visibleIds.includes(col.id)}
                  onChange={() => handleToggleColumn(col.id)}
                />
              }
            />
          ))}
        </Box>
      </Popover>

      <Snackbar
        open={saveError !== null}
        autoHideDuration={5000}
        onClose={() => clearSaveError()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => clearSaveError()} sx={{ width: '100%' }}>
          {saveError}
        </Alert>
      </Snackbar>
    </Box>
  )
}
