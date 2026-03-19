# Resource-Based URL Routing Plan

## Overview

Replace the current single-URL `/dashboard` with a routing system where the full app state — selected node and active tab — is encoded in the URL. A shared URL navigates any authenticated user with access to the same resource directly to the same view.

---

## Current State

- Single route `/dashboard` — all state is ephemeral (NavContext in-memory, DetailPanel local state)
- No URL changes when the user selects a hub, project, folder, or item
- No URL changes when the user switches tabs
- Refreshing the page loses all selection state

---

## URL Scheme

Use **path segments** for the resource type and entity ID, with **query parameters** only for auxiliary context IDs (needed by some API calls) and the active tab.

```
/dashboard                                              → no selection (welcome screen)
/dashboard/hub/:hubId                                   → hub selected
/dashboard/project/:projectId                           → project selected
/dashboard/folder/:folderId?projectId=:pid              → folder selected
/dashboard/item/:itemId?hubId=:hid                      → item selected
```

Tab is always a query param appended to any of the above:

```
/dashboard/project/:projectId?tab=contents
/dashboard/item/:itemId?hubId=:hid&tab=bom
```

### Path params vs query params rationale

| Part | Encoding | Reason |
|------|----------|--------|
| Node type | path segment (`/hub/`, `/folder/` …) | Primary resource type — clean, readable |
| Entity ID | path segment (`:hubId`, `:itemId` …) | Primary resource identifier |
| `projectId` | query param | Auxiliary context for folder API; not the resource being viewed |
| `hubId` | query param | Auxiliary context for item API; not the resource being viewed |
| `tab` | query param | UI state, not a resource |

### Examples

```
# Hub selected, default tab
/dashboard/hub/A.FooBarHub123

# Project, Contents tab
/dashboard/project/b.ProjectXYZ?tab=contents

# Folder, Details tab (projectId needed by folder API)
/dashboard/folder/urn%3AFolder123?projectId=b.ProjectXYZ

# Design item, BOM tab (hubId needed by item API)
/dashboard/item/urn%3AItem456?hubId=A.Hub123&tab=bom
```

---

## Architecture

The URL ↔ state bridge lives in a single custom hook, `useNavRouting`, consumed by `DetailPanel`. No changes to NavContext's data model are needed.

### `useNavRouting` hook

```ts
// src/hooks/useNavRouting.ts

export function useNavRouting() {
  // Returns the initial tab key derived from the URL on mount
  // Syncs selectedNode + activeTab → URL whenever they change
}
```

**On mount (URL → state):**
1. Read the matched route params (`hubId` / `projectId` / `folderId` / `itemId`) from `useParams()` and `tab`, `hubId`, `projectId` query params from `useSearchParams()`
2. Derive `type` and `entityId` from the matched route:
   - `/dashboard/hub/:hubId` → `type='hub'`, `entityId=hubId`
   - `/dashboard/project/:projectId` → `type='project'`, `entityId=projectId`
   - `/dashboard/folder/:folderId` → `type='folder'`, `entityId=folderId`
   - `/dashboard/item/:itemId` → `type='item'`, `entityId=itemId`
3. Construct a minimal stub `NavNode`:
   ```ts
   {
     id: `${type}:${entityId}`,
     label: '',           // unknown until tree loads — detail panel fetches its own data
     type,
     entityId,
     hubId: hubId ?? undefined,       // from query param
     projectId: projectId ?? undefined, // from query param
     hasChildren: type === 'hub' || type === 'project' || type === 'folder',
     isLoaded: false,
   }
   ```
4. Call `setSelectedNode(stubNode)` — the detail components (`FolderDetail`, `ItemDetail`, etc.) already query their own data using `node.entityId`, so they load correctly from the stub.
5. Return `tab ?? 'details'` as `initialTab` so `DetailPanel` can seed its `activeTab` state.

**On change (state → URL):**
A `useEffect` in `useNavRouting` watches `selectedNode` and `activeTab`. When either changes, call `navigate` (via `useNavigate`) with the updated URL. Both node changes and tab changes push new history entries (`replace: false`) so the back button restores the exact node + tab the user was on.

```ts
// Both node changes and tab changes push a new history entry
navigate(buildUrl(selectedNode, activeTab), { replace: false })
```

The only exception is the **initial mount hydration** — when the hook first reads the URL and calls `setSelectedNode`, no navigation occurs (the URL is already correct).

### `buildUrl` helper

