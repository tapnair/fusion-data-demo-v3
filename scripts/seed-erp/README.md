# seed-erp

One-time CLI that walks a Fusion assembly via the MFG DM GraphQL API and writes a mock SAP-like material-master record into MongoDB Atlas for every unique sub-model.

Designed to run **locally** with a personal APS token. Not deployed anywhere.

## Setup

```bash
cd scripts/seed-erp
npm install
cp .env.example .env
# fill in .env (see below)
```

### Env vars (`.env`, gitignored)

| Name | What |
|---|---|
| `APS_ACCESS_TOKEN` | Your personal APS token. Get it by logging into the SPA, then DevTools → Application → Session Storage → look for `aps_access_token` (or similar). Valid ~1 hour. |
| `GRAPHQL_ENDPOINT` | `https://developer.api.autodesk.com/mfg/v3/graphql/public` (default). |
| `MONGO_CONNECTION_STRING` | Use the `erp_seeder` Atlas user (readWrite on `fusion_erp_demo`). |
| `MONGO_DB` | `fusion_erp_demo` (default). |
| `MONGO_COLLECTION` | `materials` (default). |

## Usage

### Seed a top-level assembly

You need its **modelId** — the base64-encoded string the Fusion viewer surfaces. Easiest way: open the assembly in the SPA's View tab, click any component, then in DevTools console run:

```js
// in the SPA's browser console, when a component is selected
JSON.parse(sessionStorage.getItem('nav-selected-node')).entityId
```

…or just hover the top-level component in the BOM, open the React DevTools, inspect the row, copy `componentId`. (modelId vs componentId — see "Picking the right ID" below.)

Then:

```bash
npm run seed -- --modelId "<base64-modelId>"
```

### Other commands

```bash
# Dry-run: fetch + generate, but don't write to Mongo. Prints the first record.
npm run seed -- --modelId "<id>" --dry-run

# Limit walk depth (default 50, deep enough for most assemblies)
npm run seed -- --modelId "<id>" --depth 10

# Wipe the materials collection (for re-seeding)
npm run clear -- --yes
```

## How it works

1. Loads `.env`.
2. Fetches the root model + its component via GraphQL (`Query.model(modelId).component`).
3. Walks `Model.uniqueAssemblyRelations(depth)` to collect every unique descendant model in the tree, paging through cursors.
4. For each model, generates a deterministic fake material-master record (seeded by the modelId hash, so re-runs produce identical data except for `bestand` and `lastUpdated`).
5. Bulk-upserts into Mongo, keyed by `modelId`. Safe to re-run — existing records are updated, not duplicated.

## Picking the right ID

`modelId` is what the Fusion viewer exposes for each component (it's the ID of the component's Model, base64-encoded). It's the same string the SPA's properties panel uses to call `Query.model(modelId).component`.

If you accidentally pass a `componentId` (also base64, different shape) the seed will fail at step 2 with "Root model not found".

## Output

```
Fetching root model bW9kZWx-MEM1NU... ...
  root: Espresso Machine (component componentVersion~...)
Walking unique sub-models (depth=50) ...
  found 47 unique sub-models
Generated 48 ERP records.
Writing to fusion_erp_demo.materials ...
  upserted 48, modified 0, matched 0
Done.
```

## Security

- `.env` is gitignored.
- The `erp_seeder` user only has `readWrite` on `fusion_erp_demo`.
- The APS token in `.env` is short-lived (1 hour). If committed by accident, rotate by signing out of the SPA.
