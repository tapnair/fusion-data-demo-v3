# Apollo Client Refactor Plan
## Fusion Data Demo v3

> **Goal:** Replace the custom Axios-based GraphQL layer (`apiClient.ts` +
> `mfgDataModelClient.ts`) with `@apollo/client`, gaining normalized
> `InMemoryCache`, `useQuery`/`useLazyQuery` hooks, and `fetchMore`-based
> pagination. The nav tree UI state (selected node, expanded items, loading
> spinners) remains in `NavContext`; the manual children cache and pagination
> maps are retired in favour of Apollo's cache.

*Plan created: 2026-03-03*

---

## 1. What Changes vs. What Stays

### Removed
| File | Reason |
|---|---|
| `src/services/api/apiClient.ts` | Replaced by Apollo `HttpLink` + `setContext` auth link |
| `src/services/api/mfgDataModelClient.ts` | All 13 queries move to `gql` constants; execution via `client.query()` |
| `src/services/api/apsService.ts` | No longer needed |
| `src/hooks/useApi.ts` | Wraps apsService — gone with it |
| `src/hooks/useMfgData.ts` | Wraps mfgDataModelClient — gone with it |

### Significantly Changed
| File | Change |
|---|---|
| `src/hooks/useHubs.ts` | `useState`/`useEffect`/`Axios` → `useQuery(GET_HUBS)` |
| `src/hooks/useNavLoader.ts` | `new MfgDataModelClient` → `useApolloClient()` + `client.query(...)` |
| `src/context/NavContext.tsx` | Remove `nodeChildrenCache`, `folderPagination`, `replaceLoadMoreNode`, `appendNodeChildren`; keep selected/expanded/loading UI state |
| `src/components/nav/NavTree.tsx` | Read cache status via Apollo instead of `nodeChildrenCache` |
| `src/components/detail/*.tsx` | Replace manual `useEffect` + client calls with `useLazyQuery` |
| `src/App.tsx` | Add `ApolloProvider` |

### Unchanged
- All theme files (`src/theme/`)
- `src/context/AuthContext.tsx`
- `src/components/nav/NavTreeItem.tsx`
- `src/components/layout/` (Header, NavDrawer, AppShell)
- `src/types/` (all type interfaces)
- `src/services/auth/` (AuthService, TokenManager, PKCEHelper)

---

## 2. Package Installation

```bash
npm install @apollo/client graphql
```

`@apollo/client` includes the React hooks, `InMemoryCache`, `HttpLink`,
`ApolloProvider`, `gql`, and the link utilities. The `graphql` package is a
peer dependency for the `gql` tag parser.

---

## 3. Manufacturing Data Model API — Pagination Shape

> **Critical context for cache configuration.** Understanding this shape is
> required to write correct Apollo type policies.

### 3a. The Universal `{ results, pagination }` Wrapper

Every field in the v3 API that returns a list — whether paginated or not —
wraps its data in a consistent envelope:

```graphql
type ProjectConnection {
  results: [Project!]
  pagination: Pagination
}

type Pagination {
  cursor: String      # opaque cursor; null when no further pages exist
  pageSize: Int
}
```

**There are no bare array fields.** Even `hubs` (which has no meaningful
pagination) returns `{ results: [Hub!], pagination: Pagination }`. This means
every list field in the cache stores this shape and every merge function must
handle it.

### 3b. v3 vs. Previous API — Where Paginated Fields Live

This is the most important structural difference between the old API and v3:

| API Version | Paginated fields on... | Example |
|---|---|---|
| Previous | **Types** | `Hub.projects`, `Folder.items`, `Hub.users` |
| **v3 (current)** | **`Query` root** | `Query.projects(hubId:)`, `Query.itemsByFolder(hubId:, folderId:)` |

In the previous API, `apolloCache.js` put `pagedFieldNormalized` on type
fields like `Hub.fields.projects`. **In v3 all those fields move to
`Query.fields`.**  Type-level fields in v3 are never directly paginated.

