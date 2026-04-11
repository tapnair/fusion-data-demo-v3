# Plan: GraphiQL Editor + Query Log Pages

## Fusion Data Demo v3

> **Goal:** Add two new top-level pages accessible from the header:
> 1. **Query Editor** — an embedded GraphiQL instance connected to the live MFG API with auth
> 2. **Query Log** — a running table of every GraphQL operation executed during the session,
>    with the ability to load any past query directly into the editor.

*Plan created: 2026-03-19*

---

## Overview

```
Header nav bar
  ├── Home          (existing)
  ├── Debug         (existing)
  ├── Query Editor  NEW — /query-editor  → GraphiQLPage
  └── Query Log     NEW — /query-log     → QueryLogPage

Apollo Client link chain
  authLink → loggingLink (NEW) → httpLink

QueryLogContext (NEW)
  ├── entries: QueryLogEntry[]    (capped at 200, newest first)
  ├── addEntry(entry)             (called by loggingLink)
  └── clearLog()
```

---

## Package Installation

```bash
npm install graphiql @graphiql/toolkit graphql-tag
```

| Package | Purpose |
|---------|---------|
| `graphiql` | React component + CSS |
| `@graphiql/toolkit` | `createGraphiQLFetcher` factory (used for type compat; we write our own fetcher for auth) |

> `graphql` is already installed (required by Apollo). No duplicate needed.

---

## Data Model

```typescript
// src/context/QueryLogContext.tsx

export interface QueryLogEntry {
  id: string                       // crypto.randomUUID()
  timestamp: Date
  operationName: string            // operation.operationName ?? 'Anonymous'
  operationType: string            // 'query' | 'mutation' | 'subscription'
  isIntrospection: boolean         // true when operationName === 'IntrospectionQuery'
  query: string                    // print(operation.query)  — human-readable GQL string
  variables: Record<string, unknown>
  response: unknown                // response.data  (null on network error)
  errors: unknown[] | null         // response.errors  (GraphQL errors)
  durationMs: number
}
```

Cap: **200 entries** (oldest entry dropped when limit exceeded). This prevents
unbounded memory growth during long demo sessions.

---

## Architecture

### 1. `QueryLogContext` — shared state

**`src/context/QueryLogContext.tsx`**

```typescript
interface QueryLogContextValue {
  entries: QueryLogEntry[]
  addEntry: (entry: QueryLogEntry) => void
  clearLog: () => void
}

export const QueryLogContext = createContext<QueryLogContextValue>(...)

export function QueryLogProvider({ children }) {
  const [entries, setEntries] = useState<QueryLogEntry[]>([])

  const addEntry = useCallback((entry: QueryLogEntry) => {
    setEntries(prev => [entry, ...prev].slice(0, 200))
  }, [])

  const clearLog = useCallback(() => setEntries([]), [])

  return (
    <QueryLogContext.Provider value={{ entries, addEntry, clearLog }}>
      {children}
    </QueryLogContext.Provider>
  )
}

export const useQueryLog = () => useContext(QueryLogContext)
```

`QueryLogProvider` wraps the entire authenticated subtree in `App.tsx`.
It sits **outside** `ApolloWrapper` so the Apollo client factory can receive
`addEntry` as a callback parameter.

---

### 2. `loggingLink` — Apollo Link interceptor

**`src/apollo/loggingLink.ts`**

```typescript
import { ApolloLink } from '@apollo/client/core'
import { print } from 'graphql'
import type { QueryLogEntry } from '../context/QueryLogContext'

export function createLoggingLink(
  addEntry: (entry: QueryLogEntry) => void
): ApolloLink {
  return new ApolloLink((operation, forward) => {
    const startTime = Date.now()
    const { operationName, variables, query } = operation
    const opType = (query.definitions[0] as any)?.operation ?? 'query'

    return forward(operation).map(response => {
      addEntry({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        operationName: operationName ?? 'Anonymous',
        operationType: opType,
        query: print(query),
        variables: variables ?? {},
        response: response.data ?? null,
        errors: response.errors ? [...response.errors] : null,
        durationMs: Date.now() - startTime,
      })
      return response
    })
  })
}
```

**Why `.map()` instead of a full `Observable` wrapper:**
- `.map()` intercepts every successful response (including those with `errors` in the GQL
  response body — these are returned as `response.errors`, not thrown).
