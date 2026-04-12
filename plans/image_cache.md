# Plan: Thumbnail Image Caching (IndexedDB)

## Status: ✅ FULLY IMPLEMENTED (2026-04-11)

All phases complete. See implementation notes at bottom for what was already in place vs. added in the final session.

---

## Fusion Data Demo v3

> **Goal:** Cache BOM thumbnail images as blobs in IndexedDB, keyed by `componentId`.
> When the BOM table loads, cached images render instantly without waiting for a
> signed URL from the API. New images are fetched once and stored; the same blob
> is reused across sessions, since component thumbnails are stable snapshots of
> model geometry and do not change frequently.
>
> This is the companion plan to `cache_persist.md`, which excludes `Thumbnail`
> objects from the Apollo `localStorage` cache because their signed URLs expire.
> This plan solves the actual image data persistence problem.

*Plan created: 2026-03-23*

---

## Background

### The Signed URL Problem

`useBomThumbnail` fetches a `Thumbnail` object from the MFG API. When the thumbnail
status is `SUCCESS`, the API returns a `signedUrl` — a time-limited Autodesk CDN URL
that authorises access to the image file. These URLs expire (typically within a few
hours). Caching the URL string alone is useless after expiry.

### The Solution: Cache the Blob, Not the URL

Instead of persisting the signed URL, we fetch the image **once** as a binary blob
(`fetch(signedUrl)` → `response.blob()`) and store it in IndexedDB, keyed by
`componentId`. On future loads we reconstruct an `objectUrl` from the blob via
`URL.createObjectURL(blob)`, bypassing the API entirely.

**Key insight:** component thumbnails are renderings of model geometry. They change
only when the model changes — not on every session. Caching by `componentId` means
the same blob serves across sessions until it expires by TTL or the cache is purged.

---

## Library

**`idb`** — lightweight (~2 KB gzip), promise-based TypeScript wrapper around the
raw IndexedDB API. No additional transitive dependencies.

```bash
npm install idb
```

Alternative considered: `localforage` — heavier (~30 KB), supports fallback to
`localStorage` (unnecessary here). Rejected for size.

---

## Data Model

```typescript
// IndexedDB database: 'fusion-demo-thumbnails'  version: 1
// Object store:       'blobs'  keyPath: 'componentId'

interface ThumbnailCacheEntry {
  componentId: string   // key
  blob: Blob            // raw image bytes
  cachedAt: number      // Date.now() — used for TTL eviction
}
```

---

## Architecture

### New: `src/services/thumbnailImageCache.ts`

Singleton service that owns the IndexedDB connection. Exposes four operations:

```typescript
export async function getThumbnailBlob(componentId: string): Promise<Blob | null>

export async function setThumbnailBlob(componentId: string, blob: Blob): Promise<void>

export async function evictStaleEntries(maxAgeMs: number): Promise<void>
// Deletes all entries where Date.now() - cachedAt > maxAgeMs

export async function clearThumbnailCache(): Promise<void>
// Full purge — called on logout (parallel to persistor.purge())
```

Implementation sketch:

```typescript
import { openDB } from 'idb'

const DB_NAME = 'fusion-demo-thumbnails'
const STORE_NAME = 'blobs'
const DB_VERSION = 1

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME, { keyPath: 'componentId' })
  },
})

export async function getThumbnailBlob(componentId: string): Promise<Blob | null> {
  const db = await dbPromise
  const entry: ThumbnailCacheEntry | undefined = await db.get(STORE_NAME, componentId)
  return entry?.blob ?? null
}

export async function setThumbnailBlob(componentId: string, blob: Blob): Promise<void> {
  const db = await dbPromise
  await db.put(STORE_NAME, { componentId, blob, cachedAt: Date.now() })
}

export async function evictStaleEntries(maxAgeMs: number): Promise<void> {
  const db = await dbPromise
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const cutoff = Date.now() - maxAgeMs
  let cursor = await tx.store.openCursor()
  while (cursor) {
    if ((cursor.value as ThumbnailCacheEntry).cachedAt < cutoff) {
      await cursor.delete()
    }
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function clearThumbnailCache(): Promise<void> {
  const db = await dbPromise
  await db.clear(STORE_NAME)
}
```

---

### Modified: `src/hooks/useBomThumbnail.ts`

The hook currently returns `{ loading, error, status, signedUrl }`. It will be
extended to also return `objectUrl: string | null` — a `blob:` URL suitable for
use as an `<img src>`. The cell will use `objectUrl` instead of `signedUrl`.

**New return type:**
```typescript
return { loading, error, status, signedUrl, objectUrl }
//                                           ^^^^^^^^^ new
```

**Lifecycle:**

