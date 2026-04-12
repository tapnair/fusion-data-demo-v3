# Plan: Component Search

## Fusion Data Demo v3

> **Goal:** Add a search icon to the header that expands a search bar. Searching finds
> Components across the hub using `searchByHub`. Results display in a DataGrid with the
> same column architecture as the BOM table (thumbnail, physical properties, base properties)
> — reusing shared column definitions wherever possible.

*Plan created: 2026-04-11*

---

## API Summary (from schema.graphql)

### `searchByHub`

```graphql
searchByHub(
  hubId: ID!
  searchCriteria: SearchInput
  pagination: PaginationInput
): SearchPayload
```

**`SearchInput`:**
```graphql
input SearchInput {
  query: String                               # free-text
  searchFields: [PropertyNameValuePair]       # property-specific
  desiredSearchResultTypes: [SearchResultTypeEnum]
  sort: [Sort]
}

input PropertyNameValuePair {
  searchableProperty: ID!    # SearchableProperty.id
  PropertyQuery: [String!]   # one or more value strings (OR'd within a property)
}
```

**`SearchResultTypeEnum`:** `COMPONENT | FILE | FOLDER | MODEL`

Default: all types (`desiredSearchResultTypes` omitted). User can filter via a type
toggle-chip bar in the search UI. Supported types and their `searchResultObject` shapes:

| Enum | `__typename` values | Key fields |
|------|--------------------|-|
| `COMPONENT` | `Component` | `partNumber`, `description`, `materialName`, `baseProperties`, `physicalProperties`, `thumbnail` object |
| `FILE` | `DesignItem`, `DrawingItem`, `BasicItem`, `ConfiguredDesignItem` | `name`, `hub`, `project`, `parentFolder`, `mimeType`, `size` |
| `FOLDER` | `Folder` | `name`, `hub`, `project`, `parentFolder`, `path`, `objectCount` |
| `MODEL` | `Model` | `name`, `materialName`, `timestamp` |

`SearchResult.thumbnail` is a plain URL string present for all types (or null).

**`SearchPayload`:**
```graphql
type SearchPayload {
  pagination: Pagination!   # { cursor, pageSize }
  results: [SearchResult!]!
}

type SearchResult {
  name: String!
  relevancyScore: Float
  thumbnail: String          # direct URL string (NOT a Thumbnail object)
  matches: [SearchResultMatch!]!
  searchResultObject: SearchResultObjectUnion!
}

type SearchResultMatch {
  matchedPropertyId: ID!
  matchedText: String!
}
```

> **Key difference from BOM:** `SearchResult.thumbnail` is a plain `String` URL, not a
> `Thumbnail` object. No polling needed — it is either present or null.

### `searchablePropertiesByHub`

```graphql
searchablePropertiesByHub(hubId: ID!, pagination: PaginationInput): SearchableProperties

type SearchableProperties {
  results: [SearchableProperty!]!
  pagination: PaginationInfo!
}

type SearchableProperty {
  id: ID!
  propertyDefinition: PropertyDefinition!   # { id, name, specification, units { name } }
}
```

Fetch once per hub (cache-first). Used to populate the property picker in property-search mode.

---

## Architecture

### Overview

```
Header
  SearchIcon button (left of ⚙ settings)
    → toggles searchOpen state
    → Collapse reveals SearchBar below AppBar

SearchBar
  [TextField: search input]  [Mode toggle: Free-text | Property]  [✕ Close]
  (property mode): [Property dropdown] [Value field] [Search button]

Main content area
  When searchOpen + results exist → replace AppShell main content with SearchResultsPage
  When searchOpen + no results yet → show SearchResultsPage empty/prompt state
  When !searchOpen → normal dashboard/detail view

SearchResultsPage
  SearchResultsGrid (DataGrid)
    Same column system as BOM table (shared module)
    Columns: Name, Thumbnail, Part Number, Description, Material + on-demand columns
    Load More button (cursor pagination)
```

---

## Shared Column Architecture

Currently all column logic lives in `src/components/detail/tabs/bom/bomColumns.ts` and
is tightly coupled to `BomRow` and `BomCellContext`. The physical properties, thumbnail,
and base property columns need `componentId` and `componentState` to work — the same
data a search result component has.

### Refactor: `src/components/shared/componentColumns.ts`

Extract a **shared column module** with a common `ComponentRow` base interface:

