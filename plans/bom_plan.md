# BOM Tab Implementation Plan

## Overview

Implement a progressive, expandable Bill of Materials tree inside the BOM tab for `DesignItem` nodes. The BOM is rendered as a MUI DataGrid (community edition) with manual tree row management — rows are kept as a flat list with depth-based indentation and expand/collapse controls.

---

## Data Model & Schema

### Traversal path

The BOM tab does **not** re-traverse the item → model → component path. Instead it reads the component ID from the Apollo cache entry already populated by `ItemDetail` (`GET_ITEM_DETAIL` → `tipRootModel.component.id`), then queries the component directly:

```
Apollo cache (GET_ITEM_DETAIL)
  └─ DesignItem.tipRootModel.component.id  → componentId

GET_ROOT_COMPONENT_BOM(componentId, composition: WORKING)
  └─ Component.bomRelations(depth: 1)    → BOMRelations
       └─ BOMRelation.toComponent        → Component   (child)
            └─ GET_COMPONENT_BOM_CHILDREN(componentId, state)  → (next level, loaded on expand)
```

### Key fields used

**Component**
- `id`, `name.value`, `partNumber.value`, `description.value`, `materialName.value`
- `hasChildren: Boolean` — determines if expand arrow is shown
- `thumbnail.signedUrl` — component thumbnail
- `bomRelations(depth: 1, pagination: PaginationInput): BOMRelations`

**BOMRelation**
- `id` — row identity
- `toComponent: Component` — the child component
- `toComponentState: String` — opaque state string; must be passed back when querying children to get the same version
- `quantityProperty.value` — quantity
- `sequenceNumber: Int` — natural ordering within siblings

**BOMRelations**
- `results: [BOMRelation]`
- `pagination: { cursor, pageSize }` — cursor-based; `cursor` null means no more pages

---

## GraphQL Queries

### `GET_ROOT_COMPONENT_BOM` — initial load
Fetches the root component directly by component ID using `composition: WORKING`. The component ID is read from the Apollo cache entry for `GET_ITEM_DETAIL` (already fetched by `ItemDetail`); if not cached, `GET_ITEM_DETAIL` is fetched first. This avoids re-traversing the item → model → component path.

```graphql
query GetRootComponentBom($componentId: ID!, $pagination: PaginationInput) {
  component(componentId: $componentId, composition: WORKING) {
    id
    name { value }
    partNumber { value }
    description { value }
    materialName { value }
    hasChildren
    bomRelations(depth: 1, pagination: $pagination) {
      pagination { cursor pageSize }
      results {
        id
        sequenceNumber
        quantityProperty { value }
        toComponentState
        toComponent {
          id
          name { value }
          partNumber { value }
          description { value }
          materialName { value }
          hasChildren
        }
      }
    }
  }
}
```

### `GET_COMPONENT_BOM_CHILDREN` — lazy child load
Fetch children of any component when a row is expanded.

```graphql
query GetComponentBomChildren($componentId: ID!, $state: String, $pagination: PaginationInput) {
  component(componentId: $componentId, state: $state) {
    id
    bomRelations(depth: 1, pagination: $pagination) {
      pagination { cursor pageSize }
      results {
        id
        sequenceNumber
        quantityProperty { value }
        toComponentState
        toComponent {
          id
          name { value }
          partNumber { value }
          description { value }
          materialName { value }
          hasChildren
        }
      }
    }
  }
}
```

Both queries go in `src/graphql/queries/bom.ts`.

---

## Apollo Cache — Type Policies

Add `Component.bomRelations` as a `pagedField` in `src/apollo/typePolicies.ts`:

```ts
Component: {
  keyFields: ['id'],
  fields: {
    bomRelations: pagedField(['depth']),
  },
},
```

`keyArgs: ['depth']` ensures depth-1 results are cached separately from a future depth-0 (full) call.

---

## BomRow — Flat Row Model

```ts
// src/types/bom.types.ts
export interface BomRow {
  id: string              // BOMRelation id; root row uses 'root:{componentId}'
  componentId: string     // toComponent.id (or root component id)
  componentState: string | null  // toComponentState — null for root
  name: string
  partNumber: string
  description: string
  materialName: string
  quantity: string | null  // null for root row (no parent BOMRelation)
  sequenceNumber: number   // 0 for root
  depth: number            // 0 = root component, 1 = direct children, etc.
  hasChildren: boolean
  isExpanded: boolean
  isLoading: boolean
  parentRowId: string | null
  nextCursor: string | null  // pagination cursor for this component's children
}
```

