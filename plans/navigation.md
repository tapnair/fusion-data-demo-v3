# Resource-Based URL Routing Plan

## Status: ✅ IMPLEMENTED — with bug fixes applied (2026-04-11)

Core routing is complete. Several bugs were found and fixed during testing; see **Bug Fixes & Deviations** section at the bottom.

---

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
3. `DetailPanel` reads `selectedNode` and renders the appropriate detail component — which fires its own Apollo query and displays the resource immediately
4. `useDeepLinkExpansion` (see below) runs in parallel to progressively expand the left-nav tree to the selected node's location

---

## Ancestor Path Resolution (`useDeepLinkExpansion`)

A dedicated hook resolves the ancestor chain of the deep-linked node and progressively expands the tree, so the selected node appears highlighted in its proper location.

### The problem

The tree is lazy-loaded top-down: hub → projects → folders/items. To expand the tree to a folder or item, we need to know every ancestor ID so we can expand each level in sequence. The URL only contains the node's own ID plus one context ID (`projectId` for folders, `hubId` for items) — not the full path.

### Algorithm

**Step 1 — Resolve the hub ID** (needed to start tree expansion from the top):

| URL type | How to get `hubId` |
|----------|--------------------|
| `/hub/:hubId` | Already in the URL path |
| `/project/:projectId` | Query `GET_PROJECT_DETAIL(projectId)` → `project.hub.id` |
| `/folder/:folderId?projectId=` | Same: query `GET_PROJECT_DETAIL(projectId)` → `project.hub.id` |
| `/item/:itemId?hubId=` | Already in the URL query param |

**Step 2 — Resolve the folder ancestry chain** (folders/items only):

Folders and items may be nested inside one or more sub-folders. Walk up the `parentFolder` chain by repeatedly calling `GET_FOLDER_DETAIL` until reaching a folder with no `parentFolder` (root-level folder directly under the project):

```
GET_FOLDER_DETAIL(targetFolderId)  → parentFolder.id = F1
GET_FOLDER_DETAIL(F1)              → parentFolder.id = null  ← root folder
```

Result: ancestor path = `[hubId, projectId, F1, targetFolderId]`

For items, the immediate parent folder ID comes from `GET_ITEM_DETAIL` (which `DetailPanel` is already fetching). Once that resolves, apply the same walk-up from `item.parentFolder.id`.

**Step 3 — Progressive tree expansion**

With the full ancestor chain known, expand each level in sequence by adding node IDs to `expandedItems`. The existing `useEffect` in `NavTree` (Effect 2) watches `expandedItems` and calls `loadChildren` for any newly-expanded uncached node. Once children load (`nodeChildrenCache` updates), the next ancestor is added, and so on until the target node's parent is expanded and the target appears in the tree — at which point the scroll effect (Effect 1) fires automatically.

```
expandedItems ← ['hub:H1']
  → NavTree Effect 2 loads hub children (projects)
  → nodeChildrenCache updated → hook sees project in cache
expandedItems ← ['hub:H1', 'project:P1']
  → NavTree Effect 2 loads project children (root folders+items)
  → nodeChildrenCache updated → hook sees F1 in cache
expandedItems ← ['hub:H1', 'project:P1', 'folder:F1']
  → NavTree Effect 2 loads F1's children
  → target folder now in cache → selectedItems highlights it
  → scroll effect fires
```

### `useDeepLinkExpansion` hook

```ts
// src/hooks/useDeepLinkExpansion.ts

export function useDeepLinkExpansion(node: NavNode | null) {
  // Only runs when the node was created from a URL (isLoaded: false, label: '')
  // 1. Resolves hubId via GET_PROJECT_DETAIL if needed
  // 2. Walks up parentFolder chain via GET_FOLDER_DETAIL to build ancestor array
  // 3. Uses a useEffect watching nodeChildrenCache to expand one level at a time
  // 4. Stops when the target node appears in its parent's cache entry
  // 5. No-ops if the node is already visible in the tree cache
}
```