```typescript
// Minimum shape required by shared columns
export interface ComponentRow {
  id: string
  componentId: string
  componentState: string | null
  name: string
  partNumber: string
  description: string
  materialName: string
}
```

**`BomRow`** extends `ComponentRow` (adds `depth`, `hasChildren`, `isExpanded`, etc.).
**`SearchRow`** also extends `ComponentRow` (adds `relevancyScore`, `matches`, `thumbnailUrl`).

**Shared column definitions** (moved from `bomColumns.ts` → `componentColumns.ts`):
- `thumbnailColumnDef` — but adapted (see Thumbnail section below)
- `physicalPropertiesColumnDefs` — Mass, Volume, Density, Surface Area, Bounding Box
- `basePropertyColumnFactory` — `makeBasePropertyColumn(def)`
- `BomColumnDef` → renamed `ComponentColumnDef`
- `ComponentCellContext` — superset of current `BomCellContext`

**BOM-specific** columns (stay in `bomColumns.ts`, import from `componentColumns.ts`):
- Name column (with tree indent + expand toggle)
- Description, P/N, Material standard columns

**Search-specific** columns (new, in `searchColumns.ts`):
- Name column (flat, no tree indent — links to result)
- Relevance score column
- Matched properties column (shows which fields matched + matched text)

---

## Thumbnail Handling in Search

`SearchResult.thumbnail` is a direct URL string (not a signed Autodesk CDN URL that
needs polling). Display rules:
- If `thumbnail` string is present → render `<img src={thumbnail}>` directly
- If null → show `ImageNotSupportedIcon`
- No polling, no IndexedDB blob caching needed for search thumbnails

The BOM thumbnail column (`useBomThumbnail`) is NOT reused for search. Instead, search
uses a simpler `SearchThumbnailCell` that just renders the URL directly.

Physical properties and base property columns ARE reused via the shared module — they
only depend on `componentId` and `componentState`.

---

## Files

### New Files

| File | Purpose |
|------|---------|
| `src/components/shared/componentColumns.ts` | Shared column defs: physical props, base props, cell context type |
| `src/graphql/queries/search.ts` | `SEARCH_BY_HUB` and `GET_SEARCHABLE_PROPERTIES` queries |
| `src/hooks/useComponentSearch.ts` | Apollo lazy query hook managing search state + pagination |
| `src/hooks/useSearchableProperties.ts` | Fetch + cache searchable property definitions for hub |
| `src/pages/SearchResultsPage.tsx` | Full-width results DataGrid with toolbar |
| `src/components/search/SearchBar.tsx` | Collapsible search bar component rendered in/below Header |
| `src/components/search/SearchResultsGrid.tsx` | DataGrid + column settings + load more |
| `src/components/search/SearchColumnSettings.tsx` | Column visibility popover (mirrors BomColumnSettings) |
| `src/context/SearchContext.tsx` | Search state: query, mode, results, open/closed |

### Modified Files

| File | Change |
|------|--------|
| `src/components/layout/Header.tsx` | Add `SearchIcon` button left of ⚙; pass `searchOpen`/toggle to header |
| `src/components/layout/AppShell.tsx` | Render `SearchResultsPage` as main content when search is active |
| `src/components/detail/tabs/bom/bomColumns.ts` | Import shared column defs from `componentColumns.ts`; keep BOM-specific columns |
| `src/types/bom.types.ts` | `BomRow` extends `ComponentRow` |

---

## Data Model

### `SearchRow`

```typescript
import type { ComponentRow } from '../shared/componentColumns'

export type SearchResultType = 'COMPONENT' | 'FILE' | 'FOLDER' | 'MODEL'

export interface SearchResultMatch {
  matchedPropertyId: string
  matchedText: string
}

export interface SearchRow extends ComponentRow {
  // componentId / componentState / name / partNumber / description / materialName
  // come from ComponentRow — populated from Component fragment (null for non-Component types)

  resultType: SearchResultType       // derived from searchResultObject.__typename
  objectTypeName: string             // human-readable: "Component", "Design", "Drawing", "Folder", etc.

  // All result types
  relevancyScore: number | null
  thumbnailUrl: string | null        // SearchResult.thumbnail (direct URL, no polling)
  matches: SearchResultMatch[]

  // FILE-specific (DesignItem / DrawingItem / BasicItem / ConfiguredDesignItem)
  mimeType: string | null
  fileSize: string | null            // raw bytes string from API
  folderPath: string | null          // parentFolder path

  // FOLDER-specific
  objectCount: number | null
  folderPathStr: string | null

  // MODEL-specific
  modelMaterialName: string | null
  timestamp: string | null
}
```

