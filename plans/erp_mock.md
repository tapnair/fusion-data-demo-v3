# Mock ERP Integration (MongoDB Atlas)

*Plan created: 2026-05-29*

## Goal

Add a second tab to the viewer properties panel that displays mock ERP data for the picked component, sourced from a MongoDB Atlas collection. The data is keyed by `modelId` — the same one we already extract from the viewer properties. A one-time Node.js script seeds fake SAP-like material-master data for every component in a given assembly.

## Decisions (from product Q&A)

| Topic | Decision |
|---|---|
| Hosting for the read-broker | **Vercel serverless function** in a separate repo `fusion-erp-api`. *(Original plan was Atlas App Services HTTPS endpoint, but App Services is no longer available in new Atlas projects — pivoted 2026-05-29.)* |
| Endpoint auth | **APS-token validated.** Frontend passes its existing APS Bearer token; the function verifies against APS `userinfo` before serving. No exposed key in the public repo. |
| Read vs write | **Read-only for v1.** Writes happen exclusively via the seed script. |

## Architecture

```
Browser SPA (GitHub Pages)
  │  GET /material/byModelId?modelId=<base64>
  │  Authorization: Bearer <APS access token>
  ▼
Atlas App Services HTTPS endpoint  (URL in VITE_ERP_ENDPOINT_URL — public, not a secret)
  │  Function body (JS, runs in Atlas):
  │    1. Read Authorization header
  │    2. Call APS userinfo endpoint with that token
  │    3. If 200 → continue; else 401
  │    4. Read modelId from query string
  │    5. db.materials.findOne({ modelId }) → return doc (or null)
  ▼
MongoDB Atlas cluster
  └─ database: fusion_erp_demo
     └─ collection: materials
        └─ docs keyed by modelId
```

