# ERP Admin UI

*Plan created: 2026-05-29*

## Goal

Build a small standalone UI that displays and edits the mock ERP data, co-deployed with the existing `fusion-erp-api` Vercel project. Lives at `https://fusion-erp-api.vercel.app/`. Distinct from the main Fusion Data Demo SPA — no Autodesk auth, no shared theme — so it looks and feels like a separate "ERP system" being mocked.

## Decisions (from Q&A)

| Topic | Decision |
|---|---|
| Repo / hosting | **Existing `fusion-erp-api` Vercel project.** Add a Vite SPA at the root; Vercel auto-detects and deploys static + functions together. |
| Endpoint auth | **No auth on the new admin endpoints.** The existing `/api/material/byModelId` keeps its APS-Bearer-token gate so the main Fusion SPA continues to work unchanged. |
| Edit scope | **Read + full record edit.** Any field except `modelId` (immutable key) and `lastUpdated` (server-managed). |
| Visual style | MUI with a distinct theme — gray app bar, dense tables, monospace for codes — so it visually reads as a different system from the main Fusion SPA. |

## Architecture

```
fusion-erp-api/  (existing repo, Vercel project)
│
├── vite.config.ts        ← NEW
├── index.html            ← NEW
├── package.json          ← UPDATED (vite/react/mui/router added)
├── tsconfig.json         ← UPDATED
├── vercel.json           ← UPDATED if needed
│
├── api/                  ← existing
│   ├── material/
│   │   └── byModelId.ts  ← UNCHANGED (APS-gated; used by Fusion SPA)
│   └── materials/        ← NEW (admin endpoints, no auth)
│       ├── index.ts      ← GET list + filter + paginate
│       └── [modelId].ts  ← GET single, PATCH update
│
└── src/                  ← NEW Vite app
    ├── main.tsx
    ├── App.tsx
    ├── theme.ts
    ├── types.ts          (re-uses ErpMaterial shape)
    ├── api/
    │   └── client.ts     (fetch wrappers, typed)
    ├── routes/
    │   ├── ListPage.tsx
    │   └── DetailPage.tsx
    └── components/
        ├── FieldRow.tsx      (reusable label + value + inline-edit)
        ├── FilterBar.tsx
        └── EmptyState.tsx
```

### Two URL surfaces, one Vercel project

| URL | Served by | Used by |
|---|---|---|
| `https://fusion-erp-api.vercel.app/` | Vite static build | The new admin UI (this plan) |
| `https://fusion-erp-api.vercel.app/api/material/byModelId` | Existing function | Main Fusion SPA's ERP tab — unchanged |
| `https://fusion-erp-api.vercel.app/api/materials` | New function | New admin UI list view |
| `https://fusion-erp-api.vercel.app/api/materials/<modelId>` | New function | New admin UI detail view |

No CORS concerns: the admin UI calls relative paths (`/api/materials`) → same origin.

### Mongo credentials

Currently Vercel has `MONGODB_URI` set to the `erp_reader` read-only user. Admin endpoints need write access. Choices:

- **Option A: replace the env var with the `erp_seeder` (readWrite) URI.** All endpoints now run with readWrite credentials; we restrict writes at the code level (only the admin endpoints expose mutation paths).
- **Option B: keep `MONGODB_URI` as the reader URI; add a second `MONGODB_URI_RW`.** Admin endpoints use the new URI; by-modelId keeps the read-only one. Principle of least privilege.

**Decision: Option A** for demo simplicity. The data is fake; the by-modelId function exposes no write paths in code. If this were real prod, Option B would be the call.

---

## Phases

### Phase 1 — Scaffold Vite + MUI inside `fusion-erp-api/`

Add files at the repo root:

- `vite.config.ts` — standard Vite React-TS config. No `base` (deployed at root).
- `index.html` — minimal: title "ERP Material Master", `<div id="root">`, `<script type="module" src="/src/main.tsx">`.
- `tsconfig.json` — split into `tsconfig.json` (project references), `tsconfig.app.json` (for `src/`), `tsconfig.node.json` (for `api/` + `vite.config.ts`).
- `package.json` — add devDeps (`vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`), deps (`react`, `react-dom`, `react-router-dom`, `@mui/material`, `@mui/icons-material`, `@mui/x-data-grid`, `@emotion/react`, `@emotion/styled`).
- Add `build` and `dev` scripts: `"dev": "vite", "build": "tsc -b && vite build", "preview": "vite preview"`.

Verify locally: `npm install && npm run dev` — Vite serves on http://localhost:5173 with a placeholder home page.

Verify Vercel: push, deploy succeeds, root URL serves the SPA, `/api/material/byModelId` still works.

---

### Phase 2 — New backend endpoints

#### 2.1 Shared types

Pull the `ErpMaterial` shape into `src/types.ts` (and re-export from `api/_shared/types.ts` so both client + server share it).

#### 2.2 `api/materials/index.ts` — list

`GET /api/materials`

Query params:
| Name | Type | Default | Notes |
|---|---|---|---|
| `q` | string | — | Case-insensitive regex match on `matnr`, `maktx`, `vendor.name` |
| `werks` | string | — | Exact match |
| `mtart` | `FERT` \| `HALB` \| `ROH` | — | Exact match |
| `mmsta` | `ACTIVE` \| `BLOCKED` \| `OBSOLETE` | — | Exact match |
| `beskz` | `E` \| `F` | — | Exact match |
| `sort` | string | `-lastUpdated` | Prefix `-` for desc, otherwise asc. Whitelisted fields: matnr, maktx, lastUpdated, bestand, stprs. |
| `limit` | number | 50 | Max 200 |
| `offset` | number | 0 | |

Response:
```ts
{ results: ErpMaterial[], total: number, limit: number, offset: number }
```

No auth header required. Reads from `materials` collection.

#### 2.3 `api/materials/[modelId].ts` — get + update

`GET /api/materials/<modelId>` → returns single doc (or 404).

`PATCH /api/materials/<modelId>` → updates a subset of fields.
- Body: JSON object with any subset of editable fields.
- **Not editable:** `modelId` (immutable), `lastUpdated` (auto-managed).
- **Server validates:** types match schema, enums in their value sets, numeric fields ≥ 0.
- **On success:** sets `lastUpdated = new Date().toISOString()`, returns the full updated doc.
- **On validation error:** 400 with `{ error, fieldErrors: { fieldName: 'reason' } }`.

#### 2.4 Shared MongoDB client

`api/_lib/mongo.ts` — module-scoped client cache. Both new endpoints + the existing by-modelId import this so we don't keep duplicating the `cachedClient` pattern.

#### 2.5 Verify each endpoint with curl

```bash
# List, search, filter
curl 'https://fusion-erp-api.vercel.app/api/materials?q=bottom&mtart=FERT&limit=10'

# Get
curl 'https://fusion-erp-api.vercel.app/api/materials/<modelId>'

# Patch
curl -X PATCH -H 'Content-Type: application/json' \
  -d '{"bestand": 999, "maktx": "UPDATED VIA CURL"}' \
  'https://fusion-erp-api.vercel.app/api/materials/<modelId>'

# Bad patch → 400
curl -X PATCH -H 'Content-Type: application/json' \
  -d '{"mtart": "NOT_AN_ENUM"}' \
  'https://fusion-erp-api.vercel.app/api/materials/<modelId>'
```

---

### Phase 3 — Frontend: routing + theme

`src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
…
<BrowserRouter>
  <Routes>
    <Route path="/" element={<ListPage />} />
    <Route path="/materials/:modelId" element={<DetailPage />} />
  </Routes>
</BrowserRouter>
```

`src/theme.ts` — MUI theme. Distinct from the main Fusion SPA:
- Primary: gray-blue (`#3a4a5a`) — feels "enterprise".
- Background: light gray for the app bar so it doesn't compete with content.
- Typography: Roboto for headings, JetBrains Mono / monospace for SAP-like codes (MATNR, LIFNR).
- Density: compact tables, dense forms.