Non-applicable fields are `null` for that row type. Grid columns that are
component-specific (physical props, base props, P/N, Material) show a dash `—`
for non-Component rows.

### `SearchCellContext`

```typescript
export interface SearchCellContext {
  // Shared with BOM (from ComponentCellContext)
  sigFigs: number
  // Search-specific
  searchableProperties: SearchableProperty[]  // for matched property ID → name lookup
}
```

---

## GraphQL Queries

### `src/graphql/queries/search.ts`

```graphql
query SearchByHub(
  $hubId: ID!
  $searchCriteria: SearchInput
  $pagination: PaginationInput
) {
  searchByHub(
    hubId: $hubId
    searchCriteria: $searchCriteria
    pagination: $pagination
  ) {
    pagination { cursor pageSize }
    results {
      name
      relevancyScore
      thumbnail
      matches {
        matchedPropertyId
        matchedText
      }
      searchResultObject {
        __typename
        ... on Component {
          id
          name
          partNumber
          description
          materialName
        }
      }
    }
  }
}

query GetSearchablePropertiesByHub($hubId: ID!, $pagination: PaginationInput) {
  searchablePropertiesByHub(hubId: $hubId, pagination: $pagination) {
    pagination { cursor pageSize }
    results {
      id
      propertyDefinition {
        id
        name
        specification
        units { name }
      }
    }
  }
}
```

---

## Search Context

**`src/context/SearchContext.tsx`**

Holds search UI and results state. Lives outside `ApolloWrapper` is not needed — it
can live inside since it uses Apollo queries. Place it as a sibling to `NavProvider`.

```typescript
interface SearchContextValue {
  isOpen: boolean
  openSearch: () => void
  closeSearch: () => void
  mode: 'freetext' | 'property'
  setMode: (m: 'freetext' | 'property') => void
  query: string
  setQuery: (q: string) => void
  selectedPropertyId: string | null
  setSelectedPropertyId: (id: string | null) => void
  propertyQueryValues: string[]
  setPropertyQueryValues: (vals: string[]) => void
  hubId: string | null   // from NavContext.activeHubId
}
```

`hubId` comes from `NavContext.activeHubId` (see Active Hub section below). If no hub
is currently active when the user triggers search, the search bar shows an inline
message: "Expand a hub in the navigation tree to search within it."

---

## Active Hub (NavContext Extension)

### Single-Hub Expansion Rule

Only one hub node may be expanded in the nav tree at a time. When a hub is expanded,
all other hub nodes are collapsed. The expanded hub is the **active hub**.

**`NavContext` additions:**
```typescript
activeHubId: string | null          // ID of the currently expanded hub node
activeHubNode: NavNode | null       // full NavNode for the active hub
```

**`NavTree` behaviour change:**
In the `onExpandedItemsChange` handler (fired by `SimpleTreeView`), when a hub node
is added to `expandedItems`:
1. Remove all other hub node IDs from `expandedItems` (collapse all other hubs)
2. Set `activeHubId` to the newly expanded hub's ID

When a hub is collapsed (removed from `expandedItems`):
- If it was the active hub, set `activeHubId = null`

Hub node IDs are identified by checking the `NavNode.type === 'hub'` entries in the
`nodeChildrenCache` (or by prefix convention since hub IDs are URNs).

**Consumers of `activeHubId`** (replaces ad-hoc `selectedNode?.hubId` derivations):
- `SearchContext` — `hubId` for `searchByHub`
- `useHubBasePropertyDefinitions` — already takes `hubId` prop; `DetailPanel` will pass `activeHubId`
- `useMembers` (hub context) — already has its own node prop
- Any future hub-scoped query

**No active hub — prompt locations:**
- Search bar: inline message "Expand a hub in the navigation tree to search within it."
- Any other feature needing `activeHubId` that lacks it: show a similar inline prompt.

### Modified Files for Active Hub
| File | Change |
|------|--------|
| `src/context/NavContext.tsx` | Add `activeHubId`, `activeHubNode`, `setActiveHub` |
| `src/components/layout/NavTree.tsx` | On hub expand: collapse other hubs, set active hub; on hub collapse: clear if was active |

