# Left Navigation Drawer — Implementation Plan
## Fusion Data Demo v3

> **Goal:** Add a collapsible left drawer with a lazy-loading tree that navigates
> Hubs → Projects → Folders → Items. Selecting any node renders a detail panel in
> the main content area. Uses existing Weave 3 theme, MUI components, and
> `@mui/x-tree-view` (already installed).

*Plan created: 2026-03-03*

---

## Architecture Overview

```
App.tsx
└── AppShell (new)
    ├── Header (existing, modified)
    ├── NavDrawer (new)   ← collapsible, left side
    │   └── NavTree (new) ← @mui/x-tree-view RichTreeView
    └── Main content area
        └── DetailPanel (new) ← renders based on NavContext selection
            ├── DefaultDashboard (existing Dashboard, minor update)
            ├── HubDetail (new)
            ├── ProjectDetail (new)
            ├── FolderDetail (new)
            └── ItemDetail (new)
```

### State Flow

```
NavContext (new)
  selectedNode: NavNode | null
  expandedNodes: string[]
  nodeChildren: Map<string, NavNode[]>
  nodeLoadingState: Map<string, boolean>

NavTree reads NavContext → user expands/selects → NavContext updates
DetailPanel reads NavContext.selectedNode → renders appropriate detail
```

---

## Data Model

### Tree Node Shape

```typescript
// src/types/nav.types.ts

export type NavNodeType = 'hub' | 'project' | 'folder' | 'item'

export interface NavNode {
  id: string          // Unique tree ID: "{type}:{entityId}" e.g. "hub:abc123"
  label: string
  type: NavNodeType
  entityId: string    // Raw API entity ID
  hubId?: string      // Propagated from parent for API calls
  projectId?: string  // Propagated from parent for API calls
  parentFolderId?: string
  hasChildren: boolean
  isLoaded: boolean   // Whether children have been fetched
}
```

### Node ID convention

| Level   | id format                          | Example                          |
|---------|------------------------------------|----------------------------------|
| Hub     | `hub:{hubId}`                      | `hub:a.YWNoZW1lOg`               |
| Project | `project:{projectId}`              | `project:b.Ykl1`                 |
| Folder  | `folder:{folderId}`                | `folder:urn:adsk.wipprod:fs.f`   |
| Item    | `item:{itemId}`                    | `item:urn:adsk.wipprod:dm.lineage:xyz` |

Using a prefixed composite ID prevents ID collisions between entity types.

---

## GraphQL Queries Required

All from `schema.graphql`. New methods to add to `MfgDataModelClient`.

### 1. Get Projects for a Hub
```graphql
query GetProjects($hubId: ID!) {
  projects(hubId: $hubId) {
    results {
      id
      name
      thumbnailUrl
      fusionWebUrl
      alternativeIdentifiers {
        dataManagementAPIProjectId
      }
    }
  }
}
```

### 2. Get Root Folders + Items for a Project (parallel fetch)
```graphql
query GetFoldersByProject($projectId: ID!) {
  foldersByProject(projectId: $projectId) {
    results {
      id
      name
      path
      objectCount
      lastModifiedOn
    }
  }
}
```

```graphql
query GetItemsByProject($projectId: ID!, $pagination: PaginationInput) {
  itemsByProject(projectId: $projectId, pagination: $pagination) {
    pagination {
      cursor
      pageSize
    }
    results {
      id
      name
      extensionType
      mimeType
      size
      lastModifiedOn
      createdOn
      ... on DesignItem {
        fusionWebUrl
        isConfiguration
        tipRootModel { id }
        thumbnail { status smallImageUrl }
      }
      ... on DrawingItem {
        fusionWebUrl
      }
    }
  }
}
```

Both queries are fired in parallel when a project node is expanded. Results are merged: `[...folders, ...items]`. If items exceed 50, a `load-more` node is appended.

### 3. Get Sub-folders Within a Folder
```graphql
query GetFoldersByFolder($projectId: ID!, $folderId: ID!) {
  foldersByFolder(projectId: $projectId, folderId: $folderId) {
    results {
      id
      name
      path
      objectCount
      lastModifiedOn
    }
  }
}
```