- Network-level failures (thrown before a response is received) are not captured in the log;
  that's acceptable for a demo tool since Apollo's built-in error handling already surfaces these.

**Link chain in `client.ts`:**
```typescript
// MODIFY src/apollo/client.ts
export function createApolloClient(
  getAccessToken: () => Promise<string>,
  addLogEntry: (entry: QueryLogEntry) => void   // NEW param
) {
  const httpLink = new HttpLink({ uri: import.meta.env.VITE_GRAPHQL_ENDPOINT })
  const authLink = setContext(async (_, { headers }) => { ... })
  const loggingLink = createLoggingLink(addLogEntry)

  return new ApolloClient({
    link: ApolloLink.from([authLink, loggingLink, httpLink]),
    ...
  })
}
```

**`ApolloWrapper` in `App.tsx`:**
```typescript
function ApolloWrapper({ children }) {
  const { getAccessToken } = useAuth()
  const { addEntry } = useQueryLog()                           // NEW
  const apolloClient = useMemo(
    () => createApolloClient(getAccessToken, addEntry),        // NEW
    [getAccessToken, addEntry]
  )
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
}
```

---

### 3. `GraphiQLPage` — embedded editor

**`src/pages/GraphiQLPage.tsx`**

A full-height page containing the GraphiQL React component connected to the live API.

#### Fetcher

We write a **custom fetcher** (not `createGraphiQLFetcher`) so that:
- The auth token is fetched fresh on every request (handles expiry transparently)
- The same `VITE_GRAPHQL_ENDPOINT` env var is used
- Both normal queries and introspection queries work identically

```typescript
import type { Fetcher } from '@graphiql/toolkit'

function useGraphiQLFetcher(): Fetcher {
  const { getAccessToken } = useAuth()
  return useCallback<Fetcher>(async (graphqlParams) => {
    const token = await getAccessToken()
    const response = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(graphqlParams),
    })
    return response.json()
  }, [getAccessToken])
}
```

#### Schema / autocomplete — introspection

No `schema` prop is passed to `<GraphiQL>`. GraphiQL fires a standard
`IntrospectionQuery` through the custom fetcher on first mount, which includes the
Bearer token, so the Autodesk API responds with the full schema. Monaco receives it
and autocomplete is immediately available.

> **Why not `schema={buildSchema(schemaSDL)}`?**
> Passing a `GraphQLSchema` object sets `shouldIntrospect = false` inside GraphiQL's
> store, preventing introspection and making autocomplete dependent on correctly wiring
> Monaco's worker stack — unnecessary complexity. The official graphiql-vite example
> uses only `fetcher`; introspection is automatic.

#### Pre-population from Query Log

When the user clicks "Load in Editor" on a log entry, we navigate to:
```
/query-editor?q=<encoded-query>&v=<encoded-variables>
```

When the user clicks "Load in Editor" (from either the Query Log or the query log page),
we navigate to `/query-editor?q=<encoded>&v=<encoded>`. A `useEffect` watching
`searchParams` fires whenever these params arrive — even when `GraphiQLPage` is already
mounted — and:
1. Decodes the query and variables into React state (`setQuery` / `setVariables`).
2. Increments `editorKey` to force-remount `<GraphiQL>` with the new `defaultQuery` /
   `initialVariables` values.
3. Clears the URL params with `setSearchParams({}, { replace: true })`.

```typescript
useEffect(() => {
  const q = searchParams.get('q')
  const v = searchParams.get('v')
  if (!q && !v) return
  const newQuery = q ? decodeURIComponent(q) : query
  const newVars  = v ? decodeURIComponent(v) : variables
  setQuery(newQuery)
  setVariables(newVars)
  setEditorKey(k => k + 1)
  setSearchParams({}, { replace: true })
}, [searchParams])
```

#### Storage: no-op to prevent localStorage override

GraphiQL v5 persists the query editor content to `localStorage` by default. On remount
(key bump), it would restore the previously-stored query and override `defaultQuery`,
causing "Load in Editor" to populate variables but not the query.

Fix: pass a no-op `Storage` object to `<GraphiQL storage={noopStorage}>`:

```typescript
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
}
```

This satisfies TypeScript's `Storage` type (avoids the `null` TS error) while ensuring
`defaultQuery` is always respected on remount.

> **Why not `storage={null}`?** GraphiQL's TypeScript type is `Storage | undefined`,
> so `null` causes a compile error. `undefined` means "use the default" (localStorage).
> The no-op object is the correct workaround.

