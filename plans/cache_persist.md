# Plan: Apollo Cache Persistence

## Fusion Data Demo v3

> **Goal:** Persist the Apollo `InMemoryCache` to `localStorage` so that data from
> prior sessions is available immediately on startup (cache-first). Stale data is
> shown instantly while fresh data is fetched in the background. Cache is purged on
> logout and when the cache schema version changes.

*Plan created: 2026-03-23*

---

## Background / Research

### Library: `apollo3-cache-persist` v0.15.0

The official Apollo cache persistence library. Two API surfaces:

| API | When to use |
|-----|-------------|
| `persistCache(opts)` | Simple fire-and-forget; returns a Promise |
| `new CachePersistor(opts)` | Fine-grained control — exposes `restore()`, `purge()`, `persist()`, `pause()`, `resume()`, `getSize()` |

We use **`CachePersistor`** (same as the reference implementation) for two reasons:
1. We need `persistor.purge()` at logout
2. We need the schema-version check: restore vs purge

**Key config options:**

| Option | Default | Our choice |
|--------|---------|------------|
| `storage` | — | `LocalStorageWrapper(window.localStorage)` |
| `key` | `'apollo-cache-persist'` | `'fusion-demo-apollo-cache'` (unique, avoids collision) |
| `maxSize` | 1 048 576 (1 MB) | `5242880` (5 MB) |
| `debounce` | 1000 ms (for `'write'` trigger) | 1000 ms (default) |
| `trigger` | `'write'` | `'write'` (persist on every cache write, debounced) |
| `persistenceMapper` | — | Exclude `Thumbnail` objects — signed URLs expire; thumbnail caching handled separately |

**Async init constraint:** The `restore()` call must `await` before the Apollo Client
is instantiated. Otherwise queries may execute before the cache is hydrated, causing
unnecessary network requests that defeat the purpose of persistence.

### Apollo `InMemoryCache` serialisation

`InMemoryCache` is fully serialisable. `apollo3-cache-persist` calls `cache.extract()`
to snapshot it and `cache.restore(data)` to rehydrate. No manual serialisation needed.

### Cache-first behaviour

The app already sets `fetchPolicy: 'cache-first'` as the default on all queries
(`client.ts` `defaultOptions`). With a hydrated cache this means:
- Previously fetched hubs, projects, folders, items render **instantly** from cache
- Apollo fires a background network request and updates the UI when fresh data arrives
  (React re-render via `useQuery`)

This is the `cache-and-network` fetch policy — but since our default is `cache-first`,
components that need to always re-validate can override with `fetchPolicy: 'cache-and-network'`
on a per-query basis. The plan does not change existing fetch policies.

---

## Architecture

### The Init Problem

Currently `ApolloWrapper` in `App.tsx` creates the Apollo client **synchronously**
via `useMemo`:

```typescript
const apolloClient = useMemo(() => createApolloClient(getAccessToken, addEntry), [...])
```

Cache persistence requires an **async** init sequence:

```
1. new InMemoryCache({ typePolicies, possibleTypes })
2. new CachePersistor({ cache, storage, key, maxSize })
3. Schema version check → persistor.restore() OR persistor.purge()
4. new ApolloClient({ cache, link: ... })
```

The client can only be created after step 3 resolves. We must convert `ApolloWrapper`
to an async `useState` + `useEffect` pattern and render a loading state during init.

The init reads from `localStorage` only — no network calls — so it resolves in < 5 ms
on a typical device.

### Schema Version Key

A constant `CACHE_SCHEMA_VERSION` is stored in `src/apollo/cacheVersion.ts`.
The schema version tracks breaking changes to `typePolicies.ts` that would make
previously persisted cache data incompatible.

```typescript
// src/apollo/cacheVersion.ts
export const CACHE_SCHEMA_VERSION = '1'
export const CACHE_SCHEMA_VERSION_KEY = 'fusion-demo-cache-schema-version'
```

**When to bump `CACHE_SCHEMA_VERSION`:**
- `typePolicies.ts` changes in a way that alters how cache keys or field shapes work
- `possibleTypes.json` gains new types that conflict with stored data
- The GraphQL API itself has a breaking change

Bumping the version causes every user's persisted cache to be purged on their next
session start. The app then fetches fresh data normally.

### Logout / user switch

When the user logs out, the persisted cache must be cleared so that another user
on the same machine does not see the previous user's data.

`AuthContext` already calls `client.clearStore()` (or similar) on logout — if not,
we add it. We additionally call `persistor.purge()` at logout to wipe localStorage.

---

## Files

### New File

| File | Purpose |
|------|---------|
| `src/apollo/cacheVersion.ts` | `CACHE_SCHEMA_VERSION` constant + localStorage key |

### Modified Files

| File | Change |
|------|--------|
| `src/apollo/client.ts` | Accept pre-built `InMemoryCache` instead of creating one internally; remove `new InMemoryCache(...)` from factory |
| `src/App.tsx` | Rewrite `ApolloWrapper` from synchronous `useMemo` to async `useState`/`useEffect` with `CachePersistor` init; pass `persistor` to auth context via a ref or callback |
| `src/context/AuthContext.tsx` | Call `persistor.purge()` on logout, then `client.clearStore()` |