### 4. Get Items Within a Folder (paginated, 50 per page)
```graphql
query GetItemsByFolder($hubId: ID!, $folderId: ID!, $pagination: PaginationInput) {
  itemsByFolder(hubId: $hubId, folderId: $folderId, pagination: $pagination) {
    results {
      id
      name
      extensionType
      mimeType
      size
      lastModifiedOn
      createdOn
      ... on DesignItem {
        fusionWebUrl
        isConfiguration
        tipRootModel {
          id
        }
        thumbnail {
          status
          smallImageUrl
        }
      }
      ... on DrawingItem {
        fusionWebUrl
      }
    }
    pagination {
      cursor
      pageSize
    }
  }
}
```

Variables: `{ pagination: { pageSize: 50, cursor: null } }` on first load; subsequent pages pass the returned `cursor`.

### 5. Hub Detail
```graphql
query GetHubDetail($hubId: ID!) {
  hub(hubId: $hubId) {
    id
    name
    fusionWebUrl
    alternativeIdentifiers {
      dataManagementAPIHubId
    }
    settings {
      allowedExtensionTypes
    }
  }
}
```

### 6. Project Detail
```graphql
query GetProjectDetail($projectId: ID!) {
  project(projectId: $projectId) {
    id
    name
    fusionWebUrl
    thumbnailUrl
    hub {
      id
      name
    }
    alternativeIdentifiers {
      dataManagementAPIProjectId
    }
  }
}
```

### 7. Folder Detail
```graphql
query GetFolderDetail($projectId: ID!, $folderId: ID!) {
  folder(projectId: $projectId, folderId: $folderId) {
    id
    name
    path
    objectCount
    createdOn
    createdBy { name }
    lastModifiedOn
    lastModifiedBy { name }
    fusionWebUrl
    parentFolder {
      id
      name
    }
    project {
      id
      name
    }
  }
}
```

### 8. Item Detail
```graphql
query GetItemDetail($hubId: ID!, $itemId: ID!) {
  item(hubId: $hubId, itemId: $itemId) {
    id
    name
    extensionType
    mimeType
    size
    createdOn
    createdBy { name }
    lastModifiedOn
    lastModifiedBy { name }
    parentFolder {
      id
      name
    }
    project {
      id
      name
    }
    ... on DesignItem {
      fusionWebUrl
      isConfiguration
      thumbnail {
        status
        smallImageUrl
        largeImageUrl
      }
      tipRootModel {
        id
        timestamp
        component(composition: WORKING) {
          id
          name { value }
          partNumber { value }
          description { value }
        }
      }
    }
    ... on DrawingItem {
      fusionWebUrl
    }
  }
}
```

---

## TypeScript Types

### `src/types/project.types.ts`
```typescript
export interface Project {
  id: string
  name: string
  thumbnailUrl?: string
  fusionWebUrl?: string
  hub?: { id: string; name: string }
  alternativeIdentifiers?: {
    dataManagementAPIProjectId?: string
  }
}

export interface ProjectsResponse {
  projects: { results: Project[] }
}
```

### `src/types/folder.types.ts`
```typescript
export interface Folder {
  id: string
  name: string
  path?: string
  objectCount?: number
  createdOn?: string
  createdBy?: { name: string }
  lastModifiedOn?: string
  lastModifiedBy?: { name: string }
  fusionWebUrl?: string
  parentFolder?: { id: string; name: string }
  project?: { id: string; name: string }
}

export interface FoldersResponse {
  foldersByProject?: { results: Folder[] }
  foldersByFolder?: { results: Folder[] }
}
```

