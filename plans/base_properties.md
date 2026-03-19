# Base Properties BOM Columns Plan

## Overview

Add dynamically-generated optional columns to the BOM tab for **base properties** — custom user-defined properties attached to components via a project-level Property Collection. Column options are driven by the property definitions fetched once from the root component's collection. Each visible row's property values are fetched independently and asynchronously; all values for a component arrive in a single query so that enabling an additional column does not trigger any new network requests. Collapsed rows are marked stale and refetched (with the cached value shown immediately) when re-expanded.

---

## API Background

> **Important:** The docs site at the provided URLs is JavaScript-rendered and could not be fetched directly. The field names below are based on the APS Manufacturing Data Model API v3 schema. **Verify every field name against the GraphQL playground or schema introspection before writing queries.** Key things to confirm:
> - Exact field name for `component.baseProperties` (may differ)
> - Exact field name for `component.propertyCollection`
> - Whether `propertyCollection.properties` is paginated or a flat array
> - Exact shape of each base property value (`value` vs `displayValue`, is it a scalar or object?)
> - Whether a property definition `type` field exists and what its values are

### Property Collection (schema — one per design)

A project-level schema that defines which user-created properties exist, their names, types, and units. Lives on the root component. Fetched **once** per BOM view and drives which columns appear in the column picker.

```graphql
query GetPropertyCollection($componentId: ID!) {
  component(componentId: $componentId, composition: WORKING) {
    id
    propertyCollection {
      id
      name
      properties(pagination: { limit: 100 }) {
        results {
          id
          name
          type        # e.g. "STRING" | "BOOLEAN" | "REAL" | "INTEGER"
          units { id name }
          isReadOnly
          isRequired
        }
      }
    }
  }
}
```

### Component Base Properties (values — one fetch per component)

The per-component values. All properties are fetched in a single query per component. Each entry links back to its definition via `propertyDefinition.id`.

```graphql
# Root component (composition: WORKING — same pattern as physicalProperties)
query GetRootComponentBaseProperties($componentId: ID!) {
  component(componentId: $componentId, composition: WORKING) {
    id
    baseProperties {
      propertyDefinition { id name }
      value
      displayValue
    }
  }
}

# Non-root components (state string)
query GetComponentBaseProperties($componentId: ID!, $state: String!) {
  component(componentId: $componentId, state: $state) {
    id
    baseProperties {
      propertyDefinition { id name }
      value
      displayValue
    }
  }
}
```

**Critical design point:** Both queries fetch **all** base properties for the component in one request. Apollo normalizes the result by `(componentId, state)`. Adding a second base-property column later does not require a new network call — the full value set is already in cache.

---

## Caching Strategy

| Scenario | Fetch Policy | Behaviour |
|---|---|---|
| Row becomes visible, base prop column enabled, first time | `cache-first` | Cache miss → network request, result cached |
| Second base prop column enabled, row already visible | `cache-first` | Cache hit → instant; **zero** new network requests |
| Row collapsed | — | Descendant `componentId:state` keys added to `staleBasePropsKeys` |
| Row re-expanded (was previously collapsed) | `cache-first` + imperative background refetch | **Cached (stale) value shown immediately**; background `network-only` refetch updates cache; cells re-render automatically when cache entry changes |
| Stale key cleared | — | After the imperative refetch completes; key removed from `staleBasePropsKeys` |
| No base prop columns selected | — | Neither `GET_PROPERTY_COLLECTION` (after root is known) nor `GET_COMPONENT_BASE_PROPERTIES` queries fire |

**How stale-while-revalidate works here:** Apollo `useQuery` with `cache-first` returns the cached value immediately. When an imperative `client.query({ fetchPolicy: 'network-only' })` completes and writes a new value to the cache, all active `useQuery` subscribers for that query key automatically re-render with the new value — with no additional hook configuration needed.

---

## Architecture

### State and data ownership

| Data | Owner | Mechanism |
|---|---|---|
| Property definitions (schema) | `usePropertyCollection` hook | `useQuery`, `cache-first`, runs once when root componentId is known |
| Base property values per component | Apollo cache (written by `useBomBaseProperties` per row) | `useQuery`, `cache-first` |
| Stale component keys (need refetch on next expand) | `useBomLoader` → `staleBasePropsKeys: Set<string>` | React state; updated on collapse and cleared after refetch |
| Selected base prop column IDs | `BomTab` state + `settings.ts` | `bomVisibleColumns` in localStorage; base prop column IDs use `baseProp:{definitionId}` prefix |

### Key identifiers