#### CSS isolation

```typescript
import 'graphiql/style.css'
```

Import scoped to `GraphiQLPage.tsx` (Vite only injects the CSS when this module is loaded).
Wrap the GraphiQL component in a `div` with class `graphiql-page-root` and add a thin CSS
override file to restore any MUI global styles clobbered by GraphiQL's resets.

#### Nav-based pre-population

When the user has a node selected in the left nav tree (NavContext `selectedNode`),
the editor is pre-populated with a meaningful example query **and** the variables
section is pre-filled with the actual IDs from that node. This makes the editor
immediately runnable against the current selection.

A `useGraphiQLDefaultQuery(node)` hook maps `selectedNode` → `{ query, variables }`:

| Node type | Example query | Variables |
|-----------|--------------|-----------|
| `hub` | `GetHub` — hub name, extension, first 5 projects | `{ hubId }` |
| `project` | `GetProject` — project name, hub, first 10 root folders | `{ projectId }` |
| `folder` | `GetFolderContents` — child folders + items with type fragment | `{ folderId, projectId }` |
| `item` (DesignItem) | `GetDesignItem` — item + hub + tip root component + first-level BOM relations | `{ hubId, itemId }` |
| `null` (no selection) | Generic hub listing example | `{}` |

The hook is called in `GraphiQLPage`. Editor content is updated according to this rule:

| Scenario | Query | Variables |
|----------|-------|-----------|
| Page first loads (any node) | Set to example for current node type | Set to current node's IDs |
| Node changes to **same type** (e.g. folder → folder) | **Preserved** — keep whatever is in the editor | **Preserved** |
| Node changes to **different type** (e.g. folder → item) | **Replaced** with example for new type | **Replaced** with new node's IDs |
| No node selected | Set to generic hub listing example | `{}` |

Track `prevNodeType` in a `useRef` to detect type changes. On each `selectedNode`
change, compare `selectedNode.type` to `prevNodeType.current` to decide whether to
replace or preserve.

#### Layout

```
┌──────────┬─────────────────────────────────────────────────┐
│  Header (AppBar)                                           │
├──────────┼─────────────────────────────────────────────────┤
│ NavDrawer│  <div class="graphiql-page-root">               │
│  (same   │    <GraphiQL fetcher={fetcher} schema={schema}  │
│   as     │              query={query}                      │
│ dashboard│              onEditQuery={setQuery}             │
│   page)  │              variables={variables}              │
│          │              onEditVariables={setVariables} />  │
└──────────┴─────────────────────────────────────────────────┘
```

The NavDrawer is shown on the Query Editor page (same collapsible drawer as the
dashboard) so the user can change the selected node and immediately see the editor
update with a new example query.

Full height via `height: 'calc(100vh - <appbar-height>)'`.

**Controlled mode:** Because we need to programmatically update query/variables when
the node changes, GraphiQL runs in **controlled** mode (`query` + `onEditQuery` props
rather than `defaultQuery`). This requires tracking `query` and `variables` in local
React state.

---

### 4. `QueryLogPage` — live query table

**`src/pages/QueryLogPage.tsx`**

A full-page table showing every captured GraphQL operation in reverse-chronological
order (newest at the top).

#### Columns

Introspection queries (`IntrospectionQuery`) are **included** in the log —
they are educational to see as they show how GraphiQL discovers the schema.
They are visually distinguished with a muted italic style and an "Introspection"
chip in the Operation column (instead of the normal "Query" chip) so they stand
out from application queries without being hidden.

| Column | Content | Width |
|--------|---------|-------|
| # | Row index (1 = most recent) | 50 |
| Time | `HH:MM:SS.ms` | 90 |
| Operation | Name (bold) + type chip — "Introspection" chip (muted) for introspection ops, "Query"/"Mutation" chip for app operations | 220 |
| Duration | `Xms` right-aligned | 80 |
| Query | Collapsible code block — first 3 lines visible, "Show more" expands | flex 1 |
| Variables | JSON inline (collapsed if > 60 chars, expandable) | 200 |
| Response | JSON inline (collapsed, expandable) | 200 |
| Actions | "Load in Editor" button | 140 |

#### Expand/collapse

