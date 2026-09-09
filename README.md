# Fusion Data Demo v3

A single-page application built with Vite, React, and TypeScript that integrates with Autodesk Platform Services (APS) to explore the Manufacturing Data Model API v3.

**Live demo:** [https://tapnair.github.io/fusion-data-demo-v3](https://tapnair.github.io/fusion-data-demo-v3)

**Mock ERP admin UI:** [https://fusion-erp-api.vercel.app](https://fusion-erp-api.vercel.app) — browse and edit the fake material-master records surfaced in the app's ERP tab

---

## Features

### Authentication
- OAuth 2.0 PKCE flow with Autodesk APS — no server required
- User avatar and name displayed in the header after login
- Token stored in `sessionStorage`; expired tokens force re-login
- A `/userinfo` failure that is *not* a 401 keeps the session alive with a placeholder user, so a profile-scope problem can't produce a login redirect loop

### Navigation
- Collapsible left-side tree that progressively loads: **Hubs → Projects → Folders/Items**
- CE Hubs Only filter (on by default) — hides hubs on older data platforms
- Single-hub enforcement — expanding a hub collapses the others, keeping hub-scoped queries unambiguous
- URL-based routing — every selected node and active tab is encoded in the URL for bookmarking and sharing
- Deep link support — paste a URL and the tree auto-expands to the correct node
- Browser back/forward navigation works across all node and tab changes

### Detail Tabs
Each selected node shows relevant tabs:

| Tab | Available for |
|---|---|
| Details | All node types |
| Users | Hubs, Projects, Folders |
| Contents | Projects, Folders |
| BOM | Design Items |
| View | Design Items, Drawing Items |

### Contents Tab
- DataGrid listing of folders and files within a selected project or folder
- Folders displayed first, both groups sorted alphabetically
- Columns: icon, Name, Type, Modified, Size (human-readable)
- Click any row to navigate to that item — the left tree scrolls and highlights it

### BOM Tab
- Hierarchical Bill of Materials rendered in a MUI DataGrid
- Progressive expand/collapse of component rows
- "Load more" pagination for large assemblies
- Column visibility picker and inline precision selector (0–6 significant figures)

**Standard columns:**
| Column | Header |
|---|---|
| Name | Name |
| Description | Description |
| Part number | P/N |
| Material | Material |
| Thumbnail | (image) |
| Mass | Mass |
| Volume | Volume |
| Density | Density |
| Surface Area | Surface Area |
| Bounding Box | Bounding Box (L/W/H) |

**Base Property columns** — dynamically generated from the hub's property definition collection. All base property values for a component are fetched in a single query; enabling an additional base property column costs zero extra network requests.

**Inline editing** — base property cells are editable in place. Click a cell to enter edit mode, press Enter or blur to commit. The change is sent via the `setProperties` mutation with an optimistic update so the new value appears immediately. Read-only properties show a lock icon and cannot be edited.

**Thumbnail caching** — thumbnails are cached as blobs in IndexedDB (`fusion-demo-thumbnails`) with a 7-day TTL, so re-expanding an assembly costs no image downloads. Stale URLs self-heal via an `onError` refetch, and the cache is cleared on logout. A "Refresh Thumbnails" button forces a re-fetch.

### Search
- Search icon in the header opens a full-width search bar
- Free-text and property-based search modes, scoped to the active hub
- Type filter chips: **Component**, **File**, **Folder**, **Model**
- Results grid with thumbnail, name, type, relevance score, matched properties, P/N, description, material, parent folder, parent project, size, and item count
- Physical and base property columns can be added on demand for component rows
- Parent Folder / Parent Project cells are navigation links — clicking one jumps to that node in the tree and closes search
- Cursor-based "Load more" pagination; column visibility persisted to `localStorage`

### View Tab (APS Viewer)
- Checks the Model Derivative manifest first and only triggers a translation job when no viewable already exists
- Polls the manifest until translation completes, then loads the model in the Autodesk LMV viewer
- A **properties panel** is docked alongside the viewer and pushes (not overlays) the canvas. It stays visible for the whole session, and with nothing selected it falls back to the root assembly
- Clickable hierarchy breadcrumb — selecting a segment selects that component in the 3D scene and fits it to view

The panel has three tabs:

| Tab | Contents | Keyed on |
|---|---|---|
| **Properties** | Base and physical properties in collapsible sections, laid out as vertical BOM rows. Description is editable in place. A "Show all" toggle reveals hidden/internal properties | `modelId` |
| **ERP** | Read-only mock material-master record for the selected component, fetched through an APS-token-gated broker function | `modelId` |
| **Notes** | Free-text notes attached to a component, or to the whole assembly when nothing is selected. Create, edit, and delete inline; author is taken from the signed-in APS user | `componentLineageUrn` + `componentF3dId` |

> **Why Notes uses a different key:** `modelId` is transient across the Fusion lifecycle, so notes are keyed on the stable composite Fusion identity (`componentLineageUrn` + `componentF3dId`, plus `rootLineageUrn` for assembly-wide queries) instead. Properties and ERP still use `modelId`, which remains the correct key for Manufacturing Data Model lookups.

### Query Editor
- Embedded GraphiQL IDE connected directly to the Manufacturing Data Model API
- Authenticated with the current user's token — no separate credentials needed
- When a node is selected in the left nav, the editor pre-populates with a relevant example query and fills the variables panel with real IDs for the selected item
- Selecting a node of a different type replaces the editor content; selecting a node of the same type preserves current edits
- "Load in Editor" from the Query Log transfers any logged query + variables directly into the editor

### Query Log
- Captures every GraphQL operation executed by the app via a custom Apollo Link
- Compact table rows show: #, operation type, operation name, "Load in Editor" button, timestamp, and duration
- Click any row to expand it and view the full GraphQL query, variables, and response (or errors) in syntax-highlighted code blocks
- Introspection queries (sent by GraphiQL for schema autocomplete) are shown at reduced opacity to distinguish them from application queries
- "Clear Log" button in the toolbar; log is capped at 200 entries and is not persisted

### Cache Persistence
- Apollo's `InMemoryCache` is persisted to `localStorage` by a custom persistor built for Apollo Client v4
- Writes are debounced 1s and skipped if the serialised cache exceeds 5 MB; `Thumbnail` entities are excluded (they live in IndexedDB instead)
- A schema version check on startup restores or purges the cache, and logout purges it entirely
- Default fetch policy is `cache-and-network` (stale-while-revalidate)

### Weave 3 Design System
- 3 color schemes: **Light Gray** (default), **Dark Gray**, **Dark Blue**
- 3 density levels: **High** (compact), **Medium** (default), **Low** (comfortable)
- 9 combinations; selection persisted in `localStorage`
- Settings icon in the header opens the theme switcher
- ArtifaktElement font and 198 Weave 3 SVG icons included

---

## Prerequisites

- Node.js `^22.13.0 || >=24.0.0` (see `engines` in `package.json`)
- Autodesk APS account with a registered application (callback URL: `http://localhost:5173/callback`)

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your APS credentials:

```env
VITE_CLIENT_ID=your-client-id-here
VITE_AUTH_URL=https://developer.api.autodesk.com/authentication/v2/authorize
VITE_TOKEN_URL=https://developer.api.autodesk.com/authentication/v2/token
VITE_REDIRECT_URI=http://localhost:5173/callback
VITE_SCOPE=openid profapi:core-std-profile:read profapi:img-profile:read data:read data:write data:search
VITE_GRAPHQL_ENDPOINT=https://developer.api.autodesk.com/mfg/v3/graphql/public
```

The ERP and Notes tabs additionally need the broker endpoints (both served by the sibling `fusion-erp-api` project):

```env
VITE_ERP_ENDPOINT_URL=https://your-vercel-deployment.vercel.app/api/material/byModelId
VITE_NOTES_ENDPOINT_BASE=https://your-vercel-deployment.vercel.app/api/notes
```

> **Scopes matter, and each one earns its place:**
> - `openid` is **mandatory** for `/userinfo` — without it APS returns `403 invalid_scope`, and the app cannot identify the signed-in user
> - `profapi:core-std-profile:read` returns `name`, `given_name`, `family_name`, and `email`. Without it the header has no name and the Users tab cannot recognise your own row
> - `profapi:img-profile:read` returns `picture` — the header avatar
> - `data:search` is required to fetch hub-level base property definitions and to run component search
>
> See the [User Profile API custom scopes reference](https://aps.autodesk.com/en/docs/profile/v2/developers_guide/custom_scopes/) for the full field-to-scope mapping.

### 3. Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 4. Build for production

```bash
npm run build
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check then build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run TypeScript type checking only |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:ui` | Run Vitest with the browser UI |
| `npm run test:coverage` | Run the suite and generate a coverage report |
| `npm run deploy` | Build and deploy to GitHub Pages manually |

---

## Testing

Vitest with `@testing-library/react`, currently **373 tests across 24 files**. `fake-indexeddb/auto` is loaded in the test setup so the thumbnail cache can be exercised directly. Coverage is report-only and does not gate the build. The suite runs in CI before every deploy, so a failing test blocks the release.

```bash
npm test
```

---

## Project Structure

```
fusion-data-demo-v3/
├── .github/workflows/      # GitHub Actions (test + auto-deploy to Pages on push to main)
├── public/
│   ├── fonts/              # ArtifaktElement font files
│   ├── icons/              # 198 Weave 3 SVG icons
│   ├── 404.html            # SPA path-forwarding shim for GitHub Pages
│   └── Tokens_w3c.json     # Weave 3 W3C design token reference
├── plans/                  # Implementation plan markdown files
├── scripts/
│   └── seed-erp/           # Standalone CLI: walks an assembly and seeds mock ERP records
├── src/
│   ├── apollo/             # Client factory, type policies, paged fields,
│   │                       # cachePersistor, cacheVersion, loggingLink
│   ├── components/
│   │   ├── auth/           # ProtectedRoute, LoginButton, AuthCallback
│   │   ├── common/         # LoadingSpinner, ErrorMessage
│   │   ├── detail/         # DetailPanel, HubDetail, ProjectDetail, FolderDetail, ItemDetail
│   │   │   └── tabs/
│   │   │       ├── bom/    # BomTab, BomColumnSettings, bomColumns (all column definitions)
│   │   │       ├── ContentsTab.tsx
│   │   │       ├── UsersTab.tsx
│   │   │       └── ViewTab.tsx
│   │   ├── layout/         # AppShell, Header, NavDrawer, Navigation
│   │   ├── nav/            # NavTree, NavTreeItem
│   │   ├── search/         # SearchBar, SearchResultsGrid, SearchColumnSettings
│   │   ├── shared/         # EditableTextCell
│   │   └── viewer/         # ApsViewer, ViewerPropertiesPanel, ErpTab, NotesTab
│   ├── context/            # AuthContext, NavContext, QueryLogContext, SearchContext
│   ├── graphql/
│   │   ├── mutations/      # baseProperties (setProperties), component, members
│   │   └── queries/        # hubs, projects, folders, items, bom, thumbnail, search,
│   │                       # physicalProperties, baseProperties, members, viewerComponent
│   ├── hooks/              # Data loading and view-state hooks — nav, BOM columns,
│   │                       # viewer, search, ERP, Notes, members, routing
│   ├── pages/              # Home, Dashboard, Callback, DebugPage,
│   │                       # GraphiQLPage, QueryLogPage, SearchResultsPage
│   ├── services/
│   │   ├── auth/           # authService, pkceHelper, tokenManager, userInfoService
│   │   ├── erp/            # erpClient
│   │   ├── notes/          # notesClient
│   │   ├── viewer/         # modelDerivativeService, dataManagementService, loadViewerScripts
│   │   └── thumbnailImageCache.ts
│   ├── test/               # Vitest setup
│   ├── theme/              # Weave 3 theme factory, tokens, overrides
│   ├── types/              # TypeScript type definitions
│   └── utils/              # constants, propertyValue (coercion helper)
├── .env.example
├── .env.production         # Production env vars for GitHub Pages build
└── schema.graphql          # Manufacturing Data Model API v3 GraphQL schema
```

---

## Related Repositories

This demo is the web client in a small family of projects that share the same backend:

| Repository | Role |
|---|---|
| `fusion-data-demo-v3` | This repo — the web SPA |
| `fusion-erp-api` | Vercel project: the ERP read broker, the Notes REST API, and the ERP admin UI. Backed by MongoDB Atlas |
| `fusion-notes-addin` | Fusion add-in (Python + HTML palette) — a second Notes client, reading and writing the same records |
| `fusion-data-demo-mobile` | React Native / Expo companion app |

The mock ERP and Notes features are demo data and their endpoints are unauthenticated, apart from the ERP read broker, which validates the caller's APS token.

---

## Technologies

| Library | Version | Purpose |
|---|---|---|
| Vite | 7 | Build tool and dev server |
| React | 19 | UI library |
| TypeScript | 5 | Type safety |
| Material-UI | v7 | Component library |
| MUI X Data Grid | community | BOM, Contents, Users, and Search tables |
| MUI X Tree View | community | Left navigation tree |
| Apollo Client | v4 | GraphQL client with `InMemoryCache` |
| React Router | 7 | Client-side routing |
| GraphiQL | v5 | Embedded GraphQL IDE |
| Autodesk Viewer | v7 | 3D model viewer (loaded from CDN) |
| idb | 8 | IndexedDB wrapper for the thumbnail cache |
| Vitest | 4 | Test runner |
| Weave 3 | — | Autodesk design system (2200+ tokens) |

---

## Deployment

The app auto-deploys to GitHub Pages on every push to `main` via `.github/workflows/deploy.yml`. The workflow installs with `npm ci`, runs the test suite and coverage, builds, and publishes `dist/` to the `gh-pages` branch using the `VITE_CLIENT_ID` repository secret. All other `VITE_*` values come from `.env.production`.

To deploy manually:

```bash
npm run deploy
```

Make sure `VITE_CLIENT_ID` is set in your environment (or in `.env.production`) before running a manual deploy.

The production APS application must have `https://tapnair.github.io/fusion-data-demo-v3/callback` registered as a valid callback URL.

> **Note for Autodesk-internal machines:** if your global `~/.npmrc` points the default npm registry at an internal Artifactory mirror, `npm install` will write internal `resolved` URLs into `package-lock.json`. CI cannot reach that host and `npm ci` fails there with the unhelpful `Exit handler never called!`. Install with `--registry=https://registry.npmjs.org` and confirm the lockfile contains only `registry.npmjs.org` URLs before committing.

---

## Documentation

Detailed implementation plans are in the [`plans/`](./plans/) directory:

**Core application**
- `framework_plan.md` — Initial SPA architecture
- `weave_v3_plan.md` — Weave 3 design system integration
- `left_nav_plan.md` — Progressive tree navigation
- `apollo_refactor_plan.md` — Apollo Client migration
- `tabbed_ui_plan.md` — Tab system design
- `navigation.md` — URL-based routing
- `user_info_plan.md` — User avatar and name in header
- `user_management.md` — Users tab with member management
- `folder_contents_plan.md` — Folder/Project contents tab
- `graphiql_and_querylog.md` — Query Editor and Query Log pages

**BOM and properties**
- `bom_plan.md` — BOM table implementation
- `thumbnail_column_plan.md` — Thumbnail column
- `physical_properties_plan.md` — Physical property columns
- `base_properties.md` — Base property columns
- `edit_base_properties.md` — Inline base property editing

**Viewer**
- `viewer.md` — APS Viewer integration
- `viewer_selection.md` — Viewer selection properties panel
- `viewer_properties_v2.md` — Vertical BOM-row rewrite of the panel
- `viewer_translation_precheck.md` — Skip translation when a viewable exists
- `clickable_hierarchy.md` — Breadcrumb selection and fit-to-view

**Search**
- `component_search.md` — Component search
- `click_expansion.md` — Tree expansion from search results

**ERP and Notes**
- `erp_mock.md` — Mock ERP integration
- `erp_admin_ui.md` — ERP admin UI
- `notes.md` — Notes tab
- `notes_composite_key.md` — Migration from `modelId` to the composite Fusion identity
- `fusion_addin.md` — Fusion add-in Notes client (sibling repo)

**Platform**
- `cache_persist.md` — Apollo cache persistence
- `image_cache.md` — Thumbnail IndexedDB cache
- `testing.md` — Vitest suite
- `make_pages_plan.md` — GitHub Pages deployment
- `use_data_management_api.md` — Data Management API for viewer URN resolution
- `mobile_plan.md` — Mobile companion app (implemented in `fusion-data-demo-mobile`)

---

## License

MIT