**Key implementation detail:** The hook tracks a `pendingAncestors: string[]` state (the ordered list of node IDs to expand, from hub down to immediate parent). A `useEffect` watching `nodeChildrenCache` pops the next ancestor off the list and adds it to `expandedItems` once the previous level's children are loaded.

### Caching

All `GET_PROJECT_DETAIL` and `GET_FOLDER_DETAIL` calls during ancestor resolution use `fetchPolicy: 'cache-first'` — if the detail panel has already fetched the same data, no extra network requests fire.

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

#### `src/hooks/useDeepLinkExpansion.ts`
Ancestor chain resolution and progressive tree expansion for deep links. Called from `DetailPanel` with the current `selectedNode`. No-ops when the node was selected via normal tree navigation (already in cache).

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

### Phase 1 — Routes in `App.tsx`
Add 4 new sibling routes (`/dashboard/hub/:hubId`, etc.) all rendering the same shell subtree.

### Phase 2 — `useNavRouting` hook
Create `src/hooks/useNavRouting.ts`:
- `useParams` + `useSearchParams` to read URL on mount → construct stub NavNode → call `setSelectedNode`
- `useEffect` watching `selectedNode` + `activeTab` → call `navigate` with `buildUrl()`
- All navigations use `replace: false` (push)
- Guard: skip navigation on initial mount hydration to avoid double history entry
- Export `initialTab` for `DetailPanel` to seed its state

### Phase 3 — Wire into DetailPanel
- Import and call `useNavRouting`
- Initialise `activeTab` state from `initialTab` instead of hardcoded `'details'`
- Add call to `useDeepLinkExpansion(selectedNode)`

### Phase 4 — `useDeepLinkExpansion` hook
Create `src/hooks/useDeepLinkExpansion.ts`:
- Detect deep-link stubs (node with `isLoaded: false`, `label: ''`)
- Query `GET_PROJECT_DETAIL` to resolve `hubId` where needed
- Walk up `parentFolder` chain via `GET_FOLDER_DETAIL` to build ancestor array
- `useEffect` watching `nodeChildrenCache` to expand one level at a time

### Phase 5 — Verify
- Select node in tree → URL updates, reflects path + context params
- Switch tabs → URL updates; back button restores previous tab
- Copy URL, paste in new tab → detail panel loads immediately, tree expands progressively
- Deep link to nested folder → tree expands hub → project → parent folders → target highlighted
- Deep link to item → item detail loads immediately, tree expands to item location
- Item not found (API 403/404) → detail shows error, URL unchanged
- No selection → URL is clean `/dashboard`
- GitHub Pages → verify URL path segments survive the 404 → redirect → restore chain

---

## Non-goals (this phase)

- No encoding of tree expansion state in the URL (which nodes are expanded beyond the selected path)
- No encoding of drawer open/closed state in the URL (remains localStorage)
- No deep link support for `hub` nodes (hub detail is minimal; hub expansion is trivial and handled naturally)

---

## Bug Fixes & Deviations (2026-04-11)

Three bugs were found during testing and fixed. Each required a deviation from the original plan.

---

### Fix 1 — URL scheme extended: items now carry `projectId` and `folderId`

**Original plan URL for items:**
```
/dashboard/item/:itemId?hubId=:hid
```

**Actual URL for items (after fix):**
```
/dashboard/item/:itemId?hubId=:hid&projectId=:pid&folderId=:fid
```

**Root cause:** `useDeepLinkExpansion` called `GET_ITEM_DETAIL(hubId, itemId)` to discover the item's `project.id` and `parentFolder.id` so it could build the ancestor chain. In practice this query returned `null` for both fields when called with a lineage URN, so `pendingAncestors` ended up as only `['hub:H1']` — the hub expanded but project and folder did not.