```ts
function buildUrl(node: NavNode | null, tab: string): string {
  if (!node) return '/dashboard'

  // Path segment by type
  const base = import.meta.env.PROD ? '/fusion-data-demo-v3' : ''
  let path: string
  switch (node.type) {
    case 'hub':     path = `/dashboard/hub/${encodeURIComponent(node.entityId)}`; break
    case 'project': path = `/dashboard/project/${encodeURIComponent(node.entityId)}`; break
    case 'folder':  path = `/dashboard/folder/${encodeURIComponent(node.entityId)}`; break
    case 'item':    path = `/dashboard/item/${encodeURIComponent(node.entityId)}`; break
    default:        return '/dashboard'
  }

  // Query params: only auxiliary context + non-default tab
  const params = new URLSearchParams()
  if (node.projectId && node.type === 'folder') params.set('projectId', node.projectId)
  if (node.hubId    && node.type === 'item')    params.set('hubId', node.hubId)
  if (tab && tab !== 'details') params.set('tab', tab)

  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}
```

Note: `encodeURIComponent` handles APS entity IDs which may contain colons, dots, and slashes.

---

## Deep Link Behaviour

When a user opens a shared URL:

1. The app boots, authenticates (OAuth redirect preserved via the SPA 404 shim already in place)
2. `useNavRouting` runs on mount, constructs a stub `NavNode` from URL params, calls `setSelectedNode`
3. `DetailPanel` reads `selectedNode` and renders the appropriate detail component — which fires its own Apollo query and displays the resource
4. The left-nav tree loads hubs as normal. The selected node's ID is passed to `selectedItems` on `SimpleTreeView` (already done). If the user later expands the tree to the selected node's location, it will highlight automatically.

**No full ancestor chain expansion on deep link.** The detail panel is self-sufficient — it doesn't need the tree to be expanded to show data. Tree expansion on deep link is deferred to a future phase.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `type`/`id` present but resource not found (403/404 from API) | Detail component shows its existing error state; URL unchanged |
| `type` or `id` missing/invalid | Treat as no selection; navigate to `/dashboard` (remove params) |
| Tab value not valid for the node type | Fall back to `'details'` |

---

## Files

### New Files

#### `src/hooks/useNavRouting.ts`
The URL ↔ state bridge. Exports `useNavRouting(activeTab, setActiveTab)` — or alternatively returns `{ initialTab }` and is driven externally. (Exact signature decided in implementation.)

### Modified Files

#### `src/components/detail/DetailPanel.tsx`
- Import and call `useNavRouting`
- Seed `activeTab` initial state from `useNavRouting`'s `initialTab` instead of hardcoded `'details'`
- Pass `activeTab` and `setActiveTab` into `useNavRouting` so it can sync URL on tab change

#### `src/App.tsx`
- Replace the single `/dashboard` route with 5 sibling routes, all rendering the same `AppShell` + `DetailPanel` subtree:
  ```tsx
  <Route path="/dashboard"                    element={<Shell />} />
  <Route path="/dashboard/hub/:hubId"         element={<Shell />} />
  <Route path="/dashboard/project/:projectId" element={<Shell />} />
  <Route path="/dashboard/folder/:folderId"   element={<Shell />} />
  <Route path="/dashboard/item/:itemId"       element={<Shell />} />
  ```
  Where `<Shell />` is the same `ProtectedRoute` → `NavProvider` → `AppShell` → `DetailPanel` subtree extracted into a variable to avoid repetition.

---

## History / Back Button Behaviour

| User action | URL change | History entry |
|-------------|-----------|---------------|
| Select a different node | New path + context query params | **push** — back goes to previous node + its last tab |
| Switch tab within same node | `?tab=` param updates | **push** — back restores previous tab on that node |
| Click Contents row (child node) | New path for child node | **push** — back returns to parent's Contents tab |
| Open app fresh at `/dashboard` | No change | — |
| Initial URL hydration on mount | No navigation | — |

---

## Implementation Phases

### Phase 1 — `useNavRouting` hook
Create `src/hooks/useNavRouting.ts`:
- `useSearchParams` to read URL on mount → construct stub NavNode → call `setSelectedNode`
- `useEffect` watching selectedNode + activeTab → call `navigate` with built URL
- Export `initialTab` for DetailPanel to seed its state

### Phase 2 — Wire into DetailPanel
- Import and call `useNavRouting`
- Initialise `activeTab` state from `initialTab`
- Call `useNavRouting`'s URL-sync effect by passing `activeTab`

### Phase 3 — Verify
- Select node in tree → URL updates immediately, reflects node type + id + context IDs
- Switch tabs → URL `tab` param updates; back button does not create extra history entries
- Copy URL, paste in new tab → correct detail panel loads, correct tab is active
- Item not found (API error) → detail shows error, URL unchanged
- No selection → URL is clean `/dashboard`
- GitHub Pages deploy → verify URL params survive the 404 → redirect → restore chain

---

## Non-goals (this phase)

- No ancestor chain expansion on deep link (tree doesn't auto-expand to the selected node's location)
- No encoding of tree expansion state in the URL (which nodes are expanded)
- No encoding of drawer open/closed state in the URL (remains localStorage)
- No tab history (back button within a node navigates to a previous node, not a previous tab)
