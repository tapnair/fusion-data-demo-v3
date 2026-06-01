# Notes Composite-Key Migration

*Plan created: 2026-06-01*

## Why

The Notes feature currently keys records on `modelId` (a transient identifier that varies across the Fusion lifecycle). A second notes client (the Fusion add-in) hit problems with that identifier. The actual stable identity of a Fusion component is the composite `(lineageUrn, f3dComponentId)` — both confirmed present on every picked component's viewer properties. This plan migrates the Notes feature to that composite key.

**Scope: Notes only.** Properties tab and ERP tab continue to use `modelId` (it remains the right key for MFG DM lookups).

## Decisions (from Q&A)

| Topic | Decision |
|---|---|
| Existing data | **Drop and reuse the `notes` collection.** Demo data only; re-seeding via the UI is trivial. |
| Field naming | **Explicit: `componentLineageUrn`, `componentF3dId`, `rootLineageUrn`** on the note document. |

## Schema

### New `Note` shape

```ts
interface Note {
  id: string                  // hex of Mongo _id
  componentLineageUrn: string // e.g. "urn:adsk.wipprod:dm.lineage:4gUNJt_cSVq-PDQ0VcOg2g"
  componentF3dId: string      // UUID, e.g. "50d3754d-9629-49e5-b6c1-e05d365e61f6"
  rootLineageUrn: string      // lineageUrn of the root assembly file
  componentName: string       // denormalized display name
  body: string
  author: string
  createdAt: string           // ISO 8601
  updatedAt: string           // ISO 8601
}
```

Notes:
- `(componentLineageUrn, componentF3dId)` is the **component identity**. Both required, both non-empty.
- `rootLineageUrn` alone identifies the assembly file — no `rootF3dId` needed since the root is always "the file itself".
- All other fields unchanged from the previous schema.

### Indexes

After dropping the existing collection:

```js
db.notes.createIndex({ componentLineageUrn: 1, componentF3dId: 1, createdAt: -1 })
db.notes.createIndex({ rootLineageUrn: 1, createdAt: -1 })
```

The old `{componentModelId,createdAt}` and `{rootModelId,createdAt}` indexes are gone with the collection drop.

## API changes (`fusion-erp-api`)

### `GET /api/notes`

Query params change:

- **Component scope:** `?componentLineageUrn=<urn>&componentF3dId=<uuid>` — **both required**, treated as a composite key. If only one is present → 400.
- **Assembly scope:** `?rootLineageUrn=<urn>`
- **Precedence:** if both the component-scope pair *and* `rootLineageUrn` are supplied, component-scope wins.
- **At least one of the two scope forms is required.** Otherwise → 400.

Response shape unchanged: `{ results: Note[], total: number }`.

### `POST /api/notes`

Body fields renamed:

```ts
{
  componentLineageUrn: string,  // required, non-empty
  componentF3dId: string,        // required, non-empty
  rootLineageUrn: string,        // required, non-empty
  componentName: string,         // required, non-empty
  body: string,                  // required (may be empty)
  author: string,                // required, non-empty
}
```

Extra fields silently dropped. Validation failures return 400 with `fieldErrors`.

### `PATCH /api/notes/[id]` and `DELETE /api/notes/[id]`

**Unchanged.** PATCH still only mutates `body`.

## Frontend changes (`fusion-data-demo-v3`)

### `src/types/viewerSelection.types.ts`

Add two fields to `ViewerSelection`:

```ts
componentLineageUrn: string | null
componentF3dId: string | null
```

The existing `modelId` field stays — Properties and ERP tabs need it.

### `src/hooks/useViewerSelection.ts`

Extract the two new fields the same way `modelId` is extracted today. Add a helper:

```ts
function extractAttribute(props: ViewerProperty[], name: string): string | null {
  const prop = props.find((p) => p.attributeName === name)
  return prop && typeof prop.displayValue === 'string' ? prop.displayValue : null
}
```

