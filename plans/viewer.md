# APS Viewer — Implementation Plan
## Fusion Data Demo v3

> **Goal:** Replace the `ViewTab` placeholder with a working APS Viewer implementation.
> When the View tab is opened for a `DesignItem` or `DrawingItem`, the app checks
> for an existing SVF2 viewable, triggers a translation job if none exists, polls
> until the derivative is ready, then loads the Autodesk Viewer with the result.

*Plan created: 2026-03-18*

---

## How It Works — End-to-End Flow

```
User selects DesignItem → clicks "View" tab
  │
  ├─ 1. Encode URN: base64url(item.id)  ← lineage URN from node.entityId
  │
  ├─ 2. GET manifest — does a translation already exist?
  │       │
  │       ├─ status: success  ──────────────────────────────┐
  │       ├─ status: inprogress → skip POST, start polling  │
  │       └─ 404 / failed → POST translation job            │
  │                           │                             │
  │       ┌───────────────────┘                             │
  │       │  Poll manifest every 5 s                        │
  │       │  status: success ───────────────────────────────┤
  │       └─ status: failed → show error                    │
  │                                                         │
  └─ 3. Load APS Viewer ◄───────────────────────────────────┘
         Autodesk.Viewing.Document.load('urn:' + base64urn)
         viewer.loadDocumentNode(doc, geometry[0])
```

---

## API Details

### URN Encoding

The `item.id` from the MFG API is a lineage URN (e.g. `urn:adsk.wipprod:dm.lineage:Wp3…`).
The Model Derivative API requires this URN **base64url-encoded** (no padding):

```ts
function encodeUrn(urn: string): string {
  return btoa(urn).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
```

### Model Derivative REST Endpoints

All calls use `Authorization: Bearer <token>`. These are **REST** (not GraphQL).

#### POST translation job
```
POST https://developer.api.autodesk.com/modelderivative/v2/designdata/job
Content-Type: application/json

{
  "input": {
    "urn": "<base64url-encoded lineage URN>"
  },
  "output": {
    "formats": [
      {
        "type": "svf2",
        "views": ["2d", "3d"]
      }
    ]
  }
}
```

Response:
- `{ "result": "success" }` — translation already exists (no new job)
- `{ "result": "created" }` — new translation job started

#### GET manifest (poll for status)
```
GET https://developer.api.autodesk.com/modelderivative/v2/designdata/{urn}/manifest
```

Key response fields:
- `status` — `"inprogress"` | `"success"` | `"failed"` | `"timeout"`
- `progress` — e.g. `"50%"` (useful for progress display)
- `derivatives[*].status` — individual derivative status

Terminal states: `"success"`, `"failed"`, `"timeout"`
Poll states: `"inprogress"`, `"pending"`

A **404** on manifest means no translation has been submitted yet.

### APS Viewer v7 — CDN Loading

The Viewer is not available on npm. It must be loaded from CDN:

```
CSS: https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css
JS:  https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js
```

CDN assets are injected dynamically at runtime. A singleton module-level
`Promise` ensures they're only injected once per page load.

### Viewer Initialization

```ts
Autodesk.Viewing.Initializer(
  {
    env: 'AutodeskProduction2',   // SVF2 environment
    api: 'streamingV2',           // SVF2 API flavor
    getAccessToken: async (onTokenReady: (token: string, expiry: number) => void) => {
      const token = await getAccessToken()  // from useAuth()
      onTokenReady(token, 3600)
    },
  },
  () => {
    const viewer = new Autodesk.Viewing.GuiViewer3D(containerRef.current)
    viewer.start()
    viewer.resize()
    // viewer ready
  }
)
```

`getAccessToken` is called by the viewer SDK whenever it needs a fresh token
(e.g. to fetch SVF2 tile data). Use `useAuth().getAccessToken` directly.

### Loading a Document

```ts
const documentId = `urn:${encodedUrn}`
Autodesk.Viewing.Document.load(documentId, (doc) => {
  const root = doc.getRoot()
  const viewables = root.search({ type: 'geometry' })
  viewer.loadDocumentNode(doc, viewables[0])  // first viewable (3D preferred)
}, (errCode, errMsg) => {
  console.error(errCode, errMsg)
})
```

---

## Architecture

```
ViewTab.tsx
  ├─ useViewerTranslation(encodedUrn, token)
  │    └─ modelDerivativeService.ts  (POST job, GET manifest)
  │
  └─ ApsViewer.tsx
       └─ useApsViewer(containerRef, encodedUrn, getAccessToken)
            └─ loadViewerScripts()  (singleton CDN inject)
```

