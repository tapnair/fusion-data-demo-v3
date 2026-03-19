# Folder Contents Tab Plan

## Overview

Add a **Contents** tab to the detail panel that appears when a `folder` node is selected. The tab displays the immediate children of the selected folder — sub-folders first (sorted A→Z), then files (sorted A→Z) — in a MUI DataGrid (community edition, already installed). All UI uses Weave 3 design system conventions already established in the project.

---

## Tab Visibility

| Node type | Tabs shown |
|-----------|-----------|
| hub       | Details |
| **project** | **Details, Users, Contents** |
| **folder** | **Details, Users, Contents** |
| item      | Details, BOM (DesignItem), View (DesignItem/DrawingItem) |

The Contents tab is added to `getAvailableTabs` for `type === 'project'` and `type === 'folder'`.

---

## Data Sources

All queries already exist in `src/graphql/queries/`. The hook selects between project-root and folder queries based on `node.type`.

### Project root — folders

`GET_FOLDERS_BY_PROJECT`
```graphql
query GetFoldersByProject($projectId: ID!) {
  foldersByProject(projectId: $projectId) {
    results { id  name  objectCount  lastModifiedOn }
  }
}
```
Variables: `node.entityId` (projectId).

### Project root — items

`GET_ITEMS_BY_PROJECT`
```graphql
query GetItemsByProject($projectId: ID!, $pagination: PaginationInput) {
  itemsByProject(projectId: $projectId, pagination: $pagination) {
    pagination { cursor pageSize }
    results { id  name  extensionType  mimeType  size  lastModifiedOn  __typename }
  }
}
```
Variables: `node.entityId` (projectId).

### Folder — sub-folders

`GET_FOLDERS_BY_FOLDER`
```graphql
query GetFoldersByFolder($projectId: ID!, $folderId: ID!) {
  foldersByFolder(projectId: $projectId, folderId: $folderId) {
    results { id  name  objectCount  lastModifiedOn }
  }
}
```
Variables: `node.projectId`, `node.entityId` (folderId).

### Folder — items

`GET_ITEMS_BY_FOLDER`
```graphql
query GetItemsByFolder($hubId: ID!, $folderId: ID!, $pagination: PaginationInput) {
  itemsByFolder(hubId: $hubId, folderId: $folderId, pagination: $pagination) {
    pagination { cursor pageSize }
    results { id  name  extensionType  mimeType  size  lastModifiedOn  __typename }
  }
}
```
Variables: `node.hubId`, `node.entityId` (folderId).

All four queries run in parallel inside `useFolderContents`. The project-root queries are `skip`ped when `node.type === 'folder'` and vice versa.

---

## Row Model

```ts
// src/types/folderContents.types.ts

export type ContentRowKind = 'folder' | 'item'

export interface ContentRow {
  id: string                    // entity id
  kind: ContentRowKind          // 'folder' | 'item'
  name: string
  itemType: string | null       // extensionType for items; null for folders
  size: string | null           // size string for items; null for folders
  objectCount: number | null    // child count for folders; null for items
  lastModifiedOn: string | null
  __typename?: string           // 'DesignItem' | 'DrawingItem' (items only)
}
```

---

## Sort Order

Rows are sorted in the component (not via DataGrid column sorting) before being passed to the grid:

1. All folders first, sorted by `name` A→Z (case-insensitive)
2. All items second, sorted by `name` A→Z (case-insensitive)

This fixed order is derived once when data loads. DataGrid column sorting is disabled in this phase.

---

## Columns

| Column | Header | Width | Source |
|--------|--------|-------|--------|
| Kind icon | — | 40 | Folder icon / File icon based on `kind` |
| Name | Name | flex: 2 | `row.name` |
| Type | Type | 160 | human-readable label (see below); `"Folder"` for folders |
| Modified | Modified | 160 | `lastModifiedOn` formatted as locale date string |
| Size | Size | 100 | `size` for items; `objectCount + " items"` for folders |

The icon column has no header label and is not sortable.
`lastModifiedOn` is an ISO 8601 string — format with `new Date(val).toLocaleDateString()`.

### Size formatting

The `size` field is a raw byte count as a string (e.g. `"2048576"`). It is formatted into human-readable units:

```ts
function formatBytes(sizeStr: string | null): string {
  if (!sizeStr) return '—'
  const bytes = parseInt(sizeStr, 10)
  if (isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}
```

