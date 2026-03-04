# BOM Physical Properties Columns Plan

## Overview

Add 5 new optional columns to the BOM DataGrid covering the physical properties of each component's primary model: **Mass**, **Volume**, **Density**, **Surface Area**, and **Bounding Box** (a single combined column showing Length × Width × Height). These values come from `Component.primaryModel.physicalProperties` and may need to be generated on first access, requiring polling until the status reaches `COMPLETED`.

A **Precision selector** in the BOM toolbar lets the user choose how many decimal places to display for all physical property values (0–6, shown as `0`, `.X`, `.XX`, `.XXX`, etc.). The selection defaults to 3 and is persisted in `localStorage` via the central settings module.

All 7 columns share a **single query per component** (`GET_COMPONENT_PHYSICAL_PROPERTIES`) that fetches all properties at once. Every column cell calls the same `useBomPhysicalProperties` hook — Apollo automatically deduplicates identical in-flight queries, so only one network request fires per component regardless of how many property columns are visible. Subsequent column toggles or re-renders hit the Apollo cache instantly via `cache-first`.

Columns are hidden by default and integrated into the existing `BomColumnDef` registry with `fetchOnDemand: true`. No changes to the base BOM queries or `useBomLoader`.

---

## Schema Reference

### Access path

```
Component.primaryModel: Model          ← may be null (no CAD model)
  └─ Model.physicalProperties: PhysicalProperties
       └─ .status: PhysicalPropertyStatusEnum
       └─ .mass:    Property
       └─ .volume:  Property
       └─ .density: Property
       └─ .area:    Property
       └─ .boundingBox: BoundingBox3D
            └─ .length: Property
            └─ .width:  Property
            └─ .height: Property
```

### `PhysicalProperties` type

```graphql
type PhysicalProperties {
  status: PhysicalPropertyStatusEnum!
  area:    Property
  volume:  Property
  density: Property
  mass:    Property
  boundingBox: BoundingBox3D
}
```

### `PhysicalPropertyStatusEnum`

```graphql
enum PhysicalPropertyStatusEnum {
  SCHEDULED    # job scheduled — poll
  QUEUED       # waiting to be scheduled — poll
  IN_PROGRESS  # executing — poll
  COMPLETED    # done — stop polling
  FAILED       # failed, auto-resubmitted by server — poll
  CANCELLED    # cancelled, auto-resubmitted by server — poll
}
```

### `Property` type (relevant fields)

```graphql
type Property {
  displayValue: String        # server-formatted value + units, e.g. "5.23 kg"
  definition: PropertyDefinition!
}
```

`displayValue` is used directly for display — no client-side unit formatting needed.

### `BoundingBox3D` type

```graphql
type BoundingBox3D {
  length: Property   # x-direction
  width:  Property   # y-direction
  height: Property   # z-direction
}
```

### Null handling

`Component.primaryModel` may be `null` for BOM items without a CAD model. Cells render empty in this case — no error, no loading state.

---

## Polling Strategy

Physical property generation is faster than thumbnail generation. Use a **fixed 3-second poll interval** (no random jitter needed — all rows will poll independently and are unlikely to thunderherd on property generation).

```
Status       Action
────────────────────────────────────────
SCHEDULED  → poll every 3 s
QUEUED     → poll every 3 s
IN_PROGRESS→ poll every 3 s
COMPLETED  → stop polling, display values
FAILED     → stop polling, show error icon
CANCELLED  → stop polling, show error icon
```

```ts
export const PHYSICAL_PROPS_WORKING_STATES = ['SCHEDULED', 'QUEUED', 'IN_PROGRESS']
const POLL_INTERVAL_MS = 3_000
```

---

## GraphQL Queries

Two queries — same root/child split used for thumbnails and BOM children.

### `GET_ROOT_COMPONENT_PHYSICAL_PROPERTIES` — root row

```graphql
query GetRootComponentPhysicalProperties($componentId: ID!) {
  component(componentId: $componentId, composition: WORKING) {
    id
    primaryModel {
      id
      physicalProperties {
        status
        mass    { displayValue }
        volume  { displayValue }
        density { displayValue }
        area    { displayValue }
        boundingBox {
          length { displayValue }
          width  { displayValue }
          height { displayValue }
        }
      }
    }
  }
}
```

### `GET_COMPONENT_PHYSICAL_PROPERTIES` — child rows

```graphql
query GetComponentPhysicalProperties($componentId: ID!, $state: String) {
  component(componentId: $componentId, state: $state) {
    id
    primaryModel {
      id
      physicalProperties {
        status
        mass    { displayValue }
        volume  { displayValue }
        density { displayValue }
        area    { displayValue }
        boundingBox {
          length { displayValue }
          width  { displayValue }
          height { displayValue }
        }
      }
    }
  }
}
```

