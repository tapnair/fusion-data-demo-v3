# Clickable Hierarchy Breadcrumb

*Plan created: 2026-05-29*

## Goal

Make each segment of the breadcrumb at the top of `ViewerPropertiesPanel` clickable. Clicking a segment selects that component/assembly in the APS Viewer **and** updates the panel to reflect that component. When the user navigates to a component this way, no body is associated with the selection — the BODY accordion at the bottom is hidden.

## Viewer API confirmed

| Need | API call |
|---|---|
| Programmatic selection (fires `SELECTION_CHANGED_EVENT`) | `viewer.select(dbIds: number \| number[])` |
| Detect body vs component synchronously | `tree.getChildCount(dbId)` — leaves (= 0) are bodies; > 0 are components/assemblies |
| Walk ancestors | `tree.getNodeParentId(dbId)`, `tree.getNodeName(dbId)` (already used) |
| Camera fit on click | `viewer.fitToView(dbIds: number[])` — exists in the SDK; needs to be added to our `.d.ts` |

Because `viewer.select()` triggers the same event our existing `useViewerSelection` listener handles, "click breadcrumb → select component → panel updates" composes naturally with one new piece: the selection handler must distinguish *picked body* from *picked component* (today it always assumes a body).

## Decisions (from product Q&A)

| Topic | Decision |
|---|---|
| Camera on breadcrumb click | **Fit-to-view + select.** Calls `viewer.fitToView([dbId])` after `viewer.select([dbId])`. |
| Panel header text | **Always show the component name.** Body name lives in the breadcrumb when applicable; the header is consistently component-focused. |
| Last breadcrumb segment | **Bold, not clickable.** Standard breadcrumb pattern: ancestors are links, current is plain text. |

## Implicit (not asked, defaulted)

| Topic | Default |
|---|---|
| BODY accordion when no body picked | **Hidden** — matches "It is not necessary to display body in this view." |
| BODY accordion when a body WAS picked | Stays at the bottom, collapsed by default (unchanged from today). |
| Hierarchy path scope | Walks from root down to the current component. Includes the model root (typically the file/lineage name). No de-duplication of consecutive identical names — Fusion sometimes shows e.g. `Controls v1 › Controls v1 › ...`, we show what the tree says. |
| Clicking a body in the viewer | Unchanged. Still picks the body, still treats parent as the component. |
| Clicking outside any geometry | Unchanged. Selection clears, panel closes. |
| Fallback (no `modelId` on picked component) | Same as today — show the "MFG DM data not available" banner + the raw component/body accordions. |

---

## Phases

### Phase 1 — Extend Viewer type declarations

`src/types/autodesk-viewer.d.ts`:

```ts
class GuiViewer3D {
  // existing methods...
  fitToView(dbIds?: number[]): void          // NEW
}
```

Already present and reusable: `select`, `clearSelection`, `getSelection`, `getProperties`, `addEventListener`, `removeEventListener`, `model.getData().instanceTree.{getRootId,getNodeName,getNodeParentId,getChildCount}`.

---

### Phase 2 — Restructure `ViewerSelection` type

`src/types/viewerSelection.types.ts` — replace the current shape:

```ts
export interface HierarchyNode {
  dbId: number
  name: string
}

export interface ViewerBody {
  dbId: number
  name: string
  externalId: string
  properties: ViewerProperty[]
}

export interface ViewerSelection {
  /** The component the panel is showing.
   *  When the user picks a body, this is the body's parent component.
   *  When the user picks (or breadcrumb-navigates to) a component, this is that component. */
  componentDbId: number
  componentName: string
  componentProperties: ViewerProperty[]
  modelId: string | null

  /** The picked body, when the pick was actually a body (leaf node). */
  body: ViewerBody | null

  /** Root → … → component. Last entry is the component itself. */
  hierarchyPath: HierarchyNode[]
}
```

Old fields (`dbId`, `name`, `externalId`, `properties`, `parentDbId`, `parentName`, `parentProperties`, `parentModelId`, the old `string[]` `hierarchyPath`) are gone. Only the panel reads these — it gets updated in Phase 4.

