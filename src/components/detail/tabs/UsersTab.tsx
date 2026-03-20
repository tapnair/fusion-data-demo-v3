import { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Avatar,
  Chip,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  TextField,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import DeleteIcon from '@mui/icons-material/Delete'
import EmailIcon from '@mui/icons-material/Email'
import { useMembers } from '../../../hooks/useMembers'
import { useAuth } from '../../../context/AuthContext'
import type { MemberRow, MemberRole } from '../../../types/members.types'
import { HUB_ROLES, FOLDER_ROLES } from '../../../types/members.types'
import type { NavNode } from '../../../types/nav.types'
import type { WeaveDensity } from '../../../theme/types'

// ── Density map (matches BomTab / ContentsTab pattern) ───────────────────────

const DENSITY_MAP: Record<WeaveDensity, 'compact' | 'standard' | 'comfortable'> = {
  high: 'compact',
  medium: 'standard',
  low: 'comfortable',
}

// ── AddMemberDialog ───────────────────────────────────────────────────────────

interface AddMemberDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (emails: string[], role: MemberRole | null) => Promise<void>
  isHub: boolean
}

function AddMemberDialog({ open, onClose, onAdd, isHub }: AddMemberDialogProps) {
  const [emailsText, setEmailsText] = useState('')
  const [role, setRole] = useState<MemberRole>('EDITOR')
  const [adding, setAdding] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const handleAdd = async () => {
    const emails = emailsText
      .split(/[\n,]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0)
    if (emails.length === 0) return
    setAdding(true)
    setDialogError(null)
    try {
      await onAdd(emails, isHub ? null : role)
      setEmailsText('')
      onClose()
    } catch (err: any) {
      setDialogError(err?.message ?? 'Failed to add members')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Members</DialogTitle>
      <DialogContent>
        <TextField
          label="Email addresses"
          multiline
          rows={3}
          fullWidth
          sx={{ mt: 1 }}
          helperText="Enter one or more email addresses, separated by commas or new lines"
          value={emailsText}
          onChange={e => setEmailsText(e.target.value)}
        />
        {!isHub && (
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="add-member-role-label">Role</InputLabel>
            <Select
              labelId="add-member-role-label"
              label="Role"
              value={role}
              onChange={e => setRole(e.target.value as MemberRole)}
            >
              {FOLDER_ROLES.map(r => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {isHub && (
          <Alert severity="info" sx={{ mt: 2 }}>
            New hub members are added with the User role. You can change their role in the table after adding.
          </Alert>
        )}
        {dialogError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {dialogError}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={adding}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={adding || !emailsText.trim()}
          startIcon={adding ? <CircularProgress size={16} /> : undefined}
        >
          Add Members
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── UsersTab ──────────────────────────────────────────────────────────────────

interface UsersTabProps {
  node: NavNode
}

export function UsersTab({ node }: UsersTabProps) {
  const theme = useTheme()
  const { user } = useAuth()

  const {
    rows,
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
    addMembers,
    changeRole,
    removeMember,
    reactivateMember,
    resendInvitation,
  } = useMembers(node)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [confirmRemoveRow, setConfirmRemoveRow] = useState<MemberRow | null>(null)
  const [roleLoading, setRoleLoading] = useState<Record<string, boolean>>({})
  const [snackbarError, setSnackbarError] = useState<string | null>(null)

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRoleChange = async (row: MemberRow, newRole: MemberRole) => {
    setRoleLoading(prev => ({ ...prev, [row.id]: true }))
    try {
      await changeRole(row.email, newRole)
    } catch (err: any) {
      setSnackbarError(err?.message ?? 'Failed to change role')
    } finally {
      setRoleLoading(prev => ({ ...prev, [row.id]: false }))
    }
  }

  const handleResend = async (row: MemberRow) => {
    try {
      await resendInvitation(row.email)
    } catch (err: any) {
      setSnackbarError(err?.message ?? 'Failed to resend invitation')
    }
  }

  const handleReactivate = async (row: MemberRow) => {
    try {
      await reactivateMember(row.email)
    } catch (err: any) {
      setSnackbarError(err?.message ?? 'Failed to reactivate member')
    }
  }

  const handleConfirmRemove = async () => {
    if (!confirmRemoveRow) return
    const row = confirmRemoveRow
    setConfirmRemoveRow(null)
    try {
      await removeMember(row.email)
    } catch (err: any) {
      setSnackbarError(err?.message ?? 'Failed to remove member')
    }
  }

  const handleAdd = async (emails: string[], role: MemberRole | null) => {
    await addMembers(emails, role)
  }

  // ── Column definitions ───────────────────────────────────────────────────────

  const roleOptions = node.type === 'hub' ? HUB_ROLES : FOLDER_ROLES

  const columns: GridColDef[] = [
    {
      field: 'avatar',
      headerName: '',
      width: 56,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as MemberRow
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', pl: 0.5 }}>
            <Avatar
              src={row.avatarUrl ?? undefined}
              sx={{ width: 32, height: 32 }}
            >
              {row.displayName ? row.displayName.charAt(0).toUpperCase() : ''}
            </Avatar>
          </Box>
        )
      },
    },
    {
      field: 'displayName',
      headerName: 'Name',
      flex: 1,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as MemberRow
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2">{row.displayName || row.email}</Typography>
            <Typography variant="caption" color="text.secondary">{row.email}</Typography>
          </Box>
        )
      },
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 190,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as MemberRow
        const isSelf = !!user?.email && row.email === user.email
        if (roleLoading[row.id]) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <CircularProgress size={16} />
            </Box>
          )
        }
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}>
            <Tooltip title={isSelf ? 'You cannot change your own role' : ''} disableHoverListener={!isSelf}>
              <span style={{ width: '100%' }}>
                <Select
                  size="small"
                  variant="standard"
                  fullWidth
                  disabled={isSelf}
                  value={row.role}
                  onChange={e => handleRoleChange(row, e.target.value as MemberRole)}
                >
                  {roleOptions.map(r => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </Select>
              </span>
            </Tooltip>
          </Box>
        )
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as MemberRow
        let color: 'success' | 'warning' | 'default' = 'default'
        let label = 'Inactive'
        if (row.status === 'ACTIVE') {
          color = 'success'
          label = 'Active'
        } else if (row.status === 'PENDING') {
          color = 'warning'
          label = 'Pending'
        }
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Chip size="small" label={label} color={color as any} />
          </Box>
        )
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as MemberRow
        const isSelf = !!user?.email && row.email === user.email
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', gap: 0.5 }}>
            {node.type === 'hub' && row.status === 'PENDING' ? (
              <Tooltip title="Resend invitation">
                <IconButton size="small" onClick={() => handleResend(row)}>
                  <EmailIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : node.type === 'hub' && row.status === 'INACTIVE' ? (
              <Tooltip title="Reactivate">
                <IconButton size="small" color="primary" onClick={() => handleReactivate(row)}>
                  <PersonAddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title={isSelf ? 'You cannot remove yourself' : node.type === 'hub' ? 'Deactivate' : 'Remove'}>
                <span>
                  <IconButton size="small" color="error" disabled={isSelf} onClick={() => setConfirmRemoveRow(row)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        )
      },
    },
  ]

  // ── Loading / Error states ───────────────────────────────────────────────────

  if (loading && rows.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
        <Typography variant="subtitle2">
          Members ({rows.length}{hasMore ? '+' : ''})
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<PersonAddIcon />}
          onClick={() => setAddDialogOpen(true)}
        >
          Add Members
        </Button>
      </Box>

      {/* DataGrid */}
      <DataGrid
        rows={rows}
        columns={columns}
        getRowId={(r: MemberRow) => r.id}
        getRowHeight={() => 56}
        hideFooter
        disableColumnMenu
        density={DENSITY_MAP[theme.density as WeaveDensity] ?? 'standard'}
        sx={{ border: 'none', flex: 1 }}
      />

      {/* Load more */}
      {hasMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <Button variant="text" size="small" onClick={loadMore}>
            Load more
          </Button>
        </Box>
      )}

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAdd}
        isHub={node.type === 'hub'}
      />

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={confirmRemoveRow !== null}
        onClose={() => setConfirmRemoveRow(null)}
        maxWidth="xs"
      >
        <DialogTitle>
          {node.type === 'hub' ? 'Deactivate Member' : 'Remove Member'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {node.type === 'hub'
              ? `Deactivate ${confirmRemoveRow?.displayName || confirmRemoveRow?.email} from this hub?`
              : `Remove ${confirmRemoveRow?.displayName || confirmRemoveRow?.email} from this ${node.type}?`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemoveRow(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleConfirmRemove}>
            {node.type === 'hub' ? 'Deactivate' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={snackbarError !== null}
        autoHideDuration={5000}
        onClose={() => setSnackbarError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackbarError(null)} sx={{ width: '100%' }}>
          {snackbarError}
        </Alert>
      </Snackbar>
    </Box>
  )
}
