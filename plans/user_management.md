# Plan: User Management Tab

## Fusion Data Demo v3

> **Goal:** Replace the "Coming soon" Users tab placeholder with a fully functional
> member management UI. The tab will display current members in a DataGrid, allow
> inline role changes, member removal, and adding new members by email address.
> The same tab and UI is used for Hub, Project, and Folder nodes — only the
> underlying queries and mutations differ.

*Plan created: 2026-03-20*

---

## Scope

| Node type | Tab visible | Members query | Roles |
|---|---|---|---|
| Hub | Yes (new) | `hub.members` | `HubMemberRoleEnum` (ADMIN / GUEST / USER) |
| Project | Yes (existing placeholder) | `project.members` | `FolderRoleEnum` (5 levels) |
| Folder | Yes (existing placeholder) | `folder.members` | `FolderRoleEnum` (5 levels) |

---

## API Reference (schema-verified)

### Roles

**Hub** (`HubMemberRoleEnum`):

| Value | Description |
|---|---|
| `ADMIN` | Administrator of the hub |
| `USER` | Regular member |
| `GUEST` | Project contributor — member of specific projects only |

**Project / Folder** (`FolderRoleEnum`):

| Value | Description |
|---|---|
| `ADMINISTRATOR` | All Manager permissions + delete items forever |
| `MANAGER` | All Editor permissions + manage members + set access levels |
| `EDITOR` | All Reader permissions + edit, upload, rename, move, delete |
| `READER` | All Viewer permissions + open with desktop, download, copy |
| `VIEWER` | View files, folders, comments, people |

**Member status** (`FolderMemberStatus` / `HubMemberStatus`):
`ACTIVE` | `INACTIVE` | `PENDING` (invitation sent, awaiting acceptance)

---

### Queries

```graphql
# Hub members
query GetHubMembers($hubId: ID!, $cursor: String) {
  hub(hubId: $hubId) {
    id
    members(pagination: { cursor: $cursor, limit: 50 }) {
      pagination { cursor pageSize }
      results {
        role
        status
        isProjectCreator
        avatarUrl
        displayName
        user { id email firstName lastName userName }
      }
    }
  }
}

# Project members
query GetProjectMembers($projectId: ID!, $cursor: String) {
  project(projectId: $projectId) {
    id
    members(pagination: { cursor: $cursor, limit: 50 }) {
      pagination { cursor pageSize }
      results {
        role
        status
        avatarUrl
        displayName
        user { id email firstName lastName userName }
      }
    }
  }
}

# Folder members
query GetFolderMembers($folderId: ID!, $projectId: ID!, $cursor: String) {
  folder(folderId: $folderId, projectId: $projectId) {
    id
    members(pagination: { cursor: $cursor, limit: 50 }) {
      pagination { cursor pageSize }
      results {
        role
        status
        avatarUrl
        displayName
        user { id email firstName lastName userName }
      }
    }
  }
}
```

---

### Mutations

#### Hub

```graphql
mutation AddHubMembers($input: AddHubMembersInput!) {
  addHubMembers(input: $input) { hub { id } }
}
# input: { hubId, emailAddresses: [EmailAddress!]! }

mutation ChangeHubMemberRole($input: ChangeHubMemberRoleInput!) {
  changeHubMemberRole(input: $input) { member { role status user { email } } }
}
# input: { hubId, emailAddress, role: HubMemberRoleEnum! }

mutation DeactivateHubMember($input: DeactivateHubMemberInput!) {
  deactivateHubMember(input: $input) { member { status user { email } } }
}
# input: { hubId, emailAddress }
# Note: Hub has no hard-delete. Deactivate = "remove" for hub members.

mutation ActivateHubMember($input: ActivateHubMemberInput!) {
  activateHubMember(input: $input) { member { status user { email } } }
}
# input: { hubId, emailAddress }

mutation ResendHubInvitation($input: ResendHubInvitationInput!) {
  resendHubInvitation(input: $input) { member { status } }
}
# input: { hubId, emailAddress }
# Only available for PENDING members
```

#### Project