### `src/types/item.types.ts`
```typescript
export interface ItemBase {
  id: string
  name: string
  extensionType?: string
  mimeType?: string
  size?: string
  createdOn?: string
  createdBy?: { name: string }
  lastModifiedOn?: string
  lastModifiedBy?: { name: string }
  parentFolder?: { id: string; name: string }
  project?: { id: string; name: string }
  fusionWebUrl?: string
}

export interface Thumbnail {
  status?: string
  smallImageUrl?: string
  largeImageUrl?: string
}

export interface DesignItem extends ItemBase {
  __typename: 'DesignItem'
  isConfiguration?: boolean
  thumbnail?: Thumbnail
  tipRootModel?: {
    id: string
    timestamp?: string
    component?: {
      id: string
      name?: { value: string }
      partNumber?: { value: string }
      description?: { value: string }
    }
  }
}

export interface DrawingItem extends ItemBase {
  __typename: 'DrawingItem'
}

export type Item = DesignItem | DrawingItem

export interface ItemsResponse {
  itemsByFolder: { results: Item[] }
}
```

### `src/types/nav.types.ts`
```typescript
export type NavNodeType = 'hub' | 'project' | 'folder' | 'item' | 'load-more'

export interface NavNode {
  id: string
  label: string
  type: NavNodeType
  entityId: string
  hubId?: string
  projectId?: string
  parentFolderId?: string
  hasChildren: boolean
  isLoaded: boolean
  // 'load-more' nodes only — tracks which folder to continue paginating
  parentNodeId?: string
}

export interface FolderPaginationState {
  nextCursor: string | null   // null = no more pages
  hasMore: boolean
  pageSize: 50
}
```

---

## Files to Create

### 1. `src/context/NavContext.tsx`

Manages tree selection and lazy-load cache.

```typescript
interface NavContextValue {
  selectedNode: NavNode | null
  setSelectedNode: (node: NavNode | null) => void
  expandedItems: string[]
  setExpandedItems: (ids: string[]) => void
  nodeChildrenCache: Map<string, NavNode[]>
  setNodeChildren: (parentId: string, children: NavNode[]) => void
  appendNodeChildren: (parentId: string, children: NavNode[]) => void  // for load-more
  loadingNodes: Set<string>
  setNodeLoading: (nodeId: string, loading: boolean) => void
  folderPagination: Map<string, FolderPaginationState>   // keyed by folder node id
  setFolderPagination: (nodeId: string, state: FolderPaginationState) => void
}
```

### 2. `src/components/layout/AppShell.tsx`

Top-level layout wrapper used by authenticated routes. Replaces the role of `Dashboard` and `HubsPage` as layout containers.

```typescript
interface AppShellProps {
  colorScheme: WeaveColorScheme
  density: WeaveDensity
  onColorSchemeChange: (s: WeaveColorScheme) => void
  onDensityChange: (d: WeaveDensity) => void
  children: React.ReactNode   // content area (DetailPanel or legacy pages)
}
```

Layout structure (MUI):
```
<Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
  <Header ... />
  <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
    <NavDrawer open={drawerOpen} onToggle={toggleDrawer} />
    <Box component="main" sx={{ flex: 1, overflow: 'auto', p: 3 }}>
      {children}
    </Box>
  </Box>
</Box>
```

Drawer open state lives here (or in NavContext). Persisted to localStorage key `nav-drawer-open`.

### 3. `src/components/layout/NavDrawer.tsx`

MUI `Drawer` (permanent variant, toggled by width) wrapping `NavTree`.

```typescript
const DRAWER_WIDTH_OPEN = 300
const DRAWER_WIDTH_CLOSED = 0  // fully hidden — main content takes full width

interface NavDrawerProps {
  open: boolean
  onToggle: () => void
}
```

- Use MUI `Drawer` with `variant="permanent"` and CSS `width` transition
- When closed: `width: 0`, `overflow: hidden` — drawer is completely hidden
- Toggle is in the Header (hamburger `MenuIcon`) — no toggle button inside the drawer itself
- Drawer header shows "Navigation" label when open
- Scrollable interior via `overflow: 'auto'`
- Styled with Weave 3 surface color: `background.paper`

### 4. `src/components/nav/NavTree.tsx`

Uses `RichTreeView` from `@mui/x-tree-view`.

```typescript
// Key responsibilities:
// 1. Seeds root with hub nodes from useHubs()
// 2. On node expansion: fetches children via MfgDataModelClient
// 3. On node selection: updates NavContext.selectedNode
// 4. Shows loading indicator per node while fetching
// 5. Uses custom item slot for icons + loading state
```