---

## Files

### New Files

#### `src/types/bom.types.ts`
`BomRow` interface (above).

#### `src/graphql/queries/bom.ts`
`GET_ROOT_COMPONENT_BOM` and `GET_COMPONENT_BOM_CHILDREN` as `gql` DocumentNode constants.

#### `src/hooks/useBomLoader.ts`
Manages the flat `BomRow[]` list and all expand/collapse/pagination logic.

```ts
export function useBomLoader(node: NavNode) {
  const client = useApolloClient()
  const [rows, setRows] = useState<BomRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load root BOM on mount / node change
  useEffect(() => { loadRoot() }, [node.entityId])

  // loadRoot(): read componentId from cache, fetch GET_ROOT_COMPONENT_BOM, build root row + level-1 child rows
  // toggleRow(row): if expanding → loadChildren(); if collapsing → remove descendants
  // loadMore(row): fetch next page for an already-expanded row, append rows

  return { rows, loading, error, toggleRow, loadMore }
}
```

**`loadRoot`**: reads the component ID from the Apollo cache entry for `GET_ITEM_DETAIL` (already populated by `ItemDetail`). If not yet cached, fetches `GET_ITEM_DETAIL` to obtain `tipRootModel.component.id`. Then queries `GET_ROOT_COMPONENT_BOM` with that component ID and `composition: WORKING`. Builds a `BomRow` for the root `Component` at depth 0 (pre-expanded) and maps its `bomRelations.results` into `BomRow[]` at depth 1.

**`toggleRow(row)`**:
- If `isExpanded`: set `isExpanded: false`, remove all descendant rows from the flat list (rows whose id chain leads back to `row.id`).
- If `!isExpanded`: set `isLoading: true` on the row, call `loadChildren(row)`.

**`loadChildren(row)`**: queries `GET_COMPONENT_BOM_CHILDREN` with `componentId` and `state`. Inserts resulting `BomRow[]` at `depth + 1` into the flat array immediately after `row` (and after any of its existing siblings). Stores `nextCursor`.

**`loadMore(row)`**: queries next page using stored cursor, appends new rows after existing children of that parent. Replaces the "load more" sentinel row.

**Descendant removal**: use a recursive walk or track parent chains — remove any row where walking `parentRowId` upward reaches the collapsed row's id.

#### `src/components/detail/tabs/bom/bomColumns.ts`
Column registry: `BomColumnDef` interface, `BomCellContext` interface, `BOM_COLUMNS` array, `DEFAULT_VISIBLE_COLUMNS`, and `BomNameCell` render component. All future column additions go here only.

#### `src/components/detail/tabs/bom/BomColumnSettings.tsx`
Standalone settings component rendered directly above the DataGrid. `ViewColumnIcon` button → `Popover` → list of `Checkbox` + label per column. Always-visible columns have disabled checkboxes. Has a bottom border separating it from the grid headers.

#### `src/components/detail/tabs/bom/BomTab.tsx` *(replaces `tabs/BomTab.tsx` placeholder)*

```tsx
export function BomTab({ node }: { node: NavNode }) {
  const theme = useTheme()  // theme.density is WeaveDensity ('high' | 'medium' | 'low')
  const { rows, loading, error, toggleRow, loadMore } = useBomLoader(node)
  const [visibleColumnIds, setVisibleColumnIds] = useState(...)
  const cellContext: BomCellContext = useMemo(() => ({ toggleRow, loadMore }), [toggleRow, loadMore])
  const gridColumns = buildGridColumns(visibleColumnIds, cellContext)
  // BomColumnSettings rendered above DataGrid; density mapped from theme.density
}
```

**BomTab receives `node`** — requires updating `DetailPanel` to pass `node` when rendering `<BomTab>`.

---

### Modified Files

#### `src/apollo/typePolicies.ts`
Add `Component` entity and `bomRelations` pagedField (see above).

#### `src/components/detail/DetailPanel.tsx`
Pass `node={selectedNode}` to `<BomTab>` (currently rendered without props):
```tsx
{activeTab === 'bom' && <BomTab node={selectedNode} />}
```

---

## Column Registry

Install `@mui/x-data-grid` (community, free):
```
npm install @mui/x-data-grid
```

### `BomColumnDef` — abstract column definition

All columns are described by a single interface. Adding a new column type in the future means adding one entry to the registry — no changes to `BomTab` or the DataGrid setup.

