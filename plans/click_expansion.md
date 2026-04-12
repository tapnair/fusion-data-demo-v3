# Plan: Nav Tree Expansion on Search Result Click

## Goal

When a user clicks a search result and the detail panel opens, the left nav tree should also expand to reveal the target item — scrolling it into view so the user can see where in the hierarchy the item lives.

---

## Research Findings

### What already exists

**`useDeepLinkExpansion`** (`src/hooks/useDeepLinkExpansion.ts`) is a hook already used in `DetailPanel` that does almost exactly what we need:
- Takes a `NavNode`
- Builds an ordered ancestor chain: `['hub:H', 'project:P', 'folder:F1', 'folder:F2']`
- Uses `GET_ITEM_DETAIL` to get `project.id` and immediate `parentFolder.id`
- Walks up the folder chain via sequential `GET_FOLDER_DETAIL` calls (each gives `parentFolder.id`)
- Adds ancestors to `expandedItems` **progressively** — waits for each level's children to load before expanding the next (step 2 effect triggers on every `nodeChildrenCache` update)
- All queries use `fetchPolicy: 'cache-first'` so previously-browsed paths resolve instantly

**NavTree scroll effect** (`src/components/nav/NavTree.tsx` lines 179–185):
```typescript
useEffect(() => {
  if (!selectedNode) return
  requestAnimationFrame(() => {
    const el = document.getElementById(`nav-tree-${selectedNode.id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}, [selectedNode?.id, nodeChildrenCache])
```
This fires every time `nodeChildrenCache` changes, so it naturally retries as each tree level loads. However, it currently never finds the element because `NavTreeItem` does not set an `id` attribute on the rendered `<TreeItem>`.

**Why expansion doesn't trigger for search results today:**

`useDeepLinkExpansion` has this guard:
```typescript
if (!node || node.label !== '') return  // not a stub
```
The search result navigation creates nodes with `label: row.name` (non-empty), so expansion is always skipped. The hook was designed for URL-based "stub" nodes (label='' meaning "we only know the ID, not the name").

### API queries involved

| Query | Variables | Used for |
|---|---|---|
| `GET_ITEM_DETAIL` | `hubId`, `itemId` | Get `project.id` + `parentFolder.id` for the item |
| `GET_FOLDER_DETAIL` | `projectId`, `folderId` | Walk up: each call returns `parentFolder.id` |

`GET_ITEM_DETAIL` is already in the codebase and returns both `project.id` and `parentFolder { id }`.
`GET_FOLDER_DETAIL` returns `parentFolder { id }` and `project { id }` — both needed.

The search result row already has `parentItemHubId` and `parentItemFolderId`, but **not** `projectId` — so we still need the `GET_ITEM_DETAIL` call to get the project ID (required for `GET_FOLDER_DETAIL` variables).

### NavLoader mechanics

When a node ID is added to `expandedItems`, `NavTree` has an effect that calls `loadChildren(node)` if the node's children aren't already cached. `loadChildren` populates `nodeChildrenCache`, which triggers the deep-link step-2 effect, which adds the next ancestor, and so on. This waterfall is already working correctly.

### NavNodeType & NavNode

`NavNode` has:
- `id`, `label`, `type`, `entityId`, `hubId?`, `projectId?`, `dmProjectId?`, `parentFolderId?`, `hasChildren`, `isLoaded`, `parentNodeId?`

No existing field for "expand tree on navigation" intent.

---

## Implementation Plan

### Step 1 — Fix `NavTreeItem` scroll anchor (1 file, trivial)

**File:** `src/components/nav/NavTreeItem.tsx`

Add `id={`nav-tree-${itemId}`}` to the `<TreeItem>` element:
```tsx
<TreeItem itemId={itemId} label={itemLabel} id={`nav-tree-${itemId}`}>
```
MUI's `TreeItem` renders an `<li>` root and passes unknown HTML props through, so `id` will be applied to the element. Without this, the scroll effect in `NavTree` can never find the target.

### Step 2 — Add `needsTreeExpansion` to `NavNode` (1 file, trivial)

**File:** `src/types/nav.types.ts`

```typescript
export interface NavNode {
  ...
  /** When true, useDeepLinkExpansion should expand the tree to this node even if label is set. */
  needsTreeExpansion?: boolean
}
```

This is a clean, explicit signal from navigation code to the expansion hook — no ambiguity about stub vs. non-stub nodes.

### Step 3 — Update `useDeepLinkExpansion` trigger condition (1 file, small)

**File:** `src/hooks/useDeepLinkExpansion.ts`

Change the guard from:
```typescript
if (!node || node.label !== '') return  // not a stub
```
to:
```typescript
if (!node || (node.label !== '' && !node.needsTreeExpansion)) return
```

No other changes needed — the existing `resolveAncestors` logic already handles items correctly.

### Step 4 — Set `needsTreeExpansion: true` in search navigation (1 file, small)

**File:** `src/components/search/SearchResultsGrid.tsx` — `useRowNavigation`

For the **COMPONENT / MODEL** branch (navigates to parent item):
```typescript
const itemNode: NavNode = {
  id: `item:${row.parentItemId}`,
  label: row.name,
  type: 'item',
  entityId: row.parentItemId,
  hubId,
  hasChildren: true,
  isLoaded: false,
  needsTreeExpansion: true,   // ← add this
}
```

For the **FILE** branch (navigates to the item itself):
```typescript
const itemNode: NavNode = {
  id: `item:${row.id}`,
  label: row.name,
  type: 'item',
  entityId: row.id,
  hubId,
  hasChildren: false,
  isLoaded: false,
  needsTreeExpansion: true,   // ← add this
}
```

For the **FOLDER** branch (navigates to the folder):
```typescript
const folderNode: NavNode = {
  id: `folder:${row.id}`,
  label: row.name,
  type: 'folder',
  entityId: row.id,
  hubId,
  hasChildren: true,
  isLoaded: false,
  needsTreeExpansion: true,   // ← add this
}
```

Note: `useDeepLinkExpansion` already has a `folder` type branch in `resolveAncestors` that walks the parent chain correctly.

---

## Data flow on click

```
User clicks search result
  → useRowNavigation: setSelectedNode({ needsTreeExpansion: true, ... }), closeSearch()
  → SearchContext.isOpen = false
  → AppShell: renders DetailPanel instead of SearchResultsPage
  → DetailPanel: useDeepLinkExpansion(selectedNode) fires
  → resolveAncestors(node):
      1. GET_ITEM_DETAIL → get projectId + parentFolderId
      2. GET_FOLDER_DETAIL (loop) → walk up folder chain
      3. setPendingAncestors(['hub:H', 'project:P', 'folder:F1', ...])
  → Step-2 effect (watches nodeChildrenCache + pendingAncestors):
      • hub already in expandedItems → skip to project
      • project children loaded? → add folder:F1 to expandedItems
      • NavTree loadChildren effect picks this up → loads F1 children → updates cache
      • folder:F1 children loaded? → add folder:F2 ... (if deeper)
      • Eventually: target item is in the DOM
  → NavTree scroll effect (watches nodeChildrenCache):
      • document.getElementById('nav-tree-item:TARGET') → found
      • scrollIntoView({ behavior: 'smooth', block: 'nearest' })
