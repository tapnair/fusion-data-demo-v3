# Tabbed UI Plan

## Overview

Replace the flat `DetailPanel` with a tabbed interface in the main content area. Tabs displayed depend on the selected node type and, for items, the resolved GraphQL `__typename`.

---

## Tab Visibility Rules

| Tab | Hub | Project | Folder | Item (DesignItem) | Item (DrawingItem) | Item (other) |
|-----|-----|---------|--------|-------------------|--------------------|--------------|
| **Details** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Users** | — | ✓ | ✓ | — | — | — |
| **BOM** | — | — | — | ✓ | — | — |
| **View** | — | — | — | ✓ | ✓ | — |

**Item subtype challenge**: The nav tree only knows `type: 'item'`. The `__typename` (`DesignItem` | `DrawingItem` | etc.) is only available after the `GET_ITEM_DETAIL` Apollo query resolves. BOM and View tabs are hidden entirely until the subtype is resolved — only the Details tab is shown while loading. Once resolved, the applicable tabs appear. Because Apollo caches results, revisiting a previously selected item resolves the type synchronously — no delay on second visit.

---

## Architecture

### Component Structure

```
DetailPanel.tsx  (refactored — becomes tab container)
├── Tabs bar (MUI Tabs)
├── DetailsTabPanel     → existing HubDetail / ProjectDetail / FolderDetail / ItemDetail
├── UsersTabPanel       → new placeholder
├── BomTabPanel         → new placeholder
└── ViewTabPanel        → new placeholder
```

### Item Subtype Resolution

`ItemDetail` already fetches `GET_ITEM_DETAIL` which includes `__typename`. Add an optional `onTypeResolved?: (typename: string) => void` callback prop to `ItemDetail`. `DetailPanel` stores `itemSubtype` in state, resets to `null` whenever `selectedNode` changes, and uses it to compute which tabs are available.

Because Apollo caches results, revisiting a previously selected item will resolve the type synchronously from cache — no delay on second visit.

---

## Files

### New Files

#### `src/components/detail/tabs/UsersTab.tsx`
Placeholder component. Shows a "Users" heading and a "Coming soon" message. Visible for `project` and `folder` node types.

#### `src/components/detail/tabs/BomTab.tsx`
Placeholder component. Shows a "Bill of Materials" heading and a "Coming soon" message. Visible only for `DesignItem`.

#### `src/components/detail/tabs/ViewTab.tsx`
Placeholder component. Shows a "3D / Drawing View" heading and a "Coming soon" message. Visible for `DesignItem` and `DrawingItem`.

---

### Modified Files

#### `src/components/detail/DetailPanel.tsx`

Refactor into a tab container:

1. Read `selectedNode` from `NavContext`.
2. Track `activeTab: string` in local state. When `selectedNode` changes, keep the current tab if it exists in the new node's available tabs; otherwise fall back to `'details'`.
3. Track `itemSubtype: string | null` in local state — reset to `null` on node change, set via callback from `ItemDetail`.
4. Compute `availableTabs` from `selectedNode.type` and `itemSubtype`:
   ```ts
   const showUsers = type === 'project' || type === 'folder'
   const showBom   = type === 'item' && itemSubtype === 'DesignItem'
   const showView  = type === 'item' && (itemSubtype === 'DesignItem' || itemSubtype === 'DrawingItem')
   ```
5. On node change: if `activeTab` is present in the new `availableTabs`, keep it; otherwise reset to `'details'`. This means navigating between folders while on the Users tab stays on Users, but switching from a folder to a hub resets to Details.
6. Render MUI `Tabs` + `Tab` for each available tab, and a `TabPanel` (simple `Box` with `role="tabpanel"` and `hidden` prop) for each tab content.
7. Pass `onTypeResolved={setItemSubtype}` to `ItemDetail`.

#### `src/components/detail/ItemDetail.tsx`

Add prop `onTypeResolved?: (typename: string) => void`. Call it inside the `useEffect` (or a separate `useEffect` on `data`) once `data?.item?.__typename` is known:
```ts
useEffect(() => {
  if (data?.item?.__typename) {
    onTypeResolved?.(data.item.__typename)
  }
}, [data, onTypeResolved])
```

---

## MUI Components

- **`Tabs`** — horizontal tab bar, `value={activeTab}` + `onChange`
- **`Tab`** — one per visible tab, `value` = tab key string (`'details'`, `'users'`, `'bom'`, `'view'`)
- **`Box`** with `role="tabpanel"` and `hidden={activeTab !== tabKey}` — tab panel wrapper
- All components use theme tokens — no custom `sx` colours, no hardcoded sizes

No additional MUI packages required; `@mui/material` already included.

---

## Implementation Phases

### Phase 1 — Placeholder tab components
Create `UsersTab.tsx`, `BomTab.tsx`, `ViewTab.tsx` in `src/components/detail/tabs/`.

### Phase 2 — Refactor DetailPanel
Add `itemSubtype` state, `availableTabs` computation, MUI `Tabs` bar, and `TabPanel` wrappers. Keep existing detail components untouched inside the Details tab.

### Phase 3 — Wire ItemDetail callback
Add `onTypeResolved` prop to `ItemDetail` and emit the resolved `__typename`.

### Phase 4 — Verify tab visibility
Manually test: hub (Details only), project (Details + Users), folder (Details + Users), DesignItem (Details + BOM + View), DrawingItem (Details + View), other item types (Details only).

---

## Non-goals (for this phase)

- No actual Users, BOM, or View content — placeholders only
- No URL routing for tabs
- Active tab persists across node changes only when the tab is valid for the new node; resets to Details otherwise