- **Stale key format**: `` `${componentId}:${componentState ?? 'root'}` ``
- **Column ID format**: `` `baseProp:${propertyDefinitionId}` ``

---

## Files

### New Files

#### `src/graphql/queries/baseProperties.ts`

Three GQL documents:
1. `GET_PROPERTY_COLLECTION` — root component `propertyCollection` + paginated `properties.results`
2. `GET_ROOT_COMPONENT_BASE_PROPERTIES` — root component `baseProperties` (with `composition: WORKING`)
3. `GET_COMPONENT_BASE_PROPERTIES` — non-root component `baseProperties` (with `state: $state`)

#### `src/hooks/usePropertyCollection.ts`

```ts
export interface PropertyDefinition {
  id: string
  name: string
  type: string   // 'STRING' | 'BOOLEAN' | 'REAL' | 'INTEGER' | etc.
  units: { id: string; name: string } | null
}

export function usePropertyCollection(rootComponentId: string | null): {
  definitions: PropertyDefinition[]
  loading: boolean
  error: ApolloError | undefined
}
```

- `skip: !rootComponentId` — does not fire until root component is known
- `fetchPolicy: 'cache-first'` — fires only once per Apollo cache lifetime
- Flattens `propertyCollection.properties.results` into a `PropertyDefinition[]`
- Returns an empty array while loading or if there is no property collection

#### `src/hooks/useBomBaseProperties.ts`

```ts
export function useBomBaseProperties(
  componentId: string,
  componentState: string | null
): {
  loading: boolean
  error: ApolloError | undefined
  // Map: propertyDefinitionId → displayValue (preferred) or value cast to string
  valueMap: Record<string, string | null>
}
```

- Uses root vs non-root query variant, same `isRoot = componentState === null` pattern as `useBomPhysicalProperties`
- `fetchPolicy: 'cache-first'`
- Parses the `baseProperties` array into `Record<definitionId, displayValue>` so any column can look up its value in O(1) — no per-property queries

### Modified Files

#### `src/types/bom.types.ts`

**No changes.** Base property values live entirely in the Apollo cache and are not stored on `BomRow`.

#### `src/graphql/queries/bom.ts`

**No changes.** Base properties are fetched via a separate query family to keep cache entries independent.

#### `src/hooks/useBomLoader.ts`

Add stale-key tracking to support refetch-on-re-expand:

```ts
// New state inside useBomLoader
const [staleBasePropsKeys, setStaleBasePropsKeys] = useState<Set<string>>(new Set())

// On collapse: collect all descendant componentId:state keys → mark stale
// (inside the setRows callback already used for collapse)
const descendantKeys: string[] = []
prev.forEach(r => {
  if (toRemove.has(r.id) && !r.id.startsWith('load-more:')) {
    descendantKeys.push(`${r.componentId}:${r.componentState ?? 'root'}`)
  }
})
setStaleBasePropsKeys(prev => {
  const next = new Set(prev)
  descendantKeys.forEach(k => next.add(k))
  return next
})

// New helper: called by cells after their background refetch completes
const clearStaleKey = useCallback((key: string) => {
  setStaleBasePropsKeys(prev => {
    const next = new Set(prev)
    next.delete(key)
    return next
  })
}, [])

// Return additions
return { rows, loading, error, toggleRow, loadMore, staleBasePropsKeys, clearStaleKey }
```

#### `src/components/detail/tabs/bom/bomColumns.ts`

**Extend `BomCellContext`:**

```ts
export interface BomCellContext {
  toggleRow: (row: BomRow) => void
  loadMore: (loadMoreRow: BomRow) => void
  sigFigs: number
  staleBasePropsKeys: Set<string>      // NEW
  clearStaleKey: (key: string) => void // NEW
}
```

**Add `BomBasePropCellInner` and `BomBasePropCell`:**