---

## Files to Create

### `src/services/viewer/modelDerivativeService.ts`

Pure REST functions. No React, no hooks. Stateless.

```ts
const BASE_URL = 'https://developer.api.autodesk.com/modelderivative/v2/designdata'

/** base64url-encode a lineage URN for Model Derivative input */
export function encodeUrn(urn: string): string {
  return btoa(urn).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export type ManifestStatus = 'pending' | 'inprogress' | 'success' | 'failed' | 'timeout'

export interface ManifestResult {
  status: ManifestStatus
  progress: string
}

/**
 * GET manifest for the given encoded URN.
 * Returns null if 404 (no translation submitted yet).
 * Throws on unexpected HTTP errors.
 */
export async function getManifest(encodedUrn: string, token: string): Promise<ManifestResult | null>

/**
 * POST a translation job to SVF2 format (2d + 3d views).
 * Idempotent — safe to call even if a job already exists.
 */
export async function triggerTranslation(encodedUrn: string, token: string): Promise<void>
```

### `src/hooks/useViewerTranslation.ts`

Drives the translation state machine.

```ts
export type TranslationStatus =
  | 'idle'          // no urn yet
  | 'checking'      // GET manifest in flight (first check)
  | 'submitting'    // POST job in flight
  | 'polling'       // waiting for inprogress → success
  | 'ready'         // translation complete, safe to load viewer
  | 'failed'        // terminal failure

export interface ViewerTranslationState {
  status: TranslationStatus
  progress: string | null   // e.g. "50%", null when not available
  error: string | null
}

export function useViewerTranslation(
  encodedUrn: string | null
): ViewerTranslationState
```

**State machine logic:**

1. When `encodedUrn` changes: reset to `idle`, then immediately start `checking`.
2. **`checking`**: GET manifest.
   - 404 → move to `submitting`
   - `inprogress` | `pending` → move to `polling`
   - `success` → move to `ready`
   - `failed` | `timeout` → move to `failed`
3. **`submitting`**: POST translation job → move to `polling`.
4. **`polling`**: `setInterval` (5 s) calling GET manifest.
   - `success` → clear interval, move to `ready`
   - `failed` | `timeout` → clear interval, move to `failed`
   - Update `progress` on each poll while in flight.
5. **`ready`** / **`failed`**: terminal — no more polling.

When the hook unmounts, clear any active interval.

Polling continues in the background when the user switches away from the
View tab. To enable this, `ViewTab` must stay mounted even when another tab
is active. This requires a change to `DetailPanel.tsx`: the View tab panel
must always render `<ViewTab>` (when it's available for the current node), not
conditionally with `activeTab === 'view'`. The MUI `hidden` prop hides it
visually; the component remains mounted and polling continues.

### `src/hooks/useApsViewer.ts`

Manages the full `Autodesk.Viewing` lifecycle.

```ts
export function useApsViewer(
  containerRef: React.RefObject<HTMLDivElement>,
  encodedUrn: string | null,
  isReady: boolean,               // from useViewerTranslation — only load when ready
  getAccessToken: () => Promise<string>
): { viewerLoaded: boolean; viewerError: string | null }
```

**Responsibilities:**

1. On first render: call `loadViewerScripts()` to inject CDN assets.
2. Once scripts are loaded and `containerRef.current` is available:
   - Call `Autodesk.Viewing.Initializer(config, callback)` once.
   - In callback: create `GuiViewer3D`, `start()`, `resize()`.
   - Store viewer instance in a `ref` (not state — avoids re-render on create).
3. When `encodedUrn` changes and `isReady` is true: call
   `Autodesk.Viewing.Document.load(...)`.
4. On document load success: search for geometry viewables (prefer 3D for
   `DesignItem`, 2D for `DrawingItem`). Call `viewer.loadDocumentNode(...)`.
5. On `GEOMETRY_LOADED_EVENT`: apply visual tweaks (background, light preset).
6. On unmount: `viewer.finish()`, `Autodesk.Viewing.shutdown()`.

**Viewer instance storage:** Keep the viewer in a `useRef<any>` so initialization
runs only once. Do NOT store in React state — viewer initialization is
asynchronous and imperative, and storing it in state would cause double-init.

### `src/services/viewer/loadViewerScripts.ts`

Singleton that injects CDN scripts. Can be called multiple times safely.

```ts
const VIEWER_VERSION = '7.*'
const CSS_URL = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}/style.min.css`
const JS_URL  = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}/viewer3D.min.js`

let loadPromise: Promise<void> | null = null

export function loadViewerScripts(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve, reject) => {
    // 1. Inject <link rel="stylesheet" href={CSS_URL} />
    // 2. Inject <script src={JS_URL} onload=resolve onerror=reject />
  })
  return loadPromise
}
```