---

## Detailed Implementation

### 1. `src/apollo/cacheVersion.ts` (new)

```typescript
export const CACHE_SCHEMA_VERSION = '1'
export const CACHE_SCHEMA_VERSION_KEY = 'fusion-demo-cache-schema-version'
```

### 2. `src/apollo/client.ts` (modified)

Remove `new InMemoryCache(...)` from inside `createApolloClient`.
Accept the cache as a parameter so the caller can build and hydrate it first:

```typescript
import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { typePolicies, possibleTypes } from './typePolicies'
import { createLoggingLink } from './loggingLink'
import type { QueryLogEntry } from '../context/QueryLogContext'

// Exported so ApolloWrapper can create the cache before calling createApolloClient
export function createCache(): InMemoryCache {
  return new InMemoryCache({ typePolicies, possibleTypes })
}

export function createApolloClient(
  cache: InMemoryCache,                               // ← was created internally
  getAccessToken: () => Promise<string>,
  addLogEntry: (entry: QueryLogEntry) => void
) {
  const httpLink = new HttpLink({ uri: import.meta.env.VITE_GRAPHQL_ENDPOINT })
  const loggingLink = createLoggingLink(addLogEntry)
  const authLink = setContext(async (_, { headers }) => {
    const token = await getAccessToken()
    return { headers: { ...headers, authorization: `Bearer ${token}` } }
  })

  return new ApolloClient({
    link: ApolloLink.from([authLink, loggingLink, httpLink]),
    cache,
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network' },
      query:      { fetchPolicy: 'cache-and-network' },
    },
  })
}
```

### 3. `src/App.tsx` — `ApolloWrapper` rewrite

```typescript
import { CachePersistor, LocalStorageWrapper } from 'apollo3-cache-persist'
import { createCache, createApolloClient } from './apollo/client'
import { CACHE_SCHEMA_VERSION, CACHE_SCHEMA_VERSION_KEY } from './apollo/cacheVersion'

function ApolloWrapper({ children }: { children: React.ReactNode }) {
  const { getAccessToken, setPersistor } = useAuth()
  const { addEntry } = useQueryLog()
  const [apolloClient, setApolloClient] = useState<ApolloClient<NormalizedCacheObject> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const cache = createCache()

      const persistor = new CachePersistor({
        cache,
        storage: new LocalStorageWrapper(window.localStorage),
        key: 'fusion-demo-apollo-cache',
        maxSize: 5242880, // 5 MB
        debounce: 1000,
        persistenceMapper: async (data: string) => {
          const parsed = JSON.parse(data)
          // Exclude Thumbnail objects — signed URLs expire and are re-fetched
          // by the existing polling hooks. Thumbnail caching is handled separately.
          const filtered = Object.fromEntries(
            Object.entries(parsed).filter(([key]) => !key.startsWith('Thumbnail:'))
          )
          return JSON.stringify(filtered)
        },
      })

      // Schema version check: restore or purge
      const storedVersion = localStorage.getItem(CACHE_SCHEMA_VERSION_KEY)
      if (storedVersion === CACHE_SCHEMA_VERSION) {
        await persistor.restore()
      } else {
        await persistor.purge()
        localStorage.setItem(CACHE_SCHEMA_VERSION_KEY, CACHE_SCHEMA_VERSION)
      }

      if (cancelled) return

      // Give the persistor to AuthContext so logout can call persistor.purge()
      setPersistor(persistor)

      setApolloClient(createApolloClient(cache, getAccessToken, addEntry))
    }

    init().catch(console.error)
    return () => { cancelled = true }
  }, [getAccessToken, addEntry, setPersistor])

  if (!apolloClient) {
    // Typically resolves in < 5 ms; a minimal loading state avoids a flash
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
  }

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
}
```

**Why `setPersistor` on `AuthContext`?**
`AuthContext` is the natural owner of logout logic. Providing the persistor via a
setter (stored in a `useRef` inside `AuthContext`) avoids prop-drilling and keeps
the logout cleanup collocated with auth cleanup.

Alternatively, a `PersistorContext` could be created — but that adds a context just
for one value. The `useRef` setter approach is simpler.

### 4. `src/context/AuthContext.tsx` — logout integration

Add a `persistorRef` inside `AuthContext` and a `setPersistor` setter:

```typescript
const persistorRef = useRef<CachePersistor<NormalizedCacheObject> | null>(null)

const setPersistor = useCallback(
  (p: CachePersistor<NormalizedCacheObject>) => { persistorRef.current = p },
  []
)

const logout = useCallback(async () => {
  // 1. Wipe persisted cache so the next user on this machine starts clean
  if (persistorRef.current) {
    await persistorRef.current.purge()
  }
  // 2. Clear the in-memory Apollo cache (and cancel active queries)
  //    ApolloWrapper exposes client via useApolloClient() if needed, or
  //    clearStore can be called from here if client ref is available.
  //    (Apollo client ref approach — see note below)

  // 3. Clear auth tokens
  clearTokens()
  setUser(null)
  setIsAuthenticated(false)
}, [])
```