**Lazy loading strategy:**
- On `onItemExpansionToggle`: check if node `isLoaded`, if not → fetch children → cache in NavContext → mark loaded
- Uses `getItemChildren` prop only as fallback; primary approach is managing items array in state

**Icon mapping:**

| Node type | Icon (MUI)                          |
|-----------|-------------------------------------|
| hub       | `AccountTreeIcon` or `HubIcon`      |
| project   | `FolderSpecialIcon`                 |
| folder    | `FolderIcon` / `FolderOpenIcon`     |
| item (design) | `DesignServicesIcon`           |
| item (drawing) | `ArticleIcon`                 |

### 5. `src/components/nav/NavTreeItem.tsx`

Custom item component for `RichTreeView` using the `slots.item` prop.

- Shows spinner overlay on the label when `loadingNodes.has(node.id)`
- Truncates long labels with `text-overflow: ellipsis`
- Uses Weave 3 typography: `body2` / `caption`
- Active node highlighted with `primary.main` background tint

### 6. `src/components/detail/DetailPanel.tsx`

Reads `NavContext.selectedNode` and renders the correct detail component.

```typescript
function DetailPanel() {
  const { selectedNode } = useNavContext()

  if (!selectedNode) return <DefaultView />   // existing Dashboard content

  switch (selectedNode.type) {
    case 'hub':     return <HubDetail node={selectedNode} />
    case 'project': return <ProjectDetail node={selectedNode} />
    case 'folder':  return <FolderDetail node={selectedNode} />
    case 'item':    return <ItemDetail node={selectedNode} />
  }
}
```

### 7. `src/components/detail/HubDetail.tsx`

Fetches and displays hub details.

Fields shown:
- Hub name (h4)
- Hub ID (monospace, copyable)
- Data Management API Hub ID
- Link to Fusion web URL
- Projects count (link → expands in tree)
- Allowed extension types

### 8. `src/components/detail/ProjectDetail.tsx`

Fields shown:
- Project name + thumbnail image (if available)
- Project ID
- Parent hub name (link)
- Fusion web URL
- Data Management API Project ID

### 9. `src/components/detail/FolderDetail.tsx`

Fields shown:
- Folder name + full path
- Object count (badge)
- Created by / on
- Last modified by / on
- Parent folder link
- Parent project link
- Fusion web URL

### 10. `src/components/detail/ItemDetail.tsx`

Fields shown (common):
- Item name
- Extension type / MIME type
- File size
- Created by / on
- Last modified by / on
- Parent folder / project links
- Fusion web URL button

Additional for `DesignItem`:
- Thumbnail image (if available)
- isConfiguration badge
- Component name, part number, description (from `tipRootModel.component`)
- "Open in Fusion" button (fusionWebUrl)

Additional for `DrawingItem`:
- "Open in Fusion" button (fusionWebUrl)

**Scope boundary:** No BOM data. Item detail is metadata-only. BOM is a future enhancement.

---

## Files to Modify

### `src/services/api/mfgDataModelClient.ts`

Add 8 new methods:

```typescript
async getProjects(hubId: string): Promise<ProjectsResponse>
async getFoldersByProject(projectId: string): Promise<FoldersResponse>
async getFoldersByFolder(projectId: string, folderId: string): Promise<FoldersResponse>
async getItemsByFolder(hubId: string, folderId: string, pagination?: { pageSize: number; cursor: string | null }): Promise<ItemsResponse>
async getHubDetail(hubId: string): Promise<{ hub: Hub }>
async getProjectDetail(projectId: string): Promise<{ project: Project }>
async getFolderDetail(projectId: string, folderId: string): Promise<{ folder: Folder }>
async getItemDetail(hubId: string, itemId: string): Promise<{ item: Item }>
```

### `src/App.tsx`

Wrap authenticated routes in `AppShell` + `NavProvider`:

```typescript
// Before
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard colorScheme={...} density={...} ... />
  </ProtectedRoute>
} />

// After
<Route path="/dashboard" element={
  <ProtectedRoute>
    <NavProvider>
      <AppShell colorScheme={...} density={...} ...>
        <DetailPanel />
      </AppShell>
    </NavProvider>
  </ProtectedRoute>
} />
```

The `/hubs` route and `HubsPage.tsx` are **deleted**. The tree drawer fully replaces the hub grid.

### `src/pages/Dashboard.tsx`

Reduce to a "default/welcome" view shown when no tree node is selected:
- Keep welcome message + user info
- Remove `HubList` (tree replaces it)
- Add a hint: "Select a hub in the left panel to begin"

### `src/pages/HubsPage.tsx` — **DELETE**

File is removed. The `/hubs` route is also removed from `App.tsx`. The tree drawer replaces this page entirely.

### `src/components/layout/Header.tsx`

Add a drawer toggle button (hamburger / menu icon) at the far left of the toolbar:

```typescript
<IconButton
  edge="start"
  color="inherit"
  onClick={onDrawerToggle}  // new prop
  sx={{ mr: 2 }}
>
  <MenuIcon />
</IconButton>
```

---

## New Hooks

### `src/hooks/useNavLoader.ts`

Central hook for lazy-loading tree children. Called by `NavTree` on node expand.

```typescript
function useNavLoader() {
  const { getAccessToken } = useAuth()

  async function loadChildren(node: NavNode): Promise<NavNode[]> {
    const client = new MfgDataModelClient(...)

    switch (node.type) {
      case 'hub':
        const { projects } = await client.getProjects(node.entityId)
        return projects.results.map(p => ({
          id: `project:${p.id}`,
          label: p.name,
          type: 'project',
          entityId: p.id,
          hubId: node.entityId,
          hasChildren: true,
          isLoaded: false,
        }))

      case 'project':
        const { foldersByProject } = await client.getFoldersByProject(node.entityId)
        return foldersByProject.results.map(f => ({
          id: `folder:${f.id}`,
          label: f.name,
          type: 'folder',
          entityId: f.id,
          hubId: node.hubId,
          projectId: node.entityId,
          hasChildren: (f.objectCount ?? 0) > 0,
          isLoaded: false,
        }))

      case 'folder':
        // Fetch sub-folders AND first page of items in parallel
        const [foldersRes, itemsRes] = await Promise.all([
          client.getFoldersByFolder(node.projectId!, node.entityId),
          client.getItemsByFolder(node.hubId!, node.entityId, { pageSize: 50, cursor: null }),
        ])
        const subFolders = foldersRes.foldersByFolder.results.map(f => ({...}))
        const items = itemsRes.itemsByFolder.results.map(i => ({
          id: `item:${i.id}`,
          label: i.name,
          type: 'item' as NavNodeType,
          entityId: i.id,
          hubId: node.hubId,
          projectId: node.projectId,
          parentFolderId: node.entityId,
          hasChildren: false,
          isLoaded: true,
        }))

        // Store pagination cursor for this folder in NavContext
        const paginationInfo = itemsRes.itemsByFolder.pagination
        const hasMore = !!paginationInfo?.cursor
        setFolderPagination(node.id, { nextCursor: paginationInfo?.cursor ?? null, hasMore, pageSize: 50 })

        // Append a load-more pseudo-node if there are more pages
        const loadMoreNode: NavNode[] = hasMore ? [{
          id: `load-more:${node.id}`,
          label: 'Load more...',
          type: 'load-more',
          entityId: node.entityId,
          hubId: node.hubId,
          projectId: node.projectId,
          parentFolderId: node.entityId,
          parentNodeId: node.id,
          hasChildren: false,
          isLoaded: true,
        }] : []

        return [...subFolders, ...items, ...loadMoreNode]

      case 'load-more':
        // Called when user clicks a load-more node — appends next page to parent folder
        const folderNodeId = node.parentNodeId!
        const pagination = getFolderPagination(folderNodeId)
        const moreItems = await client.getItemsByFolder(
          node.hubId!, node.entityId, { pageSize: 50, cursor: pagination.nextCursor }
        )
        const newPagination = moreItems.itemsByFolder.pagination
        const stillMore = !!newPagination?.cursor
        setFolderPagination(folderNodeId, { nextCursor: newPagination?.cursor ?? null, hasMore: stillMore, pageSize: 50 })

        const newItemNodes = moreItems.itemsByFolder.results.map(i => ({...mapItemToNode(i, node)}))
        // Replace the old load-more node with new items (+ new load-more if still more)
        replaceLoadMoreNode(folderNodeId, node.id, newItemNodes, stillMore)
        return []   // appendNodeChildren handles the actual state update
    }
  }

  return { loadChildren }
}
```