---

### Phase 3 — Refactor `useViewerSelection`

`src/hooks/useViewerSelection.ts` — substantive changes:

**Signature change**:
```ts
export function useViewerSelection(
  viewerRef: React.RefObject<Autodesk.Viewing.GuiViewer3D | null>,
  viewerInitialized: boolean
): {
  selection: ViewerSelection | null
  selectByDbId: (dbId: number) => void   // NEW imperative API
}
```

**Selection-handler logic**:

```
on SELECTION_CHANGED_EVENT, picked = event.dbIdArray[0]
if event.dbIdArray is empty → setSelection(null), return

const isComponent = tree.getChildCount(picked) > 0
if isComponent:
   componentDbId = picked
   body = null
   getProperties(picked) → componentProperties, componentName, modelId
else:                        // picked is a body (leaf)
   parent = tree.getNodeParentId(picked)
   if parent is root or invalid:
       // body floats with no parent component — degrade gracefully
       componentDbId = picked            // treat the body as the "component" shell
       componentName = bodyName
       componentProperties = bodyProperties
       modelId = null                    // → fallback banner path in panel
       body = null
       (returns after one getProperties call)
   else:
       componentDbId = parent
       getProperties(picked) → body
       getProperties(parent) → componentProperties, componentName, modelId
```

**`buildHierarchyPath(componentDbId)`**: returns `{dbId, name}[]` (was `string[]`). Walks from `componentDbId` up to `tree.getRootId()` inclusive, then reverses so order is root → component.

**`selectByDbId`**:
```ts
const selectByDbId = useCallback((dbId: number) => {
  const viewer = viewerRef.current
  if (!viewer) return
  viewer.select([dbId])         // fires SELECTION_CHANGED_EVENT → handler updates state
  viewer.fitToView([dbId])      // animates camera
}, [viewerRef])
```

Note: `useCallback` requires moving it out of the `useEffect`. Either:
(a) hoist `viewerRef.current` reads inside the callback (the current value is fine — the ref is stable), or
(b) keep the event handler inside the `useEffect`, expose `selectByDbId` at the hook scope.

Approach (b) is cleaner. The selection-handler setup stays inside `useEffect`; `selectByDbId` is defined alongside as a stable `useCallback`.

---

### Phase 4 — Update `ViewerPropertiesPanel`

`src/components/viewer/ViewerPropertiesPanel.tsx`:

#### 4.1 Receive `selectByDbId` as a prop

```ts
interface ViewerPropertiesPanelProps {
  selection: ViewerSelection | null
  onClose: () => void
  onSelectDbId: (dbId: number) => void   // NEW
}
```

`ApsViewer.tsx` passes `selectByDbId` from the hook through to the panel.

#### 4.2 Header

Replace today's `selection.name` (body name) with `selection.componentName`. No other header changes.

#### 4.3 Breadcrumb

Replace `selection.hierarchyPath.join(' › ')` with a flex row of clickable segments:

```tsx
<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
  {selection.hierarchyPath.map((node, i) => {
    const isLast = i === selection.hierarchyPath.length - 1
    return (
      <Fragment key={node.dbId}>
        {i > 0 && <Typography variant="caption" color="text.secondary">›</Typography>}
        {isLast ? (
          <Typography variant="caption" sx={{ fontWeight: 600 }} color="text.primary">
            {node.name}
          </Typography>
        ) : (
          <Link
            component="button"
            variant="caption"
            underline="hover"
            onClick={() => onSelectDbId(node.dbId)}
          >
            {node.name}
          </Link>
        )}
      </Fragment>
    )
  })}
</Box>
```

Uses MUI `Link` with `component="button"` so it's a real focusable button for accessibility. Wraps gracefully on narrow widths.

#### 4.4 BODY accordion

Render only when `selection.body !== null`:

```tsx
{selection.body && (
  <>
    <Divider sx={{ my: 1 }} />
    {/* existing BODY accordion using selection.body.properties */}
  </>
)}
```