### 3c. Paginated Query Fields in This Application

| Query Field | Keying Args (cache partition) | Pagination Args (excluded from key) |
|---|---|---|
| `hubs` | *(none — singleton)* | — |
| `projects(hubId:)` | `hubId` | — |
| `foldersByProject(projectId:)` | `projectId` | — |
| `foldersByFolder(projectId:, folderId:)` | `projectId`, `folderId` | — |
| `itemsByProject(projectId:, pagination:)` | `projectId` | `pagination` |
| `itemsByFolder(hubId:, folderId:, pagination:)` | `hubId`, `folderId` | `pagination` |

`keyArgs` must list **only** the keying args — omitting `pagination` from
`keyArgs` ensures that page 2 of the same folder merges into the same cache
entry as page 1.

### 3d. The `pagedFieldNormalized` Merge Strategy

The naive approach of spreading arrays (`[...existing.results, ...incoming.results]`)
breaks when the same page is re-fetched: items appear twice. The correct
strategy (adapted from the reference implementation) stores results as a
**keyed object** using each item's Apollo cache reference (`__ref`) as the
key. This makes the merge idempotent:

```typescript
// Internally stored in cache as:
// { __typename, pagination, results: { 'Ref:abc': {...}, 'Ref:def': {...} } }
//
// The read() function converts back to the array shape that components expect:
// { __typename, pagination, results: [...] }
```

This is the fundamental pattern that must be applied to every paginated (and
non-paginated list) Query field.

---

## 4. New Files to Create

```
src/apollo/
├── client.ts              # Factory: createApolloClient(getAccessToken)
├── typePolicies.ts        # InMemoryCache type/field policies
└── pagedField.ts          # Reusable pagedFieldNormalized policy factory

src/graphql/queries/
├── hubs.ts                # GET_HUBS, GET_HUB_DETAIL
├── projects.ts            # GET_PROJECTS, GET_PROJECT_DETAIL
├── folders.ts             # GET_FOLDERS_BY_PROJECT, GET_FOLDERS_BY_FOLDER, GET_FOLDER_DETAIL
└── items.ts               # GET_ITEMS_BY_FOLDER, GET_ITEMS_BY_PROJECT, GET_ITEM_DETAIL
```

---

## 5. Phase-by-Phase Implementation

---

### Phase 1 — Apollo Client Factory & Cache Configuration

#### `src/apollo/pagedField.ts`

Reusable field policy factory, adapted from the reference implementation to
TypeScript and the v3 `{ results, pagination }` shape:

```typescript
import type { FieldPolicy } from '@apollo/client'

/**
 * Field policy for any Manufacturing Data Model v3 list field.
 * All list fields return { results: T[], pagination: { cursor, pageSize } }.
 *
 * Results are stored internally as a ref-keyed object to ensure idempotent
 * merging — re-fetching the same page never produces duplicates.
 * The read() function converts back to the array shape consumers expect.
 *
 * Pass keyArgs to scope cache entries by parent entity identifiers.
 * Pagination args (cursor, limit) must NOT be in keyArgs.
 */
export function pagedField(keyArgs: string[] | false = false): FieldPolicy {
  return {
    keyArgs,
    merge(existing, incoming) {
      const mergedResults = existing ? { ...existing.results } : {}
      incoming?.results?.forEach((item: any) => {
        // Key by Apollo cache reference (__ref) — normalized entities only.
        // This workaround is required due to Apollo issue #9315:
        // ideally would be: mergedResults[readField('id', item)] = item
        mergedResults[item.__ref] = item
      })
      return {
        __typename: incoming?.__typename,
        pagination: incoming?.pagination,
        results: mergedResults,
      }
    },
    read(existing) {
      if (existing) {
        return {
          __typename: existing.__typename,
          pagination: existing.pagination ?? null,
          results: Object.values(existing.results),
        }
      }
    },
  }
}
```

#### `src/apollo/typePolicies.ts`

