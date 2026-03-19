# Base Properties BOM Columns Plan

## Overview

Add dynamically-generated optional columns to the BOM tab for **base properties** — custom user-defined properties attached to components via a hub-level Property Definition Collection. Column options are driven by the property definitions fetched **once per hub per session** from `Hub.basePropertyDefinitionCollections`. Each visible row's property values are fetched independently and asynchronously via `Component.baseProperties`; all values for a component arrive in a single query so that enabling an additional column does not trigger any new network requests. Collapsed rows are marked stale and silently refetched (with the cached value shown immediately) when re-expanded.

---

## API Structure (schema-verified)

All field names below are confirmed against `schema.graphql` in this repo.

### Hub-level: Property Definition Collections

`Hub.basePropertyDefinitionCollections` returns a `PropertyDefinitionCollections` object containing a flat list of collections. Each collection's `definitions` field returns the `PropertyDefinition` objects. Flatten all definitions across all collections — there will never be name or ID conflicts.

```graphql
query GetHubBasePropertyDefinitions($hubId: ID!) {
  hub(hubId: $hubId) {
    id
    basePropertyDefinitionCollections {
      results {
        id
        name
        definitions {
          results {
            id
            name
            specification    # e.g. "STRING" | "REAL" | "INTEGER" | "BOOLEAN"
            units { id name }
            isHidden
            isArchived
            isReadOnly
            propertyBehavior # "STANDARD" | "TIMELESS"
          }
        }
      }
    }
  }
}
```

**`PropertyDefinition` fields used:**

| Field | Type | Purpose |
|---|---|---|
| `id` | `ID!` | Column ID key (`baseProp:${id}`), value map key |
| `name` | `String!` | Column header label |
| `specification` | `String` | Data type hint for future formatting (`"STRING"`, `"REAL"`, etc.) |
| `units` | `Units { id name }` | Optional unit suffix in cell display |
| `isHidden` | `Boolean` | Filter out — do not show in column picker |
| `isArchived` | `Boolean` | Filter out — do not show in column picker |
| `isReadOnly` | `Boolean` | Informational only (display only, no editing in scope) |

### Component-level: Base Property Values

`Component.baseProperties` returns a `Properties` object. **Pagination is not supported by the API** — all values are returned in a single call despite the `Properties` wrapper type.

```graphql
# Root component (composition: WORKING)
query GetRootComponentBaseProperties($componentId: ID!) {
  component(componentId: $componentId, composition: WORKING) {
    id
    baseProperties {
      results {
        name
        displayValue
        value
        definition { id }
      }
    }
  }
}

# Non-root components (state string)
query GetComponentBaseProperties($componentId: ID!, $state: String!) {
  component(componentId: $componentId, state: $state) {
    id
    baseProperties {
      results {
        name
        displayValue
        value
        definition { id }
      }
    }
  }
}
```

**`Property` fields used:**

| Field | Type | Purpose |
|---|---|---|
| `displayValue` | `String` | Primary display string — use this first |
| `value` | `PropertyValue` (scalar) | Fallback if `displayValue` is null — call `String(value)` |
| `definition.id` | `ID!` | Key for value map lookup by column |

**Key design point:** Both queries fetch **all** base properties for the component in one request. Apollo normalises the result by `(componentId, state)`. Enabling a second base-property column later costs **zero extra network requests** — the value for that definition is already in cache.

---

## Caching Strategy

| Scenario | Fetch Policy | Behaviour |
|---|---|---|
| Property definitions (hub) | `cache-first` | Fetched once per hub per session; never refetched unless Apollo cache is cleared |
| Row becomes visible, first base prop column enabled | `cache-first` | Cache miss → network request; all property values cached together |
| Second base prop column enabled, row already visible | `cache-first` | Cache hit → instant; **zero** new network requests |
| Row collapsed | — | Descendant `componentId:state` keys added to `staleBasePropsKeys` |
| Row re-expanded (was previously collapsed) | `cache-first` + imperative background refetch | **Stale cached value shown immediately**; one `network-only` refetch per stale component updates cache; cells re-render automatically |
| Stale key cleared | — | After imperative refetch completes; key removed from set |
| No base prop columns selected | — | `GetComponentBaseProperties` queries never fire |

**How stale-while-revalidate works:** `useQuery` with `cache-first` returns the cached value immediately. When an imperative `client.query({ fetchPolicy: 'network-only' })` completes and writes new values to the Apollo cache, all active `useQuery` subscribers for that query key re-render automatically — no additional hook configuration needed.