```
On mount:
  1. Check IndexedDB for componentId
  2. If blob found → createObjectURL(blob) → set objectUrl immediately
     (cached image renders before any API call resolves)
  3. Apollo query fires (cache-first → may resolve instantly from Apollo cache)

When signedUrl becomes available (Apollo query settles with SUCCESS status):
  4. If objectUrl is already set (from IndexedDB) → skip re-fetch (use cached blob)
  5. If objectUrl is null (cache miss) → fetch(signedUrl) → blob → setThumbnailBlob
     → createObjectURL(blob) → set objectUrl

On unmount:
  6. URL.revokeObjectURL(objectUrl) to release memory
```

**Why skip re-fetch when objectUrl is already set?**
The blob content is stable. Re-fetching from a new signed URL every session would
waste bandwidth for data that hasn't changed.

**Implementation sketch:**

```typescript
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@apollo/client/react'
import {
  getThumbnailBlob,
  setThumbnailBlob,
} from '../services/thumbnailImageCache'
import { GET_ROOT_COMPONENT_THUMBNAIL, GET_COMPONENT_THUMBNAIL } from '../graphql/queries/thumbnail'

export function useBomThumbnail(componentId: string, componentState: string | null) {
  const [pollInterval, setPollInterval] = useState(0)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)   // for cleanup in effect return
  const fetchedRef = useRef(false)                   // prevent double-fetch on StrictMode
  const isRoot = componentState === null

  // Step 1: Check IndexedDB on mount
  useEffect(() => {
    getThumbnailBlob(componentId).then(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setObjectUrl(url)
      }
    })
    return () => {
      // Revoke objectUrl on unmount
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [componentId])

  const { loading, error, data } = useQuery(
    isRoot ? GET_ROOT_COMPONENT_THUMBNAIL : GET_COMPONENT_THUMBNAIL,
    {
      variables: isRoot ? { componentId } : { componentId, state: componentState },
      fetchPolicy: 'cache-first',
      pollInterval,
    }
  )

  // Step 2: Poll state machine (unchanged)
  useEffect(() => {
    if (!data) return
    const status = (data as any)?.component?.thumbnail?.status
    if (!status) return
    if (WORKING_STATES.includes(status)) {
      setPollInterval(randomPollInterval())
    } else {
      setPollInterval(0)
    }
  }, [data])

  // Step 3: Fetch blob when signedUrl is available and not already cached
  const anyData = data as any
  const thumbnail = anyData?.component?.thumbnail ?? null
  const status: string | null = thumbnail?.status ?? null
  const signedUrl: string | null = thumbnail?.signedUrl ?? null

  useEffect(() => {
    if (!signedUrl || objectUrl || fetchedRef.current) return
    fetchedRef.current = true
    fetch(signedUrl)
      .then(r => r.blob())
      .then(blob => {
        setThumbnailBlob(componentId, blob).catch(console.error)
        const url = URL.createObjectURL(blob)
        // Revoke any previous objectUrl before setting new one
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = url
        setObjectUrl(url)
      })
      .catch(console.error)
  }, [signedUrl, componentId, objectUrl])

  return { loading, error, status, signedUrl, objectUrl }
}
```

---

### Modified: `BomThumbnailCellInner` in `bomColumns.ts`

Single change: use `objectUrl` (the cached blob URL) instead of `signedUrl` for
the `<img src>` attribute in both the thumbnail and the hover popover.

```typescript
// Before
const { loading, error, status, signedUrl } = useBomThumbnail(...)
// ...
if (loading || isWorking || !signedUrl) { return <Skeleton /> }
// ...
<img src={signedUrl} ... />

// After
const { loading, error, status, objectUrl } = useBomThumbnail(...)
// ...
if (loading || isWorking || !objectUrl) { return <Skeleton /> }
// ...
<img src={objectUrl} ... />
```

The `signedUrl` return value is no longer used by the cell — it's only needed
inside `useBomThumbnail` to trigger the blob fetch.

---

### Modified: `src/components/detail/tabs/bom/BomColumnSettings.tsx`

A **"Refresh Thumbnails"** `IconButton` (with `RefreshIcon` and tooltip
"Re-fetch all thumbnails from API") is added to the toolbar, visible only when
the thumbnail column is currently enabled.

Clicking it:
1. Calls `clearThumbnailCache()` — wipes all blobs from IndexedDB immediately
2. Increments a `thumbnailGeneration` counter exposed via `BomCellContext`

`useBomThumbnail` reads `thumbnailGeneration` from context. When it changes, the
hook resets `fetchedRef.current = false` and clears its local `objectUrl` state,
causing it to re-enter the "check IndexedDB → miss → fetch blob" flow on the next
`signedUrl` resolution.

```typescript
// BomCellContext addition
thumbnailGeneration: number        // increment to force all cells to re-fetch
```