```typescript
import type { TypePolicies } from '@apollo/client'
import { pagedField } from './pagedField'

/**
 * possibleTypes tells Apollo which concrete types implement each interface
 * or union. Required for correct fragment matching (e.g. DesignItem /
 * DrawingItem inline fragments). Generated from schema.graphql.
 */
import possibleTypes from './possibleTypes.json'

export const typePolicies: TypePolicies = {
  // --- Entity normalization ---
  // All entities are keyed by their scalar `id` field (Apollo default).
  // Explicit declaration ensures correctness even if __typename varies.
  Hub:        { keyFields: ['id'] },
  Project:    { keyFields: ['id'] },
  Folder:     { keyFields: ['id'] },
  DesignItem: { keyFields: ['id'] },
  DrawingItem:{ keyFields: ['id'] },

  // --- Non-entity (embedded) types ---
  // These have no stable identity; merge inline without normalization.
  Thumbnail:  { keyFields: false, merge: true },
  Pagination: { keyFields: false, merge: true },

  // --- Query-level field policies ---
  // In v3, ALL list/paginated fields live at the Query root (not on types).
  // Apply pagedField() to every list-returning Query field.
  Query: {
    fields: {
      // --- Single-entity read shortcuts ---
      // When an entity is already in cache (e.g. from a list query),
      // detail queries are served instantly without a network request.
      hub: {
        read(_, { args, toReference }) {
          return toReference({ __typename: 'Hub', id: args!.hubId })
        },
      },
      project: {
        read(_, { args, toReference }) {
          return toReference({ __typename: 'Project', id: args!.projectId })
        },
      },
      folder: {
        read(_, { args, toReference }) {
          return toReference({ __typename: 'Folder', id: args!.folderId })
        },
      },
      // Item is an interface — concrete type is DesignItem or DrawingItem.
      // toReference works once __typename is known from a prior query.
      item: {
        read(_, { args, toReference }) {
          // __typename will be resolved by Apollo from the cached object
          return toReference({ __typename: 'Item', id: args!.itemId })
        },
      },

      // --- Paginated list fields ---
      // keyArgs partitions the cache per parent entity.
      // Pagination variables (cursor, limit) are intentionally excluded
      // from keyArgs so all pages of the same parent share one cache entry.
      hubs:             pagedField(false),               // singleton
      projects:         pagedField(['hubId']),
      foldersByProject: pagedField(['projectId']),
      foldersByFolder:  pagedField(['projectId', 'folderId']),
      itemsByProject:   pagedField(['projectId']),
      itemsByFolder:    pagedField(['hubId', 'folderId']),
    },
  },
}
```

#### `src/apollo/client.ts`

```typescript
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { typePolicies, possibleTypes } from './typePolicies'

export function createApolloClient(getAccessToken: () => Promise<string>) {
  const httpLink = new HttpLink({
    uri: import.meta.env.VITE_GRAPHQL_ENDPOINT,
  })

  const authLink = setContext(async (_, { headers }) => {
    const token = await getAccessToken()
    return {
      headers: {
        ...headers,
        authorization: `Bearer ${token}`,
      },
    }
  })

  return new ApolloClient({
    link: ApolloLink.from([authLink, httpLink]),
    cache: new InMemoryCache({ typePolicies, possibleTypes }),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-first' },
      query:      { fetchPolicy: 'cache-first' },
    },
  })
}
```

---

### Phase 2 — `possibleTypes.json` (Already Created)

`src/apollo/possibleTypes.json` has been generated directly from
`schema.graphql` and covers all 4 interfaces and 2 unions in the schema:

| Abstract Type | Concrete Implementations |
|---|---|
| `Item` | `BasicItem`, `ConfiguredDesignItem`, `DesignItem`, `DrawingItem` |
| `IProperty` | `ComputedProperty`, `Property` |
| `HistoryChange` | 10 concrete change types |
| `BulkQueryResponse` | 4 bulk query response types |
| `ConfigValue` | `BooleanValue`, `IntValue`, `StringValue` |
| `SearchResultObjectUnion` | `BasicItem`, `Component`, `ConfiguredDesignItem`, `DesignItem`, `DrawingItem`, `Folder`, `Model` |