> **Note on `client.clearStore()`:** `AuthContext` doesn't currently have access to
> the Apollo client. Two options:
> A. Pass a `clearApolloStore` callback from `ApolloWrapper` into `AuthContext` via
>    a second setter (parallel to `setPersistor`).
> B. Call `persistor.purge()` only — this clears localStorage. The in-memory cache
>    is effectively discarded anyway when `ApolloWrapper` re-initialises after auth
>    state changes.
>
> Option B is simpler and sufficient: the user is redirected to the login page,
> the app re-mounts, and a fresh `ApolloWrapper` init creates a new client with an
> empty cache. No stale in-memory data can be acted on after logout.

---

## `maxSize` Options

| Value | Behaviour |
|-------|-----------|
| `1048576` (1 MB, default) | Persistence pauses silently once cache exceeds 1 MB; no data is lost in memory but new data won't be persisted until next cold start |
| `false` | Unlimited — all cache data persisted; risk of filling localStorage (5–10 MB browser limit) |
| `5242880` (5 MB) | Higher ceiling; still prevents runaway growth |

**Decision: see Q1 below.**

---

## Fetch Policy Behaviour After Hydration

| Scenario | Behaviour |
|----------|-----------|
| App loads, cache hydrated | `cache-and-network` serves data instantly from cache, then re-fetches in background |
| User navigates to previously visited hub/project | Served from cache immediately |
| User navigates to new hub/project (not in cache) | Normal network request |
| BOM expanded for previously fetched component | Served from cache |
| Physical properties / thumbnails (polling) | Polling resumes as normal; cached values shown while polling in progress |
| Base property definitions (hub-level, `cache-first`) | Served from cache immediately — no re-fetch needed |

The app default will be changed from `cache-first` to `cache-and-network` in `client.ts`.
This gives true stale-while-revalidate: cached data renders instantly, and Apollo always
fires a background network request to update with fresh data. Individual queries that
should never re-fetch (e.g. base property definitions) can still override with
`fetchPolicy: 'cache-first'` locally.

---

## Implementation Phases

### Phase 1 — Package + `cacheVersion.ts`
- `npm install apollo3-cache-persist`
- Create `src/apollo/cacheVersion.ts`

### Phase 2 — Refactor `client.ts`
- Extract `createCache()` factory
- `createApolloClient` accepts `cache` as first param

### Phase 3 — Rewrite `ApolloWrapper` in `App.tsx`
- Async init with `CachePersistor`
- Schema version check: restore vs purge
- Loading spinner while init runs
- `setPersistor` call to give `AuthContext` the persistor handle

### Phase 4 — Logout integration in `AuthContext.tsx`
- Add `persistorRef` + `setPersistor` + expose `setPersistor` from context
- Call `persistor.purge()` in logout handler

### Phase 5 — Verify

- [ ] On first load: network requests fire normally, cache saved to localStorage
- [ ] On second load (same session / page refresh): data visible instantly before network response
- [ ] `localStorage` key `'fusion-demo-apollo-cache'` contains serialised cache JSON
- [ ] Schema version key `'fusion-demo-cache-schema-version'` is `'1'`
- [ ] Bumping `CACHE_SCHEMA_VERSION` to `'2'` causes cache purge on next load
- [ ] Logging out purges `localStorage` cache entry
- [ ] After logout + re-login, app starts with empty cache (no cross-user data leakage)
- [ ] BOM data, base property definitions, and member lists are all cached across refreshes
- [ ] `Thumbnail:*` keys are absent from the persisted cache JSON (filtered by `persistenceMapper`)
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Key Design Decisions

| Topic | Decision |
|-------|---------|
| API choice | `CachePersistor` (not `persistCache`) — needed for `restore`/`purge` control |
| Storage | `LocalStorageWrapper(window.localStorage)` — synchronous, works in all browsers |
| Async init loading state | `<CircularProgress>` while persistor init runs (< 5 ms typical) |
| Schema version | Simple integer string in `localStorage`; bump manually on breaking policy changes |
| Logout behaviour | `persistor.purge()` on logout — protects against cross-user data leakage on shared machines |
| Fetch policy | Changed to `cache-and-network` — persisted data shown instantly + background re-fetch always fires |
| Storage key | `'fusion-demo-apollo-cache'` — explicit, avoids collision with other Apollo apps on same origin |
| `maxSize` | `5242880` (5 MB) |
| Selective persistence | `Thumbnail` objects excluded via `persistenceMapper`; thumbnail image caching handled in a separate plan |

---

## Decisions

| Q | Answer |
|---|--------|
| Q1 — `maxSize` | **5 MB** (`5242880`) |
| Q2 — Fetch policy | **`cache-and-network`** — instant load + background re-fetch |
| Q3 — Selective persistence | **Exclude `Thumbnail` objects** via `persistenceMapper`; thumbnail image caching is a separate plan |