**Query selection:**

| Row type  | `componentState` | Query used                                  |
|-----------|-----------------|---------------------------------------------|
| Root row  | `null`          | `GET_ROOT_COMPONENT_PHYSICAL_PROPERTIES`    |
| Child row | `"<state>"`     | `GET_COMPONENT_PHYSICAL_PROPERTIES`         |

File: `src/graphql/queries/physicalProperties.ts`

### Apollo cache behaviour

`Component` entities are normalised by `id` in `typePolicies.ts`. Both BOM queries and physical property queries resolve to the same `Component:{id}` cache entry — `primaryModel.physicalProperties` fields are merged into it alongside `bomRelations` fields already stored there. No cache conflicts, no duplicate entries.

Apollo deduplicates identical in-flight operations by operation name + variables. Because both queries have distinct, stable operation names (`GetRootComponentPhysicalProperties` / `GetComponentPhysicalProperties`) and consistent variable shapes, Apollo correctly deduplicates concurrent requests from multiple column cells for the same row.

---

## `useBomPhysicalProperties` Hook

One hook call per cell. Apollo's operation deduplication ensures only one network request fires per component even when multiple property columns are visible for the same row. Subsequent calls for the same component hit the Apollo cache via `cache-first`.

```ts
// src/hooks/useBomPhysicalProperties.ts

export const PHYSICAL_PROPS_WORKING_STATES = [
  'SCHEDULED', 'QUEUED', 'IN_PROGRESS', 'FAILED', 'CANCELLED'
]
const POLL_INTERVAL_MS = 3_000

export function useBomPhysicalProperties(
  componentId: string,
  componentState: string | null
) {
  const [pollInterval, setPollInterval] = useState(0)
  const isRoot = componentState === null

  const { loading, error, data } = useQuery(
    isRoot
      ? GET_ROOT_COMPONENT_PHYSICAL_PROPERTIES
      : GET_COMPONENT_PHYSICAL_PROPERTIES,
    {
      variables: isRoot
        ? { componentId }
        : { componentId, state: componentState },
      fetchPolicy: 'cache-first',
      pollInterval,
    }
  )

  useEffect(() => {
    if (!data) return
    const status = (data as any)?.component?.primaryModel?.physicalProperties?.status
    if (!status) return                           // primaryModel is null — no polling needed
    if (PHYSICAL_PROPS_WORKING_STATES.includes(status)) {
      setPollInterval(POLL_INTERVAL_MS)
    } else {
      setPollInterval(0)
    }
  }, [data])

  const physProps = (data as any)?.component?.primaryModel?.physicalProperties ?? null

  return { loading, error, physProps }
}
```

**Returns:** `physProps` — the full `PhysicalProperties` object, or `null` if `primaryModel` is absent. Each column cell reads its specific field from this object.

---

## Cell Component

A single parameterised component handles all 7 columns. The `accessor` function extracts the relevant `displayValue` from the `physProps` object.

```ts
// co-located in bomColumns.ts

type PhysPropsAccessor = (physProps: any) => string | null

function BomPhysicalPropertiesCellInner({
  row,
  accessor,
}: {
  row: BomRow
  accessor: PhysPropsAccessor
}) {
  const { loading, error, physProps } = useBomPhysicalProperties(
    row.componentId,
    row.componentState
  )

  // No primary model — component has no CAD file
  if (!loading && !error && physProps === null) return null

  // Still generating
  const isWorking =
    physProps?.status && PHYSICAL_PROPS_WORKING_STATES.includes(physProps.status)

  const isTerminalFailure =
    physProps?.status === 'FAILED' || physProps?.status === 'CANCELLED'

  if (loading || isWorking) {
    return <CircularProgress size={12} sx={{ color: 'text.disabled' }} />
  }

  if (error || isTerminalFailure) {
    return <ErrorOutlineIcon fontSize="small" sx={{ color: 'text.disabled' }} />
  }

  const value = accessor(physProps)
  if (!value) return null  // property present but no displayValue yet

  return <Typography variant="body2">{value}</Typography>
}

function BomPhysicalPropertiesCell({
  row,
  accessor,
}: {
  row: BomRow
  accessor: PhysPropsAccessor
}) {
  if (row.id.startsWith('load-more:')) return null
  return <BomPhysicalPropertiesCellInner row={row} accessor={accessor} />
}
```

### Visual states