What never enters the public repo:
- The MongoDB connection string (lives in Atlas as the App Service's linked data source — invisible to code).
- The Atlas API key used by the seed script (lives in a local `.env` file, gitignored).
- No service-account credentials needed (read path uses the user's APS token; write path is local-only).

What's safe to commit:
- The HTTPS endpoint URL (it's gated by APS token validation).
- The function source code (no secrets inside).
- The seeding script (reads creds from local `.env`).

---

## Phase 0 — Atlas setup (step-by-step in the UI)

These steps are done in the MongoDB Atlas web UI before any code is written. Once complete, the App Service's HTTPS endpoint URL becomes the frontend's only required env var.

### 0.1 Create the database

1. Sign in to **cloud.mongodb.com**.
2. Pick your cluster (or create a free M0). Note its name (e.g. `Cluster0`).
3. Click **Browse Collections → + Create Database**.
4. Database name: `fusion_erp_demo`
5. Collection name: `materials`
6. Click **Create**.

### 0.2 Add a unique index on `modelId`

Still inside the `materials` collection:
1. Open the **Indexes** tab → **Create Index**.
2. Fields: `{ "modelId": 1 }`
3. Options: tick **Unique**.
4. Create.

This prevents duplicate seed runs from creating two rows for the same component.

### 0.3 (Optional) JSON-schema validation

In **Indexes → Validation**, paste the schema in §3.2 below. This rejects writes that don't match the ERP shape. Helpful while developing the seed script.

### 0.4 Create the read-only Atlas user

The Vercel function needs Mongo access. Use a dedicated read-only user:

1. **Database & Network Access → Database Access → + Add New Database User**
2. Username: `erp_reader`
3. Password: autogenerate, copy.
4. Built-in role: **Read only** scoped to `fusion_erp_demo`.
5. Add.

### 0.5 Network access for Vercel

Vercel serverless functions don't have static IPs, so:

1. **Database & Network Access → Network Access → + Add IP Address**
2. **Allow access from anywhere** (`0.0.0.0/0`).

This is safe because the credentials are scoped read-only to one database.

### 0.6 Grab the connection string

1. **Cluster → Connect → Drivers**, copy the URI.
2. Substitute `erp_reader` for `<username>` and the password from §0.4. Keep it local — do not commit.

### 0.7 Create the Vercel project repo

Scaffolded in a sibling directory, `fusion-erp-api/`. See its own README. Files:

```
fusion-erp-api/
├── api/material/byModelId.ts
├── package.json
├── tsconfig.json
├── vercel.json
├── .gitignore
├── .env.example
└── README.md
```

The function source is in §1.1 below.

### 0.8 Push to GitHub

```bash
cd /Users/rainsbp/_local_rainsbp/Claude/fusion-erp-api
git commit -m "Initial: Vercel serverless broker for fusion-data-demo-v3"
git remote add origin git@github.com:tapnair/fusion-erp-api.git
git push -u origin main
```

### 0.9 Import the repo into Vercel

1. **vercel.com → Add New… → Project**, pick `fusion-erp-api`.
2. Framework: Other. Root directory: `./`. No build command override needed.
3. **Environment Variables** (set before first deploy, for all environments):
   - `MONGODB_URI` — the connection string from §0.6
   - `MONGODB_DB` — `fusion_erp_demo`
   - `ALLOWED_ORIGINS` — `https://tapnair.github.io,http://localhost:5173`
4. **Deploy.**

### 0.10 Disable Deployment Protection on production

By default new Vercel projects gate production deployments behind a Vercel auth wall:

1. **Project Settings → Deployment Protection**
2. **Standard Protection: Disabled** (or "Only preview deployments" — production must be open for the SPA to reach the function without Vercel auth).

### 0.11 Get the production URL

On the project's **Deployments** page, the row marked **Production** shows the stable alias (e.g. `fusion-erp-api.vercel.app`). The full endpoint URL is:

```
https://<production-alias>/api/material/byModelId
```

This URL goes into `VITE_ERP_ENDPOINT_URL` for the SPA — see Phase 2.

### 0.12 Verify

```bash
# 1. No token → 401
curl -i "https://<prod-url>/api/material/byModelId?modelId=foo"

# 2. Bogus token → 401
curl -i -H "Authorization: Bearer fake" "https://<prod-url>/api/material/byModelId?modelId=foo"

# 3. Real APS token, unknown modelId → 404
curl -i -H "Authorization: Bearer <real-aps-token>" "https://<prod-url>/api/material/byModelId?modelId=foo"
```

### 0.13 Create the seed-script Atlas user

The seed script runs locally and writes directly to Mongo — separate user, separate scope:

1. **Database Access → + Add New Database User**
2. Username: `erp_seeder`
3. Password: autogenerate, copy.
4. Built-in role: **Read and write to any database** scoped to `fusion_erp_demo` (or `readWrite` on `fusion_erp_demo` only).
5. Add.

Copy a separate connection string for this user; it goes into `scripts/seed-erp/.env` (gitignored).

---

## Phase 1 — Vercel serverless function (the read broker)

Lives in a separate repo `fusion-erp-api/`. Source: `api/material/byModelId.ts`.

Behavior:
1. CORS — echoes `Access-Control-Allow-Origin` only for hosts in `ALLOWED_ORIGINS` env var.
2. APS token validation — `GET https://api.userprofile.autodesk.com/userinfo` with the caller's Bearer token. 401 on missing / invalid.
3. Mongo `findOne({ modelId })` against the `materials` collection. 404 if missing. Strips `_id`.
4. MongoClient is module-scoped so warm function instances reuse the connection.

See `fusion-erp-api/README.md` for endpoint details, env vars, and verification curls.

---

## Phase 2 — Frontend integration

### 2.1 Env wiring

`.env.development.example` (committed, no real values):
```
VITE_ERP_ENDPOINT_URL=https://<region>.aws.data.mongodb-api.com/app/<app-id>/endpoint/material/byModelId
```

`.env.development` and `.env.production` are NOT committed and hold the real value. Update `.gitignore` if needed.

For CI deploy: add `VITE_ERP_ENDPOINT_URL` as a GitHub Actions secret; reference it in `.github/workflows/deploy.yml` the same way `VITE_CLIENT_ID` is handled.

### 2.2 New client: `src/services/erp/erpClient.ts`

A pure-fetch module — no React dependencies. Single function:

```ts
export interface ErpMaterial {
  modelId: string
  matnr: string                  // SAP material number
  maktx: string                  // material description
  meins: string                  // base UoM (EA, KG, M, etc.)
  mtart: string                  // material type (FERT, HALB, ROH)
  werks: string                  // plant (e.g. "PL01")
  mmsta: string                  // plant status
  beskz: 'E' | 'F'               // procurement type (E=in-house make, F=external buy)
  dismm: string                  // MRP type (PD, M1, etc.)
  plifz: number                  // planned delivery time (days)
  eisbe: number                  // safety stock
  stprs: number                  // standard price
  waers: string                  // currency code
  bestand: number                // stock on hand
  vendor: { lifnr: string; name: string } | null
  lastUpdated: string            // ISO timestamp
}

export async function fetchErpMaterial(
  modelId: string,
  apsAccessToken: string
): Promise<ErpMaterial | null>
```

Implementation:
- `fetch(`${VITE_ERP_ENDPOINT_URL}?modelId=${encodeURIComponent(modelId)}`, { headers: { Authorization: `Bearer ${apsAccessToken}` } })`
- 404 → returns `null`
- 401 → throws (UI surfaces "auth expired, sign in again")
- other non-2xx → throws

### 2.3 New hook: `src/hooks/useErpData.ts`

```ts
export interface UseErpDataResult {
  loading: boolean
  error: string | null
  material: ErpMaterial | null
}

export function useErpData(modelId: string | null): UseErpDataResult
```

Internals:
- Uses `useAuth().getAccessToken()` to mint a token per request.
- Manages its own in-memory cache keyed by modelId so re-opening the panel for the same component is instant.
- `useEffect` triggers a fetch on `modelId` change.
- Aborts in-flight requests on unmount or modelId change (AbortController).

Does NOT use Apollo — keeps the ERP store fully isolated from the GraphQL cache. Easier to reason about, easier to test, easier to swap out later.

### 2.4 New tab UI: `src/components/viewer/ErpTab.tsx`

A presentational component:

```ts
interface ErpTabProps {
  modelId: string | null
}
```

States:
- `modelId === null` → empty state ("Pick a component to see ERP data").
- `loading` → CircularProgress.
- `error` → small Alert with retry button.
- `material === null` (404) → empty state ("No ERP record for this component").
- `material` resolved → two-column label/value grid grouped into sections:
  - **Material Master**: matnr, maktx, mtart, meins
  - **Plant / MRP**: werks, mmsta, beskz, dismm, plifz, eisbe
  - **Procurement**: stprs + waers, vendor.lifnr, vendor.name
  - **Inventory**: bestand
  - **Meta**: lastUpdated

Visual style mirrors the existing BOM-row property list (same `${LABEL_WIDTH}px 1fr` grid).

### 2.5 Tabs in the panel: `ViewerPropertiesPanel.tsx`

Currently the panel renders a single content area. Add a small tab strip below the breadcrumb:

```tsx
<Tabs value={tab} onChange={(_, v) => setTab(v)}>
  <Tab label="Properties" value="properties" />
  <Tab label="ERP" value="erp" />
</Tabs>
```

State: `const [tab, setTab] = useState<'properties' | 'erp'>('properties')` — local to the panel. Tab choice resets to "Properties" when `selection.componentDbId` changes (cleanest mental model).

When `tab === 'erp'`: render `<ErpTab modelId={selection.modelId} />`.

When `tab === 'properties'`: render the current Properties content (header thumbnail, accordions, etc.).

The breadcrumb, header (component name, close X, column-settings gear, show-hidden eye) stay above the tab strip — they're cross-tab concerns.

**Edge case:** in the fallback "MFG DM not available" path (`modelId === null`), the ERP tab is also useless (no key to query by). Hide the ERP tab entirely in that case, falling back to a single-tab look identical to today's fallback.

---

## Phase 3 — Data shape & seeding

### 3.1 Document shape in `materials`

```json
{
  "_id": "<auto>",
  "modelId": "bW9kZWx-MEM1NU9hTGZuc...",   // base64 modelId from the viewer
  "matnr": "7601025",
  "maktx": "CONTROLS BOTTOM PIECE",
  "meins": "EA",
  "mtart": "FERT",
  "werks": "PL01",
  "mmsta": "ACTIVE",
  "beskz": "F",
  "dismm": "PD",
  "plifz": 14,
  "eisbe": 25,
  "stprs": 12.34,
  "waers": "USD",
  "bestand": 142,
  "vendor": { "lifnr": "V100023", "name": "Acme Components Inc." },
  "lastUpdated": "2026-05-29T15:30:00.000Z"
}
```

Field choices follow SAP material-master conventions so the demo "feels" like a real ERP. We use the actual SAP table-field codes (MATNR, MAKTX, etc.) but also surface friendly labels in the UI.

### 3.2 JSON-schema validator (optional, in §0.3)

```json
{
  "$jsonSchema": {
    "bsonType": "object",
    "required": ["modelId", "matnr", "maktx", "meins", "mtart"],
    "properties": {
      "modelId": { "bsonType": "string" },
      "matnr": { "bsonType": "string" },
      "maktx": { "bsonType": "string" },
      "meins": { "bsonType": "string" },
      "mtart": { "enum": ["FERT", "HALB", "ROH"] },
      "beskz": { "enum": ["E", "F"] },
      "plifz": { "bsonType": "int", "minimum": 0 },
      "eisbe": { "bsonType": "int", "minimum": 0 },
      "stprs": { "bsonType": "double", "minimum": 0 },
      "bestand": { "bsonType": "int", "minimum": 0 },
      "lastUpdated": { "bsonType": "string" }
    }
  }
}
```

### 3.3 Seeding script: `scripts/seed-erp/`

Standalone Node.js project, independent of the SPA's build:

```
scripts/seed-erp/
├── package.json            (separate scope; not part of the SPA's npm workspace)
├── tsconfig.json
├── .env.example            (committed, placeholders only)
├── .env                    (gitignored — real connection string + APS token)
├── README.md               (how to run)
├── src/
│   ├── index.ts            (CLI entry)
│   ├── fusionClient.ts     (GraphQL queries: walks the assembly BOM, extracts modelIds + base properties)
│   ├── fakeData.ts         (generator for SAP-like fields, seeded by modelId for deterministic output)
│   └── mongoWriter.ts      (upserts docs into the materials collection)
```

`package.json` deps (lean):
- `mongodb` (Node driver)
- `graphql-request` (lightweight GraphQL client)
- `dotenv`
- `commander` (CLI args)
- `tsx` (run TS directly, no build step)
- `@faker-js/faker` (realistic-looking vendor names, descriptions)

`.env` (gitignored):
```
APS_ACCESS_TOKEN=<paste from your browser session — see README>
MONGO_CONNECTION_STRING=mongodb+srv://erp_seeder:<pwd>@cluster0.xxx.mongodb.net
MONGO_DB=fusion_erp_demo
MONGO_COLLECTION=materials
```

`.env.example` (committed):
```
APS_ACCESS_TOKEN=
MONGO_CONNECTION_STRING=mongodb+srv://<user>:<password>@<cluster>.mongodb.net
MONGO_DB=fusion_erp_demo
MONGO_COLLECTION=materials
```

`scripts/seed-erp/.gitignore`:
```
node_modules/
.env
dist/
```

### 3.4 CLI usage

```bash
cd scripts/seed-erp
npm install
cp .env.example .env
# Fill in .env with token + connection string
npx tsx src/index.ts seed --item <itemId> --project <projectId>
```

Behavior:
1. Load `.env`.
2. Sanity check: APS token works (call MFG GraphQL with a tiny query).
3. Fetch the assembly's root component via `Query.item(itemId).tipRootModel.component`.
4. Walk the BOM tree using `bomRelations(depth: -1)` or recursive fetching (mirror the BOM tab's approach).
5. For each unique component, extract: `componentId`, `name.displayValue`, `partNumber.displayValue`, `description.displayValue`, `materialName.displayValue`, and the model's `id` (which IS the modelId we'll use as the key).
6. For each component, generate fake ERP data deterministically (seeded by modelId so re-runs are stable; only `lastUpdated` and `bestand` vary).
7. Upsert into MongoDB: `db.materials.updateOne({ modelId }, { $set: doc }, { upsert: true })`.
8. Print a summary: `Seeded 47 materials (43 inserted, 4 updated).`

### 3.5 Where the APS token comes from

For one-time seeding, simplest is: log in to the SPA in your browser, open DevTools, copy the token from sessionStorage (it's stored there by the auth flow). Paste into `.env`. The token's TTL is ~1 hour — long enough to seed a few dozen components.

The README in `scripts/seed-erp/` documents this step exactly so future maintainers can repeat the flow.

### 3.6 Fake data generator

`scripts/seed-erp/src/fakeData.ts`:

- Vendor names from `faker.company.name()`, pool of ~30 to keep distribution realistic.
- LIFNR like `V` + 6 digits, seeded by hash of vendor name.
- MATNR pulled from the Fusion part number; fall back to a generated 7-digit number if absent.
- MAKTX uppercased from Fusion description; fall back to component name.
- MTART weighted: 70% FERT (finished), 20% HALB (semi-finished), 10% ROH (raw).
- BESKZ: 50/50 split.
- DISMM: weighted toward PD (90%), occasional M1.
- PLIFZ: 7–42 days, uniform.
- EISBE: 5–100, uniform.
- STPRS: $0.50–$500, log-uniform so values feel like real costs.
- BESTAND (stock on hand): poisson-ish around 100. Allowed to vary per run.
- LASTUPDATED: now.

All randomness seeded by the modelId so re-runs are deterministic (except the explicitly-time-varying fields).

---

## Phase 4 — Security checklist before going public

- [ ] `.env`, `.env.development`, `.env.production` all in `.gitignore`. Confirm `git ls-files | grep -i env`.
- [ ] `scripts/seed-erp/.env` gitignored.
- [ ] `VITE_ERP_ENDPOINT_URL` only ever referenced via `import.meta.env`, never hardcoded.
- [ ] Atlas Allowed Request Origins limited to `tapnair.github.io` + `localhost:5173`. No `*`.
- [ ] APS token verification active in the function. Test by curl'ing without a token → 401.
- [ ] `erp_seeder` Atlas user is `readWrite` on `fusion_erp_demo` only (not admin, not cluster-wide).
- [ ] Network Access: ideally the user's IP, not `0.0.0.0/0` — but if convenience matters, 0.0.0.0/0 is acceptable because the user has built-in role limits.
- [ ] No mongo connection strings in any file under the repo.
- [ ] GitHub Actions secret `VITE_ERP_ENDPOINT_URL` set up correctly; build references it.

---

## Phase 5 — Tests

| File | Tests |
|---|---|
| `src/services/erp/erpClient.test.ts` | fetch URL composition, 200/404/401 handling, auth header. Mocks `global.fetch`. |
| `src/hooks/useErpData.test.tsx` | loading → success, loading → 404 empty, error path, modelId change cancels prior fetch, modelId null returns null without fetching. |
| `src/components/viewer/ErpTab.test.tsx` | empty modelId state, loading state, 404 empty state, populated state renders all field groups. |

Seed script does not need automated tests for v1 — it's a developer tool, not user-facing.

---

## Files

### New
- `.env.development.example`
- `src/services/erp/erpClient.ts`
- `src/services/erp/erpClient.test.ts`
- `src/hooks/useErpData.ts`
- `src/hooks/useErpData.test.tsx`
- `src/components/viewer/ErpTab.tsx`
- `src/components/viewer/ErpTab.test.tsx`
- `scripts/seed-erp/package.json`
- `scripts/seed-erp/tsconfig.json`
- `scripts/seed-erp/.env.example`
- `scripts/seed-erp/.gitignore`
- `scripts/seed-erp/README.md`
- `scripts/seed-erp/src/index.ts`
- `scripts/seed-erp/src/fusionClient.ts`
- `scripts/seed-erp/src/fakeData.ts`
- `scripts/seed-erp/src/mongoWriter.ts`

### Modified
- `.gitignore` — add `.env.production`, `.env.development`, `scripts/seed-erp/.env`
- `.github/workflows/deploy.yml` — wire `VITE_ERP_ENDPOINT_URL` secret into the build step
- `src/components/viewer/ViewerPropertiesPanel.tsx` — add tab strip, route content to `ErpTab` when on the ERP tab
- `README.md` — short note about the optional ERP-mock setup (point at this plan)

### Untouched
- Apollo cache config (the ERP path doesn't go through Apollo)
- The Authentication / token plumbing (we reuse `getAccessToken`)

---

## Risk / open items

| Risk | Mitigation |
|---|---|
| APS userinfo endpoint rate limit / latency on every read | Atlas function caches verified tokens? — out of scope for v1; userinfo is ~50ms typically. If it becomes a problem, add a 60s in-memory cache inside the function keyed by token hash. |
| App Service free-tier usage spikes | Atlas free tier gives ~1M requests/month; demo traffic shouldn't approach this. Monitor in Atlas dashboard. |
| Seeded data goes stale if Fusion components are renamed | Re-running the seed script is idempotent (upsert by modelId) — just rerun. |
| modelId changes across Fusion versions for the same logical part | Re-run seed; old entries become orphaned. Could add a cleanup pass that removes docs whose modelId no longer appears in the walked tree — defer. |
| GraphQL pagination for very large assemblies | `bomRelations` is paginated; seed script handles cursor loops. Mirror the BOM tab's loader logic. |

## Non-goals (v1)

- Write-back from the panel UI.
- Multi-plant or multi-currency display (one plant per material).
- Stock-history time-series.
- BOM-level rollup (cost-of-goods, lead-time aggregation).
- Real APS user → Mongo role mapping (every authenticated APS user sees the same data).
- A second collection for vendors / suppliers (flattened into the material doc instead).
- The script discovering assemblies automatically — user provides `itemId` + `projectId`.

---

*Last updated: 2026-05-29*