Then refactor `extractModelId` to use it, and add extractions for `lineageUrn` and `f3dComponentId`. Set the new fields on `selection` and `rootSelection` at every path (picked component, picked body's parent, body-no-parent fallback, root walk).

The root walk in `onGeometryLoaded` keeps its existing logic — walks BFS looking for the first node with a `modelId`. The same node will have `lineageUrn` and `f3dComponentId` since they all come together in Fusion's f3d data.

**Remove the debug `console.log` statements** that are currently in place — they've served their purpose.

### `src/services/notes/notesClient.ts`

Update types and URL composition:

```ts
export interface Note { /* new shape per §Schema */ }

export interface CreateNoteInput {
  componentLineageUrn: string
  componentF3dId: string
  rootLineageUrn: string
  componentName: string
  body: string
  author: string
}

export async function listNotesByComponent(
  componentLineageUrn: string,
  componentF3dId: string,
  signal?: AbortSignal
): Promise<Note[]>

export async function listNotesByAssembly(
  rootLineageUrn: string,
  signal?: AbortSignal
): Promise<Note[]>
```

URLs:
- Component list: `GET ${base}?componentLineageUrn=<urlencoded>&componentF3dId=<urlencoded>`
- Assembly list: `GET ${base}?rootLineageUrn=<urlencoded>`

### `src/hooks/useNotes.ts`

Args type:

```ts
type UseNotesArgs =
  | { mode: 'component'; componentLineageUrn: string; componentF3dId: string }
  | { mode: 'assembly'; rootLineageUrn: string }
```

The hook's effect keys on the appropriate identifiers (concatenation of the composite pair for component-mode; just `rootLineageUrn` for assembly-mode).

### `src/components/viewer/NotesTab.tsx`

Replace `componentModelId` / `rootModelId` references with the new identifiers:

```ts
const componentLineageUrn = effective.componentLineageUrn
const componentF3dId = effective.componentF3dId
const rootLineageUrn = rootSelection.componentLineageUrn  // root's own lineageUrn

const hasValidScope = isAssemblyScope
  ? rootLineageUrn !== null
  : componentLineageUrn !== null && componentF3dId !== null

const notesArgs = isAssemblyScope
  ? { mode: 'assembly' as const, rootLineageUrn: rootLineageUrn ?? '' }
  : { mode: 'component' as const, componentLineageUrn: componentLineageUrn ?? '', componentF3dId: componentF3dId ?? '' }
```

`handleAdd` validates all three identifiers are non-null before creating. The visible error message stays as-is (slight wording change to reflect "lineageUrn or f3dComponentId could not be determined" but optional).

### Tests

Update the existing tests to use the new identifiers throughout. Add coverage for the new component-scope composite (both params required).

- `useViewerSelection.test.tsx` — confirm new fields surface on both selection and rootSelection.
- `notesClient.test.ts` — URL composition with new params; both-required validation for component scope.
- `useNotes.test.tsx` — new args shape.
- `NotesTab.test.tsx` — uses new identifiers, hasValidScope logic.

## What you do in Atlas

Before the new endpoints will store data correctly:

1. **Atlas → cluster → Browse Collections → `fusion_erp_demo` → `notes`** → click the ⋮ menu → **Drop Collection** → confirm.
2. The collection will auto-recreate on the first POST.
3. After at least one note has been posted (collection now exists), add the two new indexes via the **Indexes** tab:
   - Fields: `{ "componentLineageUrn": 1, "componentF3dId": 1, "createdAt": -1 }`
   - Fields: `{ "rootLineageUrn": 1, "createdAt": -1 }`

That's it. No Vercel env-var changes — `MONGODB_URI`/`MONGODB_DB`/`MONGODB_COLLECTION` all stay the same.

## What's untouched

- `useViewerComponent`, `useErpData`, `ErpTab`, `Properties` tab — still use `modelId`.
- The admin UI in `fusion-erp-api` — orthogonal; queries `materials`, not `notes`.
- The seed script — orthogonal; writes to `materials`.

## Risk / open items

| Risk | Mitigation |
|---|---|
| A picked component lacks either `lineageUrn` or `f3dComponentId` | `hasValidScope` returns false; NotesTab shows "Open an assembly to see notes" and the Add button is disabled. |
| Mismatch between viewer's `lineageUrn` and what the Fusion add-in records | This is the whole point of the migration — they should now match. If they still don't, root cause is elsewhere (e.g. version-specific URN differences). |
| Old client code calls the API with `componentModelId` / `rootModelId` after the migration | Server returns 400 for missing scope. Both clients (web SPA + add-in) need to update — frontend is updated here; the add-in is your job in the other repo. |

## Non-goals

- A "compatibility mode" that accepts both old and new query params. Cut clean.
- Migrating any existing notes — the collection is dropped.

---

*Last updated: 2026-06-01*