---

## Search Bar UI

**`src/components/search/SearchBar.tsx`**

Rendered in `AppShell` immediately below the `AppBar` via MUI `Collapse` (unmounts
when closed). Nav buttons remain fully visible in the AppBar above.

```
┌──────────────────────────────────────────────────────────┐
│ [☰] Home  Query Editor  Query Log   Fusion Data Demo  🔍 ⚙ [User] │
├──────────────────────────────────────────────────────────┤  ← Collapse
│  🔍  Search...                        [Free text | Property]  [✕]  │
│  (property mode only):                                           │
│  [Property ▼]  [Value...]  [Search ▶]                           │
└──────────────────────────────────────────────────────────┘
```

`AppShell` owns the `searchOpen` boolean and renders:
```tsx
<AppBar ...><Header .../></AppBar>
<Collapse in={searchOpen} unmountOnExit>
  <SearchBar />
</Collapse>
{searchOpen ? <SearchResultsPage /> : children}
```

**Free-text mode:**
- `TextField` with search adornment
- Submit on Enter or debounced (300ms after stop typing)
- Auto-submit as user types

**Property mode:**
- `Autocomplete` for property selection (populated from `useSearchableProperties`)
- `TextField` for value(s)
- Submit button

**Keyboard:** Escape closes the bar and clears results.

---

## Search Results Grid

**Type filter chips** (above the grid, in the toolbar):
```
[All] [Component] [File] [Folder] [Model]
```
Selecting a chip sets `desiredSearchResultTypes` in the query. "All" omits the filter.
Multiple chips can be selected simultaneously.

**Columns (default visible):**

| Column | Source | Applies to | Width | Default |
|--------|--------|-----------|-------|---------|
| Thumbnail | `SearchResult.thumbnail` (direct URL) | All | 72 | ✅ |
| Name | `SearchRow.name` | All | 250 | ✅ |
| Type | `SearchRow.objectTypeName` chip | All | 130 | ✅ |
| Relevance | `SearchRow.relevancyScore` (0–1, %) | All | 90 | ✅ |
| Matched | `SearchRow.matches` property name + text | All | 200 | ✅ |
| Part Number | `Component.partNumber` | COMPONENT | 200 | ✅ |
| Description | `Component.description` | COMPONENT | 200 | ✅ |
| Material | `Component.materialName` | COMPONENT | 120 | ✅ |
| Path / Location | folder path or `parentFolder.path` | FILE, FOLDER | 200 | ✅ |
| Size | `fileSize` formatted bytes | FILE | 100 | ✅ |
| Item Count | `objectCount` | FOLDER | 100 | ✅ |

Non-applicable columns show `—` for rows of a different type.

**On-demand columns (same as BOM, same hooks — COMPONENT rows only):**
- Physical properties: Mass, Volume, Density, Surface Area, Bounding Box
- Base property columns (from hub definitions)

**Toolbar:**
- "Columns" button → popover with column visibility toggles (mirrors `BomColumnSettings`)
- "Precision" button → sig figs for physical properties
- Result count: "X results"

**Pagination:**
- Initial fetch: 20 results
- "Load More" button at bottom: appends next page using `fetchMore` cursor
- Apollo `merge` function concatenates pages in cache

**Row click:**
- Navigates to the component in the nav tree (same pattern as Contents tab click)
- Uses `setSelectedNode` from `NavContext` if the component is in the current tree
- Otherwise selects it and triggers tree expansion

---

## Hook: `useComponentSearch`

```typescript
export function useComponentSearch() {
  const { isOpen, query, mode, selectedPropertyId, propertyQueryValues, hubId } = useSearch()
  const [executeSearch, { data, loading, error, fetchMore }] = useLazyQuery(SEARCH_BY_HUB)

  // Build SearchInput from context state
  const buildSearchCriteria = (): SearchInput => {
    if (mode === 'freetext') {
      return { query, desiredSearchResultTypes: ['COMPONENT'] }
    } else {
      return {
        searchFields: [{
          searchableProperty: selectedPropertyId!,
          PropertyQuery: propertyQueryValues,
        }],
        desiredSearchResultTypes: ['COMPONENT'],
      }
    }
  }

  // Fire search on query/mode changes
  useEffect(() => {
    if (!hubId || (!query && propertyQueryValues.length === 0)) return
    executeSearch({ variables: { hubId, searchCriteria: buildSearchCriteria(), pagination: { limit: 20 } } })
  }, [query, mode, selectedPropertyId, propertyQueryValues, hubId])

  // Map results to SearchRow[]
  const rows: SearchRow[] = useMemo(() => mapResultsToRows(data), [data])

  const loadMore = () => {
    const cursor = data?.searchByHub?.pagination?.cursor
    if (!cursor) return
    fetchMore({ variables: { pagination: { cursor, limit: 20 } } })
  }

  return { rows, loading, error, loadMore, hasMore: !!data?.searchByHub?.pagination?.cursor }
}
```