| Condition                                        | Display                                  |
|--------------------------------------------------|------------------------------------------|
| `primaryModel` is null                           | Empty cell (no CAD model)                |
| `loading` (first fetch)                          | Small `CircularProgress` (size 12)       |
| `status` is a working state (SCHEDULED/QUEUED/IN_PROGRESS) | Small `CircularProgress` (size 12) |
| `status === 'COMPLETED'`, value present          | `Typography body2` with `displayValue`   |
| `status === 'COMPLETED'`, no `displayValue`      | Empty cell                               |
| `status === 'FAILED'` or `'CANCELLED'`           | Muted `ErrorOutlineIcon` (stop polling)  |
| `error` (network/GraphQL)                        | Muted `ErrorOutlineIcon`                 |
| Load-more sentinel row                           | Nothing (empty cell)                     |

---

## Column Registry

All 5 columns added to `BOM_COLUMNS` in `bomColumns.ts`, positioned after the existing 4 columns. None added to `DEFAULT_VISIBLE_COLUMNS` — users opt in via the column settings popover.

The bounding box is a **single combined column** rendering all three dimensions stacked. It uses a `BomBoundingBoxCell` variant that renders a multi-line `Box` instead of a single `Typography`.

```ts
// Scalar accessor helpers
const acc = {
  mass:    (p: any) => p?.mass?.displayValue ?? null,
  volume:  (p: any) => p?.volume?.displayValue ?? null,
  density: (p: any) => p?.density?.displayValue ?? null,
  area:    (p: any) => p?.area?.displayValue ?? null,
}

// In BOM_COLUMNS:
{ id: 'mass',        header: 'Mass',         width: 110, fetchOnDemand: true, getValue: () => null,
  renderCell: (row) => <BomPhysicalPropertiesCell row={row} accessor={acc.mass} /> },
{ id: 'volume',      header: 'Volume',       width: 110, fetchOnDemand: true, getValue: () => null,
  renderCell: (row) => <BomPhysicalPropertiesCell row={row} accessor={acc.volume} /> },
{ id: 'density',     header: 'Density',      width: 130, fetchOnDemand: true, getValue: () => null,
  renderCell: (row) => <BomPhysicalPropertiesCell row={row} accessor={acc.density} /> },
{ id: 'area',        header: 'Surface Area', width: 130, fetchOnDemand: true, getValue: () => null,
  renderCell: (row) => <BomPhysicalPropertiesCell row={row} accessor={acc.area} /> },
{ id: 'boundingBox', header: 'Bounding Box', width: 140, fetchOnDemand: true, getValue: () => null,
  renderCell: (row) => <BomBoundingBoxCell row={row} /> },
```

### `BomBoundingBoxCell`

A dedicated cell component (co-located in `bomColumns.ts`) for the combined bounding box column. Calls `useBomPhysicalProperties` like all other property cells, then renders three lines:

```tsx
function BomBoundingBoxCellInner({ row }: { row: BomRow }) {
  const { loading, error, physProps } = useBomPhysicalProperties(row.componentId, row.componentState)

  if (!loading && !error && physProps === null) return null

  const isWorking = physProps?.status && PHYSICAL_PROPS_WORKING_STATES.includes(physProps.status)
  const isTerminalFailure = physProps?.status === 'FAILED' || physProps?.status === 'CANCELLED'

  if (loading || isWorking) return <CircularProgress size={12} sx={{ color: 'text.disabled' }} />
  if (error || isTerminalFailure) return <ErrorOutlineIcon fontSize="small" sx={{ color: 'text.disabled' }} />

  const bb = physProps?.boundingBox
  if (!bb) return null

  return (
    <Box sx={{ lineHeight: 1.4 }}>
      {bb.length?.displayValue && <Typography variant="caption">L: {bb.length.displayValue}</Typography>}
      {bb.width?.displayValue  && <Typography variant="caption">W: {bb.width.displayValue}</Typography>}
      {bb.height?.displayValue && <Typography variant="caption">H: {bb.height.displayValue}</Typography>}
    </Box>
  )
}
```

`DEFAULT_VISIBLE_COLUMNS` is unchanged.

---

## Fetch-on-Demand Flow

```
BOM load (unchanged)
  └─ GET_ROOT_COMPONENT_BOM → rows rendered, no physical property queries

User enables one or more physical property columns (e.g. Mass + Volume)
  └─ BomPhysicalPropertiesCell mounts for each row
       └─ useBomPhysicalProperties fires for each row
            Apollo deduplicates: 1 network request per component
            └─ status: IN_PROGRESS → poll every 3 s
            └─ status: COMPLETED   → display values, stop polling

User enables a second property column (e.g. Density) while Mass is already loaded
  └─ New cells mount → useBomPhysicalProperties called again per row
       cache-first hits → data served instantly from Apollo cache
       No network requests fired

User hides all physical property columns
  └─ All BomPhysicalPropertiesCell components unmount
       All polls stop automatically
       Apollo cache retains the data

User re-enables any column
  └─ cache-first → instant display for COMPLETED rows
       Rows that were still IN_PROGRESS will re-poll from where they left off
```