Examples: `"1023"` → `"1023 B"`, `"2048576"` → `"2.0 MB"`, `"1536000000"` → `"1.4 GB"`.

Folders show `objectCount + " items"` (e.g. `"12 items"`); if `objectCount` is null or 0, show `"—"`.

---

### Type label mapping

`extensionType` values follow the pattern `{namespace}:{TypeName}` (e.g. `autodesk.fusion360:Design`). A lookup map provides human-readable labels for known types, with a fallback that splits on `:`, takes the last segment, and inserts spaces before capital letters (PascalCase → "Pascal Case").

```ts
// contentColumns.ts

const EXTENSION_TYPE_LABELS: Record<string, string> = {
  'autodesk.fusion360:Design':   'Fusion Design',
  'autodesk.fusion360:Drawing':  'Fusion Drawing',
  'autodesk.fusion360:Library':  'Fusion Library',
  'autodesk.fusion:Nest':        'Fusion Nest',
  'autodesk.cam:Operation':      'CAM Operation',
  'autodesk.bim360:Document':    'BIM360 Document',
  // extend as more types are encountered
}

function formatExtensionType(extensionType: string | null): string {
  if (!extensionType) return '—'
  if (EXTENSION_TYPE_LABELS[extensionType]) return EXTENSION_TYPE_LABELS[extensionType]
  // fallback: take last segment after ':', split PascalCase into words
  const segment = extensionType.split(':').pop() ?? extensionType
  return segment.replace(/([A-Z])/g, ' $1').trim()
}
```

---

## `useFolderContents` Hook

```ts
// src/hooks/useFolderContents.ts

export function useFolderContents(node: NavNode) {
  const isProject = node.type === 'project'
  const isFolder  = node.type === 'folder'

  // Project-root queries (skipped for folder nodes)
  const projFoldersResult = useQuery(GET_FOLDERS_BY_PROJECT, {
    variables: { projectId: node.entityId },
    skip: !isProject,
    fetchPolicy: 'cache-first',
  })
  const projItemsResult = useQuery(GET_ITEMS_BY_PROJECT, {
    variables: { projectId: node.entityId },
    skip: !isProject,
    fetchPolicy: 'cache-first',
  })

  // Folder queries (skipped for project nodes)
  const folderFoldersResult = useQuery(GET_FOLDERS_BY_FOLDER, {
    variables: { projectId: node.projectId!, folderId: node.entityId },
    skip: !isFolder || !node.projectId,
    fetchPolicy: 'cache-first',
  })
  const folderItemsResult = useQuery(GET_ITEMS_BY_FOLDER, {
    variables: { hubId: node.hubId!, folderId: node.entityId },
    skip: !isFolder || !node.hubId,
    fetchPolicy: 'cache-first',
  })

  const loading =
    projFoldersResult.loading || projItemsResult.loading ||
    folderFoldersResult.loading || folderItemsResult.loading

  const error =
    projFoldersResult.error ?? projItemsResult.error ??
    folderFoldersResult.error ?? folderItemsResult.error ?? null

  const rows: ContentRow[] = useMemo(() => {
    const rawFolders = isProject
      ? (projFoldersResult.data?.foldersByProject?.results ?? [])
      : (folderFoldersResult.data?.foldersByFolder?.results ?? [])

    const rawItems = isProject
      ? (projItemsResult.data?.itemsByProject?.results ?? [])
      : (folderItemsResult.data?.itemsByFolder?.results ?? [])

    const folderRows: ContentRow[] = rawFolders
      .map(f => ({ kind: 'folder' as const, id: f.id, name: f.name, ... }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    const itemRows: ContentRow[] = rawItems
      .map(i => ({ kind: 'item' as const, id: i.id, name: i.name, ... }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    return [...folderRows, ...itemRows]
  }, [isProject, projFoldersResult.data, projItemsResult.data,
      folderFoldersResult.data, folderItemsResult.data])

  return { rows, loading, error }
}
```

---

## Click-to-Navigate Behaviour

When a row is clicked in the Contents grid, the app navigates to that node: the detail panel switches to show the clicked folder or item's details, and the left-nav tree reflects the selection.

### Implementation

`ContentsTab` reads `setSelectedNode`, `setExpandedItems`, `expandedItems`, and `nodeChildrenCache` from `useNavContext()`.

On row click (`onRowClick` DataGrid callback):

