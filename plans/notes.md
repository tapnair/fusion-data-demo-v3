# Notes Feature

*Plan created: 2026-06-01*

## Goal

Add a third "Notes" tab to the viewer properties panel. Notes attach to a specific component (by `modelId`) and also store the root assembly's modelId. The Notes tab lists notes for the current component, or — when nothing is selected — all notes in the current assembly. New notes can be added inline; existing notes can be edited or deleted.

To make "nothing selected" a first-class state, the panel now also falls back to showing the **root assembly's** data in the Properties and ERP tabs (instead of being empty). This unifies the panel: there is always a current entity — either the picked component or the root assembly.

A future standalone client will be built against the same API later.

## Decisions (from Q&A)

| Topic | Decision |
|---|---|
| Panel visibility when nothing selected | **Panel always visible on View tab.** With nothing selected, the *current entity* is the root assembly: Properties and ERP tabs render the root's data; Notes tab lists all notes for the assembly. |
| Operations in v1 | **Create + delete + edit.** Inline edit per note, trash icon per note, inline add form at the top. |
| Note fields | **Body + author + timestamps**, plus links. Full shape in §3.1. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Fusion SPA (this repo)                                         │
│                                                                  │
│   ViewTab                                                        │
│     └─ ApsViewer                                                 │
│          ├─ useViewerSelection  (now also computes rootSelection)│
│          ├─ ViewerPropertiesPanel  (now always-visible on View)  │
│          │     ├─ Properties tab  (effective entity = sel ?? root)│
│          │     ├─ ERP tab         (effective entity = sel ?? root)│
│          │     └─ Notes tab  (NEW)                               │
│          └─ Viewer canvas                                        │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  fusion-erp-api (Vercel)                                        │
│                                                                  │
│   /api/material/byModelId   (existing, APS-gated)               │
│   /api/materials/*          (existing, admin UI)                │
│   /api/notes                (NEW: GET list, POST create)        │
│   /api/notes/[id]           (NEW: PATCH edit, DELETE remove)    │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Mongo driver
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  MongoDB Atlas — db `fusion_erp_demo`                           │
│                                                                  │
│   materials   (existing)                                         │
│   notes       (NEW)                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Root modelId — where does it come from?

The viewer instance tree carries it. The root component's properties include `modelId` — the same attribute we already extract from selected components.

Mechanism: when the viewer emits `GEOMETRY_LOADED_EVENT`, walk to `tree.getRootId()`, call `viewer.getProperties(rootDbId)`, and extract the root's `modelId`. Stash it in the hook's state. No extra GraphQL roundtrip needed.

### "Effective entity" abstraction

The hook returns two things:
- `selection` — the user's current pick (null when nothing is selected).
- `rootSelection` — a synthesized "selection-shape" object pointing at the root assembly (null until geometry loads).

Panel reads `effective = selection ?? rootSelection`. Both have the same shape; the panel doesn't need to special-case. The breadcrumb for the synthetic root is a single bold entry — clicking it doesn't fire a re-select (it's already the implicit default).

When the user clicks something in the viewer, `selection` becomes real and the panel naturally swaps to it. Clicking blank space clears selection → panel re-renders against `rootSelection`.

---

## Phase 0 — Atlas + Vercel setup

You do these in the Atlas UI before any code runs.

### 0.1 Create the `notes` collection

1. Atlas → cluster `tapnair-cluster` → **Browse Collections**
2. Inside `fusion_erp_demo`, click **+ Create Collection**
3. Name: `notes`
4. Click **Create**

### 0.2 Create two indexes

In the `notes` collection's **Indexes** tab:

**Index 1** — component lookups:
- Fields: `{ "componentModelId": 1, "createdAt": -1 }`
- No special options.

**Index 2** — assembly-wide lookups:
- Fields: `{ "rootModelId": 1, "createdAt": -1 }`
- No special options.

(No unique constraint — multiple notes per component is expected.)

### 0.3 Mongo user — nothing new

`erp_seeder` already has `readWrite` on `fusion_erp_demo`. Vercel's `MONGODB_URI` already uses those credentials. No new user or env var needed.

### 0.4 Vercel env — nothing new

`MONGODB_URI`, `MONGODB_DB`, `MONGODB_COLLECTION` are already set. The `notes` collection name is hard-coded in the new function code (different from `materials`); no env var to add.

That's it for setup. ~3 minutes in the Atlas UI.

---

## Phase 1 — Backend (in `fusion-erp-api`)

### 1.1 Shared types

Append to `api/_shared/types.ts`:

```ts
export interface Note {
  id: string               // hex string of Mongo _id, exposed to clients
  componentModelId: string
  rootModelId: string
  componentName: string    // denormalized — what to show in the list
  body: string             // multi-line text, can be empty
  author: string           // free-form, e.g. APS user full name, or "Unknown"
  createdAt: string        // ISO 8601
  updatedAt: string        // ISO 8601
}

export interface NotesListResponse { results: Note[]; total: number }
```

### 1.2 Mongo helper

Extend `api/_lib/mongo.ts` with:

```ts
export async function getNotesCollection(): Promise<Collection<Note>>
```

Same pattern as `getMaterialsCollection` — same client cache, just a different collection name.

### 1.3 `api/notes/index.ts` — GET list, POST create

`GET /api/notes`:
- Required: exactly one of `componentModelId` OR `rootModelId` in the query string. Both is allowed (componentModelId wins). Neither → 400.
- Sort: `createdAt` desc.
- Limit: 200 (cap; demo doesn't need pagination).
- Returns `{ results: Note[], total: number }`. Strips `_id`, exposes `id` (hex).
- CORS: `*`.

`POST /api/notes`:
- Body JSON: `{ componentModelId, rootModelId, componentName, body, author }`.
- Validation: all strings, all required (except `body` may be empty), `componentModelId` and `rootModelId` non-empty.
- Server sets `createdAt = updatedAt = new Date().toISOString()`.
- Inserts. Returns the full Note.

### 1.4 `api/notes/[id].ts` — PATCH edit, DELETE remove

Route param: `id` (hex string of ObjectId).

`PATCH`:
- Body: `{ body?: string }`. Only `body` is mutable; all other fields immutable.
- Server sets `updatedAt = now`.
- Returns the full updated Note (or 404).

`DELETE`:
- Deletes the doc by `_id`.
- Returns `204 No Content` on success, `404` if missing.

### 1.5 Verify

```bash
# list-by-component
curl 'https://fusion-erp-api.vercel.app/api/notes?componentModelId=<modelId>'

# list-by-assembly
curl 'https://fusion-erp-api.vercel.app/api/notes?rootModelId=<rootModelId>'

# create
curl -X POST -H 'Content-Type: application/json' \
  -d '{"componentModelId":"X","rootModelId":"Y","componentName":"Test","body":"hello","author":"Patrick"}' \
  'https://fusion-erp-api.vercel.app/api/notes'

# edit
curl -X PATCH -H 'Content-Type: application/json' \
  -d '{"body":"updated"}' \
  'https://fusion-erp-api.vercel.app/api/notes/<id>'

# delete
curl -X DELETE 'https://fusion-erp-api.vercel.app/api/notes/<id>'
```

---

## Phase 2 — Frontend: viewer selection + root selection

In `fusion-data-demo-v3/src/hooks/useViewerSelection.ts`:

### 2.1 Add `rootSelection`

Returned shape becomes:
```ts
{
  selection: ViewerSelection | null
  rootSelection: ViewerSelection | null
  selectByDbId: (dbId: number) => void
}
```

### 2.2 Compute `rootSelection` on geometry load

Listen for `Autodesk.Viewing.GEOMETRY_LOADED_EVENT` in addition to `SELECTION_CHANGED_EVENT`. On geometry-loaded:

```ts
const data = viewer.model?.getData()
if (!data?.instanceTree) return
const rootDbId = data.instanceTree.getRootId()
viewer.getProperties(rootDbId, (result) => {
  const componentProperties = mapProps(result.properties)
  setRootSelection({
    componentDbId: rootDbId,
    componentName: result.name ?? '',
    componentProperties,
    modelId: extractModelId(componentProperties),
    body: null,
    hierarchyPath: [{ dbId: rootDbId, name: result.name ?? '' }],
  })
})
```

`rootSelection` is a `ViewerSelection` (same shape). The panel treats it identically to a real selection.

### 2.3 Reset on viewer change

Reset both `selection` and `rootSelection` to null when `viewerInitialized` flips back to false (the cleanup function).

### 2.4 Tests

Extend `useViewerSelection.test.tsx` with two new tests:
- After `GEOMETRY_LOADED_EVENT` fires, `rootSelection` is populated with the root node's data.
- `selection` is still independent (still null until a pick happens).

---

## Phase 3 — Panel: always visible, third tab

### 3.1 `ApsViewer.tsx`

Today: `width: selection ? 380 : 0`. Change to: panel is always 380 wide while the View tab is mounted (the View tab unmount removes it anyway). Remove the slide transition since visibility no longer changes.

Pass the new `rootSelection` to the panel.

### 3.2 `ViewerPropertiesPanel.tsx`

New prop: `rootSelection: ViewerSelection | null`.

Compute the effective entity:
```ts
const effective = selection ?? rootSelection
```

If `effective === null` (geometry hasn't loaded yet), render a centered spinner placeholder.

Otherwise, all existing code that referenced `selection` should now reference `effective`. Properties tab and ERP tab automatically work — they receive `effective.modelId`.

### 3.3 Tab strip — add Notes

```tsx
<Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
  <Tab label="Properties" value="properties" />
  <Tab label="ERP" value="erp" />
  <Tab label="Notes" value="notes" />
</Tabs>
```

`tab` state still resets to `'properties'` when `effective.componentDbId` changes (same effect, broader trigger).

### 3.4 Header + breadcrumb when on the synthetic root

When `effective === rootSelection`:
- Header shows `effective.componentName` (the root model's name, e.g. "Espresso Machine v1").
- Breadcrumb shows a single bold non-clickable entry (the root). Already handled by current breadcrumb logic since `hierarchyPath` has length 1 and last segment is always bold.
- Show-hidden eye toggle: same rule as today — show when any raw-property accordion is visible.

---

## Phase 4 — Frontend: Notes tab + service + hook

### 4.1 `src/services/notes/notesClient.ts`

```ts
export interface Note { /* same as backend */ }

