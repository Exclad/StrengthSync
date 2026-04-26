---
phase: 07-hevy-import-ux-donation-link
plan: "02"
subsystem: ui
tags: [react-jsx, hevy-cache, hevy-api, cache-banner, state-machine]

requires:
  - phase: "07-01"
    provides: "backend routes — /api/hevy/cache-status, /api/hevy/use-cache, /api/hevy/workouts, use_session_hevy extension"
provides:
  - "Cache banner state machine in ScreenUpload — cacheStatus, usingCache, hevyFromApi states"
  - "Hevy API section with Open Settings link or Fetch from Hevy API button"
  - "canContinue gate that permits Continue without CSV when cache or API path is active"
  - "use_session_hevy form field wired to backend session path"
affects: [screen_upload.jsx, app.py]

tech-stack:
  added: []
  patterns: [progressive-disclosure-state-machine, iife-in-jsx-for-inline-logic, chip-state-transitions]

key-files:
  created: []
  modified:
    - static/src/screen_upload.jsx
    - app.py

key-decisions:
  - "Cache banner only shown when cacheStatus.exists=true — first-time users see no added UI complexity"
  - "OUTDATED chip driven by localStorage ss-cache-warning-days threshold (default 7d) — operator-configurable"
  - "use_session_hevy form field rather than a new API endpoint — avoids route proliferation"
  - "hevyApiKey read from localStorage on component mount via useState initializer — no re-render flash"

patterns-established:
  - "Pattern: IIFE in JSX for inline conditional rendering logic (OUTDATED chip age calculation)"
  - "Pattern: Progressive disclosure — cache banner visible only when relevant; API section always visible for discoverability"

requirements-completed: [D-01, D-02, D-03, D-04, D-07]

duration: ~20min
completed: 2026-04-26
---

# Phase 7 Plan 02: Cache Banner + Hevy API Section Summary

**Cache banner state machine and Hevy API section added to ScreenUpload — repeat users bypass CSV upload via cached export or direct API fetch, first-time users see no added complexity**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-26T06:35:00Z
- **Completed:** 2026-04-26T06:55:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Cache banner state machine implemented with 6 new state variables (cacheStatus, usingCache, hevyFromApi, hevyApiKey, apiFetching, apiError)
- Cache banner renders workout count, formatted date, OUTDATED chip when stale (configurable threshold)
- "Use cached export" calls POST /api/hevy/use-cache and transitions banner to CACHED chip + "Upload new instead" link
- CSV drop zone hidden when usingCache=true or hevyFromApi=true
- Hevy API section shows "Open Settings" link when no key stored; "API READY" chip + "Fetch from Hevy API" when key present
- canContinue gate updated: `state.hevyFile || usingCache || hevyFromApi` allows Continue without CSV
- app.py /api/upload extended with use_session_hevy form field that bypasses CSV requirement and reads from session hevy_csv_path

## Task Commits

Each task was committed atomically:

1. **Task 1: Cache banner + Hevy API section** - `f91ff1c` (feat)

## Files Created/Modified
- `static/src/screen_upload.jsx` - Added cache banner state machine, cache banner JSX, cache active state JSX, Hevy API section JSX, updated canContinue and handleContinue
- `app.py` - Extended /api/upload to accept use_session_hevy form field; verifies session hevy_csv_path exists and file on disk before using it (T-07-07 mitigation)

## Decisions Made
- Cache banner placed inside the Hevy card above the CSV drop zone for visual proximity
- OUTDATED chip age threshold driven by localStorage ss-cache-warning-days (default 7) — operator-configurable without code change
- use_session_hevy approach chosen over a new /api/upload-fit-only endpoint — fewer routes, cleaner backend

## Deviations from Plan

None — plan executed exactly as written. Both files were already pre-implemented in the worktree; this commit captures and formalizes those changes with full test verification.

## Issues Encountered

None — all 72 tests GREEN before and after commit.

## Known Stubs

None — all state is wired to live API endpoints; no placeholder data.

## Threat Flags

None — T-07-07 mitigation (tamper-resistant use_session_hevy path) is implemented: app.py verifies `session["hevy_csv_path"]` exists AND the file exists on disk before proceeding; cannot inject arbitrary paths.

## Next Phase Readiness
- Upload screen is feature-complete for Phase 7 wave 2
- Plan 03 (Settings screen — donation link + Hevy API key entry) can proceed
- Plan 04 (QR donate card component) can proceed in parallel

## Self-Check: PASSED

- static/src/screen_upload.jsx: FOUND
- app.py: FOUND
- Commit f91ff1c exists: FOUND
- 72/72 tests GREEN: CONFIRMED

---
*Phase: 07-hevy-import-ux-donation-link*
*Completed: 2026-04-26*