1. **Look up the NavNode in the tree cache** — search `nodeChildrenCache.get(node.id)` for a child whose `entityId === row.id`. The current node's children are already cached there if the tree has expanded this node.

2. **If found** — call `setSelectedNode(childNode)`. For folder rows, also add the current `node.id` to `expandedItems` (ensures parent stays expanded in the tree). The `SimpleTreeView` derives its selected item from `selectedNode.id`, so the tree highlight updates automatically.

3. **If not found** (tree hasn't loaded this node's children yet) — construct a `NavNode` from available row data and parent context:
   ```ts
   const navNode: NavNode = {
     id: `${row.kind === 'folder' ? 'folder' : 'item'}:${row.id}`,
     label: row.name,
     type: row.kind === 'folder' ? 'folder' : 'item',
     entityId: row.id,
     hubId: node.hubId,
     projectId: node.type === 'project' ? node.entityId : node.projectId,
     parentFolderId: node.type === 'folder' ? node.entityId : undefined,
     hasChildren: row.kind === 'folder',
     isLoaded: false,
     parentNodeId: node.id,
   }
   setSelectedNode(navNode)
   ```
   The detail panel will load correctly (it queries by `entityId`). The tree won't highlight the node since it isn't in the tree yet — this is acceptable for this phase.

---

## `ContentsTab` Component

```tsx
// src/components/detail/tabs/ContentsTab.tsx

export function ContentsTab({ node }: { node: NavNode }) {
  const theme = useTheme()
  const { rows, loading, error } = useFolderContents(node)
  const { setSelectedNode, nodeChildrenCache, expandedItems, setExpandedItems } = useNavContext()

  const DENSITY_MAP = { high: 'compact', medium: 'standard', low: 'comfortable' }

  const handleRowClick = useCallback((params: GridRowParams) => {
    const row = params.row as ContentRow
    const cached = nodeChildrenCache.get(node.id)
    const existing = cached?.find(n => n.entityId === row.id)

    if (existing) {
      setSelectedNode(existing)
      if (!expandedItems.includes(node.id)) {
        setExpandedItems([...expandedItems, node.id])
      }
    } else {
      const navNode: NavNode = {
        id: `${row.kind === 'folder' ? 'folder' : 'item'}:${row.id}`,
        label: row.name,
        type: row.kind === 'folder' ? 'folder' : 'item',
        entityId: row.id,
        hubId: node.hubId,
        projectId: node.type === 'project' ? node.entityId : node.projectId,
        parentFolderId: node.type === 'folder' ? node.entityId : undefined,
        hasChildren: row.kind === 'folder',
        isLoaded: false,
        parentNodeId: node.id,
      }
      setSelectedNode(navNode)
    }
  }, [node, nodeChildrenCache, expandedItems, setSelectedNode, setExpandedItems])

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">{error.message}</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <DataGrid
        rows={rows}
        columns={CONTENT_COLUMNS}
        getRowId={(r) => r.id}
        hideFooter
        disableColumnMenu
        loading={loading}
        density={DENSITY_MAP[theme.density]}
        onRowClick={handleRowClick}
        sx={{ border: 'none', flex: 1, cursor: 'pointer' }}
      />
    </Box>
  )
}
```

Column definitions are co-located in the same file or in a `contentColumns.ts` file (same pattern as `bomColumns.ts`).

---

## Files

### New Files

#### `src/types/folderContents.types.ts`
`ContentRow` and `ContentRowKind` types.

#### `src/hooks/useFolderContents.ts`
Hook with two parallel `useQuery` calls, `useMemo` sort, returns `{ rows, loading, error }`.

#### `src/components/detail/tabs/ContentsTab.tsx`
The tab component. Column definitions co-located here (or in a companion `contentColumns.ts`).

### Modified Files

#### `src/components/detail/DetailPanel.tsx`
- Add `'contents'` to `TabKey` union.
- Add `{ key: 'contents', label: 'Contents' }` inside `getAvailableTabs` for `type === 'folder'`.
- Add a `<Box role="tabpanel">` block rendering `<ContentsTab node={selectedNode} />` when `activeTab === 'contents'`.
- Import `ContentsTab`.

---

## Apollo Cache

`foldersByFolder` and `itemsByFolder` are already registered as `pagedField` entries in `typePolicies.ts`. No new type policies are needed.

---

## Weave 3 Styling