```ts
// src/components/detail/tabs/bom/bomColumns.ts

export interface BomColumnDef {
  /** Unique stable key used for visibility persistence */
  id: string
  /** Column header label */
  header: string
  /** Width hint (flex takes precedence if set) */
  width?: number
  flex?: number
  /** Extract the display value from a BomRow */
  getValue: (row: BomRow) => string | null
  /** Optional custom cell renderer — receives the row and tree callbacks */
  renderCell?: (row: BomRow, ctx: BomCellContext) => React.ReactNode
  /** If true, column cannot be hidden via settings */
  alwaysVisible?: boolean
  /**
   * If true, this column's data is NOT included in the base BOM query.
   * useBomLoader must fetch it separately when the column becomes visible.
   * (Reserved for future columns — all initial columns are fetchedInBase.)
   */
  fetchOnDemand?: boolean
}

export interface BomCellContext {
  toggleRow: (row: BomRow) => void
  loadMore: (loadMoreRow: BomRow) => void  // receives the load-more sentinel row (which carries the cursor)
}
```

### `BOM_COLUMNS` — registry of all known columns

```ts
export const BOM_COLUMNS: BomColumnDef[] = [
  {
    id: 'name',
    header: 'Name',
    flex: 2,
    alwaysVisible: true,
    getValue: (row) => row.name,
    renderCell: (row, ctx) => <BomNameCell row={row} ctx={ctx} />,
  },
  {
    id: 'description',
    header: 'Description',
    flex: 2,
    getValue: (row) => row.description,
  },
  {
    id: 'partNumber',
    header: 'P/N',
    width: 160,
    getValue: (row) => row.partNumber,
    // rendered with monospace font via sx on the cell
  },
  {
    id: 'material',
    header: 'Material',
    width: 160,
    getValue: (row) => row.materialName,
  },
]

/** IDs visible by default */
export const DEFAULT_VISIBLE_COLUMNS = ['name', 'description', 'partNumber', 'material']
```

`BomNameCell` is a small co-located component in the same file that renders the tree indent, expand icon, and loading spinner:

```tsx
function BomNameCell({ row, ctx }: { row: BomRow; ctx: BomCellContext }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', pl: row.depth * 3 }}>
      {row.hasChildren ? (
        <IconButton size="small" onClick={() => ctx.toggleRow(row)}>
          {row.isLoading
            ? <CircularProgress size={16} />
            : row.isExpanded
              ? <ExpandLessIcon fontSize="small" />
              : <ChevronRightIcon fontSize="small" />}
        </IconButton>
      ) : (
        <Box sx={{ width: 28 }} />
      )}
      <Typography variant="body2">{row.name}</Typography>
    </Box>
  )
}
```

**Load-more row**: A sentinel `BomRow` with `id: 'load-more:{parentRowId}'` and `nextCursor` set to the pagination cursor. Its `renderCell` in the Name column renders a "Load more…" `Button` that calls `ctx.loadMore(row)`, passing the sentinel row itself so `useBomLoader` can read `row.nextCursor`, `row.componentId`, and `row.componentState` without any stale closure issues.

### Deriving DataGrid columns from the registry

`BomTab` converts `BOM_COLUMNS` filtered by `visibleColumnIds` into `GridColDef[]`:

```ts
const gridColumns: GridColDef[] = BOM_COLUMNS
  .filter(c => visibleColumnIds.includes(c.id))
  .map(c => ({
    field: c.id,
    headerName: c.header,
    width: c.width,
    flex: c.flex,
    valueGetter: (_, row) => c.getValue(row as BomRow),
    renderCell: c.renderCell
      ? (params) => c.renderCell!(params.row as BomRow, cellContext)
      : undefined,
  }))
```

### DataGrid configuration

`BomColumnSettings` is rendered as a plain component **directly above** the DataGrid inside a flex column container — not via `slots.toolbar`. This is more reliable than the toolbar slot approach.

```tsx
// Weave density → DataGrid density mapping
// Weave values: 'high' | 'medium' | 'low'
const DENSITY_MAP: Record<WeaveDensity, 'compact' | 'standard' | 'comfortable'> = {
  high: 'compact',
  medium: 'standard',
  low: 'comfortable',
}

<Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
  <BomColumnSettings visibleColumnIds={visibleColumnIds} onChange={handleColumnChange} />
  <DataGrid
    rows={rows}
    columns={gridColumns}
    getRowId={(r) => r.id}
    hideFooter
    disableColumnMenu
    density={DENSITY_MAP[theme.density]}
    sx={{ border: 'none', flex: 1 }}
  />
</Box>
```