---

## Component Layout Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Header: [☰] Fusion Data Demo           [⚙️] [Logout]           │
├──────────────────────────────────────────────────────────────────┤
│         │                                                         │
│  [<]    │                                                         │
│  ──     │                                                         │
│  ▼ Hub1 │   DetailPanel                                          │
│    ▶ Project A │                                                  │
│    ▼ Project B │   (Hub / Project / Folder / Item details)       │
│      ▶ Folder1 │                                                  │
│      ▼ Folder2 │                                                  │
│        📄 Item1│                                                  │
│        📄 Item2│                                                  │
│  ▶ Hub2        │                                                  │
│                │                                                  │
│  NavDrawer     │  Main Content Area                              │
│  (300px open)  │  (flex: 1)                                      │
└────────────────┴─────────────────────────────────────────────────┘
```

Drawer collapsed state (fully hidden):
```
┌──────────────────────────────────────────────────────────────────┐
│  Header: [☰] Fusion Data Demo           [⚙️] [Logout]           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│                  DetailPanel (full width)                        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Weave 3 Styling Notes

All components use the existing theme — no custom colors hardcoded.

| Element                     | Token / sx                                       |
|-----------------------------|--------------------------------------------------|
| Drawer background           | `background.paper`                               |
| Drawer border               | `divider` (right border)                         |
| Tree item hover             | `action.hover`                                   |
| Tree item selected          | `action.selected` bg, `primary.main` text        |
| Loading spinner in tree     | `CircularProgress size={14}`                     |
| Detail section headers      | `Typography variant="h6"`                        |
| Metadata labels             | `Typography variant="caption" color="text.secondary"` |
| Metadata values             | `Typography variant="body2"`                     |
| External link buttons       | `Button variant="outlined" size="small"`         |
| Copy-to-clipboard for IDs   | `IconButton` with `ContentCopyIcon`              |

Drawer transition uses MUI's built-in `Drawer` animation. Width transition on
open/close is handled by setting `width` on the Drawer `PaperProps` with a CSS
`transition` matching MUI's `theme.transitions.create`.

---

## Implementation Phases

### Phase 1 — Types & API Layer
1. Create `src/types/project.types.ts`, `folder.types.ts`, `item.types.ts`, `nav.types.ts`
2. Add 8 new methods to `src/services/api/mfgDataModelClient.ts`

**Acceptance criteria:** TypeScript compiles, new methods callable.

---

### Phase 2 — NavContext
1. Create `src/context/NavContext.tsx`
2. Export `NavProvider` and `useNavContext` hook

**Acceptance criteria:** Context mounts without errors, state readable.

---

### Phase 3 — NavTree + NavDrawer
1. Create `src/hooks/useNavLoader.ts`
2. Create `src/components/nav/NavTreeItem.tsx`
3. Create `src/components/nav/NavTree.tsx`
   - Seed with hubs from `useHubs()`
   - Lazy-load children on expand via `useNavLoader`
   - Update `NavContext` on selection
4. Create `src/components/layout/NavDrawer.tsx`

**Acceptance criteria:**
- Tree renders with hub nodes
- Expanding a hub loads its projects
- Expanding a project loads root folders
- Expanding a folder loads sub-folders + items
- Selecting any node updates `NavContext.selectedNode`
- Drawer opens and closes with smooth transition

---