---

## Architecture

### State and data ownership

| Data | Owner | Mechanism |
|---|---|---|
| Property definitions | `useHubBasePropertyDefinitions(hubId)` | `useQuery`, `cache-first`, runs once per hub |
| Base property values per component | Apollo cache (via `useBomBaseProperties` per row) | `useQuery`, `cache-first` |
| Stale component keys (need refetch on next expand) | `useBomLoader` → `staleBasePropsKeys: Set<string>` | React state; updated on collapse, cleared after refetch |
| Selected base prop column IDs | `BomTab` state + `settings.ts` | `bomVisibleColumns` in localStorage; prefix `baseProp:{definitionId}` |

### Key identifiers

- **Stale key format**: `` `${componentId}:${componentState ?? 'root'}` ``
- **Column ID format**: `` `baseProp:${propertyDefinitionId}` ``

### Hub ID availability

`BomTab` receives `node: NavNode` which has `node.hubId`. This is passed directly to `useHubBasePropertyDefinitions`.

---

## Files

### New Files

#### `src/graphql/queries/baseProperties.ts`

Three GQL documents:
1. `GET_HUB_BASE_PROPERTY_DEFINITIONS` — `hub.basePropertyDefinitionCollections.results[].definitions.results[]`
2. `GET_ROOT_COMPONENT_BASE_PROPERTIES` — `component(composition: WORKING).baseProperties.results[]`
3. `GET_COMPONENT_BASE_PROPERTIES` — `component(state: $state).baseProperties.results[]`

#### `src/hooks/useHubBasePropertyDefinitions.ts`

```ts
export interface PropertyDefinition {
  id: string
  name: string
  specification: string | null   // 'STRING' | 'REAL' | 'INTEGER' | 'BOOLEAN' | etc.
  units: { id: string; name: string } | null
  isReadOnly: boolean | null
}

export function useHubBasePropertyDefinitions(hubId: string | null | undefined): {
  definitions: PropertyDefinition[]
  loading: boolean
  error: ApolloError | undefined
}
```

- `skip: !hubId`
- `fetchPolicy: 'cache-first'` — fires once per hub per Apollo cache lifetime
- Flattens all collections: `results.flatMap(c => c.definitions.results)`
- **Filters out** definitions where `isHidden === true` or `isArchived === true`
- Returns sorted by `name` for predictable column picker order

#### `src/hooks/useBomBaseProperties.ts`

```ts
export function useBomBaseProperties(
  componentId: string,
  componentState: string | null
): {
  loading: boolean
  error: ApolloError | undefined
  // Map: propertyDefinitionId → display string (displayValue ?? String(value) ?? null)
  valueMap: Record<string, string | null>
}
```

- `isRoot = componentState === null` pattern (same as `useBomPhysicalProperties`)
- `fetchPolicy: 'cache-first'`
- Parses `baseProperties.results` into `Record<definition.id, displayValue ?? String(value)>`
- `value` is a `PropertyValue` scalar — if `displayValue` is null, convert with `String(value)`, treating `null`/`undefined` as `null`

### Modified Files

#### `src/types/bom.types.ts`

**No changes.** Base property values live entirely in the Apollo cache and are not stored on `BomRow`.

#### `src/graphql/queries/bom.ts`

**No changes.** Base properties are fetched in a separate query family.

#### `src/hooks/useBomLoader.ts`

Add stale-key tracking for refetch-on-re-expand:

```ts
// New state
const [staleBasePropsKeys, setStaleBasePropsKeys] = useState<Set<string>>(new Set())

// On collapse — inside the existing setRows callback, before filtering:
const keysToStale: string[] = []
prev.forEach(r => {
  if (toRemove.has(r.id) && !r.id.startsWith('load-more:')) {
    keysToStale.push(`${r.componentId}:${r.componentState ?? 'root'}`)
  }
})
if (keysToStale.length) {
  setStaleBasePropsKeys(prev => {
    const next = new Set(prev)
    keysToStale.forEach(k => next.add(k))
    return next
  })
}

// New helper called by cells after their background refetch completes
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
  staleBasePropsKeys: Set<string>       // NEW
  clearStaleKey: (key: string) => void  // NEW
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

  // One background refetch when this component was previously collapsed.
  // cache-first useQuery shows stale value immediately; cache update triggers re-render.
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

  // Show loading indicator only on first fetch (valueMap empty = never loaded)
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

**Add column factory (exported):**

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

Extend props:

```ts
interface BomColumnSettingsProps {
  visibleColumnIds: string[]
  onChange: (ids: string[]) => void
  sigFigs: number
  onSigFigsChange: (n: number) => void
  basePropertyDefs?: PropertyDefinition[]  // NEW
  basePropsLoading?: boolean               // NEW
}
```

Add a labelled "Base Properties" section in the column picker `Popover`, below the existing `BOM_COLUMNS` list:

```tsx
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

