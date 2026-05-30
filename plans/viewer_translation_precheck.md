# Viewer Translation Manifest Pre-check

*Plan created: 2026-05-29 (after-the-fact write-up)*

## Status: ✅ Implemented (commit `c960c2c`)

## Problem

Every visit to the **View** tab walked the full "Starting translation job → Generating viewable" sequence — even for items whose viewable already existed on the Model Derivative server. `useViewerTranslation` was POSTing a translation job unconditionally on every mount, and `setInterval` waited a full 5s before its first manifest poll.

For an already-translated item this meant:
- ~500ms–2s of "Starting translation job…" while we did the redundant POST.
- ≥5s of "Generating viewable…" while we waited for the first poll tick.

…to display something the server had been ready to give us immediately.

## Fix (`src/hooks/useViewerTranslation.ts`)

Re-order to **GET manifest first**, branch on its state:

| Manifest state | Action |
|---|---|
| `success` | Skip POST and polling entirely. Set status to `'ready'`. |
| `null` (404 — no job yet) | POST translation job, then poll. |
| `'inprogress'` / `'pending'` | Skip POST (job is already running). Just poll. |
| `'failed'` / `'timeout'` | POST again to retry, then poll. |

Also extracted the poll body into a `pollOnce` helper and made `startPolling` run it **immediately** before arming `setInterval`. The 5s interval still applies to follow-up polls, but the first check is synchronous-ish.

## Verify

- Re-open the View tab for an already-translated item: brief "Starting translation job…" during the DM + manifest calls, then the viewer loads. No "Generating viewable…" phase.
- First-time translation: same UX as before — POST + progressing manifest polls.
- Translation already running (e.g. started by another user / earlier tab): now skips the redundant POST.

## Trade-offs

- One extra GET on the cold path (item that's never been translated). Negligible.
- The retry-on-revisit behavior for previously-failed translations is preserved — `'failed'` / `'timeout'` still triggers a fresh POST.