```typescript
// useBomThumbnail addition
const { thumbnailGeneration } = useContext(BomCellContext)

// Reset when generation bumps
useEffect(() => {
  fetchedRef.current = false
  if (objectUrlRef.current) {
    URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
  }
  setObjectUrl(null)
}, [thumbnailGeneration])
```

`thumbnailGeneration` is `useState(0)` in `BomTab`, incremented by the refresh
callback passed to `BomColumnSettings`.

---

### Modified: `src/context/AuthContext.tsx`

Add `clearThumbnailCache()` call in the `logout` handler alongside
`persistor.purge()`, so a different user on the same machine starts fresh:

```typescript
import { clearThumbnailCache } from '../services/thumbnailImageCache'

const logout = useCallback(async (): Promise<void> => {
  await Promise.all([
    persistorRef.current?.purge(),
    clearThumbnailCache(),
  ])
  TokenManager.clearToken()
  setAccessToken(null)
  setIsAuthenticated(false)
  setUser(null)
  authService.logout()
}, [])
```

---

### Eviction on App Start

Stale entries (older than the configured TTL) should be purged once per session
to prevent IndexedDB growing unbounded. A good place is `App.tsx`, called once
on mount:

```typescript
// In App.tsx top-level useEffect (outside ApolloWrapper):
useEffect(() => {
  evictStaleEntries(THUMBNAIL_CACHE_TTL_MS).catch(console.error)
}, [])
```

TTL constant lives in `thumbnailImageCache.ts`:
```typescript
export const THUMBNAIL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000  // 7 days
```

---

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `src/services/thumbnailImageCache.ts` | IndexedDB service: `get`, `set`, `evictStale`, `clear` |

### Modified Files

| File | Change |
|------|--------|
| `src/hooks/useBomThumbnail.ts` | IndexedDB check on mount; blob fetch + store when signedUrl arrives; return `objectUrl`; revoke on unmount; reset on `thumbnailGeneration` change |
| `src/components/detail/tabs/bom/bomColumns.ts` | Use `objectUrl` instead of `signedUrl` in `BomThumbnailCellInner`; show skeleton while `!objectUrl` |
| `src/components/detail/tabs/bom/BomColumnSettings.tsx` | Add "Refresh Thumbnails" `IconButton`, visible when thumbnail column enabled; calls `clearThumbnailCache()` + increments `thumbnailGeneration` |
| `src/components/detail/tabs/bom/BomTab.tsx` | Add `thumbnailGeneration` state; pass refresh callback to `BomColumnSettings`; add `thumbnailGeneration` to `BomCellContext` |
| `src/types/bom.types.ts` | Add `thumbnailGeneration: number` to `BomCellContext` type |
| `src/context/AuthContext.tsx` | Call `clearThumbnailCache()` on logout |
| `src/App.tsx` | Call `evictStaleEntries(THUMBNAIL_CACHE_TTL_MS)` on app mount |
| `package.json` | Add `idb` dependency |

---

## Implementation Phases

### Phase 1 — Package + `thumbnailImageCache.ts`
- `npm install idb`
- Create `src/services/thumbnailImageCache.ts` with `openDB`, `get`, `set`, `evictStale`, `clear`

### Phase 2 — `useBomThumbnail.ts` update
- Add IndexedDB check on mount → `setObjectUrl` if blob found
- Add `signedUrl` effect → fetch blob, store in IndexedDB, `setObjectUrl`
- Add `useRef` for `objectUrlRef` cleanup on unmount
- Return `objectUrl` in addition to existing fields

### Phase 3 — Cell update + refresh button
- `BomThumbnailCellInner`: swap `signedUrl` → `objectUrl` for both img elements and loading guard
- Add `thumbnailGeneration` to `BomCellContext` type (`bom.types.ts`)
- Add `thumbnailGeneration` state + refresh callback to `BomTab.tsx`
- Add "Refresh Thumbnails" `IconButton` to `BomColumnSettings.tsx` (visible when thumbnail column enabled)
- Add `thumbnailGeneration` reset effect to `useBomThumbnail`

### Phase 4 — Logout + eviction
- `AuthContext.tsx`: add `clearThumbnailCache()` to logout
- `App.tsx`: add eviction `useEffect` on mount

### Phase 5 — Verify

