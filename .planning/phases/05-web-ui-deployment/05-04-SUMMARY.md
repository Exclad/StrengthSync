---
phase: "05"
plan: "04"
subsystem: frontend-preview-done-wiring
status: partial  # Tasks 1+2 complete; Task 3 (human-verify checkpoint) pending
tags: [react, jsx, api-wiring, fetch, preview, export, blob-download, wave-2c]
dependency_graph:
  requires: [05-01, 05-02, 05-03]
  provides: [wired_preview_screen, wired_done_screen, app_step_guards]
  affects: [05-05-PLAN.md]
tech_stack:
  added: []
  patterns: [fetch-on-mount, blob-download, url-createobjecturl, app-state-guards]
key_files:
  created: []
  modified:
    - static/src/screen_preview.jsx
    - static/src/screen_done.jsx
    - static/src/app.jsx
decisions:
  - "ScreenPreview fetches /api/preview on mount using hevy_workout_index from matchResult"
  - "HR chart uses simple SVG polyline; empty state shown when heartRateSamples.length === 0"
  - "ScreenDone auto-starts /api/export on mount — no user click needed after Generate on ScreenPreview"
  - "Staggered log lines (400ms intervals) for UX feedback without blocking the fetch"
  - "handleDownload uses URL.createObjectURL + anchor.click() + URL.revokeObjectURL pattern"
  - "app.jsx appState extended to include uploadResult, matchResult, exercises, previewResult, timezone"
  - "handleRestart clears full appState and removes ss-step from localStorage"
  - "Dev deep-link step guard hydration preserved unchanged per plan instruction"
metrics:
  tasks_completed: 2
  tasks_total: 3
  files_created: 0
  files_modified: 3
---

# Phase 05 Plan 04: ScreenPreview + ScreenDone + app.jsx Wiring Summary (PARTIAL)

**One-liner:** ScreenPreview wired to /api/preview with real KPIs and HR chart; ScreenDone wired to /api/export with spinner-to-download-card flow and blob download; app.jsx step guards updated to real API state.

**Status:** Tasks 1 and 2 complete and committed. Awaiting Task 3 (human-verify checkpoint).

## What Was Built

### Task 1 — Wire ScreenPreview to POST /api/preview

Modified `static/src/screen_preview.jsx`:

- Added `preview`, `previewError`, `loading` state variables
- `useEffect` fetches `/api/preview` on mount with `hevy_workout_index` from `state.matchResult`
- 6-column KPI strip rendered from `preview.biometricSummary` (preserved=green dot, replaced=orange dot)
- HR chart: SVG polyline rendered from `heartRateSamples`; if empty shows "No HR data — this workout was recorded without a heart rate sensor." with `IconInfo`
- Exercise sequence grouped by `hevy_exercise_name` from `afterSets` with per-set reps × weight display
- Generate button disabled until preview loads; passes `{ preview, hevy_workout_index }` to `onNext`
- Error banner using `.chip.bad` + `IconWarn` pattern
- Removed all mock references: `HR_SAMPLES`, `SET_TIMELINE`, `HEVY_EXERCISES`, `HRChart` component

### Task 2 — Wire ScreenDone to POST /api/export + update app.jsx

Modified `static/src/screen_done.jsx`:

- Phase state: `generating | ready | error`
- Auto-starts `/api/export` POST on mount (no user click needed)
- Staggered log lines for UX during fetch (no artificial 1800ms delay — D-17)
- `handleDownload`: `URL.createObjectURL(blob)` + anchor click + `URL.revokeObjectURL`
- Ready phase: validation green-border banner, download card with filename + KB size, privacy notice, "Sync another workout" restart button
- Error phase: `.chip.bad` + `IconWarn` with exact error message from API (D-19 CRC message passthrough)

Modified `static/src/app.jsx`:

- `appState` extended: `uploadResult`, `matchResult`, `exercises`, `previewResult`, `timezone`, `hevyFile`
- Each screen `onNext` wires real API state into `appState` and advances step
- `handleRestart` resets full `appState` and clears `ss-step` from localStorage
- Dev deep-link step guard hydration preserved unchanged
- `ScreenDone` receives `state={appState}` + `onRestart={handleRestart}`

## Verification Results

```
tests/: 67 passed (0 failures)
```

All 67 tests GREEN. No regressions.

## Task Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1 — ScreenPreview wiring | 298681d | static/src/screen_preview.jsx |
| Task 2 — ScreenDone + app.jsx | 95f9d36 | static/src/screen_done.jsx, static/src/app.jsx |

## Deviations from Plan

None — plan executed exactly as written for Tasks 1 and 2.

## Known Stubs

None in completed tasks. All wiring calls real API endpoints.

## Threat Flags

| Flag | File | Status |
|------|------|--------|
| T-05-04-01: hevy_workout_index bounds | app.py /api/export | Mitigated server-side (Plan 05-01) |
| T-05-04-02: FIT binary blob in browser | screen_done.jsx | Accepted — URL.revokeObjectURL called after download |
| T-05-04-04: out_path construction | app.py | Mitigated server-side (Plan 05-01) |