---

## Apollo Type Policy for Search

```typescript
// In typePolicies.ts — add:
Query: {
  fields: {
    searchByHub: {
      keyArgs: ['hubId', 'searchCriteria'],
      merge(existing, incoming, { args }) {
        if (!args?.pagination?.cursor) return incoming  // new search
        return {
          ...incoming,
          results: [...(existing?.results ?? []), ...incoming.results],
        }
      },
    },
  },
},
```

---

## `AppShell` Integration

When `SearchContext.isOpen` is true and results (or a loading state) exist, `AppShell`
renders `SearchResultsPage` as the main content instead of `{children}`. The nav drawer
remains visible (search results benefit from hub context in the nav tree).

```typescript
// In AppShell main area:
{searchIsOpen
  ? <SearchResultsPage />
  : children
}
```

Search stays open as the user navigates the tree (the hub selection can change, triggering
a new search). Closing the search bar returns to the previous dashboard view.

---

## Row Click Navigation

### How to navigate from each result type

| Result type | Target in tree | How to get there |
|-------------|---------------|-----------------|
| `COMPONENT` | Parent `DesignItem` | `Component.primaryModel.designItem { id, hub { id } }` — must be included in search query fragment. If `primaryModel` or `designItem` is null, show a toast "Cannot navigate: component has no associated design item." |
| `DesignItem` / `DrawingItem` / `BasicItem` / `ConfiguredDesignItem` | The item itself | `searchResultObject.id` + `hub.id` directly |
| `Folder` | The folder | `searchResultObject.id` + `hub.id` + `project.id` directly |
| `Model` | Parent DesignItem | `Model.designItem { id, hub { id } }` — included in search query fragment |

### Search query fragments (updated for navigation)

```graphql
... on Component {
  id
  name
  partNumber { displayValue }
  description { displayValue }
  materialName { displayValue }
  componentState
  primaryModel {
    id
    designItem {
      id
      hub { id }
      parentFolder { id }
    }
  }
}
... on Folder {
  id
  name
  hub { id }
  project { id }
  parentFolder { id }
  path
  objectCount
}
... on DesignItem {
  id
  name
  hub { id }
  parentFolder { id }
  mimeType
  size
}
... on DrawingItem {
  id
  name
  hub { id }
  parentFolder { id }
}
... on BasicItem {
  id
  name
  hub { id }
  parentFolder { id }
  mimeType
  size
}
... on ConfiguredDesignItem {
  id
  name
  hub { id }
  parentFolder { id }
}
... on Model {
  id
  name { displayValue }
  materialName { displayValue }
  timestamp
  designItem {
    id
    hub { id }
    parentFolder { id }
  }
}
```

### Navigation behaviour on click

1. Resolve the target `NavNode` from the result (using the hub/folder/item IDs above)
2. Call `setSelectedNode(targetNode)` — drives the detail panel
3. Expand ancestor nodes in the tree (same logic as Contents tab click — add parent IDs to `expandedItems`)
4. Scroll the tree to the selected node (`scrollIntoView`)
5. For COMPONENT results: additionally set the active tab to `'bom'` in `DetailPanel`
   — pass an `initialTab` callback through `SearchContext` or via navigation state

---

## Implementation Phases

### Phase 1 — Context + shared types
- Create `SearchContext.tsx`
- Create `src/types/search.types.ts` (`SearchRow`, `SearchCellContext`)
- Refactor `ComponentRow` base into `src/components/shared/componentColumns.ts`
  (extract physical props + base prop column defs; update `bomColumns.ts` to import)