- DataGrid `density` follows app density setting via `useTheme()` + `DENSITY_MAP` (same pattern as `BomTab`).
- Icon column uses `FolderIcon` / `InsertDriveFileOutlinedIcon` from `@mui/icons-material`, coloured with `text.secondary`.
- No hardcoded colours — use theme tokens only.
- Error state uses `Typography color="error"` or `Alert severity="error"`.

---

## Implementation Phases

### Phase 1 — Types
Create `src/types/folderContents.types.ts`.

### Phase 2 — Hook
Create `src/hooks/useFolderContents.ts` with parallel queries and sorted row list.

### Phase 3 — ContentsTab component
Create `src/components/detail/tabs/ContentsTab.tsx` with DataGrid and column definitions.

### Phase 4 — Wire into DetailPanel
Update `DetailPanel.tsx` to add the Contents tab for folder nodes.

### Phase 5 — Verify
- Folder with sub-folders and items: confirm folders appear first, items below, both alphabetical.
- Folder with only items / only sub-folders: confirm no empty section, no error.
- Empty folder: confirm empty DataGrid state (no rows, no crash).
- Loading state: confirm DataGrid skeleton / loading indicator while data fetches.
- Node switch: confirm tab resets correctly and new data loads when a different folder or project is selected.
- Project node: confirm Contents tab appears on projects and shows root-level folders + items.
- Density: confirm grid density changes when app density is changed.

---

## Tree Scroll-to-Selected

When a row is clicked and `setSelectedNode` is called, the left-nav tree scrolls to and highlights the selected item.

### Two cases

**Case 1 — node already in the tree** (parent was previously expanded by the user):
- `setSelectedNode` is called with the cached `NavNode`
- A `useEffect` in `NavTree.tsx` fires when `selectedNode?.id` changes
- Uses `document.querySelector('[data-itemid="..."]')` (MUI `TreeItem` renders this attribute) to find the element
- Calls `element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` inside a `requestAnimationFrame` to wait for the DOM update

**Case 2 — node not yet in the tree** (parent hasn't been expanded, children not loaded):
- `ContentsTab` adds the parent node id to `expandedItems` when the child is not in the cache
- A second `useEffect` in `NavTree.tsx` tracks newly-added entries in `expandedItems` via a `useRef` of the previous value, then calls `loadChildren` for any newly-expanded node that isn't yet in `nodeChildrenCache`
- Once `loadChildren` finishes, `nodeChildrenCache` updates (new Map reference) → the scroll `useEffect` fires again (it has `nodeChildrenCache` as a dependency) → finds the newly-rendered element and scrolls to it

### Modified files

#### `src/components/nav/NavTree.tsx`
- Destructure `selectedNode` from `useNavContext()` (currently not destructured here)
- Add `useRef<string[]>` to track previous `expandedItems` for diff detection
- Add `useEffect` 1 (scroll): deps `[selectedNode?.id, nodeChildrenCache]`
  ```ts
  useEffect(() => {
    if (!selectedNode) return
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-itemid="${CSS.escape(selectedNode.id)}"]`
      )
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [selectedNode?.id, nodeChildrenCache])
  ```
- Add `useEffect` 2 (load on programmatic expand): deps `[expandedItems]`
  ```ts
  useEffect(() => {
    const prev = prevExpandedRef.current
    const newIds = expandedItems.filter(id => !prev.includes(id))
    prevExpandedRef.current = expandedItems
    newIds.forEach(nodeId => {
      if (nodeId.startsWith('__')) return
      if (nodeChildrenCache.has(nodeId) || loadingNodes.has(nodeId)) return
      const node = findNodeById(hubNodes, nodeChildrenCache, nodeId)
      if (node?.hasChildren) loadChildren(node)
    })
  }, [expandedItems])
  ```
  Extract the existing `findNode` inner function to a module-level `findNodeById` helper to reuse it in both effects.

#### `src/components/detail/tabs/ContentsTab.tsx`
- In the **not-found-in-cache** branch of `handleRowClick`, also add the parent node id to `expandedItems`:
  ```ts
  if (!expandedItems.includes(node.id)) {
    setExpandedItems([...expandedItems, node.id])
  }
  ```
  This triggers Effect 2 in `NavTree` which loads the parent's children, after which Effect 1 scrolls to the selected node.

---

## Non-goals (this phase)

- No column sorting by the user (fixed order: folders A→Z, then items A→Z).
- No search or filtering.
- No pagination UI (items query supports pagination but this phase loads the first page only).
- No thumbnail column.
- No inline actions (rename, delete, open).
