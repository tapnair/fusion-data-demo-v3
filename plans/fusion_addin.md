# Fusion Notes Add-in (second notes client)

*Plan created: 2026-06-01*

## Goal

Build an Autodesk Fusion add-in (Python) that is a **second client** for the notes
backend — alongside the web SPA's Notes tab (see [`notes.md`](notes.md)). It adds a
toolbar button that opens an HTML **palette**. The palette is selection-aware: as the
user picks geometry in the Fusion canvas, it shows the notes attached to the
component(s) that geometry belongs to, and lets the user create, edit, and delete
notes — full CRUD against the same `/api/notes` endpoints the SPA uses.

Same backend, same MongoDB `notes` collection, same `Note` shape, keyed by the same
`modelId` (`mfgdmModelId`). No backend changes required.

## Decisions (from Q&A)

| Topic | Decision |
|---|---|
| Where the add-in lives | **New sibling repo `fusion-notes-addin`** (alongside `fusion-data-demo-v3` and `fusion-data-demo-mobile`). Keeps Python add-in tooling fully separate from the SPA. |
| Operations in v1 | **Full CRUD** — read, create, edit, delete. Backend already supports `GET`/`POST`/`PATCH`/`DELETE`. |
| Where HTTP runs | **In the palette's JavaScript** (`fetch`). The palette is a Qt web browser; `fetch` is async so it never freezes Fusion's UI. Python does zero networking — it only resolves the current selection to `modelId`s and pushes them to the palette. CORS on the notes endpoints is already `*`. |
| Nothing-selected behavior | **Show all notes in the design** — fall back to the design root component's `modelId` and list every note in the assembly. Mirrors the SPA's root-assembly fallback. |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Autodesk Fusion (desktop)                                            │
│                                                                       │
│   fusion-notes-addin  (Python, runs in Fusion's embedded CPython)     │
│     ├─ FusionNotes.py            run()/stop(); button + palette       │
│     ├─ activeSelectionChanged    → resolve selection → modelIds       │
│     │        handler             → palette.sendInfoToHTML('selection')│
│     │                                                                  │
│     └─ palette/index.html  (Qt web browser)                           │
│          ├─ window.fusionJavaScriptHandler.handle(action,data)        │
│          │        ← receives selection payload from Python            │
│          ├─ notesClient.js   fetch() ───────────────┐                 │
│          └─ renders list + add/edit/delete UI       │                 │
└─────────────────────────────────────────────────────┼─────────────────┘
                                                       │ HTTPS (fetch, CORS *)
                                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  fusion-erp-api (Vercel)  — UNCHANGED                                 │
│   GET  /api/notes?componentModelId=… | ?rootModelId=…                 │
│   POST /api/notes                                                      │
│   PATCH/DELETE /api/notes/[id]                                         │
│            base: https://fusion-erp-api.vercel.app/api/notes          │
└──────────────────────────────────────────────────────────────────────┘
```

### Why HTTP lives in JS, not Python

Python add-in code runs on Fusion's **main UI thread**. A blocking `urllib` call would
freeze the whole application until the request returns. The palette is a real browser,
so its `fetch` is asynchronous and off the UI thread. By keeping all networking in the
palette we avoid threads, custom-event marshalling, and UI stalls entirely. Python's
only job is the part only Python can do: read the Fusion selection and turn it into
`modelId`s.

### The two-way message protocol

Python → palette, via `palette.sendInfoToHTML(action, dataJsonString)`:

| action | data (JSON) | When |
|---|---|---|
| `selection` | `{ scope, rootModelId, rootName, components: [{modelId, name}], author, designReady, warnings: [string] }` | On every `activeSelectionChanged`, on palette open, and on document switch. |

Palette → Python, via `adsk.fusionSendData(action, dataJsonString)` (received in the
`HTMLEvent` handler; `handle` must return a non-empty string):

| action | data | Purpose |
|---|---|---|
| `ready` | `{}` | Palette finished loading → Python replies by pushing the current selection immediately (the event won't have fired yet). |
| `refresh` | `{}` | User clicked the palette's manual "Refresh" button → Python re-reads `ui.activeSelections` and re-pushes (covers cases where `activeSelectionChanged` didn't fire — see Risks). |

Payload field meanings:
- `scope`: `"selection"` when ≥1 component resolved from the live selection;
  `"assembly"` when nothing is selected (palette lists by `rootModelId`).
- `components`: **deduplicated** list of resolved components (multiple faces on one
  body collapse to one entry). Empty in assembly scope.
- `rootModelId` / `rootName`: the active design's root component, always sent so the
  palette can do the assembly-scope fallback and stamp new notes' `rootModelId`.
- `author`: `app.currentUser.displayName` (fallback `"Fusion User"`).
- `designReady`: `false` when there is no active Fusion design (e.g. a drawing/empty
  doc) — palette shows a "Open a design" placeholder.
- `warnings`: human-readable component names that were selected but had **no**
  `mfgdmModelId` (unsaved). Palette surfaces these as a small banner.

The notes API base URL is **not secret** and is hard-coded in the palette JS
(`config.js`), matching how `VITE_NOTES_ENDPOINT_BASE` is committed in the SPA.

---

## Phase 0 — Repo scaffold (`fusion-notes-addin`)

New sibling repo. Standard Fusion add-in layout (folder name == manifest/script base
name, which Fusion requires):

```
fusion-notes-addin/
├── FusionNotes.manifest          # add-in manifest (JSON)
├── FusionNotes.py                # entry: run(context) / stop(context)
├── lib/
│   ├── __init__.py
│   ├── selection.py              # resolve selection → [{modelId, name}] + root + warnings
│   └── messaging.py              # JSON encode/decode helpers for the palette bridge
├── palette/
│   ├── index.html                # the UI
│   ├── config.js                 # NOTES_BASE = 'https://fusion-erp-api.vercel.app/api/notes'
│   ├── notesClient.js            # fetch wrappers (mirror src/services/notes/notesClient.ts)
│   ├── app.js                    # render + create/edit/delete + Fusion bridge
│   └── styles.css
├── resources/
│   └── notes/                    # button icons: 16x16.png, 32x32.png, 64x64.png
├── .gitignore
└── README.md                     # install + usage
```

`FusionNotes.manifest` (key fields):
```json
{
  "autodeskProduct": "Fusion",
  "type": "addin",
  "id": "fusion-notes-addin",
  "author": "Patrick Rainsberry",
  "description": { "": "Selection-aware notes client for Fusion." },
  "version": "1.0.0",
  "runOnStartup": true,
  "supportedOS": "windows|mac",
  "editEnabled": true
}
```

Install for development: copy/symlink the folder into Fusion's add-ins directory, or
add its parent via **Utilities → Scripts and Add-Ins → green "+" → script/add-in
location**. README documents both paths (Mac & Windows).

---

## Phase 1 — Add-in lifecycle: button + palette (`FusionNotes.py`)

Globals kept alive for the add-in's lifetime: `app`, `ui`, `handlers = []`,
`palette` reference, and the resolved IDs (`CMD_ID`, `PALETTE_ID`).

`run(context)`:
1. `app = adsk.core.Application.get()`, `ui = app.userInterface`.
2. Create the command: `ui.commandDefinitions.addButtonDefinition(CMD_ID, 'Notes',
   'Show component notes', 'resources/notes')`.
3. Add a `commandCreated` handler → on `command.execute`, **show the palette**
   (create it if missing, else `palette.isVisible = True`).
4. Place the button on a toolbar panel — e.g. the **UtilityPanel** / Design workspace
   add-ins panel via `ui.allToolbarPanels.itemById('SolidScriptsAddinsPanel')` →
   `panel.controls.addCommand(cmdDef)`. (README notes where the button appears.)
5. Register the `ui.activeSelectionChanged` handler (Phase 2). Append every handler to
   the global `handlers` list so Python's GC doesn't collect them.

Palette creation (lazy, on first button click):
```python
palette = ui.palettes.add(
    PALETTE_ID, 'Notes', 'palette/index.html',
    True,   # isVisible
    True,   # showCloseButton
    True,   # isResizable
    320, 480
)
palette.dockingState = adsk.core.PaletteDockingStates.PaletteDockStateRight
palette.incomingFromHTML.add(onIncomingFromHTML)   # Phase 3 bridge
handlers.append(onIncomingFromHTML)
```

`stop(context)`:
- Delete the palette if it exists (`palette.deleteMe()`).
- Remove the toolbar control and the command definition (`itemById(...).deleteMe()`).
- Clear `handlers`. Wrap everything in try/except so a partial teardown still unloads.

---

## Phase 2 — Selection tracking (Python, `lib/selection.py`)

### 2.1 The event handler

```python
class ActiveSelectionChangedHandler(adsk.core.ActiveSelectionEventHandler):
    def notify(self, args):
        sels = adsk.core.ActiveSelectionEventArgs.cast(args).currentSelection
        push_selection(sels)        # build payload + palette.sendInfoToHTML
```

Registered on `ui.activeSelectionChanged`. The handler only does cheap, synchronous API
reads (no network) so it won't stall the UI.

### 2.2 Resolving an entity to its Component

`Selection.entity` can be a face, edge, body, vertex, occurrence, or component. Map each
to its owning `Component`:

```python
def component_of(entity):
    face = adsk.fusion.BRepFace.cast(entity)
    if face:  return face.body.parentComponent
    edge = adsk.fusion.BRepEdge.cast(entity)
    if edge:  return edge.body.parentComponent
    vert = adsk.fusion.BRepVertex.cast(entity)
    if vert:  return vert.body.parentComponent
    body = adsk.fusion.BRepBody.cast(entity)
    if body:  return body.parentComponent
    occ  = adsk.fusion.Occurrence.cast(entity)
    if occ:   return occ.component
    comp = adsk.fusion.Component.cast(entity)
    if comp:  return comp
    return None     # sketch entity, construction geom, etc. — ignored in v1
```

### 2.3 Resolving a Component to its modelId

```python
def model_id_of(component):
    try:
        dc = component.dataComponent          # preview API, may be None
        if dc and dc.mfgdmModelId:
            return dc.mfgdmModelId
    except Exception:
        pass
    return None                               # unsaved / not yet synced
```

`dataComponent` is `None` (and `mfgdmModelId` empty) until the design is saved and the
MFG DM cloud info resolves. Such components go into `warnings`, not `components`.

### 2.4 Building the payload (with dedup + assembly fallback)

```python
def build_payload():
    design = adsk.fusion.Design.cast(
        app.activeDocument.products.itemByProductType('DesignProductType'))
    if not design:
        return { 'designReady': False }

    root = design.rootComponent
    root_mid = model_id_of(root)

    seen, components, warnings = {}, [], []
    for sel in ui.activeSelections:                 # live current selection
        comp = component_of(sel.entity)
        if not comp:  continue
        mid = model_id_of(comp)
        if not mid:
            if comp.name not in warnings: warnings.append(comp.name)
            continue
        if mid not in seen:                         # dedup by modelId
            seen[mid] = True
            components.append({ 'modelId': mid, 'name': comp.name })

    return {
        'designReady': True,
        'scope': 'selection' if components else 'assembly',
        'rootModelId': root_mid,
        'rootName': root.name,
        'components': components,
        'author': (app.currentUser.displayName if app.currentUser else 'Fusion User'),
        'warnings': warnings,
    }
```

Note: when the `activeSelectionChanged` handler fires we already have
`args.currentSelection`; `build_payload` can take it as a param to avoid re-reading.
The `ui.activeSelections` read above is the path used for the initial `ready` push and
the manual `refresh`.

### 2.5 Pushing to the palette

```python
def push_selection(sels=None):
    if not palette: return
    payload = build_payload()          # or build_payload(sels) from the event
    palette.sendInfoToHTML('selection', json.dumps(payload))
```

---

## Phase 3 — Palette UI (HTML/CSS/JS)

### 3.1 The Fusion bridge (`app.js`)

Receive from Python:
```javascript
window.fusionJavaScriptHandler = {
  handle(action, data) {
    if (action === 'selection') onSelection(JSON.parse(data));
    return 'OK';                 // must return a non-empty string
  }
};
// On load, tell Python we're ready so it pushes the current selection:
adsk.fusionSendData('ready', '{}');
// Manual refresh button:
refreshBtn.onclick = () => adsk.fusionSendData('refresh', '{}');
```

The matching Python side (`palette.incomingFromHTML`):
```python
class IncomingFromHTMLHandler(adsk.core.HTMLEventHandler):
    def notify(self, args):
        a = adsk.core.HTMLEventArgs.cast(args)
        if a.action in ('ready', 'refresh'):
            push_selection()
            a.returnData = 'OK'
```

### 3.2 Notes client (`notesClient.js`)

A near-verbatim JS port of `src/services/notes/notesClient.ts` (same endpoints, same
400→error handling). Confirmed against the **deployed** functions (commit `332ab29` in
`fusion-erp-api`, verified live 2026-06-01): GET returns `200 {results,total}` with an
empty list when there are no notes (it does **not** 404), `POST` returns **`201`** with
the created note, `PATCH` returns `200`, `DELETE` returns `204`. So the client should
treat any 2xx as success rather than expecting `200` specifically.
```javascript
const NOTES_BASE = window.NOTES_CONFIG.base;  // from config.js
async function listByComponent(modelId) { /* GET ?componentModelId= */ }
async function listByAssembly(rootModelId) { /* GET ?rootModelId= */ }
async function createNote(input) { /* POST */ }       // {componentModelId, rootModelId, componentName, body, author}
async function updateNote(id, body) { /* PATCH */ }
async function deleteNote(id) { /* DELETE */ }
```

### 3.3 Rendering (`onSelection(payload)`)

- `payload.designReady === false` → "Open a Fusion design to use notes." Stop.
- `payload.warnings.length` → a dismissible banner: "N selected component(s) aren't
  saved yet and can't have notes" (lists names).
- **Header line:**
  - selection scope, 1 component → `On: <name>`
  - selection scope, N components → `On: N components` (with the names listed)
  - assembly scope → `All notes in <rootName>`
- **Add form** (top): multiline textarea + "Add note" button. Disabled when the body is
  whitespace-only, or when there is no target (`assembly` scope with no `rootModelId`,
  i.e. unsaved root).
- **List** (below): one card per note — author • relative time, body, and (in
  multi-component or assembly scope) an `On: <componentName>` sub-label so the user
  knows which component each note belongs to. Pencil ✎ → inline edit → `updateNote`.
  Trash 🗑 → confirm → `deleteNote`. Mirrors the SPA's NotesTab card layout.

### 3.4 Fetch orchestration

- **assembly scope:** `listByAssembly(rootModelId)` → render grouped/flat list.
- **selection scope, 1 component:** `listByComponent(components[0].modelId)`.
- **selection scope, N components:** `Promise.all(components.map(c =>
  listByComponent(c.modelId)))`, concatenate, tag each note's group by component name,
  sort by `createdAt` desc within groups (or one flat list with `On:` sub-labels).
- A monotonic **request token** (incrementing int) guards against out-of-order
  responses when the selection changes mid-fetch — only the latest token's results
  render. (Equivalent to the SPA's AbortController; `fetch` here can also use
  `AbortController` directly.)

### 3.5 Create with multi-selection

"Add note" in selection scope with N components → fire N `createNote` POSTs, one per
component, **same** `body`/`author`/`rootModelId`, each with its own
`componentModelId` + `componentName`. `Promise.allSettled`, then refetch. In assembly
scope, creating a note targets the **root component** (`componentModelId = rootModelId`,
`componentName = rootName`) — a note "on the assembly."

---

## Phase 4 — Edge cases & errors

| Case | Behavior |
|---|---|
| No active design (drawing, empty doc) | `designReady:false` → "Open a design" placeholder. |
| Selected component(s) unsaved (no `mfgdmModelId`) | Excluded from `components`; surfaced in the `warnings` banner. If *all* selections are unsaved → fall through to assembly scope (or show the warning + the root's notes). |
| Unsaved root (`rootModelId` null) | Assembly scope shows "Save the design to attach notes." Add form disabled. |
| Network/API error in `fetch` | Inline error strip in the palette with a Retry button. No Fusion `messageBox` spam. |
| Selection changes while a fetch is in flight | Request-token / AbortController discards stale results (3.4). |
| Document switched while palette open | `activeSelectionChanged` re-fires on the new doc's selection; also handle `app.documentActivated` to re-push even when selection is empty. |
| `activeSelectionChanged` doesn't fire (event only active during select contexts) | Manual **Refresh** button re-reads `ui.activeSelections` (protocol `refresh`). Documented in README as the fallback. |
| Palette closed then reopened | `palettes.itemById(PALETTE_ID)` returns the existing one → set `isVisible=True`; JS re-sends `ready` on reload. |

---

## Phase 5 — Testing & verification

Fusion add-ins can't be unit-tested in CI without the host app, so testing is layered:

1. **Pure-logic unit tests (no Fusion):** Extract selection-resolution and payload-
   building into functions that take plain inputs where possible; test dedup, the
   unsaved→warning path, and assembly fallback with fakes/stubs of the `.cast` chain.
   (Lightweight `pytest`; the `adsk` modules are stubbed.)
2. **`notesClient.js`:** small headless test (or reuse the SPA's `notesClient.test.ts`
   cases) for URL composition and status handling — the logic is a direct port.
3. **Manual end-to-end checklist** in the README:
   - Button appears; click opens the docked palette.
   - Select a face → its component's notes load; add a note → appears; edit; delete.
   - Select faces on two components → both groups show; add note → two DB rows (verify
     in the admin UI at `https://fusion-erp-api.vercel.app/`).
   - Deselect all → assembly notes for the root appear.
   - Unsaved component → warning banner; no crash.
   - Cross-check a note created here shows up in the SPA's Notes tab (same backend).

---

## Files

### New repo `fusion-notes-addin`
- `FusionNotes.manifest`
- `FusionNotes.py`
- `lib/{__init__.py, selection.py, messaging.py}`
- `palette/{index.html, config.js, notesClient.js, app.js, styles.css}`
- `resources/notes/{16x16,32x32,64x64}.png`
- `.gitignore`, `README.md`
- (optional) `tests/test_selection.py`

### This repo (`fusion-data-demo-v3`)
- `plans/fusion_addin.md` (this plan).
- No code changes — the backend and SPA are untouched.

### Untouched (intentional)
- `fusion-erp-api` — the notes endpoints already do everything the add-in needs.
- The SPA's Notes tab — independent client of the same API.

---

## Risk / open items

| Risk | Mitigation |
|---|---|
| `activeSelectionChanged` only fires while a select-capable command is active | Manual Refresh button + `documentActivated` handler. Reading `ui.activeSelections` on demand always works. |
| `Component.dataComponent` / `mfgdmModelId` are **preview** APIs (2024–2025) and may change between Fusion releases | Isolate the access in `model_id_of()`; wrap in try/except; degrade to the unsaved-warning path. README pins a tested Fusion version. |
| Network call latency from inside Fusion | Async `fetch` in the palette — never blocks the UI thread. |
| Palette HTML loaded from `file://` doing cross-origin `fetch` | **Server side verified live (2026-06-01):** an `OPTIONS` preflight with `Origin: file://` returns `204` with `Access-Control-Allow-Origin: *`, `Allow-Methods: GET, POST, OPTIONS`, `Allow-Headers: Content-Type`. The only residual unknown is whether the Qt browser itself enforces same-origin regardless. If it does, fall back to Python `urllib` on a background thread + custom event (documented contingency, not v1). Note `Allow-Headers` is `Content-Type` only — do **not** send an `Authorization` header (none is needed; endpoints are open). |
| `componentName` denormalized into the note can go stale on rename | Same trade-off as the SPA; acceptable for the demo. |
| Two clients writing concurrently | Backend is last-write-wins on `body`; acceptable for demo. |
| Multiple faces selected on one component create duplicate notes | Dedup by `modelId` before create (3.5) → exactly one note per unique component. |

## Non-goals (v1)

- Auth on the add-in's API calls (endpoints are open by design — same as the SPA).
- Threading / Python-side HTTP (only a documented contingency).
- Attaching notes to sub-entities (a specific face/edge/body) rather than the whole
  component — always per-component, matching the SPA.
- Offline queueing / optimistic updates (refetch-after-mutation is sufficient).
- Packaging/signing for the Autodesk App Store; this is a dev-installed add-in.
- @-mentions, threading, attachments, notifications (same non-goals as the SPA notes).

---

*Last updated: 2026-06-01*