### Phase 2 — GraphQL layer
- Create `src/graphql/queries/search.ts` (`SEARCH_BY_HUB`, `GET_SEARCHABLE_PROPERTIES`)
- Add `searchByHub` merge policy to `typePolicies.ts`
- Create `src/hooks/useSearchableProperties.ts`
- Create `src/hooks/useComponentSearch.ts`

### Phase 3 — Search Bar UI
- Create `src/components/search/SearchBar.tsx` (Collapse, TextField, mode toggle)
- Add `SearchIcon` button to `Header.tsx` (left of ⚙)
- Wire `SearchContext` into `AppShell` for open/close

### Phase 4 — Results Grid
- Create `src/components/search/SearchColumnSettings.tsx`
- Create `src/components/search/SearchResultsGrid.tsx`
- Create `src/pages/SearchResultsPage.tsx`
- Wire into `AppShell` main content area

### Phase 5 — On-demand columns
- Wire physical properties columns (reuse `useBomPhysicalProperties` hook, same args)
- Wire base property columns (reuse `useBomBaseProperties` hook, same args)
- Precision selector in `SearchColumnSettings`

### Phase 6 — Row click → tree navigation
- See "Row Click Navigation" section; build `resolveSearchRowToNavNode` helper
- Call `setSelectedNode` + expand ancestor tree items (same pattern as Contents tab)

### Phase 7 — Verify
- [ ] Search icon appears left of ⚙ in header when authenticated
- [ ] Click opens search bar with animation; Escape closes it
- [ ] Free-text search returns COMPONENT results only
- [ ] Property mode shows searchable properties from hub; search by value works
- [ ] Results grid shows Name, Thumbnail, P/N, Description, Material, Relevance, Matched
- [ ] Thumbnail column renders direct URL images (no polling)
- [ ] Load More appends next page; button hidden when no more results
- [ ] Physical properties columns fetch on-demand with polling
- [ ] Base property columns fetch on-demand with cache-first
- [ ] Clicking a result selects and scrolls to it in the nav tree
- [ ] Switching hubs in nav tree triggers a new search against the new hub
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Key Design Decisions

| Topic | Decision |
|-------|---------|
| Column reuse | Extract shared `ComponentColumnDef` + physical/base prop columns into `src/components/shared/componentColumns.ts`; both BOM and search import from there |
| Thumbnail in search | Direct `<img>` from `SearchResult.thumbnail` string — no polling, no IndexedDB |
| Search scope | All types by default; type filter chip bar (All / Component / File / Folder / Model) in grid toolbar. On-demand property columns apply to Component rows only. |
| Hub source | `NavContext.activeHubId` — the currently expanded hub. Only one hub may be expanded at a time (others collapse automatically). No active hub → inline prompt in search bar. |
| Result type filter | TBD (Q2) |
| Row click | Navigate nav tree to the result. Components → navigate to parent DesignItem via `Component.primaryModel.designItem`, open BOM tab. Files/Folders/Models → navigate directly. |
| Search bar placement | Full-width `Collapse` below AppBar — nav buttons stay visible in header above. `AppShell` owns `searchOpen` state. |
| Column refactor | Full shared module: `src/components/shared/componentColumns.ts` with `ComponentColumnDef`, `ComponentCellContext`, physical props + base prop column defs. `bomColumns.ts` and `searchColumns.ts` both import from it. |
| Pagination | `fetchMore` cursor-based; Apollo merge policy for `searchByHub` |
| Search submit | Auto-submit on free-text with 300ms debounce; explicit button click in property mode |
| Property mode values | Single value input (comma-separated multi-value is a stretch goal) |

---

## Open Questions

| Q | Topic |
|---|-------|
| Q1 | **Hub source:** `NavContext.activeHubId` (expanded hub). Single-hub-expansion enforced in NavTree. No active hub → inline prompt. |
| Q2 | **Type filter:** All types implemented. Chip bar (All / Component / File / Folder / Model) in search results toolbar. Default = all types. |
| Q3 | **Row click:** Navigate nav tree to result. COMPONENT → navigate to parent DesignItem (`Component.primaryModel.designItem`), open BOM tab. FILE/FOLDER/MODEL → navigate directly to that node. |
| Q4 | **Search bar placement:** Full-width `Collapse` below AppBar; nav buttons remain visible above. |
| Q5 | **Column refactor:** Full shared module (`componentColumns.ts`). BOM and Search both import shared physical/base prop column defs. BOM-specific (tree indent) and search-specific (type chip, relevance, matched) columns stay in their own files. |
