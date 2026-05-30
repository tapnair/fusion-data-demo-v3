import React from 'react'
import { Box, CircularProgress, TextField, Typography } from '@mui/material'

export interface EditableTextCellProps {
  value: string | null
  readOnly?: boolean
  onCommit: (next: string) => Promise<void>
  validate?: (next: string) => string | null
}

export function EditableTextCell({ value, readOnly, onCommit, validate }: EditableTextCellProps): React.JSX.Element {
  const [editing, setEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState('')
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [pendingError, setPendingError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [optimisticValue, setOptimisticValue] = React.useState<string | null>(null)

  const displayValue = optimisticValue ?? value ?? null

  if (readOnly) {
    return (
      <Typography variant="body2" noWrap>
        {displayValue ?? ''}
      </Typography>
    )
  }

  if (saving) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pointerEvents: 'none' }}>
        <Typography variant="body2" noWrap sx={{ color: 'text.disabled' }}>
          {displayValue ?? ''}
        </Typography>
        <CircularProgress size={10} sx={{ color: 'text.disabled', flexShrink: 0 }} />
      </Box>
    )
  }

  if (editing) {
    const exitEdit = () => {
      setEditing(false)
      setValidationError(null)
    }

    const handleCommit = async () => {
      const trimmed = editValue.trim()
      if (trimmed === '') {
        exitEdit()
        return
      }
      if (validate) {
        const validationMsg = validate(trimmed)
        if (validationMsg !== null && validationMsg !== undefined) {
          setValidationError(validationMsg)
          return
        }
      }
      setEditing(false)
      setValidationError(null)
      setPendingError(null)
      setOptimisticValue(trimmed)
      setSaving(true)
      try {
        await onCommit(trimmed)
        setOptimisticValue(null)
      } catch (err: any) {
        setOptimisticValue(null)
        setPendingError(err?.message ?? 'Save failed')
        throw err
      } finally {
        setSaving(false)
      }
    }

    return (
      <Box sx={{ width: '100%' }}>
        <TextField
          size="small"
          variant="standard"
          value={editValue}
          autoFocus
          error={!!validationError}
          helperText={validationError ?? undefined}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
          onBlur={() => { handleCommit().catch(() => { /* error already captured in state */ }) }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCommit().catch(() => { /* error already captured in state */ })
            }
            if (e.key === 'Escape') {
              e.stopPropagation()
              exitEdit()
            }
          }}
          sx={{ width: '100%' }}
          inputProps={{ style: { fontSize: '0.875rem' } }}
        />
      </Box>
    )
  }

  return (
    <Box
      onClick={() => {
        setEditValue(displayValue ?? '')
        setValidationError(pendingError)
        setEditing(true)
      }}
      sx={{
        cursor: 'text',
        width: '100%',
        minHeight: 24,
        '&:hover': { outline: '1px solid', outlineColor: 'divider', borderRadius: 0.5 },
      }}
    >
      {displayValue ? (
        <Typography variant="body2" noWrap>
          {displayValue}
        </Typography>
      ) : null}
    </Box>
  )
}
