import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TableHead,
  Typography,
} from '@mui/material'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import { useQueryLog } from '../context/QueryLogContext'
import type { QueryLogEntry } from '../context/QueryLogContext'

const COL_COUNT = 7

function formatTime(date: Date): string {
  return (
    date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) +
    '.' +
    String(date.getMilliseconds()).padStart(3, '0')
  )
}

function CodeBlock({ title, code }: { title: string; code: string | null }) {
  if (code == null) return null
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
        {title}
      </Typography>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          bgcolor: 'grey.900',
          color: 'grey.100',
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: 1.5,
          overflowX: 'auto',
          whiteSpace: 'pre',
          maxHeight: 320,
          overflowY: 'auto',
        }}
      >
        {code}
      </Box>
    </Box>
  )
}

function DetailPanel({ entry }: { entry: QueryLogEntry }) {
  const hasError = entry.errors !== null && entry.errors.length > 0

  return (
    <Box sx={{ p: 2.5 }}>
      <CodeBlock title="GraphQL Query" code={entry.query} />
      <CodeBlock
        title="Query Variables"
        code={JSON.stringify(entry.variables, null, 2)}
      />
      {hasError && (
        <CodeBlock
          title="Errors"
          code={JSON.stringify(entry.errors, null, 2)}
        />
      )}
      <CodeBlock
        title="Response"
        code={entry.response != null ? JSON.stringify(entry.response, null, 2) : null}
      />
    </Box>
  )
}

function EntryRow({ entry, index, isOpen, onToggle }: {
  entry: QueryLogEntry
  index: number
  isOpen: boolean
  onToggle: () => void
}) {
  const navigate = useNavigate()
  const hasError = entry.errors !== null && entry.errors.length > 0
  const isIntro = entry.isIntrospection

  const chipLabel = isIntro
    ? 'Introspection'
    : entry.operationType === 'mutation'
    ? 'Mutation'
    : 'Query'
  const chipColor = isIntro
    ? 'default'
    : entry.operationType === 'mutation'
    ? 'warning'
    : 'primary'

  function handleLoadInEditor(e: React.MouseEvent) {
    e.stopPropagation()
    const q = encodeURIComponent(entry.query)
    const v = encodeURIComponent(JSON.stringify(entry.variables, null, 2))
    navigate(`/query-editor?q=${q}&v=${v}`)
  }

  return (
    <>
      <TableRow
        onClick={onToggle}
        sx={{
          cursor: 'pointer',
          borderLeft: hasError ? '3px solid' : '3px solid transparent',
          borderLeftColor: hasError ? 'error.main' : 'transparent',
          opacity: isIntro ? 0.65 : 1,
          '&:hover': { bgcolor: 'action.hover' },
          bgcolor: isOpen ? 'action.selected' : undefined,
        }}
      >
        <TableCell sx={{ width: 36, p: 0.5, pl: 1 }}>
          <IconButton size="small" tabIndex={-1} sx={{ pointerEvents: 'none' }}>
            {isOpen
              ? <KeyboardArrowDownIcon fontSize="small" />
              : <KeyboardArrowRightIcon fontSize="small" />
            }
          </IconButton>
        </TableCell>
        <TableCell sx={{ width: 44 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {index}
          </Typography>
        </TableCell>
        <TableCell sx={{ width: 140 }}>
          <Chip label={chipLabel} color={chipColor as any} size="small" variant="outlined" />
        </TableCell>
        <TableCell>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ fontStyle: isIntro ? 'italic' : 'normal' }}
          >
            {entry.operationName}
          </Typography>
        </TableCell>
        <TableCell sx={{ width: 140 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon fontSize="small" />}
            onClick={handleLoadInEditor}
            sx={{ fontSize: '0.7rem', py: 0.25, px: 0.75, whiteSpace: 'nowrap' }}
          >
            Load in Editor
          </Button>
        </TableCell>
        <TableCell sx={{ width: 110, whiteSpace: 'nowrap' }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'text.secondary' }}>
            {formatTime(entry.timestamp)}
          </Typography>
        </TableCell>
        <TableCell sx={{ width: 80, textAlign: 'right' }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
            {entry.durationMs}ms
          </Typography>
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      <TableRow sx={{ '& > td': { p: 0, borderBottom: isOpen ? undefined : 'none' } }}>
        <TableCell colSpan={COL_COUNT}>
          <Collapse in={isOpen} unmountOnExit>
            <DetailPanel entry={entry} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

export default function QueryLogPage() {
  const { entries, clearLog } = useQueryLog()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function handleToggle(id: string) {
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
          Query Log
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={<DeleteSweepIcon />}
          onClick={clearLog}
          disabled={entries.length === 0}
        >
          Clear Log
        </Button>
      </Box>

      {/* Table */}
      {entries.length === 0 ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No queries yet. Navigate the app to see GraphQL operations here.
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ flex: 1, overflow: 'auto', borderRadius: 0 }}>
          <Table size="small" stickyHeader sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 36 }} />
                <TableCell sx={{ width: 44 }}>#</TableCell>
                <TableCell sx={{ width: 140 }}>Type</TableCell>
                <TableCell>Operation Name</TableCell>
                <TableCell sx={{ width: 140 }} />
                <TableCell sx={{ width: 110 }}>Time</TableCell>
                <TableCell sx={{ width: 80, textAlign: 'right' }}>Duration</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry, i) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  index={i + 1}
                  isOpen={expandedId === entry.id}
                  onToggle={() => handleToggle(entry.id)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