**Fix:** `buildUrl` now includes `projectId` and `parentFolderId` as query params for item nodes. `parseLocation` extracts `folderId`. The URL→state stub is created with `parentFolderId: folderId`. `useDeepLinkExpansion` reads `n.projectId` and `n.parentFolderId` directly from the stub when available, skipping `GET_ITEM_DETAIL` entirely. The `GET_FOLDER_DETAIL` walk-up still runs to resolve intermediate folders (e.g. root folder → sub-folder → item's parent), but now uses the correct `projectId` from the URL. Falls back to `GET_ITEM_DETAIL` for old/external links that predate this fix.

**Files changed:** `src/hooks/useNavRouting.ts`, `src/hooks/useDeepLinkExpansion.ts`

---

### Fix 2 — Auth redirect loses the URL (React state timing race)

**Symptom:** Pasting a deep link in a new tab, authenticating via OAuth, and landing on `/dashboard` instead of the original URL.

**Root cause:** Two-stage race condition:
1. `ProtectedRoute` correctly saved the URL to `sessionStorage` before redirecting to `/`
2. After OAuth, `AuthCallback` called `window.__handleAuthSuccess` (queues `setIsAuthenticated(true)`) then `navigate(savedUrl)` via React Router
3. On the next render, `ProtectedRoute` still saw `isAuthenticated=false` (React state batch hadn't flushed) → re-saved the URL and redirected to `/` again
4. `Home` then saw `isAuthenticated=true` (state flushed) and unconditionally redirected to `/dashboard`, discarding the `sessionStorage` value

**Fix:** `AuthCallback` now uses `window.location.replace(window.location.origin + redirect)` instead of React Router's `navigate()`. A hard redirect forces a full page reload; the app re-initialises with the token already in `localStorage`, so `AuthProvider`'s mount effect sets `isAuthenticated=true` before `ProtectedRoute` ever renders.

**Files changed:** `src/components/auth/AuthCallback.tsx`, `src/components/auth/ProtectedRoute.tsx` (sessionStorage save added)

---

### Fix 3 — NavTree timing race: hub expands but children never load on deep link

**Symptom:** After deep-link restoration, the hub node expanded in the tree but its children (projects) never appeared — even though `useDeepLinkExpansion` had already added `hub:H1` to `expandedItems`.

**Root cause:** `useDeepLinkExpansion` calls `setExpandedItems(['hub:H1'])` to trigger hub expansion. NavTree's expansion effect (watching `[expandedItems]`) calls `findNodeById(hubNodes, ...)` to get the hub node and call `loadChildren`. But when the deep link is processed on mount, `useHubs` hasn't resolved yet — `hubNodes` is empty. `findNodeById` returns `null`, so `loadChildren` is never called. When hubs eventually load, `expandedItems` hasn't changed, so the effect doesn't re-run.

**Fix:** A second `useEffect` was added to `NavTree` that depends on `[hubNodes]`. When `hubNodes` first populates, it iterates `expandedItems` and calls `loadChildren` for any node that is expanded but not yet in `nodeChildrenCache` or `loadingNodes`. This catches the timing gap where expansion was set before the hub list loaded.

**Files changed:** `src/components/nav/NavTree.tsx`

---

### Fix 4 — `useNavRouting` state→URL effect overwrote deep-link URL on first render

**Symptom:** Pasting a deep link caused a brief flash where the URL was reset to `/dashboard`.

**Root cause:** On mount, both effects in `useNavRouting` ran in the same cycle. The URL→state effect queued `setSelectedNode(stub)` but the state→URL effect still saw `selectedNode=null` (state update hadn't applied) and called `navigate('/dashboard')`, overwriting the deep-link URL.

**Fix:** `isFirstRender` ref guard skips the state→URL effect on the very first render. State updates from the URL→state effect are applied before the state→URL effect fires on subsequent renders.

**Files changed:** `src/hooks/useNavRouting.ts`