```graphql
mutation AddProjectMembers($input: AddProjectMembersInput!) {
  addProjectMembers(input: $input) { project { id } }
}
# input: { projectId, memberRole: FolderRoleEnum!, emailAddresses: [EmailAddress!]! }

mutation ChangeProjectMemberRole($input: ChangeProjectMemberRoleInput!) {
  changeProjectMemberRole(input: $input) { project { id } }
}
# input: { projectId, emailAddress, memberRole: FolderRoleEnum! }

mutation RemoveProjectMembers($input: RemoveProjectMembersInput!) {
  removeProjectMembers(input: $input) { project { id } }
}
# input: { projectId, emailAddresses: [EmailAddress!]! }
```

#### Folder

```graphql
mutation AddFolderMembers($input: AddFolderMembersInput!) {
  addFolderMembers(input: $input) { folder { id } }
}
# input: { projectId, folderId, memberRole: FolderRoleEnum!, emailAddresses: [EmailAddress!]! }

mutation ChangeFolderMemberRole($input: ChangeFolderMemberRoleInput!) {
  changeFolderMemberRole(input: $input) { folder { id } }
}
# input: { projectId, folderId, emailAddress, memberRole: FolderRoleEnum! }

mutation RemoveFolderMembers($input: RemoveFolderMembersInput!) {
  removeFolderMembers(input: $input) { folder { id } }
}
# input: { projectId, folderId, emailAddresses: [EmailAddress!]! }
```

---

## Data Model

```typescript
// src/types/members.types.ts

export type MemberRole =
  // Hub roles
  | 'ADMIN' | 'USER' | 'GUEST'
  // Project / Folder roles
  | 'ADMINISTRATOR' | 'MANAGER' | 'EDITOR' | 'READER' | 'VIEWER'

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'

export interface MemberRow {
  id: string            // user.id (DataGrid row key)
  email: string
  displayName: string   // from member.displayName (API-provided)
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  role: MemberRole
  status: MemberStatus
  isProjectCreator?: boolean   // Hub only
}

export type MemberContext = 'hub' | 'project' | 'folder'
```

---

## Architecture

### New Files

| File | Purpose |
|---|---|
| `src/graphql/queries/members.ts` | Three `GET_*_MEMBERS` query documents |
| `src/graphql/mutations/members.ts` | All member mutation documents (10 total) |
| `src/types/members.types.ts` | `MemberRow`, `MemberRole`, `MemberStatus`, `MemberContext` |
| `src/hooks/useMembers.ts` | Unified data + mutation hook, context-aware |

### Modified Files

| File | Change |
|---|---|
| `src/components/detail/tabs/UsersTab.tsx` | Full implementation (replaces placeholder) |
| `src/components/detail/DetailPanel.tsx` | Add Users tab to Hub nodes |

---

## `useMembers` Hook

```typescript
export function useMembers(node: NavNode): {
  rows: MemberRow[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  addMembers: (emails: string[], role: MemberRole) => Promise<void>
  changeRole: (email: string, role: MemberRole) => Promise<void>
  removeMember: (email: string) => Promise<void>
  resendInvitation?: (email: string) => Promise<void>  // hub only
}
```

Internally, the hook:
- Selects the correct query based on `node.type`
- Extracts ID args: hub → `node.entityId`, project → `node.entityId`,
  folder → `{ folderId: node.entityId, projectId: node.projectId }`
- Maps raw API results into `MemberRow[]`
- Provides `addMembers` / `changeRole` / `removeMember` that call the
  correct mutation for the node type
- On mutation success, **refetches the members query** (`refetch()`) to
  reflect server state; no optimistic updates
- `resendInvitation` is only populated for hub context (returns undefined otherwise)

---

## `UsersTab` Component

```
UsersTab
├── Header row
│   ├── Typography "Members (N)"
│   └── Button "+ Add Members" → opens AddMemberDialog
├── DataGrid (MUI community, Weave 3 density)
│   ├── Column: Avatar (50px) — MUI Avatar with initials fallback
│   ├── Column: Name / Email — displayName + email below (flex: 1)
│   ├── Column: Role (200px) — Select dropdown, disabled for current user
│   ├── Column: Status (120px) — Chip (ACTIVE=success, PENDING=warning, INACTIVE=default)
│   └── Column: Actions (120px)
│       ├── Remove / Deactivate icon button (DeleteIcon)
│       └── Resend Invitation icon button (EmailIcon) — hub/PENDING only
└── Load more button (if hasMore)

AddMemberDialog (MUI Dialog)
├── TextField — "Email addresses" (multiline, comma or newline separated)
├── Select — "Role" (project/folder only)
│   └── Info Alert — "New hub members are added with the User role.
│       You can change their role in the table after adding." (hub only)
├── helper text explaining role levels (project/folder only)
└── Buttons: Cancel | Add Members
```