- [ ] First BOM load: no IndexedDB entries → thumbnail cells show skeleton → `signedUrl` fetched → blob stored → image renders
- [ ] Reload page: IndexedDB entries found → images render immediately without waiting for Apollo query
- [ ] BOM column hidden and re-shown: blob still in IndexedDB, images render instantly
- [ ] Navigate away, return to BOM: images render from IndexedDB (no flicker)
- [ ] Open DevTools → Application → IndexedDB → `fusion-demo-thumbnails` → `blobs`: entries visible with `componentId`, `blob`, `cachedAt`
- [ ] Set TTL to 1ms and reload: eviction runs, all entries purged, thumbnails re-fetched
- [ ] "Refresh Thumbnails" button visible in header only when thumbnail column is enabled
- [ ] Clicking it clears IndexedDB, shows skeletons briefly, then re-fetches all visible blobs
- [ ] "Refresh Thumbnails" button hidden when thumbnail column is disabled
- [ ] Logout: `fusion-demo-thumbnails` IndexedDB is cleared
- [ ] `URL.createObjectURL` and `URL.revokeObjectURL` balanced (no memory leak): check with DevTools Memory → Blobs
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Key Design Decisions

| Topic | Decision |
|-------|---------|
| Storage | IndexedDB via `idb` — native blob storage, no base64 bloat, separate budget from `localStorage` |
| Cache key | `componentId` — stable, not time-limited. Same component reuses the same blob across sessions |
| Re-fetch strategy | Once cached, never re-fetch unless TTL-evicted or user clicks "Refresh Thumbnails" in BOM header |
| Object URL lifecycle | Created on blob load, revoked on cell unmount via `useRef` |
| TTL | 7 days |
| Eviction timing | On app mount (once per session, async, non-blocking) |
| Logout | `clearThumbnailCache()` runs alongside `persistor.purge()` — parallel via `Promise.all` |
| Double-fetch guard | `fetchedRef` prevents re-fetching in React StrictMode double-effect calls |
| Skeleton condition | `!objectUrl` (was `!signedUrl`) — skeleton shown until blob is ready, not just until URL arrives |

---

## Decisions

| Q | Answer |
|---|--------|
| Q1 — TTL | **7 days** |
| Q2 — Stale images | **"Refresh Thumbnails" button** in BOM header — clears IndexedDB and bumps `thumbnailGeneration` to force re-fetch of all visible cells |
| Q3 — Storage limit | **TTL only** — no entry count cap; 7-day eviction is sufficient for demo usage |

---

## Implementation Notes (2026-04-11)

### What was already in place before the final session
When the final implementation session ran, most of the plumbing was already committed from earlier sessions:
- `src/services/thumbnailImageCache.ts` — fully implemented (`openDB`, `getThumbnailBlob`, `setThumbnailBlob`, `evictStaleEntries`, `clearThumbnailCache`, `THUMBNAIL_CACHE_TTL_MS`)
- `src/context/AuthContext.tsx` — `clearThumbnailCache()` already called on logout via `Promise.all`
- `src/App.tsx` — `evictStaleEntries(THUMBNAIL_CACHE_TTL_MS)` already called on mount
- `src/components/detail/tabs/bom/BomTab.tsx` — `thumbnailGeneration` state, `clearThumbnailCache()` + increment on "Refresh Thumbnails", wired into `BomCellContext`
- `src/components/detail/tabs/bom/BomColumnSettings.tsx` — "Refresh Thumbnails" `IconButton` with `RefreshIcon`, visible only when thumbnail column is enabled
- `src/types/bom.types.ts` (via `bomColumns.ts`) — `thumbnailGeneration: number` in `BomCellContext`
- `idb` package — already installed

### What was added in the final session
Two files completed the implementation:

**`src/hooks/useBomThumbnail.ts`** — rewritten to add:
- Mount effect: `getThumbnailBlob(componentId)` → `URL.createObjectURL(blob)` → `setObjectUrl` immediately (cached images render before any API response)
- `objectUrlRef` for safe cleanup on unmount (avoids stale closure issue with plain state)
- `fetchedRef` to prevent double-fetch in React StrictMode
- `thumbnailGeneration` reset effect: revokes current objectUrl, clears `fetchedRef`, sets `objectUrl = null` so the next `signedUrl` triggers a fresh network fetch
- `signedUrl` effect: `fetch(signedUrl)` → `blob()` → `setThumbnailBlob` → `URL.createObjectURL` → `setObjectUrl` (only runs on cache miss)
- Returns `objectUrl` in addition to existing fields

**`src/components/detail/tabs/bom/bomColumns.ts`** — `BomThumbnailCellInner`:
- Destructures `objectUrl` instead of `signedUrl` from `useBomThumbnail`
- Skeleton guard changed from `!signedUrl` → `!objectUrl`
- Both `<img src>` elements (inline thumbnail and hover popover) use `objectUrl`

### Deviation from plan: cancelled useEffect return for objectUrl
The plan suggested revoking the objectUrl inside the mount effect's cleanup function. The actual implementation uses `objectUrlRef` to track the current URL, with revocation in the cleanup AND in the `signedUrl` effect (before creating a new objectUrl). This prevents a double-revoke if the objectUrl changes mid-lifecycle.