```tsx
function BomBasePropCellInner({
  row,
  definitionId,
  ctx,
}: {
  row: BomRow
  definitionId: string
  ctx: BomCellContext
}) {
  const componentKey = `${row.componentId}:${row.componentState ?? 'root'}`
  const isStale = ctx.staleBasePropsKeys.has(componentKey)
  const { loading, error, valueMap } = useBomBaseProperties(row.componentId, row.componentState)
  const client = useApolloClient()

  // One background refetch when this component was previously collapsed
  // cache-first useQuery shows stale value immediately; cache update re-renders the cell
  useEffect(() => {
    if (!isStale) return
    const query = row.componentState === null
      ? GET_ROOT_COMPONENT_BASE_PROPERTIES
      : GET_COMPONENT_BASE_PROPERTIES
    const variables = row.componentState === null
      ? { componentId: row.componentId }
      : { componentId: row.componentId, state: row.componentState }
    client.query({ query, variables, fetchPolicy: 'network-only' })
      .finally(() => ctx.clearStaleKey(componentKey))
  }, [isStale]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !Object.keys(valueMap).length) {
    return React.createElement(CircularProgress, { size: 12, sx: { color: 'text.disabled' } })
  }
  if (error) {
    return React.createElement(ErrorOutlineIcon, { fontSize: 'small', sx: { color: 'text.disabled' } })
  }

  const value = valueMap[definitionId] ?? null
  if (!value) return null
  return React.createElement(Typography, { variant: 'body2', noWrap: true }, value)
}

function BomBasePropCell({
  row,
  definitionId,
  ctx,
}: {
  row: BomRow
  definitionId: string
  ctx: BomCellContext
}) {
  if (row.id.startsWith('load-more:')) return null
  return React.createElement(
    Box,
    { sx: { display: 'flex', alignItems: 'center', height: '100%' } },
    React.createElement(BomBasePropCellInner, { row, definitionId, ctx })
  )
}
```

**Add column factory function** (exported for use in `BomTab`):

```ts
export function makeBasePropertyColumn(def: PropertyDefinition): BomColumnDef {
  return {
    id: `baseProp:${def.id}`,
    header: def.name,
    flex: 1,
    fetchOnDemand: true,
    getValue: () => null,
    renderCell: (row, ctx) =>
      React.createElement(BomBasePropCell, { row, definitionId: def.id, ctx }),
  }
}
```

#### `src/components/detail/tabs/bom/BomColumnSettings.tsx`

Extend props to accept the property definitions and a loading flag:

```ts
interface BomColumnSettingsProps {
  visibleColumnIds: string[]
  onChange: (ids: string[]) => void
  sigFigs: number
  onSigFigsChange: (n: number) => void
  basePropertyDefs?: PropertyDefinition[]  // NEW
  basePropsLoading?: boolean               // NEW — shows skeleton while collection loads
}
```

In the column picker `Popover`, render base property columns below existing columns in a labelled section:

```tsx
{/* Inside the popover Box, after the existing BOM_COLUMNS list */}
{(basePropsLoading || (basePropertyDefs && basePropertyDefs.length > 0)) && (
  <>
    <Divider sx={{ my: 1 }} />
    <Typography variant="caption" color="text.secondary" sx={{ pb: 0.5, display: 'block' }}>
      Base Properties
    </Typography>
    {basePropsLoading && <CircularProgress size={14} sx={{ my: 0.5 }} />}
    {basePropertyDefs?.map(def => {
      const colId = `baseProp:${def.id}`
      return (
        <FormControlLabel
          key={colId}
          label={def.name}
          control={
            <Checkbox
              size="small"
              checked={visibleColumnIds.includes(colId)}
              onChange={() => handleToggle(colId)}
            />
          }
        />
      )
    })}
  </>
)}
```

`handleToggle` already works for any column ID — no changes needed there.

#### `src/components/detail/tabs/bom/BomTab.tsx`

1. Destructure `staleBasePropsKeys` and `clearStaleKey` from `useBomLoader`
2. Derive `rootComponentId` from the first root row (available once rows are populated)
3. Call `usePropertyCollection(rootComponentId)`
4. Generate `basePropertyColumns` with `makeBasePropertyColumn`
5. Merge into `allColumns` for grid column filtering
6. Thread `staleBasePropsKeys` and `clearStaleKey` into `cellContext`
7. Pass `basePropertyDefs` and `basePropsLoading` to `BomColumnSettings`

```tsx
const { rows, loading, error, toggleRow, loadMore, staleBasePropsKeys, clearStaleKey } =
  useBomLoader(node)

const rootComponentId = useMemo(() => {
  const rootRow = rows.find(r => r.id.startsWith('root:'))
  return rootRow?.componentId ?? null
}, [rows])

const { definitions, loading: propCollLoading } = usePropertyCollection(rootComponentId)

const basePropertyColumns = useMemo(
  () => definitions.map(makeBasePropertyColumn),
  [definitions]
)

const allColumns = useMemo(
  () => [...BOM_COLUMNS, ...basePropertyColumns],
  [basePropertyColumns]
)

const cellContext: BomCellContext = useMemo(
  () => ({ toggleRow, loadMore, sigFigs, staleBasePropsKeys, clearStaleKey }),
  [toggleRow, loadMore, sigFigs, staleBasePropsKeys, clearStaleKey]
)

// Filter from allColumns (not BOM_COLUMNS)
const gridColumns: GridColDef[] = useMemo(
  () =>
    allColumns
      .filter(c => visibleColumnIds.includes(c.id))
      .map(c => ({
        field: c.id,
        headerName: c.header,
        width: c.width,
        flex: c.flex,
        sortable: false,
        valueGetter: (_value: unknown, row: BomRow) => c.getValue(row) ?? '',
        renderCell: c.renderCell
          ? (params: any) => c.renderCell!(params.row as BomRow, cellContext)
          : undefined,
      })),
  [allColumns, visibleColumnIds, cellContext]
)
```