### `src/components/viewer/ApsViewer.tsx`

The visual component: a full-height/width `div` ref container with the viewer
rendered inside it. Receives all props from `ViewTab` — no data fetching here.

```tsx
interface ApsViewerProps {
  encodedUrn: string
  isReady: boolean
  getAccessToken: () => Promise<string>
}

export function ApsViewer({ encodedUrn, isReady, getAccessToken }: ApsViewerProps)
```

Renders:
- `<Box ref={containerRef} sx={{ height: '100%', width: '100%', position: 'relative' }} />`
- A `Backdrop` + `CircularProgress` overlay (same pattern as reference) while
  `!viewerLoaded` to mask the viewer container while geometry is loading.

---

## Files to Modify

### `src/components/detail/tabs/ViewTab.tsx`

Replace the placeholder with the full implementation. Receives `node: NavNode`.

```tsx
interface ViewTabProps {
  node: NavNode
}

export function ViewTab({ node }: ViewTabProps)
```

**Responsibilities:**
1. Derive `encodedUrn = encodeUrn(node.entityId)` (memo'd on `node.entityId`).
2. Call `useViewerTranslation(encodedUrn)` to get `{ status, progress, error }`.
3. Call `useAuth().getAccessToken`.
4. Render based on `status`:
   - `idle` | `checking` | `submitting` → loading spinner + status message
   - `polling` → spinner + "Generating viewable… {progress}" message
   - `ready` → `<ApsViewer encodedUrn={encodedUrn} isReady getAccessToken />`
   - `failed` → error message + "Retry" button (re-checks manifest first via `checking` state; only POSTs a new job if manifest is still absent/failed)

### `src/components/detail/DetailPanel.tsx`

Two changes:

1. **Always mount `ViewTab`** when it is available for the current node type, so
   polling continues in the background when the user switches away from the tab.
   Use the `hidden` prop on the panel `Box` for visual hiding rather than
   conditional rendering.

2. **Pass `node`** to `<ViewTab>`.

```tsx
// Before (unmounts on tab switch — polling stops)
<Box role="tabpanel" hidden={activeTab !== 'view'} sx={{ flex: 1, overflow: 'auto' }}>
  {activeTab === 'view' && <ViewTab />}
</Box>

// After (stays mounted — polling continues)
{availableTabs.some(t => t.key === 'view') && (
  <Box role="tabpanel" hidden={activeTab !== 'view'} sx={{ flex: 1, overflow: 'hidden' }}>
    <ViewTab node={selectedNode} />
  </Box>
)}
```

The other tab panels (details, users, bom) are unchanged — they continue to
use conditional rendering since they have no background work to maintain.

---

## Loading States & UI

| State        | UI shown                                                      |
|--------------|---------------------------------------------------------------|
| `checking`   | `CircularProgress` + "Checking for existing viewable…"       |
| `submitting` | `CircularProgress` + "Submitting translation job…"           |
| `polling`    | `CircularProgress` + "Generating viewable… {progress}"       |
| `ready`      | APS Viewer (full height/width, no overlay once model loaded) |
| `failed`     | `ErrorOutlineIcon` + error message + "Retry" button           |

All status messages use `Typography variant="body2" color="text.secondary"`.
Loading states use `CircularProgress` from MUI. All styled with theme tokens —
no hardcoded colours.

---

## TypeScript Declarations

The Autodesk Viewer SDK is not typed on npm. Declare a minimal ambient type in
`src/types/autodesk-viewer.d.ts` to avoid `any` everywhere:

```ts
declare namespace Autodesk {
  namespace Viewing {
    const GEOMETRY_LOADED_EVENT: string
    function Initializer(options: Record<string, unknown>, callback: () => void): void
    function shutdown(): void
    class GuiViewer3D {
      constructor(container: HTMLElement, config?: Record<string, unknown>)
      start(): number
      finish(): void
      resize(): void
      loadDocumentNode(doc: Document, viewable: BubbleNode, options?: Record<string, unknown>): Promise<any>
      setBackgroundColor(r: number, g: number, b: number, r2: number, g2: number, b2: number): void
      setLightPreset(preset: number): void
      addEventListener(event: string, callback: () => void): void
      model: any
    }
    class Document {
      static load(urn: string, onSuccess: (doc: Document) => void, onFailure: (code: number, msg: string) => void): void
      getRoot(): BubbleNode
    }
    class BubbleNode {
      search(criteria: Record<string, unknown>): BubbleNode[]
    }
  }
}
```

---

## Weave 3 Styling

- All overlay/status UI uses MUI components with theme tokens.
- The viewer container (`div`) itself is unstyled beyond `height: 100%` /
  `width: 100%` — the APS Viewer manages its own internal styling via its CSS.
- The viewer CSS is injected via CDN; no CSS-in-JS conflicts expected.
- `Backdrop` uses `position: 'absolute'` so it overlays only the viewer
  container, not the whole page (matches reference implementation).
- No density-based adjustments needed — the viewer is a fixed chrome UI.

---

## Key Differences from Reference Implementation

| Aspect | Reference (`useForgeViewer`) | This plan |
|---|---|---|
| Data fetching | `react-query` | Direct `fetch` in service + custom hook |
| Token | Custom `getToken` utility | `useAuth().getAccessToken` |
| State management | Multiple `useState` | Single `status` state machine |
| Polling | `react-query` retry | `setInterval` in `useViewerTranslation` |
| Env context | `forgeEnvContext` | Hard-coded to production |
| Viewer storage | `useState` (causes double-init risk) | `useRef` (single init) |
| Node selection | `appStateContext` | `NavNode` prop |
| Script loading | Pre-loaded in HTML | Dynamic CDN injection on first mount |

---

## New Files Summary

```
src/
├── services/viewer/
│   ├── modelDerivativeService.ts    NEW — POST job, GET manifest, encodeUrn
│   └── loadViewerScripts.ts         NEW — singleton CDN script injector
├── hooks/
│   ├── useViewerTranslation.ts      NEW — translation state machine + polling
│   └── useApsViewer.ts              NEW — Autodesk.Viewing lifecycle
├── components/viewer/
│   └── ApsViewer.tsx                NEW — viewer container + loading overlay
└── types/
    └── autodesk-viewer.d.ts         NEW — ambient types for Autodesk.Viewing
```

## Modified Files Summary

```
src/components/detail/tabs/ViewTab.tsx      — replace placeholder
src/components/detail/DetailPanel.tsx       — pass node prop to ViewTab
```

No new npm packages required. No changes to `.env` or Apollo config.
The `data:read` scope already in `VITE_SCOPE` is sufficient for the
Model Derivative API.

---

## Implementation Phases

### Phase 1 — Service layer
Create `modelDerivativeService.ts` (`encodeUrn`, `getManifest`,
`triggerTranslation`) and `loadViewerScripts.ts`.

### Phase 2 — Translation hook
Create `useViewerTranslation.ts` with the full state machine and polling.

### Phase 3 — Viewer hook
Create `useApsViewer.ts` managing script loading, initializer, document load.
Create `autodesk-viewer.d.ts` ambient type declarations.

### Phase 4 — ApsViewer component
Create `ApsViewer.tsx` with the container ref and loading backdrop.

### Phase 5 — ViewTab + DetailPanel wiring
Rewrite `ViewTab.tsx` to use hooks and render states.
Update `DetailPanel.tsx` to pass `node` prop.

### Phase 6 — Verify
- DesignItem: open View tab → spinner while generating → viewer loads 3D model
- DrawingItem: open View tab → viewer loads 2D view
- Already-translated item: manifest hit → viewer loads instantly (no POST)
- In-progress translation: polling shows progress %, eventually loads
- Failed translation: error state + retry button re-triggers correctly
- Switch items while viewer is open: viewer unloads old model, loads new
- Switch away from View tab then back: viewer still loaded, no re-init
- Token expiry: viewer `getAccessToken` callback fetches fresh token

---

## Notes & Decisions

| Topic | Decision |
|---|---|
| SVF2 vs SVF | SVF2 (`streamingV2` env) — current Autodesk default, better performance |
| Views requested | `["2d", "3d"]` — viewer selects geometry automatically |
| Poll interval | 5 s — fast enough for interactive UX, not spammy |
| Polling persistence | Continues while `ViewTab` is hidden — `ViewTab` stays always-mounted when view tab is available; other tabs still use conditional rendering |
| Viewable selection | Auto-load first `geometry` viewable — no picker UI |
| Viewer re-init on item change | Unload model only — `GuiViewer3D` instance reused; `Autodesk.Viewing.Initializer` called once per page load |
| Retry on failure | Re-check manifest first (`checking` state); POST new job only if manifest is still absent/failed |
| DrawingItem view preference | Load first `geometry` viewable (2D drawing) |
| DesignItem view preference | Load first `geometry` viewable (3D model) |

---

*Last updated: 2026-03-18*