### Role Select in grid
- Inline `Select` in the Role cell (size="small", variant="standard")
- Changing the value immediately calls `changeRole(email, newRole)`
- Cell shows `CircularProgress` (size=16) while mutation is in-flight, disabled during this time
- On error: revert to previous value + `Snackbar` toast

### Remove / Deactivate
- Single click on the trash icon fires the appropriate remove/deactivate mutation
- A MUI `Dialog` confirmation prompt appears first: "Remove [Name] from this [hub/project/folder]?"
- On confirm: mutation fires, row updates on refetch
- For hub INACTIVE members: Actions column shows a "Reactivate" button (PersonAddIcon)
  calling `activateHubMember` instead of the remove button

### Status Chip
| Status | Chip color | Label |
|---|---|---|
| ACTIVE | `success` | Active |
| PENDING | `warning` | Pending |
| INACTIVE | `default` | Inactive |

---

## DetailPanel Change

Add `hub` to the tab visibility rule so the Users tab appears for all three node types:

```typescript
// Before
if (type === 'project' || type === 'folder') {
  tabs.push({ key: 'users', label: 'Users' })
}

// After
if (type === 'hub' || type === 'project' || type === 'folder') {
  tabs.push({ key: 'users', label: 'Users' })
}
```

Pass `node` to `UsersTab`:

```tsx
{activeTab === 'users' && <UsersTab node={selectedNode} />}
```

---

## Apollo Cache Strategy

- Fetch policy: `network-only` on first load, no status filter applied — all statuses shown (ACTIVE, PENDING, INACTIVE)
- `hasMore` is derived from `pagination.cursor != null` — a non-null cursor means a next page exists (`Pagination` type has `cursor` and `pageSize` only, no `hasNextPage` field)
- After any mutation: call `refetch()` on the members query to pull fresh data
- No manual cache writes — refetch is simple and correct for this use case
- Paginated "load more" uses `fetchMore` with cursor, appending results to `rows` state locally

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Members query fails | Alert with error message, retry button |
| `addMembers` fails | Dialog stays open, error shown inside dialog below email field |
| `changeRole` fails | Role Select reverts to previous value, Snackbar toast error |
| `removeMember` fails | Confirmation dialog closes, Snackbar toast error |
| `resendInvitation` fails | Snackbar toast error |
| `node.projectId` missing for folder | Alert: "Project ID not available" — guard against invalid state |

---

## Implementation Phases

### Phase 1 — Types and GraphQL documents
Create `src/types/members.types.ts`, `src/graphql/queries/members.ts`, `src/graphql/mutations/members.ts`.

### Phase 2 — `useMembers` hook
Unified hook with all query/mutation logic. Verify in browser that members list loads for hub, project, and folder nodes.

### Phase 3 — `UsersTab` component
DataGrid with Avatar, Name/Email, Role Select, Status Chip, Actions column.
`AddMemberDialog` component.

### Phase 4 — `DetailPanel` update
Add `hub` to Users tab visibility. Pass `node` prop to `UsersTab`.

### Phase 5 — Verify

- [ ] Users tab appears on hub, project, and folder nodes
- [ ] Members load and display correctly for all three contexts
- [ ] Role change Select updates on success, reverts on error
- [ ] Remove/deactivate shows confirmation dialog; row disappears after confirm
- [ ] Add Members dialog accepts emails + role, dismisses on success
- [ ] Hub PENDING members show Resend Invitation button
- [ ] Hub INACTIVE members show Reactivate button
- [ ] Load more works when there are more than 50 members
- [ ] Snackbar error toasts appear on mutation failure
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Decisions

1. **Inactive hub members** — Show all statuses (ACTIVE + PENDING + INACTIVE) in the list.
   INACTIVE rows display a "Reactivate" button (PersonAddIcon) instead of the remove button.

2. **Add Members dialog — multiple emails** — The email field accepts multiple addresses
   separated by commas or newlines. All are submitted in a single mutation call (the API
   accepts `[EmailAddress!]!`).

3. **Hub role on add** — `addHubMembers` takes no role argument; all new hub members receive
   the default `USER` role. The Add Members dialog for hub context omits the role selector
   and shows an info note: _"New hub members are added with the User role. You can change
   their role in the table after adding."_
