# Fusion Data Demo v3

A single-page application built with Vite, React, and TypeScript that integrates with Autodesk Platform Services (APS) to explore the Manufacturing Data Model API v3.

**Live demo:** [https://tapnair.github.io/fusion-data-demo-v3](https://tapnair.github.io/fusion-data-demo-v3)

---

## Features

### Authentication
- OAuth 2.0 PKCE flow with Autodesk APS — no server required
- User avatar and name displayed in the header after login
- Token stored in `sessionStorage`; invalid/expired tokens force re-login

### Navigation
- Collapsible left-side tree that progressively loads: **Hubs → Projects → Folders/Items**
- CE Hubs Only filter (on by default) — hides hubs on older data platforms
- URL-based routing — every selected node and active tab is encoded in the URL for bookmarking and sharing
- Deep link support — paste a URL and the tree auto-expands to the correct node
- Browser back/forward navigation works across all node and tab changes

### Detail Tabs
Each selected node shows relevant tabs:

| Tab | Available for |
|---|---|
| Details | All node types |
| Users | Projects, Folders |
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
- Column visibility picker and inline precision selector

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

### View Tab (APS Viewer)
- Triggers a Model Derivative translation job for the selected design
- Polls the manifest until translation completes, then loads the model in the Autodesk LMV viewer
- Clicking a component in the 3D scene opens a **properties flyout panel** on the right that pushes (not overlays) the viewer canvas
- The flyout shows both the selected body's properties and its parent component's properties, grouped into collapsible accordion sections by category
- A "Show all" toggle reveals hidden/internal properties

### Weave 3 Design System
- 3 color schemes: **Light Gray** (default), **Dark Gray**, **Dark Blue**
- 3 density levels: **High** (compact), **Medium** (default), **Low** (comfortable)
- 9 combinations; selection persisted in `localStorage`
- Settings icon in the header opens the theme switcher
- ArtifaktElement font and 198 Weave 3 SVG icons included

---

## Prerequisites

- Node.js 20.19+ or 22.12+
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
VITE_SCOPE=data:read data:write data:search
VITE_GRAPHQL_ENDPOINT=https://developer.api.autodesk.com/mfg/v3/graphql/public
```

> **Note:** The `data:search` scope is required to fetch hub-level base property definitions. Make sure all three data scopes are present or some features will not work.

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
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run TypeScript type checking |
| `npm run deploy` | Build and deploy to GitHub Pages |

---

## Project Structure

```
fusion-data-demo-v3/
├── .github/workflows/      # GitHub Actions (auto-deploy to Pages on push to main)
├── public/
│   ├── fonts/              # ArtifaktElement font files
│   ├── icons/              # 198 Weave 3 SVG icons
│   ├── 404.html            # SPA path-forwarding shim for GitHub Pages
│   └── Tokens_w3c.json     # Weave 3 W3C design token reference
├── plans/                  # Implementation plan markdown files
├── src/
│   ├── apollo/             # Apollo Client setup (client factory, type policies, paged field utils)
│   ├── components/
│   │   ├── auth/           # ProtectedRoute, LoginButton
│   │   ├── detail/         # DetailPanel, HubDetail, ProjectDetail, FolderDetail, ItemDetail
│   │   │   └── tabs/
│   │   │       ├── bom/    # BomTab, BomColumnSettings, bomColumns (all column definitions)
│   │   │       ├── ContentsTab.tsx
│   │   │       ├── UsersTab.tsx
│   │   │       └── ViewTab.tsx
│   │   ├── layout/         # AppShell, Header, NavDrawer
│   │   ├── nav/            # NavTree, NavTreeItem
│   │   └── viewer/         # ApsViewer, ViewerPropertiesPanel
│   ├── context/            # AuthContext, NavContext
│   ├── graphql/
│   │   ├── mutations/      # baseProperties (setProperties)
│   │   └── queries/        # hubs, projects, folders, items, bom, thumbnail,
│   │                       # physicalProperties, baseProperties
│   ├── hooks/              # useHubs, useNavLoader, useBomLoader, useBomThumbnail,
│   │                       # useBomPhysicalProperties, useBomBaseProperties,
│   │                       # useHubBasePropertyDefinitions, useApsViewer,
│   │                       # useViewerSelection, useViewerTranslation,
│   │                       # useFolderContents, useNavRouting, useDeepLinkExpansion
│   ├── pages/              # Home, Dashboard, Callback, DebugPage
│   ├── services/
│   │   ├── auth/           # authService, pkceHelper, tokenManager, userInfoService
│   │   └── viewer/         # modelDerivativeService, dataManagementService, loadViewerScripts
│   ├── theme/              # Weave 3 theme factory, tokens, overrides
│   ├── types/              # TypeScript type definitions
│   └── utils/              # constants, propertyValue (coercion helper)
├── .env.example
├── .env.production         # Production env vars for GitHub Pages build
└── schema.graphql          # Manufacturing Data Model API v3 GraphQL schema
```

---

## Technologies

| Library | Version | Purpose |
|---|---|---|
| Vite | 7 | Build tool and dev server |
| React | 19 | UI library |
| TypeScript | 5 | Type safety |
| Material-UI | v7 | Component library |
| MUI X Data Grid | community | BOM and Contents tables |
| MUI X Tree View | community | Left navigation tree |
| Apollo Client | v4 | GraphQL client with `InMemoryCache` |
| React Router | 7 | Client-side routing |
| Autodesk Viewer | v7 | 3D model viewer (loaded from CDN) |
| Weave 3 | — | Autodesk design system (2200+ tokens) |

---

## Deployment

The app auto-deploys to GitHub Pages on every push to `main` via the `.github/workflows/deploy.yml` workflow. The workflow builds the app and pushes the `dist/` output to the `gh-pages` branch using the `VITE_CLIENT_ID` repository secret.

To deploy manually:

```bash
npm run deploy
```

Make sure `VITE_CLIENT_ID` is set in your environment (or in `.env.production`) before running a manual deploy.

The production APS application must have `https://tapnair.github.io/fusion-data-demo-v3/callback` registered as a valid callback URL.

---

## Documentation

Detailed implementation plans are in the [`plans/`](./plans/) directory:

- `framework_plan.md` — Initial SPA architecture
- `weave_v3_plan.md` — Weave 3 design system integration
- `left_nav_plan.md` — Progressive tree navigation
- `apollo_refactor_plan.md` — Apollo Client migration
- `tabbed_ui_plan.md` — Tab system design
- `bom_plan.md` — BOM table implementation
- `thumbnail_column_plan.md` — Thumbnail column
- `physical_properties_plan.md` — Physical property columns
- `base_properties.md` — Base property columns
- `edit_base_properties.md` — Inline base property editing
- `viewer.md` — APS Viewer integration
- `viewer_selection.md` — Viewer selection properties panel
- `folder_contents_plan.md` — Folder/Project contents tab
- `navigation.md` — URL-based routing
- `user_info_plan.md` — User avatar and name in header
- `make_pages_plan.md` — GitHub Pages deployment
- `use_data_management_api.md` — Data Management API for viewer URN resolution

---

## License

MIT
