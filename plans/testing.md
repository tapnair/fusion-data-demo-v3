# Plan: Testing Strategy

## Fusion Data Demo v3

> **Goal:** Introduce a practical, maintainable test suite that catches regressions,
> documents intended behaviour, and integrates into the existing GitHub Actions CI pipeline.

*Plan created: 2026-04-11*

---

## Recommended Framework: Vitest + Testing Library + Playwright

| Layer | Tool | Why |
|-------|------|-----|
| Unit + Integration | **Vitest** | Native Vite integration — shares the same config, transforms, and module resolution. Jest-compatible API. Dramatically faster than Jest for Vite projects. Built-in TypeScript. |
| Component | **@testing-library/react** | The standard for React testing. Encourages testing from the user's perspective (queries by role/label/text), not implementation details. Works seamlessly with Vitest. |
| E2E | **Playwright** | First-class TypeScript support, parallel execution, reliable browser automation. Best choice when OAuth is involved because it can persist auth state across tests. |

---

## What Types of Tests to Write

### 1. Unit Tests — Pure Logic (Highest ROI)

Test pure functions in isolation. No DOM, no network, no React. Fast to write and run.

| File | What to test |
|------|-------------|
| `src/utils/propertyValue.ts` | `coercePropertyValue` — all specification types (STRING, INTEGER, FLOAT, BOOLEAN, DISTANCE, DENSITY, MASS, VOLUME, AREA), edge cases (NaN, non-integer floats for INTEGER, invalid boolean strings, empty input, whitespace-only) |
| `src/apollo/pagedField.ts` | `pagedField` merge (deduplication, incremental pages, first page with no existing) and read (returns array from ref-keyed object, handles undefined existing) |
| `src/services/auth/pkceHelper.ts` | `generateCodeVerifier` (correct length, valid charset), `generateCodeChallenge` (SHA-256 → base64url), `generateState` (valid format) |
| `src/services/thumbnailImageCache.ts` | `getThumbnailBlob`, `setThumbnailBlob`, `evictStaleEntries` (TTL boundary), `clearThumbnailCache` — requires fake IndexedDB via `fake-indexeddb` |
| BOM formatter helpers in `bomColumns.ts` | `formatDisplayValue` (unit lookup, sig-fig rounding), `UNIT_ABBREVIATIONS` map coverage |
| `src/components/detail/tabs/ContentsTab.tsx` | `formatBytes` helper (byte boundaries: B, KB, MB, GB), `formatExtensionType` (known + unknown extension types) |

### 2. Hook Integration Tests — React + Apollo Mocked

Test custom hooks against a mocked Apollo client. No real network calls.

| Hook | What to test |
|------|-------------|
| `useQueryLog` / `loggingLink` | Entries accumulate in context; cap at 200; `clearLog` empties; `addEntry` puts newest first |
| `useBomThumbnail` | Polling starts when status is WORKING; stops when terminal; `thumbnailGeneration` bump triggers refetch |
| `useBomBaseProperties` | Cache-first: second render with same componentId does not fire a second network request |
| `useHubBasePropertyDefinitions` | Definitions are flattened across collections; `isHidden`/`isArchived` filtered out |

### 3. Component Tests — Render + Interaction

Render components with a mock Apollo provider and test user-visible behaviour.

| Component | What to test |
|-----------|-------------|
| `BomColumnSettings` | Columns toggle on/off; persistence to localStorage; "Precision" menu opens and updates selection; "Refresh Thumbnails" button calls callback |
| `DetailPanel` | Correct tabs rendered per node type (hub: Details+Users; folder: Details+Users+Contents; DesignItem: Details+BOM+View); tab switching; active tab preserved on same-type node change |
| `ProtectedRoute` | Redirects to `/` when not authenticated; renders children when authenticated |
| `UsersTab` | Grid renders member rows; clicking Remove opens confirmation dialog; "Add Members" dialog validates email input |
| `BomBasePropCellInner` | Display mode → click → edit mode; Escape cancels; Enter commits; read-only cells show lock icon and are not clickable |

