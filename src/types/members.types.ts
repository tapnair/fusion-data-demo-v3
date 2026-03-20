export type MemberRole =
  // Hub roles
  | 'ADMIN' | 'USER' | 'GUEST'
  // Project / Folder roles
  | 'ADMINISTRATOR' | 'MANAGER' | 'EDITOR' | 'READER' | 'VIEWER'

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'

export interface MemberRow {
  id: string              // user.id — DataGrid row key
  email: string
  displayName: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  role: MemberRole
  status: MemberStatus
  isProjectCreator?: boolean  // hub only
}

export type MemberContext = 'hub' | 'project' | 'folder'

export const HUB_ROLES: { value: string; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'USER', label: 'User' },
  { value: 'GUEST', label: 'Guest' },
]

export const FOLDER_ROLES: { value: string; label: string }[] = [
  { value: 'ADMINISTRATOR', label: 'Administrator' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EDITOR', label: 'Editor' },
  { value: 'READER', label: 'Reader' },
  { value: 'VIEWER', label: 'Viewer' },
]