```

---

## Known limitations / open questions

1. **Hub children not loaded**: `resolveAncestors` adds `hub:H` to `pendingAncestors` only when the hub's `entityId` is known. The hub should already be in `expandedItems` when searching (search requires an active hub). But hub children might not be cached yet. The step-2 waterfall handles this: hub is expanded first, its children load, then project is added.

2. **Pagination**: Auto-paginate until the target is found or pages are exhausted. Add a Step 3 to `useDeepLinkExpansion` that watches `nodeChildrenCache` for the parent node, checks if the target is present, and if not triggers `loadChildren` on any `load-more` node. Repeat until found or no more pages.

3. **FOLDER results**: `resolveAncestors` for `folder` type walks from the folder up to its root project. This means clicking a folder search result expands to that folder in the tree. The selected node is the folder itself, so `nav-tree-folder:${id}` must be visible — it will be, once its parent folder is expanded.

4. **Scroll timing**: The scroll fires on every `nodeChildrenCache` update during expansion. Early intermediate scrolls (e.g., to the hub) will fire first, then the final scroll to the target item fires once it's loaded. The last scroll wins. This should be fine visually.

5. **navTree DOM id prefix**: The scroll effect uses `nav-tree-` as a prefix. This is set in `NavTree` (the `id="nav-tree"` on `SimpleTreeView`) and needs to match the `id` we set in `NavTreeItem`. Confirm: `nav-tree-${itemId}` where `itemId = 'item:abc123'` → element id = `nav-tree-item:abc123`. Colons in HTML IDs are valid.

---

## Files changed summary

| File | Change |
|---|---|
| `src/components/nav/NavTreeItem.tsx` | Add `id={`nav-tree-${itemId}`}` to `<TreeItem>` |
| `src/types/nav.types.ts` | Add `needsTreeExpansion?: boolean` to `NavNode` |
| `src/hooks/useDeepLinkExpansion.ts` | Update guard to also fire when `needsTreeExpansion` is true |
| `src/components/search/SearchResultsGrid.tsx` | Set `needsTreeExpansion: true` on nodes from `useRowNavigation` |
| `src/graphql/queries/search.ts` | Add `project { id }` to Folder fragment (needed for folder tree expansion — projectId required for GET_FOLDER_DETAIL) |
| `src/types/search.types.ts` | Add `parentProjectId: string \| null` field |
| `src/hooks/useComponentSearch.ts` | Map `obj.project?.id` for Folder results |

Total: 7 files. No new queries, no new components.

---

## Decisions recorded

1. **Pagination**: Auto-paginate until the target is found or pages are exhausted. Add a Step 3 to `useDeepLinkExpansion` that watches `nodeChildrenCache` for the parent node, checks if the target is present, and if not triggers `loadChildren` on any `load-more` node. Repeat until found or no more pages.

2. **Result types**: ALL result types (COMPONENT, MODEL, FILE, FOLDER) trigger tree expansion.

3. **Latency**: Silent background expansion is acceptable — no loading indicator needed.