The "Show hidden" eye toggle in the header only affects the BODY accordion (per v2 design). Hide the toggle entirely when `selection.body === null` (nothing it can affect).

#### 4.5 Fallback path (`modelId === null`)

Today's fallback renders the COMPONENT accordion (raw `parentProperties`) and the BODY accordion. With the new shape:
- COMPONENT accordion uses `selection.componentProperties` (instead of `parentProperties`).
- BODY accordion only renders when `selection.body !== null`.
- Banner text unchanged.

#### 4.6 BOM-row list path

Already keyed on `useViewerComponent(selection.modelId)` — change the prop name (was `selection.parentModelId`, now `selection.modelId`). No other change.

---

### Phase 5 — Wire it through `ApsViewer`

`src/components/viewer/ApsViewer.tsx`:

```diff
- const { selection } = useViewerSelection(viewerRef, viewerInitialized)
+ const { selection, selectByDbId } = useViewerSelection(viewerRef, viewerInitialized)
…
- <ViewerPropertiesPanel selection={selection} onClose={…} />
+ <ViewerPropertiesPanel selection={selection} onClose={…} onSelectDbId={selectByDbId} />
```

---

### Phase 6 — Tests

Add to `src/hooks/`:

**`useViewerSelection.test.tsx`** (new) — mocks `Autodesk.Viewing.GuiViewer3D` enough to drive the handler. Cover:
- Body pick (leaf, childCount === 0) → componentDbId = parent, body populated, hierarchyPath ends at component.
- Component pick (non-leaf) → componentDbId = picked, body = null.
- Pick whose parent is root → degraded path (body = null, modelId = null).
- `selectByDbId(n)` → calls `viewer.select([n])` and `viewer.fitToView([n])`.

Optionally also add an integration smoke test for the panel breadcrumb — clicking a segment calls `onSelectDbId(dbId)`. Quick `@testing-library/react` test against a stubbed selection prop.

---

## Files

### Modified
- `src/types/autodesk-viewer.d.ts` — add `fitToView`.
- `src/types/viewerSelection.types.ts` — full reshape (see Phase 2).
- `src/hooks/useViewerSelection.ts` — body/component detection + new `selectByDbId`.
- `src/components/viewer/ViewerPropertiesPanel.tsx` — clickable breadcrumb, header swap, conditional BODY accordion, field renames (`parentModelId` → `modelId`, `parentProperties` → `componentProperties`, `parentName` → `componentName`, etc.).
- `src/components/viewer/ApsViewer.tsx` — pass `onSelectDbId`.

### New
- `src/hooks/useViewerSelection.test.tsx` — selection-handler tests.

---

## Risk / open items

| Risk | Mitigation |
|---|---|
| `viewer.fitToView` not present at runtime on older Viewer 7.x builds | Guard with `typeof viewer.fitToView === 'function'` before calling. No-op otherwise. |
| `tree.getChildCount` returns 0 for an unloaded sub-assembly (lazy-loaded models) | Acceptable for v1 — Fusion thumbnails are loaded with full geometry. If we see misclassification in practice, fall back to checking properties for `modelId`. |
| Programmatic `viewer.select` causes the same selection event we just handled → infinite loop | The handler is idempotent: `event.dbIdArray` is the new array; we always set state to match the new pick. No self-triggering loop because we don't call `select` from inside the handler. |
| Hierarchy includes nodes with empty/blank names | Filter out segments where `name.trim() === ''` to avoid an empty link. Cheap defense. |
| Panel breadcrumb wraps awkwardly on long paths | Flex-wrap with small `gap`; the divider char `›` is part of the row. Acceptable for v1. |

## Non-goals

- Highlighting body bodies differently from assembly bodies in the viewer (rely on the SDK's default colour).
- Adding a "back" / "up one level" arrow button — breadcrumb segments serve this purpose.
- Persisting the most-recent breadcrumb pick across page reloads.
- Multi-select / additive selection from the breadcrumb.

---

*Last updated: 2026-05-29*