App shell: `<AppBar>` with title "ERP Material Master" + a subtle "Mock System — Fusion Demo" subtitle, `<Container maxWidth="xl">` for page content.

---

### Phase 4 — List view

`src/routes/ListPage.tsx`.

Layout:
```
┌────────────────────────────────────────────────────────┐
│ ERP Material Master                                    │
│ Mock System — Fusion Demo                              │
├────────────────────────────────────────────────────────┤
│ [Search box]  [Plant ▾] [Type ▾] [Status ▾] [Proc ▾]  │
│                                              N records │
├────────────────────────────────────────────────────────┤
│ MATNR     │ Description          │ Type │ Plant │ ... │
│ 7601025   │ CONTROLS BOTTOM PIECE│ FERT │ PL01  │ ... │
│ ...                                                    │
│                                                        │
│           [Prev]  Page 1 of 3  [Next]                 │
└────────────────────────────────────────────────────────┘
```

Components:
- `FilterBar` — search input (debounced 300ms) + 4 dropdowns. Selected values reflected in URL query string so the page is shareable / refreshable.
- MUI `DataGrid` (we already have `@mui/x-data-grid` in the main SPA stack, low add cost): columns MATNR, MAKTX (Description), MTART (Material Type), WERKS (Plant), MMSTA, STPRS+WAERS, BESTAND, vendor.name, lastUpdated.
- Row click → `navigate(/materials/<modelId>)`.
- Server-side pagination via the `limit`/`offset` query params.
- Default sort: `lastUpdated` desc; column header click changes sort.

Empty state: "No materials match those filters." with a button to clear filters.

Error state: small Alert at the top of the page.

---

### Phase 5 — Detail view + edit form

`src/routes/DetailPage.tsx`.

Layout:
```
┌────────────────────────────────────────────────────────┐
│ ← All materials                                        │
│ MATNR 7601025 — CONTROLS BOTTOM PIECE                  │
├────────────────────────────────────────────────────────┤
│ MATERIAL MASTER                                        │
│   Material No.   [7601025          ]  (read-only key)  │
│   Description    [CONTROLS BOTTOM …]  ✎                │
│   Material Type  [FERT ▾]            ✎                 │
│   Base UoM       [EA ▾]              ✎                 │
│                                                        │
│ PLANT / MRP                                            │
│   Plant          [PL01]              ✎                 │
│   …                                                    │
│                                                        │
│ PROCUREMENT                                            │
│   …                                                    │
│                                                        │
│ INVENTORY                                              │
│   Stock on Hand  [142]               ✎                 │
│                                                        │
│ VENDOR                                                 │
│   LIFNR          [V100023]           ✎                 │
│   Vendor Name    [Acme Components]   ✎                 │
│                                                        │
│ META                                                   │
│   Model ID       [bW9kZWx-…]         (read-only)       │
│   Last Updated   2026-05-29 17:30    (server-managed)  │
│                                                        │
│  [Save changes]   [Discard]                            │
└────────────────────────────────────────────────────────┘
```

`FieldRow` component — label, current value, editor type. Editor types:
- `text` — `<TextField>`
- `number` — `<TextField type="number">`
- `enum` — `<Select>` populated from the type's union literals
- `readonly` — plain text, no edit affordance

State: local form copy of the material's fields, mutated on edit. "Save changes" enabled only when form differs from server state.

Save: PATCH with the diff (only changed fields). On success, replace local state with server response. On 400 with `fieldErrors`, show inline errors per field. On other error, snackbar.

Discard: reset local form to server state.

Validation: client-side mirror of the server's schema — block invalid enums, numeric < 0, empty required fields.

Beskz set to 'E' → hide the vendor section (server keeps it `null`).
Beskz set to 'F' → show vendor section.

---

### Phase 6 — Polish

- Skeleton loaders on initial fetch.
- Toast snackbar via MUI `<Snackbar>` for save success / errors.
- Keyboard: Cmd+S / Ctrl+S to save when there are unsaved changes.
- Browser tab title reflects the current MATNR on the detail page.
- Subtle "Last saved 5 seconds ago" indicator.

---

