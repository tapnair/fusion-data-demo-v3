# BOM Thumbnail Column Plan

## Overview

Add a **Thumbnail** column to the BOM DataGrid. Thumbnails are fetched per-row using independent parallel queries — one per visible component — so the BOM tree loads instantly with placeholders while thumbnails resolve in the background. Because the thumbnail API frequently returns `IN_PROGRESS` or `PENDING` before the image is ready, each row polls with random backoff until the status reaches a terminal state (`SUCCESS` or `FAILED`).

The column is hidden by default and integrated into the existing `BomColumnDef` registry using the `fetchOnDemand: true` flag — no changes to the base BOM queries.

---

## Schema Reference

### `Thumbnail` type

```graphql
type Thumbnail {
  id: ID!
  status: ThumbnailStatusEnum!
  signedUrl: String
  expires: String
}
```

### `ThumbnailStatusEnum`

```graphql
enum ThumbnailStatusEnum {
  IN_PROGRESS   # generation in progress — poll
  PENDING       # queued — poll
  TIMEOUT       # generation timed out — poll (may recover)
  SUCCESS       # image ready — stop polling
  FAILED        # terminal failure — stop polling
}
```

### Field path from `Component`

```
Component.thumbnail: Thumbnail
  └─ .id        ID
  └─ .status    ThumbnailStatusEnum
  └─ .signedUrl String (null until SUCCESS)
```

---

## Polling Strategy (adapted from reference `ComponentThumbnail`)

The reference component (`/fusion-automation-demo/.../ComponentThumbnail`) uses Apollo's built-in `pollInterval` mechanism:

1. Start with `pollInterval = 0` (no polling).
2. On query completion, inspect `thumbnail.status`.
3. If status is a **working state** (`IN_PROGRESS`, `PENDING`, `TIMEOUT`), activate polling with a **random interval** between 10–30 seconds. The random spread prevents all rows from re-fetching simultaneously (thundering herd).
4. If status is a **terminal state** (`SUCCESS`, `FAILED`), set `pollInterval = 0` to stop.
5. Use `fetchPolicy: 'cache-first'` — subsequent poll cycles update the cache; components re-render only when `signedUrl` appears.

```
Status           Action
─────────────────────────────────
IN_PROGRESS  →   poll 10–30 s random
PENDING      →   poll 10–30 s random
TIMEOUT      →   poll 10–30 s random
SUCCESS      →   stop polling, render image
FAILED       →   stop polling, render error icon
```

---

## GraphQL Queries

Two separate queries mirror the same split already used in `useBomLoader` — the root row requires `composition: WORKING` while child rows are pinned by their `toComponentState`.

### `GET_ROOT_COMPONENT_THUMBNAIL` — root row

```graphql
query GetRootComponentThumbnail($componentId: ID!) {
  component(componentId: $componentId, composition: WORKING) {
    id
    thumbnail {
      id
      status
      signedUrl
    }
  }
}
```

### `GET_COMPONENT_THUMBNAIL` — child rows

```graphql
query GetComponentThumbnail($componentId: ID!, $state: String) {
  component(componentId: $componentId, state: $state) {
    id
    thumbnail {
      id
      status
      signedUrl
    }
  }
}
```

**Query selection in `useBomThumbnail`:**

| Row type   | `componentState` | Query used                        |
|------------|-----------------|-----------------------------------|
| Root row   | `null`          | `GET_ROOT_COMPONENT_THUMBNAIL`    |
| Child row  | `"<state>"`     | `GET_COMPONENT_THUMBNAIL`         |

File: `src/graphql/queries/thumbnail.ts`

---

## `useBomThumbnail` Hook

Each thumbnail cell manages its own independent query and polling state. This naturally provides parallel fetching — every mounted `BomThumbnailCell` fires its own query.

```ts
// src/hooks/useBomThumbnail.ts

const WORKING_STATES = ['IN_PROGRESS', 'PENDING', 'TIMEOUT']
const POLL_MIN_MS = 10_000
const POLL_MAX_MS = 30_000

function randomPollInterval() {
  return Math.floor(Math.random() * (POLL_MAX_MS - POLL_MIN_MS) + POLL_MIN_MS)
}

export function useBomThumbnail(componentId: string, componentState: string | null) {
  const [pollInterval, setPollInterval] = useState(0)
  const isRoot = componentState === null

  const { loading, error, data } = useQuery(
    isRoot ? GET_ROOT_COMPONENT_THUMBNAIL : GET_COMPONENT_THUMBNAIL,
    {
      variables: isRoot
        ? { componentId }
        : { componentId, state: componentState },
      fetchPolicy: 'cache-first',
      pollInterval,
      onCompleted: (data) => {
        const status = data?.component?.thumbnail?.status
        if (status && WORKING_STATES.includes(status)) {
          setPollInterval(randomPollInterval())
        } else {
          if (pollInterval !== 0) setPollInterval(0)
        }
      },
    }
  )

  const thumbnail = data?.component?.thumbnail ?? null
  const status = thumbnail?.status ?? null
  const signedUrl = thumbnail?.signedUrl ?? null

  return { loading, error, status, signedUrl }
}
```

