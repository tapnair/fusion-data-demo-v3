# Plan: Viewer Component Selection Properties Panel

## Fusion Data Demo v3

> **Goal:** When the APS Viewer has a model loaded, clicking a component in the 3D scene
> opens a flyout panel on the right side of the viewer that displays the component's
> properties from the SVF2 property database (the "bubble" db). Clicking empty space
> or pressing the close button dismisses the panel.

*Plan created: 2026-03-19*

---

## How It Works — End-to-End Flow

```
User clicks component in viewer
  │
  ├─ SELECTION_CHANGED_EVENT fires on viewer
  │       └─ event.dbIdArray[0] = dbId of selected node
  │
  ├─ viewer.getProperties(dbId, cb)
  │       └─ returns { name, externalId, properties: Property[] }
  │
  ├─ Walk InstanceTree via getNodeParentId() up to root
  │       └─ builds hierarchyPath: string[] (breadcrumb)
  │
  └─ setState(selection) → ViewerPropertiesPanel slides in from right
```

---

## Viewer API Details

### Selection event

```typescript
viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
  const dbId = event.dbIdArray[0]   // undefined / 0 when nothing selected
  if (!dbId) { setSelection(null); return }
  viewer.getProperties(dbId, onSuccess, onError)
})
```

Event fires with empty `dbIdArray` when the user clicks empty space — clear the panel.

### Property shape

```typescript
interface Property {
  attributeName: string    // raw internal key
  displayCategory: string  // grouping label (e.g. "Materials and Finishes")
  displayName: string      // human-readable label
  displayValue: string | number
  hidden: boolean
  type: number             // 20=String, 3=Double, 2=Integer, 10/11=DbKey ref
  units: string | null
}
```

### Hierarchy path (breadcrumb)

```typescript
function buildPath(viewer, dbId): string[] {
  const tree = viewer.model.getData().instanceTree
  const path: string[] = []
  let cur = dbId
  while (cur !== 0) {
    path.unshift(tree.getNodeName(cur))
    if (cur === tree.getRootId()) break
    cur = tree.getNodeParentId(cur)
  }
  return path  // e.g. ["Assembly", "Subassembly:1", "Part:1"]
}
```

---

## Data Model

