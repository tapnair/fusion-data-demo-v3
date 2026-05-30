# Viewer Properties Panel v2 — BOM-row Vertical View

*Plan created: 2026-05-29*

## Goal

Replace the existing flyout properties panel with a vertical BOM-row view of the picked component, sourced from the MFG DM GraphQL API (not from the viewer's embedded properties). Reuse the BOM table's cell components so the panel inherits every column the BOM has — including the staggered async loading for thumbnails, physical properties, and base properties, and the inline editing for editable cells.

## Trigger / data flow

```
viewer SELECTION_CHANGED
   │
   ▼  pick first dbId in event.dbIdArray
useViewerSelection (existing) extracts parent component properties
   │
   ▼  read attribute `modelId` from parent component properties
   │     (value: base64-encoded ID, ready to pass straight to model(modelId:))
   ▼
useViewerComponent(modelId)
   ├── Apollo query Query.model(modelId: ID!) { component { id, name, partNumber, description, materialName, ... } }
   │       (cache-first; cached across re-selections of the same component)
   │
   └── returns a synthetic ComponentRow:
         { id: componentId, componentId, componentState: null,
           name, partNumber, description, materialName }
   │
   ▼
ViewerPropertiesPanel (rewritten)
   ├── renders a vertical list, one row per column from the shared column registry
   ├── reuses shared cell renderers:
   │     - thumbnail        → BomThumbnailCell (existing)
   │     - physical props   → PhysicalPropertiesCell (existing)
   │     - base props       → BasePropCell (existing, inline-edit)
   │     - editable text    → new EditableTextCell (new shared component)
   └── collapsed BODY accordion at bottom shows the raw viewer properties for the picked body
```

The picked component's `modelId` is enough — `Query.model(modelId).component` returns one Component, which is exactly what the BOM row represents. No tree walking needed.

## Decisions (from product Q&A)

| Topic | Decision |
|---|---|
| Body section | **Keep as collapsed accordion at the bottom** of the panel. Preserves today's information; just demotes it. |
| Description edit | **Editable in both BOM and panel.** Promote the existing inline-edit pattern to a shared `EditableTextCell`, use it in the BOM Description column and in the panel row. |
| Property scope | **All by default, with its own column-visibility setting** persisted under `viewer-panel-visible-columns`. Independent of BOM column visibility. |
| Fallback (no `modelId`) | **Fall back to today's viewer-properties view** AND show a small banner at the top: *"MFG DM data not available for this component."* |
| Panel width | **Bump 320 → 380px** to accommodate inline editors and unit suffixes without truncation. |
| Composition | `Query.model(modelId)` defaults to `WORKING`. Use the default. |
| Tree sync | **Not in v1.** Selection in viewer does not change the left nav. |

---

## Phases

### Phase 1 — Extract `modelId` into selection state

**Goal:** `ViewerSelection` carries the picked component's `modelId`, so downstream consumers (panel, future features) can look up the component without re-parsing the raw viewer properties.

#### 1.1 Extend `ViewerSelection`

`src/types/viewerSelection.types.ts`:

```ts
export interface ViewerSelection {
  // existing fields...
  parentModelId: string | null   // NEW — read from parentProperties[].attributeName === 'modelId'
}
```

#### 1.2 Read `modelId` in `useViewerSelection`

`src/hooks/useViewerSelection.ts` — inside the parent `viewer.getProperties` callback:

```ts
const modelIdProp = componentResult.properties.find(
  (p) => p.attributeName === 'modelId'
)
const parentModelId = typeof modelIdProp?.displayValue === 'string'
  ? modelIdProp.displayValue
  : null
setSelection({ ...base, parentDbId, parentName, parentProperties: ..., parentModelId })
```

For body-only selections (`parentDbId === null`) set `parentModelId: null`.

#### 1.3 Remove debug console.logs

Delete the `console.log('[ViewerSelection] ...')` lines added earlier.

#### 1.4 Verify

- [ ] Click a body in the viewer → `selection.parentModelId` is a non-empty base64 string.
- [ ] Pick a body with no parent component (shouldn't really happen for MFG DM models, but defensively) → `parentModelId === null`.
- [ ] Typecheck passes.

---

### Phase 2 — GraphQL query + hook for the picked component

**Goal:** `useViewerComponent(modelId)` returns the `ComponentRow` shape consumed by the shared cell renderers, plus loading/error state.

#### 2.1 New query `GET_VIEWER_COMPONENT`

`src/graphql/queries/viewerComponent.ts`:

```ts
import { gql } from '@apollo/client'

export const GET_VIEWER_COMPONENT = gql`
  query GetViewerComponent($modelId: ID!) {
    model(modelId: $modelId) {
      id
      component {
        id
        name { displayValue }
        partNumber { displayValue }
        description { displayValue }
        materialName { displayValue }
      }
    }
  }
`
```

Field names mirror what `useBomLoader.ts` reads for root components — same Property shape (`{ displayValue }`).

#### 2.2 `useViewerComponent` hook

`src/hooks/useViewerComponent.ts`:

```ts
export interface ViewerComponentResult {
  loading: boolean
  error: string | null
  row: ComponentRow | null   // shape from src/components/shared/componentColumns.ts
}

export function useViewerComponent(modelId: string | null): ViewerComponentResult
```

Internals:
- `useQuery(GET_VIEWER_COMPONENT, { variables: { modelId }, skip: !modelId, fetchPolicy: 'cache-first' })`
- Map result → `ComponentRow` with `componentId = data.model.component.id`, `componentState = null` (matches BOM root-row convention so the existing physical/base-property hooks key the same cache entries).
- `id = componentId` so React keys are stable across re-renders.

`cache-first` means re-picking the same component does **not** refetch — instant panel render on revisit.

#### 2.3 Verify

- [ ] Pick a component → network shows one `GetViewerComponent` request.
- [ ] Pick same component again → no network request (cache hit).
- [ ] Component fields appear correctly.
- [ ] Typecheck passes.

---

### Phase 3 — Shared `EditableTextCell`

**Goal:** Generalize the inline-edit UX from `BasePropCell` into a standalone shared cell so it can be used by:
- The BOM **Description** column (promoting it from read-only)
- The new panel's **Description** row

The base-property cell stays as-is — its editor is too coupled to base-property semantics (definitionId + specification coercion).

#### 3.1 New component `EditableTextCell`

`src/components/shared/EditableTextCell.tsx` (new):

```tsx
export interface EditableTextCellProps {
  value: string | null
  readOnly?: boolean
  onCommit: (next: string) => Promise<void>
  /** Optional client-side validation; return string error to block commit. */
  validate?: (next: string) => string | null
}
```

Behavior (mirrors `BasePropCell` display/edit/saving states):
- Display: noWrap Typography, hover outline, click → edit.
- Edit: MUI `TextField` standard variant, autofocus, Enter/blur commits, Escape cancels.
- Saving: greyed value + small spinner.
- Error: revert optimistic value, show validation/server error as TextField helperText (next edit) and via a Snackbar at parent level.
- Read-only: plain Typography, no hover affordance, no lock icon (description has no `isReadOnly` concept).

Extracts the state machine currently in `BasePropCell` (lines 326–461). Keep `BasePropCell` using its own state machine — do not refactor it yet to avoid blast-radius. (Could be unified later; defer.)

#### 3.2 Add `updateComponentDescription` mutation

`src/graphql/mutations/component.ts` (new file):

```ts
export const UPDATE_COMPONENT_DESCRIPTION = gql`
  mutation UpdateComponentDescription($input: UpdateComponentDescriptionInput!) {
    updateComponentDescription(input: $input) {
      id
      description { displayValue }
    }
  }
`
```

Schema input: `{ componentId: ID!, description: String!, sessionId: ID }`. Omit `sessionId`.

#### 3.3 Verify

- [ ] `EditableTextCell` renders in isolation with a Storybook-less smoke test (mounted in a unit test).
- [ ] Commit calls `onCommit` with trimmed value.
- [ ] Escape reverts.

---

### Phase 4 — Description column becomes editable in the BOM

**Goal:** Promote the BOM `description` column from read-only to inline-edit using `EditableTextCell`. Establish the shared `setDescription` action on the row context.

#### 4.1 Extend the cell context

`src/components/shared/componentColumns.ts`:

```ts
export interface BasePropertiesCapableContext extends ComponentCellContext {
  // existing fields...
  setDescription?: (componentId: string, value: string) => Promise<void>
}
```

When `setDescription` is omitted (e.g., in the search results grid) the column renders read-only.

#### 4.2 Replace `description` column's `getValue` with a `renderCell`

`src/components/detail/tabs/bom/bomColumns.ts`:

```ts
{
  id: 'description',
  header: 'Description',
  flex: 2,
  getValue: (row) => row.description,
  renderCell: (row, ctx) =>
    React.createElement(EditableTextCell, {
      value: row.description,
      readOnly: !ctx.setDescription,
      onCommit: (next) => ctx.setDescription!(row.componentId, next),
    }),
}
```

#### 4.3 Wire `setDescription` in `BomTab`

`src/components/detail/tabs/bom/BomTab.tsx`:

```ts
const [mutateDescription] = useMutation(UPDATE_COMPONENT_DESCRIPTION)

const setDescription = useCallback(async (componentId: string, value: string) => {
  try {
    await mutateDescription({
      variables: { input: { componentId, description: value } },
    })
    // Apollo's normalized cache will update Component:<id>.description automatically
    // because we select `description { displayValue }` in the mutation response.
  } catch (err: any) {
    setSaveError(err?.message ?? 'Failed to save description')
    throw err
  }
}, [mutateDescription])

// add to cellContext
```

Note: the BOM's root-component query and child-component query both read `description { displayValue }`. The mutation returns `Component` with `description { displayValue }` — Apollo's normalized cache writes back to `Component:<id>` and every BOM row referencing that component re-renders automatically. No manual `writeQuery` needed (unlike base properties, where the value lives nested under `baseProperties.results`).

#### 4.4 Verify

- [ ] Edit a Description cell in BOM, press Enter → saves, optimistic update visible, mutation fires.
- [ ] On API error → row reverts, Snackbar shows error.
- [ ] Edit cells in rapid succession → no race conditions, latest value wins.
- [ ] BOM tab in search results still renders Description as read-only (no `setDescription` on that context).

---

### Phase 5 — Build the new `ViewerPropertiesPanel`

**Goal:** Replace the existing panel with the BOM-row vertical view, gated by the v2 implementation.

#### 5.1 New panel skeleton

`src/components/viewer/ViewerPropertiesPanel.tsx` — rewritten. Width bumps to **380px**. Structure:

```
┌─ Header (component name + close X + visibility toggle + column-settings gear) ─┐
├─ Breadcrumb (hierarchyPath, unchanged) ──────────────────────────────────────┤
├─ MFG-DM banner if parentModelId === null ────────────────────────────────────┤
├─ Thumbnail (centered, ~120px, hover popover, uses BomThumbnailCellInner) ────┤
├─ Vertical property list ────────────────────────────────────────────────────┤
│    Name                     Controls Bottom Piece                             │
│    Description             [editable]                                         │
│    Part Number             7601025                                            │
│    Material                PA 12 — Nylon ...                                  │
│    Mass                    [spinner → 0.434 oz]                               │
│    Volume                  [spinner → 0.683 in³]                              │
│    Density                 [spinner → ...]                                    │
│    Surface Area            [spinner → 10.076 in²]                             │
│    Bounding Box            [spinner → L: ... W: ... H: ...]                   │
│    <base-property rows>   [spinner → value, inline-editable]                  │
├─ Divider ──────────────────────────────────────────────────────────────────┤
└─ BODY accordion (collapsed by default, renders today's raw viewer props) ─┘
```

Each row uses a `<Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr' }}>` for label/value alignment. The value column renders via the same `renderCell` functions used by the BOM — they don't know they're inside a different parent.

#### 5.2 Mount cells with a synthesized context

```ts
const { row, loading, error } = useViewerComponent(selection.parentModelId)

const cellContext: BomCellContext = useMemo(() => ({
  toggleRow: () => {},      // no-op — panel has no tree
  loadMore: () => {},       // no-op
  sigFigs: bomSigFigs,      // read from settings, same as BOM
  staleBasePropsKeys: new Set(),
  clearStaleKey: () => {},
  setBaseProperty,          // same callback as BomTab — extract into a shared hook? See §6.
  setDescription,           // same
  thumbnailGeneration,
}), [...])
```

The shared cells were designed to be context-driven, so they work unchanged. `toggleRow`/`loadMore` are no-ops because the panel never shows a load-more row.

#### 5.3 Column registry: which rows to show

Reuse the BOM's column registry but with the panel's own visibility setting:

```ts
const columnRegistry = useMemo(
  () => [...BOM_COLUMNS, ...basePropertyDefs.map(makeBasePropertyColumn)],
  [basePropertyDefs]
)

const [visibleIds, setVisibleIds] = useState<string[]>(
  () => loadSettings().viewerPanelVisibleColumns ?? columnRegistry.map(c => c.id)
)
```

- Default: all columns visible.
- Excluded by default: `thumbnail` is rendered separately at the top of the panel — exclude its column from the row list (but keep using `BomThumbnailCellInner` for the hero image).
- `name` column: render as a plain Typography (the BOM's `BomNameCell` adds depth indentation and expand chevrons — neither relevant for the panel). Either skip `name` in the registry render and instead show it in the header, or render it without the BOM-specific decoration. **Recommendation:** show in header, skip from row list.

#### 5.4 Column settings UI

Small gear icon in the header opens a `Popover` with checkbox toggles, mirroring `BomColumnSettings` but persisted under `viewer-panel-visible-columns`. Reuse `BomColumnSettings` if its props are flexible enough — otherwise duplicate (the component is small; duplication is fine for v1).

#### 5.5 BODY accordion at the bottom

Carry forward today's body section (raw `selection.properties` rendered as accordions by category) but **default to collapsed**. Lives below a divider after the BOM-row list. The existing `groupByCategory` helper stays.

#### 5.6 Fallback banner

When `selection.parentModelId === null`:

```tsx
<Alert severity="info" sx={{ m: 1 }}>
  MFG DM data not available for this component.
</Alert>
```

…and render only the existing component+body accordions (today's UI) below the banner. No thumbnail, no BOM row list, no column settings. This preserves the current behavior as a graceful degradation.

#### 5.7 Save errors

Render the same `Snackbar` pattern as `BomTab` for description/base-property failures. The Snackbar lives at the panel root and is wired via the closures passed into the cell context.

#### 5.8 Verify

- [ ] Pick a component → panel populates Name, Description, P/N, Material immediately; Mass/Volume/etc. show spinners then resolve.
- [ ] Re-pick same component → instant render from cache.
- [ ] Description: click → edit → Enter → saves; visible in BOM tab too (after switching tabs).
- [ ] Base property: click → edit → Enter → saves with same flow as BOM.
- [ ] BODY accordion at bottom collapses/expands, contents match today's body section.
- [ ] When viewer pick has no `modelId` → banner shown, today's UI rendered below.
- [ ] Column settings gear → toggling a column hides/shows the row, persists across reloads.
- [ ] Panel width 380px, no truncation on typical values.

---

### Phase 6 — Optional: extract mutation callbacks to a shared hook

**Goal:** Avoid duplicating `setDescription` and `setBaseProperty` between `BomTab` and `ViewerPropertiesPanel`. Defer if time-boxed.

`src/hooks/useComponentMutations.ts`:

```ts
export function useComponentMutations(opts?: { onError?: (msg: string) => void }) {
  // wraps SET_PROPERTIES + UPDATE_COMPONENT_DESCRIPTION
  return { setDescription, setBaseProperty, saveError, clearSaveError }
}
```

Both `BomTab` and the panel call this. Saves ~60 lines of duplicated wiring. Optional — easy follow-up.

---

### Phase 7 — Tests

#### 7.1 New tests

| File | Tests |
|---|---|
| `src/components/shared/EditableTextCell.test.tsx` | Display→edit transition, Enter commits, Escape cancels, saving state, error revert. |
| `src/hooks/useViewerComponent.test.tsx` | Returns row on success, returns null when modelId is null, errors propagate. |

#### 7.2 Updated tests

| File | What to update |
|---|---|
| Any BOM test that asserts Description renders as a plain string | Now wraps `EditableTextCell` — assert against the value text, not the cell shape. |

#### 7.3 Verify

- [ ] `npm run test` — all suites pass, new tests added.

---

## Files

### New
- `src/graphql/queries/viewerComponent.ts`
- `src/graphql/mutations/component.ts`
- `src/hooks/useViewerComponent.ts`
- `src/components/shared/EditableTextCell.tsx`
- `src/components/shared/EditableTextCell.test.tsx`
- `src/hooks/useViewerComponent.test.tsx`
- (optional) `src/hooks/useComponentMutations.ts`

### Modified
- `src/types/viewerSelection.types.ts` — add `parentModelId`
- `src/hooks/useViewerSelection.ts` — read `modelId` from properties; remove debug logs
- `src/components/shared/componentColumns.ts` — add `setDescription` to context type
- `src/components/detail/tabs/bom/bomColumns.ts` — Description column → `EditableTextCell`
- `src/components/detail/tabs/bom/BomTab.tsx` — wire `setDescription` mutation
- `src/components/viewer/ViewerPropertiesPanel.tsx` — full rewrite (preserve BODY accordion path)
- `src/settings.ts` — add `viewerPanelVisibleColumns: string[]` settings field

### Untouched (intentionally)
- `src/hooks/useBomLoader.ts` — BOM data path unchanged
- `src/hooks/useBomPhysicalProperties.ts`, `useBomBaseProperties.ts`, `useBomThumbnail.ts` — reused as-is
- `src/components/viewer/ApsViewer.tsx` — wrapper layout unchanged (just slightly wider panel)

---

## Risk / open items

| Risk | Mitigation |
|---|---|
| `modelId` attribute name not present on every component (older Fusion exports?) | Defensive read with the explicit fallback banner; logged when missing in dev. |
| `Model.component` for a picked sub-component may not equal the BOM-row component for the same node | Verify in §2 with a sample model; if mismatch, document and adjust (worst case: also fetch via `bulkComponents` keyed off `f3dComponentId`). |
| Description mutation may have rate limits / large blast radius if user mashes Enter | Existing `BasePropCell` already serializes through optimistic state; same pattern reused. No additional debouncing planned. |
| Panel + BOM both render the same base-property cells → duplicated network requests on initial pick | Apollo caches by `componentId`/`componentState`; both hooks share the cache. Re-renders dedupe automatically. |
| Wider panel (380px) may crowd the viewer on small screens | Acceptable for v1; could make panel resizable in a follow-up. |

---

## Non-goals (v1)

- Sync viewer selection ↔ left nav tree.
- Show body-level properties in the BOM-row list (kept in the BODY accordion only).
- Resizable / draggable panel width.
- Edit Component Name, Part Number, or Material in the panel (Description only).
- Configuration / variant awareness for the picked component.

---

## Follow-ups (same-day, after v2 shipped)

These were small, well-scoped changes layered on top of v2. Captured here rather than spinning up separate plan files.

### Collapsible Base / Physical accordion grouping

After v2 shipped with a flat list of rows, the panel was visually busy. The rows are now partitioned:

- **Always visible (flat rows):** Description, Part Number, Material.
- **Base Properties accordion** (collapsible, expanded by default): every hub-defined base property column.
- **Physical Properties accordion** (collapsible, collapsed by default): Mass, Volume, Density, Surface Area, Bounding Box.

Implementation: in `ViewerPropertiesPanel.tsx`, the visible columns are partitioned into three groups by id (`ALWAYS_VISIBLE_IDS`, `PHYSICAL_IDS`, and "anything starting with `baseProp:`"). Each group renders either as a plain block (top) or wrapped in a default-uncontrolled `<Accordion>`. Accordion state is local-to-MUI and persists across component switches (only the row cells re-key — see next item).

Each accordion only renders when it has ≥1 visible column, so toggling everything off via the column-settings gear collapses the section away entirely.

### Editing reliability fixes

After v2, two bugs surfaced when actually using the inline editor:

**Bug 1 — Saved values disappeared on revisit.** Editing a description / base property looked fine immediately (optimistic UI), but clicking off and back showed the old value. Root cause: `useViewerComponent` is `cache-first`, and the auto-normalization from the mutation wasn't reliably reaching the panel's cached `Component:<id>` (id mismatch between mutation result and query result was the most likely culprit).

Fix in `useComponentMutations.ts`:
- `UPDATE_COMPONENT_DESCRIPTION` now returns `description { value displayValue }` (both fields).
- Added an explicit `cache.modify({ id: Component:<id>, fields: { description() { return updated.description } } })` in the mutation's `update` callback — robust to id mismatches.
- Added `refetchQueries: ['GetViewerComponent']` (description) and `refetchQueries: ['GetRootComponentBaseProperties', 'GetComponentBaseProperties']` (base properties) with `awaitRefetchQueries: true`. The mutation's `onCommit` promise now only resolves after the refetched value is in cache — no flicker between optimistic and refetched values.

**Bug 2 — Edited value leaked to the next component.** Editing Description on Component A and then selecting Component B in the viewer showed *A's edited text* on B. Root cause: cell components stayed mounted across component switches (same React tree position, same key), so `EditableTextCell` / `BasePropCell` local `optimisticValue` state survived a context where it no longer made sense.

Fix in two places:
- `ViewerPropertiesPanel.tsx` — each row's React `key` now includes `bomRowForCells.componentId`. Switching to a different component changes the key → React unmounts and remounts the cell with fresh state. Accordions stay mounted (their expand/collapse state is preserved across switches).
- `EditableTextCell.tsx` + `BasePropCell` in `componentColumns.ts` — `setOptimisticValue(null)` is now called after a successful `onCommit` (in addition to the existing error path). Belt-and-suspenders cleanup so the cell falls through to the freshly-refetched `value` / `valueMap[def.id]` instead of holding onto the local copy.

*Last updated: 2026-05-29*