---

## Apollo Cache Considerations

`Model` is already normalised by `id` in `typePolicies.ts`. `PhysicalProperties` is an embedded object on `Model` (no stable ID of its own), so it is stored inline under its parent `Model` cache entry.

No new type policies are needed. The existing:
```ts
Model: { keyFields: ['id'] },
```
ensures that `primaryModel` objects across queries normalise to the same `Model:{id}` entry, and `physicalProperties` is merged there.

---

## Files

### New Files

#### `src/graphql/queries/physicalProperties.ts`
`GET_ROOT_COMPONENT_PHYSICAL_PROPERTIES` and `GET_COMPONENT_PHYSICAL_PROPERTIES`.

#### `src/hooks/useBomPhysicalProperties.ts`
Hook with `PHYSICAL_PROPS_WORKING_STATES`, `POLL_INTERVAL_MS`, `useQuery` + `useEffect` polling pattern. Returns `{ loading, error, physProps }`.

### Modified Files

#### `src/components/detail/tabs/bom/bomColumns.ts`
- Add `sigFigs: number` to `BomCellContext`.
- Add `formatDisplayValue(value, decimalPlaces)` helper — parses server `displayValue` (e.g. `"5.234 kg"`) and re-formats the numeric part to the requested decimal places.
- Add `BomPhysicalPropertiesCellInner` / `BomPhysicalPropertiesCell` (accept `sigFigs` prop).
- Add `BomBoundingBoxCellInner` / `BomBoundingBoxCell` (accept `sigFigs` prop).
- Add 5 physical property column entries to `BOM_COLUMNS`; `renderCell` uses `(row, ctx)` signature and passes `ctx.sigFigs` to cells.
- Add `ErrorOutlineIcon` import.
- `DEFAULT_VISIBLE_COLUMNS` unchanged.

#### `src/components/detail/tabs/bom/BomColumnSettings.tsx`
- Add `sigFigs: number` and `onSigFigsChange: (n: number) => void` props.
- Add MUI `Select` in the toolbar with 7 options (`0`, `.X` … `.XXXXXX`), default `.XXX` (3).

#### `src/components/detail/tabs/bom/BomTab.tsx`
- Add `sigFigs` state loaded from `loadSettings().bomSigFigs ?? 3`.
- Add `handleSigFigsChange` — updates state and persists via `saveSettings({ bomSigFigs: n })`.
- Include `sigFigs` in `cellContext` memo.
- Pass `sigFigs` and `onSigFigsChange` to `<BomColumnSettings>`.

#### `src/settings.ts`
- Add `bomSigFigs?: number` to `AppSettings`.

---

## Implementation Phases

### Phase 1 — Queries
Create `src/graphql/queries/physicalProperties.ts` with both named queries.

### Phase 2 — Hook
Create `src/hooks/useBomPhysicalProperties.ts` with polling logic and the `PHYSICAL_PROPS_WORKING_STATES` constant.

### Phase 3 — Cell component & column registration
- Add `BomPhysicalPropertiesCellInner`, `BomPhysicalPropertiesCell`, `BomBoundingBoxCellInner`, and `BomBoundingBoxCell` to `bomColumns.ts`.
- Add all 5 columns to `BOM_COLUMNS` with `fetchOnDemand: true`.
- Bounding box column uses combined cell showing L / W / H stacked.

### Phase 4 — Verify
- Enable one property column; confirm one query fires per component row (not per column).
- Enable a second property column; confirm no additional network requests (cache-first).
- Confirm BOM loads with zero property queries when all property columns are hidden.
- Poll verification: component with `IN_PROGRESS` status polls every ~3 s and stops on `COMPLETED`.
- `FAILED` / `CANCELLED` status: confirm error icon appears and polling stops.
- Null `primaryModel`: rows without a CAD model show empty cells, no error, no spinner.
- Collapse + re-expand a row: child rows that were `COMPLETED` restore instantly from cache.
- Bounding box column: confirm all three dimension values render stacked in a single cell.

---

## Non-goals (this phase)

- No hub-level `arePhysicalPropertiesEnabledInBOM` flag enforcement (ignored for now — can be added later if needed).
- No client-side unit conversion or formatting beyond `displayValue`.
- No aggregated totals row.
- No sorting by physical property value.