The density is read from the MUI theme via `useTheme()` — `theme.density` is set by the Weave theme factory and reflects the app's current density selection.

Row selection is enabled (standard DataGrid default). Clicking a row highlights it using the DataGrid's built-in selection styling — no further action is taken in this phase.

Rows are ordered by `sequenceNumber` within each sibling group (preserved in the flat list). No column sorting or filtering in this phase.

---

## Column Settings

### `BomColumnSettings` component

A standalone MUI component rendered above the DataGrid. A small `IconButton` with `ViewColumnIcon` opens an MUI `Popover` listing all columns from `BOM_COLUMNS` with a `Checkbox` per column. Has a bottom border to visually separate it from the grid column headers.

- `name` column checkbox is disabled (`alwaysVisible: true`)
- All other columns are toggleable
- Checked state is controlled by `visibleColumnIds`

```tsx
// src/components/detail/tabs/bom/BomColumnSettings.tsx
interface BomColumnSettingsProps {
  visibleColumnIds: string[]
  onChange: (ids: string[]) => void
}
```

### Column visibility state

Managed in `BomTab`:

```ts
const STORAGE_KEY = 'bom-visible-columns'

const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : DEFAULT_VISIBLE_COLUMNS
})

const handleColumnChange = (ids: string[]) => {
  setVisibleColumnIds(ids)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}
```

Persisted to `localStorage` so the user's column choice survives page reload. Always-visible columns are enforced by `BomColumnSettings` (disabled checkbox) and by a guard in `handleColumnChange` that ensures `'name'` is always present.

---

## Weave V3 Styling Notes

- The DataGrid `density` prop follows the app's Weave density setting via a mapping: `high → 'compact'`, `medium → 'standard'`, `low → 'comfortable'`. Read via `useTheme()` — `theme.density` is set by the Weave theme factory and is always current.
- Do not set hardcoded colours — use `background.paper`, `text.secondary`, etc.
- The DataGrid community edition picks up MUI theme overrides automatically.
- If Weave provides a `MuiDataGrid` component override in the theme, it will apply automatically. No custom `sx` colour overrides needed.

---

## Implementation Phases

### Phase 1 — Package & types
- `npm install @mui/x-data-grid`
- Create `src/types/bom.types.ts` (`BomRow` with `materialName` field)

### Phase 2 — Queries & cache policy
- Create `src/graphql/queries/bom.ts` (`GET_ROOT_COMPONENT_BOM`, `GET_COMPONENT_BOM_CHILDREN` — both include `materialName { value }`)
- Update `src/apollo/typePolicies.ts` with `Component` entity + `bomRelations` pagedField

### Phase 3 — `useBomLoader` hook
- Implement `loadRoot`, `toggleRow`, `loadChildren`, `loadMore`

### Phase 4 — Column registry & settings
- Create `src/components/detail/tabs/bom/bomColumns.ts` with `BomColumnDef`, `BOM_COLUMNS`, `DEFAULT_VISIBLE_COLUMNS`
- Create `src/components/detail/tabs/bom/BomColumnSettings.tsx`

### Phase 5 — `BomTab` component
- Create `src/components/detail/tabs/bom/BomTab.tsx` replacing the placeholder
- Column visibility state with `localStorage` persistence
- `BomColumnSettings` rendered directly above the DataGrid (not via `slots.toolbar`)
- DataGrid wired to registry-derived columns; density from `useTheme()`
- Update `DetailPanel` to pass `node` prop to `<BomTab>`
- Delete old `src/components/detail/tabs/BomTab.tsx` placeholder

### Phase 6 — Verify
- DesignItem with children: expand rows, verify depth indentation
- Leaf rows: no expand arrow
- Pagination: "Load more" appears when cursor non-null, appends correctly
- Collapse: descendant rows removed
- Cache: re-expand previously loaded row restores instantly from Apollo cache
- Column settings: toggle columns on/off, verify persistence after reload
- Future-proofing: add a dummy column to registry, confirm it appears in settings without other changes

---

## Non-goals (this phase)

- No column sorting or filtering
- Row selection highlights the clicked row (visual only — no detail drill-down)
- No computed or custom properties
- No quantity unit display
- No lifecycle / revision information
- No thumbnail display in rows