Each `Query`, `Variables`, and `Response` cell starts collapsed. Clicking
a cell or a "Show" chevron expands it in place (MUI `Collapse`).
State is stored in a `Set<string>` of entry IDs with a per-column suffix
(`"id-query"`, `"id-vars"`, `"id-response"`).

#### "Load in Editor" action

```typescript
function handleLoadInEditor(entry: QueryLogEntry) {
  const q = encodeURIComponent(entry.query)
  const v = encodeURIComponent(JSON.stringify(entry.variables, null, 2))
  navigate(`/query-editor?q=${q}&v=${v}`)
}
```

Clicking the button navigates to `/query-editor` with the query and variables
encoded in search params.

#### Toolbar

```
[ Query Log ]   [ X entries ]      [ Clear Log ]
```

MUI DataGrid is **not** used here — this table has complex cell expansion that
works better with a plain MUI `Table` (fixed layout, `TableCell` with custom
collapse content). A DataGrid's fixed-height cells conflict with the expandable
row content.

#### Layout

The Query Log page uses `AppShell` with `hideDrawer={true}` — the header and main
frame stay visible but the left drawer is hidden, giving the wide table full
horizontal space. The hamburger toggle button is also hidden when `hideDrawer` is set.

#### Real-time updates

`QueryLogPage` reads from `useQueryLog().entries`. Because entries are React
state, new operations automatically trigger a re-render and appear at the top
of the table while the user watches.

#### Error highlighting

Rows where `entry.errors !== null` get a subtle left border in `error.main`
colour to make failed operations immediately visible.

---

### 5. Header nav additions

**`src/components/layout/Header.tsx`** — add two `Button`s inside the authenticated
left nav `Box`:

```tsx
import CodeIcon from '@mui/icons-material/Code'
import ListAltIcon from '@mui/icons-material/ListAlt'

// Add after the existing Debug button:
<Button color="inherit" component={RouterLink} to="/query-editor" startIcon={<CodeIcon />}>
  Query Editor
</Button>
<Button color="inherit" component={RouterLink} to="/query-log" startIcon={<ListAltIcon />}>
  Query Log
</Button>
```

---

### 6. New routes in `App.tsx`

```tsx
<Route
  path="/query-editor"
  element={
    <ProtectedRoute>
      <GraphiQLPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/query-log"
  element={
    <ProtectedRoute>
      <QueryLogPage />
    </ProtectedRoute>
  }
/>
```

`QueryLogProvider` wraps all authenticated routes so entries accumulate across
navigation:

```tsx
<AuthProvider>
  <QueryLogProvider>          {/* NEW — outside ApolloWrapper */}
    <ApolloWrapper>
      <Router ...>
        ...routes...
      </Router>
    </ApolloWrapper>
  </QueryLogProvider>
</AuthProvider>
```

---

## Files

### New Files

| File | Purpose |
|------|---------|
| `src/context/QueryLogContext.tsx` | `QueryLogEntry` type, `QueryLogProvider`, `useQueryLog` |
| `src/apollo/loggingLink.ts` | `createLoggingLink(addEntry)` — Apollo Link interceptor |
| `src/pages/GraphiQLPage.tsx` | Full-page GraphiQL editor with NavDrawer + nav-based pre-population |
| `src/pages/QueryLogPage.tsx` | Live query log table (no NavDrawer, full-width) |
| `src/hooks/useGraphiQLDefaultQuery.ts` | Maps `NavNode` type → example query string + variables object |

### Modified Files

| File | Change |
|------|--------|
| `src/apollo/client.ts` | Add `addLogEntry` param, insert `loggingLink` in chain |
| `src/App.tsx` | Wrap with `QueryLogProvider`, add two new routes, update `ApolloWrapper` |
| `src/components/layout/Header.tsx` | Add Query Editor + Query Log nav buttons |

---

## Implementation Phases

### Phase 1 — `QueryLogContext`
Create `src/context/QueryLogContext.tsx`:
- `QueryLogEntry` interface
- `QueryLogProvider` with capped array state
- `useQueryLog` hook

### Phase 2 — `loggingLink` + `client.ts`
Create `src/apollo/loggingLink.ts`.
Modify `src/apollo/client.ts` to accept `addLogEntry` callback and insert link.

### Phase 3 — `App.tsx` wiring
Wrap authenticated subtree with `QueryLogProvider`.
Pass `addEntry` from context into `ApolloWrapper` → `createApolloClient`.
Add two new protected routes (`/query-editor`, `/query-log`).