If the schema evolves, regenerate it via `graphql-codegen` with the
`fragment-matcher` plugin rather than editing by hand.

---

### Phase 3 — Wire ApolloProvider into App

`AuthContext` owns the `getAccessToken` callback. The Apollo client is created
once inside `AuthContext` (or immediately inside `ApolloProvider`'s wrapper)
so it can reference the live token getter.

**`src/App.tsx`** — add after auth initialization:

```tsx
// Inside the AuthProvider subtree, create a client instance once
const apolloClient = useMemo(
  () => createApolloClient(getAccessToken),
  [getAccessToken]
)

return (
  <ApolloProvider client={apolloClient}>
    {/* existing routes */}
  </ApolloProvider>
)
```

Because `getAccessToken` is stable (from `useCallback` in `AuthContext`), the
client is only created once per session.

---

### Phase 4 — Extract Queries to `gql` Constants

Move all query strings out of `mfgDataModelClient.ts` into typed `gql`
document nodes:

**`src/graphql/queries/hubs.ts`**
```typescript
import { gql } from '@apollo/client'

export const GET_HUBS = gql`
  query GetHubs {
    hubs { results { id name hubDataVersion } }
  }
`
export const GET_HUB_DETAIL = gql`
  query GetHubDetail($hubId: ID!) {
    hub(hubId: $hubId) { id name fusionWebUrl
      alternativeIdentifiers { dataManagementAPIHubId }
    }
  }
`
```

**`src/graphql/queries/projects.ts`** — `GET_PROJECTS`, `GET_PROJECT_DETAIL`

**`src/graphql/queries/folders.ts`** — `GET_FOLDERS_BY_PROJECT`,
`GET_FOLDERS_BY_FOLDER`, `GET_FOLDER_DETAIL`

**`src/graphql/queries/items.ts`** — `GET_ITEMS_BY_FOLDER`,
`GET_ITEMS_BY_PROJECT`, `GET_ITEM_DETAIL`

Queries remain identical to the current string literals — only the container
changes from template strings inside class methods to exported `DocumentNode`
constants.

---

### Phase 5 — Migrate `useHubs`

**Before:**
```typescript
const [hubs, setHubs] = useState<Hub[]>([])
useEffect(() => { /* fetch, setHubs */ }, [isAuthenticated])
```

**After:**
```typescript
import { useQuery } from '@apollo/client'
import { GET_HUBS } from '../graphql/queries/hubs'

export function useHubs() {
  const { isAuthenticated } = useAuth()
  const { data, loading, error, refetch } = useQuery(GET_HUBS, {
    skip: !isAuthenticated,
  })
  return {
    hubs: data?.hubs?.results ?? [],
    loading,
    error: error ?? null,
    refetch,
  }
}
```

Apollo automatically caches the result; subsequent renders return from cache
with no network request.

---

### Phase 6 — Migrate `useNavLoader`

Replace `new MfgDataModelClient(...)` with `useApolloClient()`. Apollo's
`client.query()` respects the configured `fetchPolicy` and `InMemoryCache`,
so already-loaded nodes are served from cache without a network round-trip.

**Key pattern:**
```typescript
import { useApolloClient } from '@apollo/client'
import { GET_PROJECTS } from '../graphql/queries/projects'

export function useNavLoader() {
  const client = useApolloClient()
  const { setNodeChildren, setNodeLoading, nodeChildrenCache } = useNavContext()

  const loadChildren = useCallback(async (node: NavNode) => {
    if (node.type !== 'load-more' && nodeChildrenCache.has(node.id)) return

    setNodeLoading(node.id, true)
    try {
      if (node.type === 'hub') {
        const { data } = await client.query({
          query: GET_PROJECTS,
          variables: { hubId: node.entityId },
        })
        // map + sort → setNodeChildren (same logic as today)
      }
      // ... other node types
    } finally {
      setNodeLoading(node.id, false)
    }
  }, [client, nodeChildrenCache, setNodeChildren, setNodeLoading])

  return { loadChildren }
}
```

**Pagination — Load More:**

For `load-more` nodes, issue a fresh `client.query` with the next cursor. The
`pagedField` merge function in `typePolicies` automatically appends the new
page's results into the existing keyed-object store, so no manual cursor Map
is needed.

```typescript
// load-more node case:
// 1. Read the cursor from the cached response for this parent
const cachedResult = client.readQuery({
  query: isProjectParent ? GET_ITEMS_BY_PROJECT : GET_ITEMS_BY_FOLDER,
  variables: parentVars,
})
const cursor = cachedResult?.itemsByProject?.pagination?.cursor
               ?? cachedResult?.itemsByFolder?.pagination?.cursor

// 2. Fetch next page — pagedField merge fn appends into cache automatically
const { data } = await client.query({
  query: isProjectParent ? GET_ITEMS_BY_PROJECT : GET_ITEMS_BY_FOLDER,
  variables: { ...parentVars, pagination: { cursor, limit: 50 } },
  fetchPolicy: 'network-only',   // must bypass cache to actually fetch page 2
})

// 3. Read the now-merged full list back from cache to update NavNode tree
const merged = client.readQuery({ query: ..., variables: parentVars })
const allItems = merged?.itemsByFolder?.results ?? []
// Map → NavNode[], update setNodeChildren with new full list
```

The `pagedField` `read()` function ensures `results` is always returned as a
plain array (converted from the internal keyed-object store), so consumers
never need to know about the internal representation.

> **Note:** `nodeChildrenCache` in `NavContext` remains for now as the
> authoritative tree rendering source. In a future iteration it could be
> removed entirely in favour of reading directly from Apollo cache via
> reactive variables.

---

### Phase 7 — Migrate Detail Components

Each detail panel currently runs:
```typescript
useEffect(() => {
  const client = new MfgDataModelClient(...)
  client.getItemDetail(hubId, itemId).then(...)
}, [node.entityId])
```

Replace with `useLazyQuery`:

```typescript
import { useLazyQuery } from '@apollo/client'
import { GET_ITEM_DETAIL } from '../graphql/queries/items'

export function ItemDetail({ node }: ItemDetailProps) {
  const [fetchItem, { data, loading, error }] = useLazyQuery(GET_ITEM_DETAIL)

  useEffect(() => {
    fetchItem({ variables: { hubId: node.hubId, itemId: node.entityId } })
  }, [node.entityId, node.hubId, fetchItem])

  const item = data?.item
  // ... render (identical to today)
}
```

Apollo's cache means selecting the same item a second time costs zero network
calls — the detail panel renders instantly from cache.

This pattern applies identically to `HubDetail`, `ProjectDetail`, and
`FolderDetail`.

---

### Phase 8 — Simplify NavContext

Remove the cache/pagination layer that Apollo now owns:

**Remove from `NavContext`:**
- `nodeChildrenCache: Map<string, NavNode[]>` → *(keep for now; see note in Phase 5)*
- `folderPagination: Map<string, FolderPaginationState>` → Apollo cache + merge function owns cursor state
- `replaceLoadMoreNode()` → simplified; just `setNodeChildren` with merged list
- `appendNodeChildren()` → no longer needed

**Keep in `NavContext`:**
- `selectedNode` / `setSelectedNode`
- `expandedItems` / `setExpandedItems`
- `loadingNodes` / `setNodeLoading` (controls spinner UX during async query)
- `setNodeChildren` (populates tree render model from query `onCompleted`)

---

### Phase 9 — Remove Legacy API Layer

Delete:
- `src/services/api/apiClient.ts`
- `src/services/api/mfgDataModelClient.ts`
- `src/services/api/apsService.ts`
- `src/hooks/useApi.ts`
- `src/hooks/useMfgData.ts`

Update any remaining imports. Run `npx tsc --noEmit` to confirm zero errors.

---

## 5. Cache Behaviour Summary

| Scenario | Before | After |
|---|---|---|
| Expand hub (first time) | API call → `nodeChildrenCache` | `client.query` → Apollo cache |
| Expand hub (again) | Cache hit (`nodeChildrenCache.has`) | Cache hit (`cache-first` policy) |
| Select item detail | API call every time | First time: network; subsequent: Apollo cache |
| Load more items | Manual cursor from `folderPagination` Map | `client.query` with cursor; merge fn appends |
| Auth token on each request | Axios interceptor in `apiClient.ts` | Apollo `setContext` auth link |
| GraphQL errors | Manual detection in `query()` method | Apollo parses `errors[]` automatically; returned via `error` from hooks |

---

## 6. File Inventory After Refactor

```
src/
├── apollo/
│   ├── client.ts              NEW
│   ├── typePolicies.ts        NEW
│   └── pagedField.ts          NEW
├── graphql/
│   └── queries/
│       ├── hubs.ts            NEW
│       ├── projects.ts        NEW
│       ├── folders.ts         NEW
│       └── items.ts           NEW
├── services/
│   └── auth/                  UNCHANGED
│       ├── AuthService.ts
│       ├── TokenManager.ts
│       └── PKCEHelper.ts
│   (api/ directory deleted entirely)
├── hooks/
│   ├── useHubs.ts             CHANGED (useQuery)
│   ├── useNavLoader.ts        CHANGED (useApolloClient)
│   └── (useApi.ts, useMfgData.ts deleted)
├── context/
│   ├── AuthContext.tsx        UNCHANGED
│   └── NavContext.tsx         CHANGED (simplified)
├── components/
│   └── detail/
│       ├── ItemDetail.tsx     CHANGED (useLazyQuery)
│       ├── HubDetail.tsx      CHANGED (useLazyQuery)
│       ├── ProjectDetail.tsx  CHANGED (useLazyQuery)
│       └── FolderDetail.tsx   CHANGED (useLazyQuery)
└── App.tsx                    CHANGED (ApolloProvider)
```

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Apollo `cache-first` returns stale tree data after mutations | Use `fetchPolicy: 'cache-and-network'` on tree queries if needed |
| `getAccessToken` reference instability causing client recreation | Ensure `getAccessToken` is wrapped in `useCallback` in `AuthContext` (it already is) |
| Pagination merge producing duplicates on re-query | `pagedField` stores results as `{ [__ref]: item }` — idempotent by design; re-fetching the same page is safe |
| Non-normalized items (no `__ref`) in results | Items are entities with `id` so Apollo always assigns a `__ref`; `Thumbnail` and `Pagination` are embedded with `keyFields: false` |
| `Item` interface fragments not resolved correctly | `possibleTypes: { Item: ['DesignItem', 'DrawingItem'] }` passed to `InMemoryCache` enables correct fragment matching |
| `__typename` missing from cached fragments | Apollo adds `__typename` automatically to all selections; no manual action needed |
| Schema introspection mismatch for `possibleTypes` | Hand-authored `possibleTypes` covers current query set; regenerate via codegen if schema evolves |

---

## 8. Optional Future Enhancements (Out of Scope for this Refactor)

- **`graphql-codegen`**: Auto-generate TypeScript types from `schema.graphql` for all query results — eliminates manual `any` types in query responses
- **Apollo DevTools**: Browser extension for inspecting the live `InMemoryCache`
- **Optimistic UI**: Use `optimisticResponse` on mutations for instant feedback
- **Reactive Variables**: Replace remaining `NavContext` UI state with Apollo reactive variables for a fully Apollo-driven state model
- **`@defer` support**: The schema supports `@defer` — Apollo Client 3.8+ handles it natively for progressive loading of heavy detail fields

---

*Last updated: 2026-03-03*