export async function listNotesByComponent(componentModelId: string): Promise<Note[]>
export async function listNotesByAssembly(rootModelId: string): Promise<Note[]>
export async function createNote(input: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note>
export async function updateNote(id: string, patch: Pick<Note, 'body'>): Promise<Note>
export async function deleteNote(id: string): Promise<void>
```

Pure-fetch module. Reads `VITE_NOTES_ENDPOINT_BASE` env var (e.g. `https://fusion-erp-api.vercel.app/api/notes`). Add the var to `.env.production` (committed; not secret) and `.env.local`.

### 4.2 `src/hooks/useNotes.ts`

```ts
export function useNotes(args:
  | { mode: 'component'; componentModelId: string }
  | { mode: 'assembly'; rootModelId: string }
): {
  notes: Note[]
  loading: boolean
  error: string | null
  refetch: () => void
  create: (body: string) => Promise<void>
  update: (id: string, body: string) => Promise<void>
  remove: (id: string) => Promise<void>
}
```

Internally:
- `useEffect` keyed on the args' identifiers triggers a fetch via the appropriate client function.
- `create`, `update`, `remove` perform their mutations then trigger `refetch` so the list stays in sync. (Optimistic updates are a stretch goal; refetch-after-mutation is simple and sufficient.)
- AbortController for in-flight cancellation on arg change.

### 4.3 `src/components/viewer/NotesTab.tsx`

Props:
```ts
interface NotesTabProps {
  effective: ViewerSelection
  rootSelection: ViewerSelection
  author: string  // current user's display name, or "Unknown"
}
```

Determines scope from props:
```ts
const isAssemblyScope = effective.componentDbId === rootSelection.componentDbId
const componentModelId = effective.modelId
const componentName = effective.componentName
const rootModelId = rootSelection.modelId
```

Header line at the top:
```
On: <componentName>            (when component-scope)
All notes in <rootName>        (when assembly-scope)
```

Below that, an inline **add form**: a multi-line `<TextField>` plus an "Add note" button. On submit: call `useNotes.create(body)`, clear the field. Disabled when the body is whitespace-only or no `modelId` is available.

Below the form, the **notes list**: each note shows
```
┌──────────────────────────────────────────┐
│ <author> • <relative time>      [✎] [🗑] │
│ <body, multi-line>                       │
│ On: <componentName> (assembly-scope only)│
└──────────────────────────────────────────┘
```

- Click the ✎ pencil → inline edit using `EditableTextCell`-like pattern (or a dedicated small textarea editor). On commit → `useNotes.update`.
- Click the 🗑 → confirm dialog (MUI `Dialog` or `Confirm`) → `useNotes.remove`.
- Relative time via `Intl.RelativeTimeFormat` or a small `formatTimeAgo` helper.

Loading state: spinner. Empty state: "No notes yet" with arrow pointing to the add form. Error state: small Alert.

### 4.4 Wire into `ViewerPropertiesPanel.tsx`

```tsx
{tab === 'notes' && effective && rootSelection && (
  <NotesTab
    effective={effective}
    rootSelection={rootSelection}
    author={user?.name ?? 'Unknown'}
  />
)}
```

`user` comes from `useAuth()`.

### 4.5 Env wiring

Add to `.env.local` and `.env.production`:
```
VITE_NOTES_ENDPOINT_BASE=https://fusion-erp-api.vercel.app/api/notes
```

And `.env.example` with a placeholder.

(We could re-derive this from `VITE_ERP_ENDPOINT_URL` by string-replacing `/api/material/byModelId` → `/api/notes`, but a dedicated env var is cleaner.)

---

## Phase 5 — Tests

Modest scope — match the depth of the ERP tab tests.

| File | Tests |
|---|---|
| `useViewerSelection.test.tsx` | Add: rootSelection populated on GEOMETRY_LOADED_EVENT; survives selection toggles. |
| `useNotes.test.tsx` | NEW. Loading → success in component mode. Loading → success in assembly mode. Create triggers refetch. Update triggers refetch. Remove triggers refetch. Error path. |
| `NotesTab.test.tsx` | NEW. Component vs assembly header text. Empty state. Add form disabled when body empty. Edit pencil opens editor. Delete shows confirm. Author propagated to created note. |
| `notesClient.test.ts` | NEW. URL composition for each method. 404 / 400 / 500 handling. Bad env var. |

---

## Files

### New (`fusion-erp-api`)
- `api/notes/index.ts`
- `api/notes/[id].ts`

### New (`fusion-data-demo-v3`)
- `src/services/notes/notesClient.ts`
- `src/services/notes/notesClient.test.ts`
- `src/hooks/useNotes.ts`
- `src/hooks/useNotes.test.tsx`
- `src/components/viewer/NotesTab.tsx`
- `src/components/viewer/NotesTab.test.tsx`

### Modified (`fusion-erp-api`)
- `api/_shared/types.ts` (add Note, NotesListResponse)
- `api/_lib/mongo.ts` (add getNotesCollection)
- `vercel.json` (add maxDuration entries for the new functions)
- `README.md` (document the new endpoints)

### Modified (`fusion-data-demo-v3`)
- `src/hooks/useViewerSelection.ts` (compute rootSelection)
- `src/hooks/useViewerSelection.test.tsx` (new cases)
- `src/components/viewer/ApsViewer.tsx` (panel always visible; pass rootSelection)
- `src/components/viewer/ViewerPropertiesPanel.tsx` (effective = selection ?? rootSelection; add Notes tab)
- `src/types/viewerSelection.types.ts` (no changes — rootSelection reuses ViewerSelection shape)
- `.env.example` / `.env.production` / `.env.local` (add VITE_NOTES_ENDPOINT_BASE)

### Untouched (intentional)
- `src/components/viewer/ErpTab.tsx` — automatically picks up effective.modelId.
- `src/components/viewer/{useViewerComponent.ts, useComponentMutations.ts}` etc. — same.
- The existing admin UI in `fusion-erp-api` — completely orthogonal.

---

## Risk / open items

| Risk | Mitigation |
|---|---|
| Root component has no `modelId` attribute (some Fusion exports) | `rootSelection.modelId` becomes null; Notes tab shows an empty state ("Open an assembly to see notes"). Properties and ERP tabs already handle null modelId via the fallback banner. |
| Multiple notes per component growing large | Cap list response at 200; if it becomes a problem, add cursor pagination later. |
| Race: viewer fires GEOMETRY_LOADED before SELECTION_CHANGED for a deep-link | Both event handlers update separate state pieces (`rootSelection` vs `selection`); order-independent. |
| `componentName` denormalization goes stale if Fusion renames components | The note still works — it just shows a stale name. Acceptable for v1. Could add a "refresh names" admin endpoint later. |
| `author` field is free-form; anyone can post as anyone | Demo only — acceptable. The future standalone client may want real auth. |
| Panel always visible reduces viewer canvas area on small viewports | Acceptable. The panel was previously closeable; if needed later, re-add a collapse button. |

## Non-goals (v1)

- @-mentions, threading, replies.
- Attachments (images, files).
- Notifications.
- Notes search across the whole DB.
- Real auth on the notes endpoints.
- "Notes count" badge on the tab label (could add later — small lift).
- Linking notes to specific BOM rows or body IDs (always per-component for now).
- The standalone client (separate effort, future).

---

*Last updated: 2026-06-01*