### Phase 4 — `GraphiQLPage`
Create `src/pages/GraphiQLPage.tsx`:
- `useGraphiQLFetcher` hook (custom fetcher, fresh token per request)
- `buildSchema(schemaSDL)` from `schema.graphql?raw` Vite import
- Read `?q=` / `?v=` search params for "Load in Editor" pre-population, clear after reading
- `useGraphiQLDefaultQuery(selectedNode)` for nav-based pre-population with type-change detection
- Full-height layout with NavDrawer (same collapsible drawer as dashboard)
- `NavProvider` must scope to all authenticated pages (not just `/dashboard/*`) so `selectedNode` is available here

### Phase 5 — `QueryLogPage`
Create `src/pages/QueryLogPage.tsx`:
- MUI `Table` with collapsible query/variables/response cells
- "Load in Editor" button navigating to `/query-editor?q=...&v=...`
- "Clear Log" toolbar button
- Real-time updates from `useQueryLog().entries`
- Error row highlighting

### Phase 6 — Header nav
Modify `src/components/layout/Header.tsx`:
- Add Query Editor and Query Log `Button`s to the left nav section

### Phase 7 — Verify

- [ ] All existing queries fire and appear in Query Log immediately
- [ ] Mutations (base property edits) also appear in the log
- [ ] Query Log shows operation name, type, timing, collapsed query/vars/response
- [ ] Expanding cells shows full query doc / JSON
- [ ] Error rows (GraphQL `errors` array non-empty) are visually distinct
- [x] "Load in Editor" navigates to `/query-editor` with query and variables pre-populated (fixed: no-op storage prevents localStorage from overriding `defaultQuery`)
- [x] GraphiQL editor can run arbitrary queries against the live API
- [x] Autocomplete works (powered by introspection through the authenticated fetcher)
- [ ] Token refresh works — running a query after token expiry still succeeds
- [ ] Clearing the log empties the table
- [ ] Navigating between pages does not lose log entries
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] GitHub Pages build succeeds (GraphiQL CSS + Vite raw import compatible)

---

## Key Design Decisions

| Topic | Decision |
|-------|---------|
| Introspection queries | Included in log, not filtered. Shown with muted italic style + "Introspection" chip to distinguish from app queries |
| Log storage | React Context (in-memory, not persisted). Entries lost on page refresh — intentional for a demo tool |
| Log cap | 200 entries — prevents memory growth during long sessions |
| Auth in GraphiQL | Custom `fetcher` calls `getAccessToken()` per request — always fresh |
| Schema for autocomplete | No `schema` prop — GraphiQL fires `IntrospectionQuery` through the authenticated fetcher on first mount; Monaco receives the schema automatically and autocomplete works |
| Pre-population transfer | URL search params (`?q=...&v=...`) — simple, supports browser back button after loading |
| GraphiQL CSS | Import in `GraphiQLPage.tsx` only — Vite injects on demand; thin override file handles any MUI conflicts |
| Table component | Plain MUI `Table` (not DataGrid) — variable-height rows from collapsed/expanded cells |
| Link placement | `authLink → loggingLink → httpLink` — logging sees authenticated operations but not auth errors |
| Network errors | Not captured (link's `.map()` only runs on successful HTTP responses) — acceptable for demo use |
| Query Editor layout | Shows NavDrawer (same as dashboard) so user can change selected node while in the editor |
| Query Log layout | Uses `AppShell` with `hideDrawer={true}` — header and main frame stay visible, drawer is hidden to give the wide table full horizontal space |
| Nav-based pre-population | `useGraphiQLDefaultQuery(node)` maps each node type to an example query + real IDs in variables; editor uses `defaultQuery`/`initialVariables` with key-bump remount; same-type node change preserves editor contents, different-type node change replaces query + variables |
| GraphiQL storage | No-op `Storage` object passed as `storage` prop — disables localStorage persistence so `defaultQuery` is always respected on remount |
| `item` query variables | `item(hubId, itemId)` — API requires both args; `hubId` sourced from `NavNode.hubId` (propagated through the nav tree) |

---

## Non-goals (this phase)

- Persisting the query log across page refreshes
- Filtering or searching the query log
- Editing and re-running queries directly from the log (use "Load in Editor" instead)
- Subscriptions in GraphiQL (API doesn't support WebSocket subscriptions)
- Multiple saved queries / query history in the editor
