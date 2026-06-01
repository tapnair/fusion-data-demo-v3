import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useNotes } from '../../hooks/useNotes'
import { useAuth } from '../../context/AuthContext'
import type { ViewerSelection } from '../../types/viewerSelection.types'
import type { Note } from '../../services/notes/notesClient'

interface NotesTabProps {
  effective: ViewerSelection
  rootSelection: ViewerSelection
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

export function NotesTab({ effective, rootSelection }: NotesTabProps) {
  const { user } = useAuth()
  const author = user?.name?.trim() || 'Unknown'

  const isAssemblyScope = effective.componentDbId === rootSelection.componentDbId
  const componentLineageUrn = effective.componentLineageUrn
  const componentF3dId = effective.componentF3dId
  const rootLineageUrn = rootSelection.componentLineageUrn
  const componentName = effective.componentName

  const hasValidScope = isAssemblyScope
    ? rootLineageUrn !== null
    : componentLineageUrn !== null && componentF3dId !== null

  const notesArgs = isAssemblyScope
    ? { mode: 'assembly' as const, rootLineageUrn: rootLineageUrn ?? '' }
    : {
        mode: 'component' as const,
        componentLineageUrn: componentLineageUrn ?? '',
        componentF3dId: componentF3dId ?? '',
      }

  const { notes, loading, error, create, update, remove } = useNotes(notesArgs)

  const [draftBody, setDraftBody] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  if (!hasValidScope) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4, px: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Open an assembly to see notes.
        </Typography>
      </Box>
    )
  }

  const handleAdd = async () => {
    const body = draftBody.trim()
    if (body === '') return
    if (componentLineageUrn === null || componentF3dId === null || rootLineageUrn === null) {
      setCreateError(
        'Could not determine lineageUrn or f3dComponentId for this component. The viewer may still be loading — try again, or pick a different component.'
      )
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      await create({
        componentLineageUrn,
        componentF3dId,
        rootLineageUrn,
        componentName,
        body,
        author,
      })
      setDraftBody('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add note'
      setCreateError(msg)
    } finally {
      setCreating(false)
    }
  }

  const beginEdit = (note: Note) => {
    setEditingId(note.id)
    setEditingBody(note.body)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingBody('')
  }

  const commitEdit = async () => {
    if (editingId === null) return
    const body = editingBody.trim()
    if (body === '') return
    try {
      await update(editingId, body)
      setEditingId(null)
      setEditingBody('')
    } catch {
      // hook surfaces error
    }
  }

  const askRemove = (note: Note) => {
    setConfirmRemoveId(note.id)
  }

  const confirmRemove = async () => {
    if (confirmRemoveId === null) return
    const id = confirmRemoveId
    setConfirmRemoveId(null)
    try {
      await remove(id)
    } catch {
      // hook surfaces error
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          {isAssemblyScope ? 'All notes in' : 'On'}
        </Typography>
        <Typography variant="body2" noWrap>
          {isAssemblyScope ? rootSelection.componentName : componentName}
        </Typography>
      </Box>

      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          multiline
          minRows={2}
          maxRows={6}
          fullWidth
          placeholder="Add a note…"
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          size="small"
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button
            variant="contained"
            size="small"
            disabled={draftBody.trim() === '' || creating}
            onClick={handleAdd}
          >
            {creating ? 'Adding…' : 'Add note'}
          </Button>
        </Box>
        {createError !== null && (
          <Alert severity="error" sx={{ mt: 1 }} onClose={() => setCreateError(null)}>
            {createError}
          </Alert>
        )}
      </Box>

      {error !== null && (
        <Box sx={{ px: 2, pt: 1.5 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : notes.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4, px: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No notes yet — add the first one above.
          </Typography>
        </Box>
      ) : (
        <Box>
          {notes.map((note) => (
            <Box
              key={note.id}
              sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {note.author}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTimeAgo(note.createdAt)}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <IconButton
                  size="small"
                  onClick={() => beginEdit(note)}
                  aria-label="Edit note"
                >
                  <EditIcon fontSize="inherit" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => askRemove(note)}
                  aria-label="Delete note"
                >
                  <DeleteOutlineIcon fontSize="inherit" />
                </IconButton>
              </Box>
              {editingId === note.id ? (
                <Box sx={{ mt: 1 }}>
                  <TextField
                    multiline
                    minRows={2}
                    maxRows={8}
                    fullWidth
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    size="small"
                    autoFocus
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                    <Button size="small" onClick={cancelEdit}>
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={commitEdit}
                      disabled={editingBody.trim() === ''}
                    >
                      Save
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                  {note.body}
                </Typography>
              )}
              {isAssemblyScope && note.componentName !== rootSelection.componentName && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  On: {note.componentName}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      <Dialog
        open={confirmRemoveId !== null}
        onClose={() => setConfirmRemoveId(null)}
      >
        <DialogTitle>Delete this note?</DialogTitle>
        <DialogContent>
          <DialogContentText>This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemoveId(null)}>Cancel</Button>
          <Button color="error" onClick={confirmRemove}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