Pass to `BomColumnSettings`:
```tsx
<BomColumnSettings
  visibleColumnIds={visibleColumnIds}
  onChange={handleColumnChange}
  sigFigs={sigFigs}
  onSigFigsChange={handleSigFigsChange}
  basePropertyDefs={definitions}
  basePropsLoading={propCollLoading}
/>
```

#### `src/settings.ts`

**No changes.** Base property column IDs (`baseProp:${id}`) are stored in the existing `bomVisibleColumns` string array. If the property collection changes between sessions (definitions removed/renamed), stale IDs in `bomVisibleColumns` are silently ignored because the column won't appear in `allColumns`.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Property collection query fails | `usePropertyCollection` returns `error`; no base property section shown in column picker; no base property queries fired |
| Individual component base properties query fails | Cell shows `ErrorOutlineIcon` (same as `BomPhysicalPropertiesCell`); other rows unaffected |
| Component has no base properties set | `valueMap` is empty; cells render nothing (`null`) for that row |
| Property collection is empty (no definitions) | Base properties section is hidden from column picker; no queries fire |

---

## Implementation Phases

### Phase 1 — Verify API schema
Before writing any code, open the GraphQL playground (authenticated) and introspect the `Component` type to confirm:
- `component.propertyCollection` field name and shape
- `component.baseProperties` field name and shape
- `BasePropertyValue` object structure (`value`, `displayValue`, `propertyDefinition`)
- `PropertyDefinition` object structure (`id`, `name`, `type`, `units`)
- Whether `propertyCollection.properties` is paginated (needs `results` wrapper) or flat

Adjust the query structures in this plan as needed.

### Phase 2 — GraphQL queries
Create `src/graphql/queries/baseProperties.ts` with verified queries.

### Phase 3 — `usePropertyCollection` hook
Create hook; test by rendering the definitions count in a `console.log` from `BomTab`.

### Phase 4 — `useBomBaseProperties` hook
Create hook; verify the `valueMap` structure against a real API response.

### Phase 5 — `useBomLoader` stale tracking
Extend `toggleRow` collapse branch and add `clearStaleKey`; no changes to expand path.

### Phase 6 — Column definitions
Add `BomBasePropCellInner`, `BomBasePropCell`, `makeBasePropertyColumn`, and the new `BomCellContext` fields to `bomColumns.ts`. Add the necessary imports (`useBomBaseProperties`, `GET_ROOT_COMPONENT_BASE_PROPERTIES`, `GET_COMPONENT_BASE_PROPERTIES`, `useApolloClient`).

### Phase 7 — `BomColumnSettings` update
Add the "Base Properties" section to the column picker popover.

### Phase 8 — `BomTab` wiring
Wire all pieces together in `BomTab.tsx`.

### Phase 9 — Verify

- [ ] No base prop columns selected → zero `baseProperties` network requests
- [ ] Enable one base prop column → each visible row fires one `GET_*BaseProperties` query; column shows values
- [ ] Enable a second base prop column → **zero new network requests**; values appear instantly from cache
- [ ] Column picker shows "Base Properties" section with definitions from property collection
- [ ] Collapse a row with children → descendants added to `staleBasePropsKeys`
- [ ] Re-expand that row → stale cells show old values immediately, trigger one background refetch each, update when response arrives
- [ ] After refetch completes → stale key removed from set; no further background refetches on subsequent renders
- [ ] Navigate away and back to BOM tab → `usePropertyCollection` hits cache; no redundant fetches
- [ ] Component with no base property values set → cells render empty (no error)
- [ ] Property collection query fails → column picker shows no base properties section; no errors in BOM rows
- [ ] TypeScript: `npx tsc --noEmit` passes with zero errors

---

## Non-goals (this phase)

- Editing base property values (read-only display only)
- Pagination of property definitions (assume ≤ 100 per collection; `limit: 100` is sufficient)
- Multiple property collections per design
- Sorting rows by base property column values
- Displaying property type metadata (units, type) in column headers
