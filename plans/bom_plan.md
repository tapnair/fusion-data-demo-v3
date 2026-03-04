# BOM Tab Implementation Plan

## Overview

Implement a progressive, expandable Bill of Materials tree inside the BOM tab for `DesignItem` nodes. The BOM is rendered as a MUI DataGrid (community edition) with manual tree row management — rows are kept as a flat list with depth-based indentation and expand/collapse controls.

---

## Data Model & Schema

### Traversal path

```
DesignItem.tipRootModel              → Model
  └─ Model.component(composition: WORKING)  → Component   (root of BOM)
       └─ Component.bomRelations(depth: 1)  → BOMRelations
            └─ BOMRelation.toComponent      → Component   (child)
                 └─ Component.bomRelations(depth: 1)  → (next level, loaded on expand)
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

### `GET_ITEM_BOM` — initial load
Fetch root component + its first-level children from the `DesignItem`.

```graphql
query GetItemBom($hubId: ID!, $itemId: ID!, $pagination: PaginationInput) {
  item(hubId: $hubId, itemId: $itemId) {
    __typename
    ... on DesignItem {
      tipRootModel {
        component {
          id
          name { value }
          partNumber { value }
          description { value }
          materialName { value }
          hasChildren
          thumbnail { signedUrl }
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
                thumbnail { signedUrl }
              }
            }
          }
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
          thumbnail { signedUrl }
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
`GET_ITEM_BOM` and `GET_COMPONENT_BOM_CHILDREN` as `gql` DocumentNode constants.

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

  // loadRoot(): fetch GET_ITEM_BOM, build root row + level-1 child rows
  // toggleRow(row): if expanding → loadChildren(); if collapsing → remove descendants
  // loadMore(row): fetch next page for an already-expanded row, append rows

  return { rows, loading, error, toggleRow, loadMore }
}
```

**`loadRoot`**: queries `GET_ITEM_BOM`, builds a `BomRow` for the root `Component` at depth 0 (pre-expanded, `isExpanded: true`), then maps its `bomRelations.results` into `BomRow[]` at depth 1. The root row is always shown and always starts expanded so its children are immediately visible.

**`toggleRow(row)`**:
- If `isExpanded`: set `isExpanded: false`, remove all descendant rows from the flat list (rows whose id chain leads back to `row.id`).
- If `!isExpanded`: set `isLoading: true` on the row, call `loadChildren(row)`.

**`loadChildren(row)`**: queries `GET_COMPONENT_BOM_CHILDREN` with `componentId` and `state`. Inserts resulting `BomRow[]` at `depth + 1` into the flat array immediately after `row` (and after any of its existing siblings). Stores `nextCursor`.

**`loadMore(row)`**: queries next page using stored cursor, appends new rows after existing children of that parent. Replaces the "load more" sentinel row.

**Descendant removal**: use a recursive walk or track parent chains — remove any row where walking `parentRowId` upward reaches the collapsed row's id.

#### `src/components/detail/tabs/bom/bomColumns.ts`
Column registry: `BomColumnDef` interface, `BomCellContext` interface, `BOM_COLUMNS` array, `DEFAULT_VISIBLE_COLUMNS`, and `BomNameCell` render component. All future column additions go here only.

#### `src/components/detail/tabs/bom/BomColumnSettings.tsx`
Settings popover component. `ViewColumnIcon` button → `Popover` → list of `Checkbox` + label per column. Always-visible columns have disabled checkboxes. This component is used as the DataGrid `slots.toolbar` (see below).

#### `src/components/detail/tabs/bom/BomTab.tsx` *(replaces `tabs/BomTab.tsx` placeholder)*

```tsx
export function BomTab({ node }: { node: NavNode }) {
  const { rows, loading, error, toggleRow, loadMore } = useBomLoader(node)
  const [visibleColumnIds, setVisibleColumnIds] = useState(...)
  const cellContext: BomCellContext = useMemo(() => ({ toggleRow, loadMore }), [toggleRow, loadMore])
  const gridColumns = buildGridColumns(visibleColumnIds, cellContext)
  const density = useWeaveDensity() // maps Weave density to DataGrid density prop
  // DataGrid with slots.toolbar = BomColumnSettings
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
  loadMore: (parentRowId: string) => void
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

**Load-more row**: A sentinel `BomRow` with `id: 'load-more:{parentRowId}'`. Its `renderCell` in the Name column renders a "Load more…" `Button` that calls `ctx.loadMore(parentRowId)`.

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

The DataGrid uses `slots.toolbar` for the column settings control and follows the app's current Weave density setting:

```tsx
// Weave density → DataGrid density mapping
const DENSITY_MAP: Record<WeaveDensity, 'compact' | 'standard' | 'comfortable'> = {
  compact: 'compact',
  medium: 'standard',
  comfortable: 'comfortable',
}

<DataGrid
  rows={rows}
  columns={gridColumns}
  getRowId={(r) => r.id}
  hideFooter
  density={DENSITY_MAP[density]}
  slots={{ toolbar: BomColumnSettings }}
  slotProps={{ toolbar: { visibleColumnIds, onChange: handleColumnChange } }}
  sx={{ border: 'none' }}
/>
```

`BomColumnSettings` as a toolbar renders a compact row with a `ViewColumnIcon` `IconButton` that opens a `Popover` of checkboxes. It sits inside the DataGrid's own header area above the column headers.

Row selection is enabled (standard DataGrid default). Clicking a row highlights it using the DataGrid's built-in selection styling — no further action is taken in this phase.

Rows are ordered by `sequenceNumber` within each sibling group (preserved in the flat list). No column sorting or filtering in this phase.

---

## Column Settings

### `BomColumnSettings` component

Rendered via the DataGrid's `slots.toolbar`. A small `IconButton` with `ViewColumnIcon` sits inside the DataGrid's toolbar area. Clicking it opens an MUI `Popover` listing all columns from `BOM_COLUMNS` with a `Checkbox` per column:

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

- The DataGrid `density` prop follows the app's Weave density setting via a mapping: `compact → 'compact'`, `medium → 'standard'`, `comfortable → 'comfortable'`. Read the density from `AppShell`'s props (or a context/hook that exposes it).
- Do not set hardcoded colours — use `background.paper`, `text.secondary`, etc.
- The DataGrid community edition picks up MUI theme overrides automatically.
- If Weave provides a `MuiDataGrid` component override in the theme, it will apply automatically. No custom `sx` colour overrides needed.

---

## Implementation Phases

### Phase 1 — Package & types
- `npm install @mui/x-data-grid`
- Create `src/types/bom.types.ts` (`BomRow` with `materialName` field)

### Phase 2 — Queries & cache policy
- Create `src/graphql/queries/bom.ts` (`GET_ITEM_BOM`, `GET_COMPONENT_BOM_CHILDREN` — both include `materialName { value }`)
- Update `src/apollo/typePolicies.ts` with `Component` entity + `bomRelations` pagedField

### Phase 3 — `useBomLoader` hook
- Implement `loadRoot`, `toggleRow`, `loadChildren`, `loadMore`

### Phase 4 — Column registry & settings
- Create `src/components/detail/tabs/bom/bomColumns.ts` with `BomColumnDef`, `BOM_COLUMNS`, `DEFAULT_VISIBLE_COLUMNS`
- Create `src/components/detail/tabs/bom/BomColumnSettings.tsx`

### Phase 5 — `BomTab` component
- Create `src/components/detail/tabs/bom/BomTab.tsx` replacing the placeholder
- Column visibility state with `localStorage` persistence
- Title bar with "BOM" label + `BomColumnSettings` icon button
- DataGrid wired to registry-derived columns
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
