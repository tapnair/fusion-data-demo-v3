# Plan: Resolve Tip Version URN via Data Management API

## Problem

The APS Model Derivative API requires a **version URN** to trigger a translation job
(e.g. `urn:adsk.wipprod:fs.file:vf.xxxxxxxx?version=N`).

Currently `ViewTab` passes `encodeUrn(node.entityId)` to `useViewerTranslation`, but
`node.entityId` is the **lineage URN** of the item (`urn:adsk.wipprod:dm.lineage:xxx`),
which the Model Derivative API does not accept.

The fix requires calling the **APS Data Management API v2** to retrieve the tip version
object of the item, then using that version's URN for the translation job.

---

## Data Management API call

```
GET https://developer.api.autodesk.com/data/v1/projects/{project_id}/items/{item_id}/tip
Authorization: Bearer {token}
```

- `project_id` — DM API project ID in `b.xxxxxxxx` format
  (available as `alternativeIdentifiers.dataManagementAPIProjectId` on the MFG project)
- `item_id`    — the item lineage URN (`node.entityId`,
  e.g. `urn:adsk.wipprod:dm.lineage:xxx`)

The response `data.id` is the version URN:
```json
{
  "data": {
    "type": "versions",
    "id": "urn:adsk.wipprod:fs.file:vf.xxxxxxxx?version=N"
  }
}
```

This version URN (base64url-encoded) is what the Model Derivative API expects.

---

## Changes Required

### 1. Extend `NavNode` with `dmProjectId`

Add an optional `dmProjectId?: string` field to `NavNode` in `src/types/nav.types.ts`.

When project nodes are built in the nav tree, store the DM project ID on the project node.
When item nodes are built as children, propagate `dmProjectId` downward (same pattern as
the existing `projectId` propagation).

### 2. New service: `src/services/viewer/dataManagementService.ts`

```typescript
const DM_BASE = 'https://developer.api.autodesk.com/data/v1'

/**
 * Returns the derivative URN for the tip version of an item.
 * Reads data.relationships.derivatives.data.id from the version object —
 * this is already base64-encoded; do NOT re-encode it.
 */
export async function getDerivativeUrn(
  dmProjectId: string,
  lineageUrn: string,
  token: string
): Promise<string>
```

Throws a descriptive `Error` on HTTP failure or if `relationships.derivatives` is absent.

### 3. Update `useViewerTranslation`

The hook currently accepts `encodedUrn: string | null` and jumps straight to triggering
the translation job.

**New signature:**
```typescript
export function useViewerTranslation(
  lineageUrn: string | null,   // node.entityId  (lineage URN, not yet encoded)
  dmProjectId: string | null   // b.xxx DM project ID
): ViewerTranslationState & { retry: () => void }
```

**Updated state machine** — DM API call folded under `submitting` (no new status):

```
idle
  → submitting  (GET /tip version URN, then POST translation job — single spinner)
  → polling     (GET manifest every 5 s)
  → ready | failed
```

`retry()` resets back to `idle` → `submitting` (re-fetches version URN too).

`TranslationStatus` type unchanged. ViewTab renders the same spinner for
`idle | submitting`. The encoded URN (passed to ApsViewer) is derived from the fetched
version URN, not from `node.entityId`.

### 4. Update `ViewTab`

Pass `node.dmProjectId` (alongside `node.entityId`) to `useViewerTranslation`:

```tsx
const { status, progress, error, retry } = useViewerTranslation(
  node.entityId,
  node.dmProjectId ?? null
)
```

No UI changes needed — DM API call is transparent to the user (folded into `submitting`).

### 5. Update `ApsViewer` / `useApsViewer`

`ApsViewer` already receives `encodedUrn` from `useViewerTranslation`. No change needed
to the viewer component itself — the encoded URN now comes from the version URN instead of
the lineage URN, but the interface is the same.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/types/nav.types.ts` | Add `dmProjectId?: string` to `NavNode` |
| `src/context/NavContext.tsx` | No change |
| `src/components/nav/` (node builders) | Propagate `dmProjectId` from project → children |
| `src/services/viewer/dataManagementService.ts` | **Create** |
| `src/hooks/useViewerTranslation.ts` | Update signature + add `fetchingVersion` state |
| `src/components/detail/tabs/ViewTab.tsx` | Pass `dmProjectId` to hook |

---

## Decisions

1. **NavNode building** — all node construction is in `src/hooks/useNavLoader.ts`.
   The project node builder already receives `p.alternativeIdentifiers.dataManagementAPIProjectId`
   from `GET_PROJECTS`; it just needs to be stored on the node and propagated to children.

2. **`fetchingVersion` status** — folded into `submitting`. No new `TranslationStatus`
   value, no ViewTab UI changes.