### Phase 4 — Detail Components
1. Create `src/components/detail/DetailPanel.tsx`
2. Create `src/components/detail/HubDetail.tsx`
3. Create `src/components/detail/ProjectDetail.tsx`
4. Create `src/components/detail/FolderDetail.tsx`
5. Create `src/components/detail/ItemDetail.tsx`

**Acceptance criteria:**
- Each detail component fetches and displays entity data
- Loading / error states handled
- `DetailPanel` switches correctly based on selected node type

---

### Phase 5 — AppShell & Layout Integration
1. Create `src/components/layout/AppShell.tsx`
2. Modify `src/components/layout/Header.tsx` — add drawer toggle prop
3. Modify `src/App.tsx` — wrap authenticated routes in `NavProvider` + `AppShell`
4. Simplify `src/pages/Dashboard.tsx` — remove `HubList`, add "select a hub" prompt

**Acceptance criteria:**
- Authenticated pages render with drawer on the left
- Drawer toggle in Header opens/closes drawer
- Drawer state persists in localStorage
- `DetailPanel` replaces old hub grid as main content
- Existing auth flow unchanged

---

### Phase 6 — Polish
1. Keyboard navigation (built into `RichTreeView`)
2. Empty states (no projects, empty folder)
3. Breadcrumb in detail panel header showing path
4. Error retry in tree nodes
5. Tooltip on collapsed tree items (show full name)
6. Test all 9 Weave 3 theme combinations

---

## Files Summary

### New files (14)
```
src/types/project.types.ts
src/types/folder.types.ts
src/types/item.types.ts
src/types/nav.types.ts
src/context/NavContext.tsx
src/hooks/useNavLoader.ts
src/components/layout/AppShell.tsx
src/components/layout/NavDrawer.tsx
src/components/nav/NavTree.tsx
src/components/nav/NavTreeItem.tsx
src/components/detail/DetailPanel.tsx
src/components/detail/HubDetail.tsx
src/components/detail/ProjectDetail.tsx
src/components/detail/FolderDetail.tsx
src/components/detail/ItemDetail.tsx
```

### Modified files (4)
```
src/services/api/mfgDataModelClient.ts  — 8 new query methods, pagination param on getItemsByFolder
src/App.tsx                              — wrap routes in AppShell + NavProvider, remove /hubs route
src/components/layout/Header.tsx        — add drawerToggle prop
src/pages/Dashboard.tsx                 — simplify to welcome/default view
```

### Deleted files (1)
```
src/pages/HubsPage.tsx                  — replaced by tree drawer
```

---

## Key Dependencies

All already installed:
- `@mui/x-tree-view` — `RichTreeView`, custom item slots, lazy loading
- `@mui/material` — `Drawer`, `Box`, `Typography`, `IconButton`, `CircularProgress`
- `@mui/icons-material` — tree node icons, drawer toggle icon

---

## Notes & Decisions

| Topic | Decision | Reason |
|---|---|---|
| Drawer collapsed state | **Fully hidden (width 0)** | Main content takes full width; clean, simple layout |
| Drawer toggle location | Header hamburger icon only | No toggle inside drawer; follows material design pattern |
| Drawer default state | Open | More discoverable on first use |
| Folder children loading | Parallel fetch (folders + items, first 50) | Single expand action, fewer round trips |
| Folder pagination | **"Load more" pseudo-node, 50 items/page** | Handles large folders without blocking expand |
| `item` node children | `hasChildren: false` | Items are leaf nodes in the hierarchy |
| Item detail depth | **Metadata only** (no BOM) | Fast single API call; BOM is a future enhancement |
| HubsPage | **Deleted** — `/hubs` route removed | Tree drawer fully replaces the hub grid |
| Project expansion | Parallel fetch: `foldersByProject` + `itemsByProject` (50/page) | Aggregate view — consistent with folder expansion |
| Hub node context | `hubId` propagated down to folder/item | Required by `itemsByFolder(hubId, folderId)` API |
| Drawer state persistence | localStorage `nav-drawer-open` | Consistent with theme persistence pattern |
| Item `__typename` discrimination | Inline fragments in query | GraphQL union type; `__typename` returned automatically |