**Key properties:**
- `pollInterval` starts at `0` — no network activity until the first query settles.
- The hook re-sets a fresh random interval on each working-state callback, so retries are always spaced 10–30 s from the previous response (not from mount time).
- When the cell unmounts (column hidden, row collapsed), the Apollo query is abandoned automatically — no cleanup needed.

---

## `BomThumbnailCell` Component

Co-located in `bomColumns.ts` alongside `BomNameCell`. Receives `row` only (no `ctx` needed for thumbnails).

### States

| Condition                          | Rendered output                                    |
|------------------------------------|----------------------------------------------------|
| `loading` (first fetch)            | MUI `Skeleton` rectangle (same size as image)      |
| `status` is a working state        | `Skeleton` with pulsing animation                  |
| `status === 'SUCCESS'`, `signedUrl`| `<img>` tag, fixed size, `object-fit: cover`; hover shows popup |
| `status === 'FAILED'`              | MUI `BrokenImageIcon` in muted colour (no retry)   |
| `error` (network/GraphQL error)    | MUI `BrokenImageIcon` in muted colour              |
| Load-more sentinel row             | Nothing (empty cell)                               |

### Dimensions

The thumbnail column has a fixed width. The image is rendered at the same height as the row, maintaining aspect ratio:

| DataGrid density | Row height | Thumbnail size |
|-----------------|------------|----------------|
| compact          | ~36 px     | 32 × 32 px     |
| standard         | ~52 px     | 44 × 44 px     |
| comfortable      | ~68 px     | 56 × 56 px     |

Use `useTheme()` + the same `DENSITY_MAP` as `BomTab` to pick the correct size, or use CSS `height: 100%` with `aspect-ratio: 1` and let the row height constrain the image.

### Hover Popup

When the thumbnail image is successfully loaded, hovering over it opens an MUI `Popover` displaying a larger version of the same `signedUrl`. No additional query is needed — the same URL renders at any size.

**Behaviour:**
- Anchor: the thumbnail `<img>` element itself (`anchorEl` set on `onMouseEnter`, cleared on `onMouseLeave`).
- The `Popover` uses `disableRestoreFocus` and `sx={{ pointerEvents: 'none' }}` so it does not interfere with mouse events on the grid.
- Popup image size: **200 × 200 px**, `object-fit: contain` (shows the full image without cropping, on a neutral background).
- The popup appears immediately on hover (no delay) and closes as soon as the mouse leaves the thumbnail.
- Placeholder and error states do **not** show a popup — only a fully resolved `signedUrl` triggers the hover behaviour.

**Sketch:**

```tsx
function BomThumbnailCellInner({ row }: { row: BomRow }) {
  const { loading, error, status, signedUrl } = useBomThumbnail(row.componentId, row.componentState)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const isWorking = status !== null && WORKING_STATES.includes(status)

  if (error || status === 'FAILED') {
    return <BrokenImageIcon fontSize="small" sx={{ color: 'text.disabled' }} />
  }
  if (loading || isWorking || !signedUrl) {
    return <Skeleton variant="rectangular" width={40} height={40} animation={isWorking ? 'pulse' : 'wave'} />
  }

  return (
    <>
      <img
        src={signedUrl}
        width={40}
        height={40}
        style={{ objectFit: 'cover', borderRadius: 4, cursor: 'default' }}
        onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
        onMouseLeave={() => setAnchorEl(null)}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
        transformOrigin={{ vertical: 'center', horizontal: 'left' }}
        disableRestoreFocus
        sx={{ pointerEvents: 'none' }}
      >
        <Box sx={{ p: 1, bgcolor: 'background.paper' }}>
          <img
            src={signedUrl}
            width={200}
            height={200}
            style={{ objectFit: 'contain', display: 'block' }}
          />
        </Box>
      </Popover>
    </>
  )
}
```

---

## Column Registry Integration

The thumbnail column is placed **first** in `BOM_COLUMNS` (before `name`) so it renders as the leftmost column when enabled. It is excluded from `DEFAULT_VISIBLE_COLUMNS` — users opt-in via the column settings popover.

```ts
export const BOM_COLUMNS: BomColumnDef[] = [
  {
    id: 'thumbnail',
    header: 'Thumbnail',
    width: 64,
    fetchOnDemand: true,           // data NOT in base BOM query
    getValue: () => null,          // no text value — image only
    renderCell: (row) => <BomThumbnailCell row={row} />,
  },
  {
    id: 'name',
    // ... (unchanged)
  },
  // ... remaining columns unchanged
]

export const DEFAULT_VISIBLE_COLUMNS = ['name', 'description', 'partNumber', 'material']
// 'thumbnail' is intentionally absent — hidden by default
```