### Phase 7 — README + Vercel env update

#### README

Update `fusion-erp-api/README.md`:
- Top section: "ERP Material Master — Mock SAP system for Fusion Data Demo"
- How to run locally (`npm install && npm run dev`).
- How endpoints are structured (existing by-modelId for the Fusion SPA + new admin endpoints).
- Note: the by-modelId endpoint remains APS-gated; admin endpoints are unauthenticated.

#### Vercel env

Replace the `MONGODB_URI` Vercel env var value with the `erp_seeder` (readWrite) connection string. Existing read-only user can remain in Atlas as a fallback but is no longer used.

Or, if you'd rather keep least-privilege:
- Keep `MONGODB_URI` as `erp_reader`.
- Add `MONGODB_URI_RW` as `erp_seeder`.
- Admin endpoints in `api/materials/*` use `MONGODB_URI_RW`; by-modelId uses `MONGODB_URI`.

(See Architecture → Mongo credentials above.)

---

## Files

### New
- `fusion-erp-api/vite.config.ts`
- `fusion-erp-api/index.html`
- `fusion-erp-api/tsconfig.app.json`
- `fusion-erp-api/tsconfig.node.json`
- `fusion-erp-api/api/materials/index.ts`
- `fusion-erp-api/api/materials/[modelId].ts`
- `fusion-erp-api/api/_lib/mongo.ts`
- `fusion-erp-api/api/_shared/types.ts`
- `fusion-erp-api/src/main.tsx`
- `fusion-erp-api/src/App.tsx`
- `fusion-erp-api/src/theme.ts`
- `fusion-erp-api/src/types.ts`
- `fusion-erp-api/src/api/client.ts`
- `fusion-erp-api/src/routes/ListPage.tsx`
- `fusion-erp-api/src/routes/DetailPage.tsx`
- `fusion-erp-api/src/components/FieldRow.tsx`
- `fusion-erp-api/src/components/FilterBar.tsx`
- `fusion-erp-api/src/components/EmptyState.tsx`

### Modified
- `fusion-erp-api/package.json` (deps + scripts)
- `fusion-erp-api/tsconfig.json` (project references)
- `fusion-erp-api/vercel.json` (maxDuration for new functions; framework detection)
- `fusion-erp-api/README.md`
- `fusion-erp-api/api/material/byModelId.ts` (only if we extract the Mongo client to `_lib`)

### Untouched
- The main `fusion-data-demo-v3` repo (this is purely additive in the sibling repo).
- The existing `/api/material/byModelId` endpoint behavior (still APS-gated).
- The `erp_reader` Atlas user (kept as a fallback).

---

## Risk / open items

| Risk | Mitigation |
|---|---|
| Vercel might not auto-detect Vite alongside `api/`. | If detection fails, set `framework: "vite"` explicitly in `vercel.json`. |
| No-auth admin endpoints publicly writable. | Acceptable for a demo with fake data; re-seeding is one command. Could add Basic Auth later via `vercel.json` headers if needed. |
| Vercel hobby tier function quotas. | List endpoint reads up to 200 docs, fast. PATCH is rare (manual edits). Easily within free-tier limits. |
| `[modelId]` route file may have URL-decoding gotchas (base64 with `=` padding etc). | Our modelIds are base64url-style (no `=` padding) — confirmed by inspection. Belt-and-suspenders: server URL-decodes once. |
| Editing `modelId` (read-only) being skipped by client but accepted by server. | Server PATCH explicitly strips `modelId` and `lastUpdated` from the input before constructing the `$set`. |

## Non-goals (v1)

- Bulk operations (multi-select, bulk edit, bulk delete).
- Audit log / change history.
- User accounts (every visitor is "the admin").
- File uploads (e.g. attaching a vendor PDF).
- Charts / dashboards.
- Real-time updates / SSE.
- A "create new material" form. (The seed script is the source of truth; manually-created materials would get orphaned because their modelId wouldn't match any Fusion model.)
- Delete (could be added; deferred — re-seeding is the easier recovery path).

---

*Last updated: 2026-05-29*