---

## Package Installation

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom fake-indexeddb
```

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner + assertion library |
| `@vitest/ui` | Browser-based interactive test UI |
| `jsdom` | DOM environment for component tests |
| `@testing-library/react` | `render`, `screen`, `fireEvent`, `waitFor` |
| `@testing-library/user-event` | Realistic user interactions (typing, clicking) |
| `@testing-library/jest-dom` | Custom DOM matchers (`toBeInTheDocument`, `toBeDisabled`, etc.) |
| `fake-indexeddb` | In-memory IndexedDB polyfill for `thumbnailImageCache` tests |

---

## Configuration

### `vitest.config.ts` (new file)

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/utils/**', 'src/apollo/pagedField.ts', 'src/services/**', 'src/hooks/**'],
      exclude: ['src/graphql/**', 'src/types/**', 'src/theme/**'],
    },
  },
})
```

### `src/test/setup.ts` (new file)

```typescript
import '@testing-library/jest-dom'
// Additional global setup: reset mocks, configure fake-indexeddb, etc.
```

---

## File Structure

```
src/
  test/
    setup.ts                          # global test setup (@testing-library/jest-dom import)
    mockApolloClient.ts               # reusable Apollo mock factory
    mockAuthContext.tsx               # AuthContext test wrapper
  utils/
    propertyValue.test.ts
  apollo/
    pagedField.test.ts
  services/
    auth/
      pkceHelper.test.ts
    thumbnailImageCache.test.ts
  hooks/
    useBomThumbnail.test.tsx
    useBomBaseProperties.test.tsx
    useQueryLog.test.tsx
  components/
    detail/
      DetailPanel.test.tsx
      tabs/
        bom/
          BomColumnSettings.test.tsx
          BomBasePropCellInner.test.tsx
    auth/
      ProtectedRoute.test.tsx
```

---

## npm Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest run --coverage",
}
```

---

## CI Integration (`.github/workflows/deploy.yml`)

Add a test step before the build:

```yaml
- name: Run unit + component tests
  run: npm test

- name: Generate coverage report
  run: npm run test:coverage
  # Coverage is informational only — does not block the build

- name: Build project
  run: npm run build

- name: Deploy to GitHub Pages
  run: npm run deploy
```

If the test step fails, the deploy is blocked. Coverage report is generated as an artifact but does not enforce a minimum threshold.

---

## Implementation Phases

### Phase 1 — Scaffold
- Install packages
- Create `vitest.config.ts`, `src/test/setup.ts`
- Add npm scripts

### Phase 2 — Unit Tests (Pure Functions)
- `propertyValue.test.ts` — all specification types + edge cases
- `pagedField.test.ts` — merge deduplication + read conversion
- `pkceHelper.test.ts` — verifier format, challenge derivation
- `thumbnailImageCache.test.ts` — IndexedDB operations via `fake-indexeddb`

### Phase 3 — Hook Tests
- `useQueryLog.test.tsx`
- `useBomThumbnail.test.tsx`

### Phase 4 — Component Tests
- `ProtectedRoute.test.tsx`
- `BomColumnSettings.test.tsx`
- `DetailPanel.test.tsx` — tab visibility per node type
- `BomBasePropCellInner.test.tsx`

### Phase 5 — CI Integration
- Add test step to deploy workflow
- Ensure E2E tests run separately (scheduled or manual trigger)

---

## Decisions

| Q | Answer |
|---|--------|
| Q1 — Primary goal of testing? | **Both** — catch regressions AND serve as living documentation of intended behaviour for future contributors and Claude sessions |
| Q2 — E2E tests? | **Skip entirely** — unit + component tests are sufficient; no test credentials available for CI |
| Q3 — Coverage enforcement? | **Report only** — `vitest --coverage` generates HTML + text reports; no threshold blocks the build |