- `fetchOnDemand: true` signals that this column's data is not fetched in the base BOM queries.
- Fetching is driven entirely by cell mounting. When the column is hidden, no `BomThumbnailCell` components are mounted → zero thumbnail queries fire.
- When the column becomes visible, every currently rendered row's cell mounts and fires its query in parallel. Rows added later (expand, load-more) trigger their cell query on mount.

---

## Fetch-on-Demand Behaviour

No changes to `useBomLoader` or the base BOM queries are needed.

```
BOM load (unchanged)
  └─ GET_ROOT_COMPONENT_BOM  ──→  rows rendered (no thumbnails yet)

User enables Thumbnail column
  └─ BomThumbnailCell mounts for each row
       └─ useBomThumbnail fires GET_COMPONENT_THUMBNAIL per row (parallel)
            └─ status: IN_PROGRESS → poll 10–30 s
            └─ status: SUCCESS     → render image, stop polling

User hides Thumbnail column
  └─ BomThumbnailCell unmounts → all polls stop automatically
  └─ Cached signedUrls remain in Apollo cache
  └─ Re-enabling column re-mounts cells → cache-first hits; no re-fetch if not expired
```

---

## Apollo Cache Considerations

Add `Thumbnail` entity normalisation in `src/apollo/typePolicies.ts`:

```ts
Thumbnail: {
  keyFields: ['id'],
},
```

This ensures thumbnails are normalised by ID across all queries, and polling updates flow to every mounted cell that holds a reference to the same thumbnail.

`Component.thumbnail` does not need a special `pagedField` — it is a singular object field, cached automatically via `Component` entity normalisation (already in place).

---

## Files

### New Files

#### `src/graphql/queries/thumbnail.ts`
`GET_ROOT_COMPONENT_THUMBNAIL` (with `composition: WORKING`) and `GET_COMPONENT_THUMBNAIL` (with `state`).

#### `src/hooks/useBomThumbnail.ts`
`useBomThumbnail(componentId, componentState)` hook with `pollInterval` state, working state detection, and random backoff. Exports `WORKING_STATES` constant for reuse in the cell component.

### Modified Files

#### `src/components/detail/tabs/bom/bomColumns.ts`
- Add `BomThumbnailCell` function component (co-located).
- Add `thumbnail` entry to `BOM_COLUMNS`.
- No changes to `DEFAULT_VISIBLE_COLUMNS`.

#### `src/apollo/typePolicies.ts`
- Add `Thumbnail: { keyFields: ['id'] }` entity policy.

---

## Implementation Phases

### Phase 1 — Queries
- Create `src/graphql/queries/thumbnail.ts` with both `GET_ROOT_COMPONENT_THUMBNAIL` (uses `composition: WORKING`) and `GET_COMPONENT_THUMBNAIL` (uses `state`), mirroring the split already used in `useBomLoader`.

### Phase 2 — Hook
- Create `src/hooks/useBomThumbnail.ts`.
- Implement `WORKING_STATES`, `randomPollInterval`, and the `useQuery` + `pollInterval` pattern.
- Add `Thumbnail` type policy in `typePolicies.ts`.

### Phase 3 — Cell component & column registration
- Add `BomThumbnailCellInner` and `BomThumbnailCell` to `bomColumns.ts`.
- Add `thumbnail` column to `BOM_COLUMNS` with `fetchOnDemand: true`.
- Implement all visual states: loading skeleton, working skeleton, image, broken, error.
- Add hover popup: `anchorEl` state, `onMouseEnter`/`onMouseLeave` handlers on the `<img>`, MUI `Popover` with 200 × 200 px image, `pointerEvents: 'none'` on the popover so grid interaction is unaffected.

### Phase 4 — Verify
- Enable thumbnail column; confirm parallel queries fire per row in network tab.
- Confirm BOM loads without any thumbnail queries when column is hidden.
- Expand a row; confirm newly added child rows start their thumbnail queries on mount.
- Simulate slow thumbnail: mock `IN_PROGRESS` status; verify polling fires at ~10–30 s intervals.
- Hide column while polling is active; confirm all polls stop (no further network requests).
- Re-enable column; confirm cache-first hits for already-resolved thumbnails.
- `FAILED` status: verify broken image icon renders, polling stops.
- Hover over a resolved thumbnail; confirm popover appears to the right with a 200 × 200 px image.
- Move mouse away; confirm popover closes immediately.
- Confirm popover does not block mouse events on the grid (rows remain hoverable/selectable).

---

## Non-goals (this phase)

- No full-size lightbox or click-to-expand beyond the hover popup.
- No thumbnail for non-Component rows (load-more sentinel rows render nothing).
- No pre-fetching thumbnails for collapsed rows.
- No signed URL expiry handling (`expires` field is fetched but re-polling naturally refreshes the URL before expiry in most cases; explicit expiry management is future work).