`handleToggle` already works for any column ID — no changes needed.

#### `src/components/detail/tabs/bom/BomTab.tsx`

```tsx
const {
  rows, loading, error, toggleRow, loadMore,
  staleBasePropsKeys, clearStaleKey,          // NEW
} = useBomLoader(node)

// Definitions from hub — node.hubId is always set for DesignItem nodes
const { definitions, loading: propDefsLoading } =
  useHubBasePropertyDefinitions(node.hubId)

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

// Build grid columns from allColumns (not just BOM_COLUMNS)
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
  basePropertyDefs={definitions}       // NEW
  basePropsLoading={propDefsLoading}   // NEW
/>
```

#### `src/settings.ts`

**No changes.** Base property column IDs (`baseProp:${id}`) are stored in the existing `bomVisibleColumns` string array alongside standard column IDs. Stale IDs (from archived/deleted definitions) are silently ignored since they won't appear in `allColumns`.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Hub property definitions query fails | `useHubBasePropertyDefinitions` returns `error`; "Base Properties" section hidden from column picker; no `baseProperties` component queries fire |
| Individual component base properties query fails | Cell shows `ErrorOutlineIcon`; other rows unaffected |
| Component has no value set for a given property | `valueMap[definitionId]` is `null`; cell renders empty |
| Property collection is empty or all definitions are hidden/archived | "Base Properties" section hidden from column picker |
| `node.hubId` is undefined | `useHubBasePropertyDefinitions` skips (no query fires) |

---

## Implementation Phases

### Phase 1 — GraphQL queries
Create `src/graphql/queries/baseProperties.ts` with the three query documents using verified field names from `schema.graphql`.

### Phase 2 — `useHubBasePropertyDefinitions` hook
Create hook. Verify in browser console that the flattened `definitions` array is populated with the expected property names when a Design item is selected.

### Phase 3 — `useBomBaseProperties` hook
Create hook. Verify `valueMap` structure against a real API response.

### Phase 4 — `useBomLoader` stale tracking
Extend `toggleRow` collapse branch to populate `staleBasePropsKeys`. Add `clearStaleKey`. No changes to expand logic.

### Phase 5 — Column definitions
Add `BomBasePropCellInner`, `BomBasePropCell`, `makeBasePropertyColumn` to `bomColumns.ts`. Extend `BomCellContext`. Add imports: `useBomBaseProperties`, `GET_ROOT_COMPONENT_BASE_PROPERTIES`, `GET_COMPONENT_BASE_PROPERTIES`, `useApolloClient`.

### Phase 6 — `BomColumnSettings` update
Add "Base Properties" section with `Divider` separator and labelled group.

### Phase 7 — `BomTab` wiring
Wire all pieces. Verify `node.hubId` is always present for `DesignItem` nodes (it is — propagated from NavTree).

### Phase 8 — Verify

- [ ] No base prop columns selected → zero `GetComponentBaseProperties` network requests
- [ ] `GetHubBasePropertyDefinitions` fires once when BOM tab opens; subsequent opens are cache hits
- [ ] "Base Properties" section appears in column picker with correct property names
- [ ] Hidden and archived definitions do not appear in column picker
- [ ] Enable one base prop column → each visible row fires one `GetComponentBaseProperties` query
- [ ] Enable a second base prop column → **zero new network requests**; values appear instantly
- [ ] Collapse a row with children → descendants added to `staleBasePropsKeys`
- [ ] Re-expand → stale cells show old values immediately, fire one background refetch each, update on response
- [ ] After refetch → key removed from `staleBasePropsKeys`; no further background refetches
- [ ] Switch item in tree → hub definitions served from cache (no re-fetch for same hub)
- [ ] Switch to different hub → `GetHubBasePropertyDefinitions` fires for new hub; cached for remainder of session
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Non-goals (this phase)

- Editing base property values (read-only display only)
- Sorting rows by base property column values
- Displaying `specification` or `units` in column headers (name only)
- Multiple hubs with conflicting property definition IDs