```typescript
// src/types/viewerSelection.types.ts

export interface ViewerProperty {
  attributeName: string
  displayCategory: string
  displayName: string
  displayValue: string | number
  units: string | null
  hidden: boolean
  type: number
}

export interface ViewerSelection {
  dbId: number
  name: string
  externalId: string
  hierarchyPath: string[]
  properties: ViewerProperty[]          // body properties

  // Parent component (always one level up from the selected body)
  parentDbId: number | null
  parentName: string
  parentProperties: ViewerProperty[]    // component properties
}
```

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/types/viewerSelection.types.ts` | **Create** — `ViewerSelection`, `ViewerProperty` types |
| `src/hooks/useViewerSelection.ts` | **Create** — SELECTION_CHANGED_EVENT listener + getProperties |
| `src/components/viewer/ViewerPropertiesPanel.tsx` | **Create** — sliding panel UI |
| `src/hooks/useApsViewer.ts` | **Modify** — return `viewerRef` and `viewerInitialized` from hook |
| `src/components/viewer/ApsViewer.tsx` | **Modify** — integrate selection hook + panel layout |
| `src/types/autodesk-viewer.d.ts` | **Modify** — add `Property`, `PropertyResult`, `InstanceTree` types if missing |

---

## Implementation Details

### 1. `useApsViewer.ts` — expose viewer internals

Currently returns `{ viewerLoaded, viewerError }`. Add to the return:

```typescript
return { viewerLoaded, viewerError, viewerRef, viewerInitialized }
```

`ApsViewer` will pass these to `useViewerSelection`.

### 2. `useViewerSelection.ts` — new hook

```typescript
export function useViewerSelection(
  viewerRef: React.RefObject<Autodesk.Viewing.GuiViewer3D | null>,
  viewerInitialized: boolean
): { selection: ViewerSelection | null }
```

- Attaches listener when `viewerInitialized` becomes `true`
- On `SELECTION_CHANGED_EVENT`:
  1. Get `dbId` from `event.dbIdArray[0]`
  2. Look up `parentDbId = tree.getNodeParentId(dbId)` (the component node)
  3. Call `getProperties(dbId)` for body props
  4. Inside that callback, call `getProperties(parentDbId)` for component props (if parentDbId > 0)
  5. `setSelection()` with both property sets
- Empty `dbIdArray` → `setSelection(null)`
- `removeEventListener` on unmount / if viewer changes
- Does **not** expose `clearSelection` — panel close button calls `viewer.clearSelection()`
  directly via `viewerRef` to keep the viewer state source-of-truth

### 3. `ViewerPropertiesPanel.tsx` — slide-out panel

**Layout inside `ApsViewer`:**
```
┌─────────────────────────────────┬──────────────────────┐
│                                 │  ✕  Part:1           │
│       3D Viewer Canvas          │  Assy › Sub › Part:1 │
│                                 │  ──────────────────  │
│                                 │  COMPONENT           │
│                                 │  ▼ General           │
│                                 │    Name   Part:1     │
│                                 │  ▶ Materials         │
│                                 │  ──────────────────  │
│                                 │  BODY                │
│                                 │  ▼ General           │
│                                 │    Volume  12.4 cm³  │
│                                 │  ▶ Physical          │
└─────────────────────────────────┴──────────────────────┘
```

**Animation:** The panel **pushes** the viewer canvas — it does not overlay.
The panel uses a `width` transition. When `selection` is null the panel has
`width: 0, overflow: hidden`. When a component is selected it expands to 320px.
The viewer container uses `flex: 1` so it shrinks to fill remaining space.
Both use `transition: width 300ms ease`. After the panel opens, `viewer.resize()`
is called so the WebGL canvas redraws at its new dimensions.

**Structure:**
- Outer wrapper: `Box` flex row, `overflow: hidden`, `height: 100%`
- Viewer container: `Box flex: 1, position: relative, overflow: hidden` (holds the canvas)
- Panel: `Box width: selection ? 320 : 0`, animated
  - Header: component name (Typography) + "Show all" toggle `IconButton` + close `IconButton`
  - Breadcrumb: hierarchy path joined with ` › ` separators (Typography `caption`)
  - `Divider`
  - **COMPONENT section**: overline label "COMPONENT", followed by accordion groups
    for `parentProperties` (one `Accordion` per `displayCategory`)
  - `Divider`
  - **BODY section**: overline label "BODY", followed by accordion groups
    for `properties` (one `Accordion` per `displayCategory`)
  - Each accordion: `AccordionSummary` with category name + visible count;
    `AccordionDetails` with 2-column grid of `displayName` / `displayValue [units]` rows
  - Default: `hidden === true` properties are not shown
  - When "Show all" is toggled on: hidden properties render with a muted/dimmed style
    to visually distinguish them from non-hidden properties
  - If `parentDbId` is null (no parent found), the COMPONENT section is omitted

### 4. `ApsViewer.tsx` — wiring

```tsx
export function ApsViewer({ encodedUrn, isReady, getAccessToken }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { viewerLoaded, viewerError, viewerRef, viewerInitialized } =
    useApsViewer(containerRef, encodedUrn, isReady, getAccessToken)
  const { selection } = useViewerSelection(viewerRef, viewerInitialized)

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Viewer canvas */}
      <Box ref={containerRef} sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* loading backdrop + error overlay (unchanged) */}
      </Box>
      {/* Sliding properties panel */}
      <ViewerPropertiesPanel
        selection={selection}
        onClose={() => viewerRef.current?.clearSelection()}
      />
    </Box>
  )
}
```

---

## Property Display Rules

- **Filter**: `hidden: true` properties are hidden by default; a "Show all" toggle in the
  panel header reveals them (toggle state is local, not persisted)
- **Group**: by `displayCategory` using MUI `Accordion` (expand/collapse per category)
- **Format**: if `units` is present, append after `displayValue` (e.g. `"2.5 mm"`)
- **Type 10/11** (DbKey cross-refs): display as `displayValue` string; do not recurse
- **Category order**: alphabetical; a "General" or unnamed category floats to top

---

## Decisions

1. **Hidden properties** — shown via "Show all" toggle in panel header; rendered with
   muted style to distinguish from visible properties. Toggle is local state, not persisted.

2. **Property layout** — accordion groups by `displayCategory`, each collapsible.
   Category summary shows property count.

3. **Panel behaviour** — pushes the viewer canvas (viewer shrinks). `viewer.resize()`
   called after panel open/close transition completes.

4. **Body + Component sections** — two named sections (COMPONENT first, BODY below),
   each with their own accordion groups. COMPONENT section omitted if no parent found.
