---
phase: "05"
plan: "02"
subsystem: frontend-upload-wiring
tags: [react, jsx, api-wiring, fetch, timezone, upload, wave-2a]
dependency_graph:
  requires: [05-01]
  provides: [wired_upload_screen, timezone_fetch, upload_post]
  affects: [05-03-PLAN.md, 05-04-PLAN.md, 05-05-PLAN.md]
tech_stack:
  added: []
  patterns: [fetch-on-mount, formdata-post, inline-error-banner, controlled-select-filter]
key_files:
  created: []
  modified:
    - static/src/data.jsx
    - static/src/screen_upload.jsx
decisions:
  - "mulberry32 PRNG removed with mock HR_SAMPLES block — only used inside deleted code"
  - "Hevy file input wired with hevyInput ref and dedicated onChange storing File in state.hevyFile"
  - "Error banner placed below the CTA button in a flex column for visual proximity"
  - "canContinue gate includes !uploading to prevent double-submit during fetch"
  - "Demo seed guard checks _file===null and shows actionable error rather than failing silently on upload"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-24T05:10:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
---

# Phase 05 Plan 02: Frontend Upload Wiring Summary

**One-liner:** Mock data.jsx stubs cleared and ScreenUpload wired to real /api/timezones + /api/upload with filtered timezone select, FormData POST, and inline error banners.

## What Was Built

Wave 2a implementation replacing prototype mock data and wiring the Upload screen to the Flask API built in Wave 1.

### Task 1 — Replace mock globals in data.jsx with empty stubs

Rewrote data.jsx to remove all mock workout data:

- Removed `GARMIN_WORKOUTS`, `HEVY_WORKOUTS`, `HEVY_EXERCISES`, `HR_SAMPLES`, `SET_TIMELINE` mock constants (170+ lines of prototype data)
- Removed `mulberry32` PRNG (was only used in the deleted `HR_SAMPLES` IIFE block)
- Replaced all removed constants with empty array stubs (`[]`) to prevent `ReferenceError` in downstream screens before API fetches resolve
- Preserved `fmtTime`, `fmtDate`, `fmtDuration` helper functions unchanged
- `Object.assign(window, {...})` still present at end of file exporting all globals

### Task 2 — Wire ScreenUpload to GET /api/timezones and POST /api/upload

Extended screen_upload.jsx with real API behavior (visual structure unchanged, pixel-perfect per D-01):

**State additions:**
- `timezones` — populated from GET /api/timezones on mount
- `timezone` — selected IANA timezone string
- `tzFilter` — text filter for timezone select
- `uploadError` — inline error message string or null
- `uploading` — boolean, true while POST is in flight

**Timezone fetch on mount:**
```javascript
useEffect(() => {
  fetch('/api/timezones').then(r => r.json()).then(data => setTimezones(data)).catch(() => setTimezones([]));
}, []);
```

**Timezone UI:** Text filter input + `<select size={5}>` populated with filtered IANA zones from API. Placed between the upload grid and the CTA row.

**File object storage:** `addFiles()` now attaches `_file: f` (raw File object) to each fitFiles entry for FormData submission. Demo seed entries have `_file: null`.

**Hevy file picker:** Wired with `hevyInput` ref. `onChange` stores raw `File` in `state.hevyFile`. File mode UI shows filename + check on selection.

**canContinue gate:** `state.fitFiles.length > 0 && state.hevyMode && timezone && !uploading`

**handleContinue:** Async handler that:
1. Guards against demo data (`_file === null` → inline error)
2. Sets `uploading = true`
3. Builds `FormData` with `fit_file`, `hevy_csv`, `timezone`
4. POSTs to `/api/upload`
5. On 400: renders `body.error` in error banner
6. On 200: calls `update({ timezone, uploadResult: body })` then `onNext(body)`
7. On network error: shows "Network error. Is the app running?"

**Error banner:** `.chip.bad` with `IconWarn` + error text, rendered below the CTA button.

**Continue button:** Shows "Uploading…" while in flight; disabled + dimmed when `!canContinue`.

## Verification Results

```
tests/test_app_api.py: 9 passed (unchanged — no backend changes in this plan)
```

All 9 API route tests GREEN. No regressions.

### Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| fmtTime/fmtDate/fmtDuration preserved in data.jsx | PASS |
| GARMIN_WORKOUTS = [] stub in data.jsx | PASS |
| HR_SAMPLES = [] stub in data.jsx | PASS |
| Object.assign(window,...) still present | PASS |
| No large mock data blocks remain | PASS |
| grep "api/timezones" in screen_upload.jsx | PASS |
| grep "api/upload" in screen_upload.jsx | PASS |
| uploadError 2+ matches | PASS |
| IconWarn in error banner | PASS |
| timezone && in canContinue gate | PASS |
| No GARMIN_WORKOUTS/HEVY_WORKOUTS in screen_upload.jsx | PASS |

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 — data.jsx stubs | 1b779e5 | feat(05-02): replace mock data in data.jsx with empty stubs; preserve fmtTime/fmtDate/fmtDuration helpers |
| Task 2 — screen_upload.jsx wiring | 0f59522 | feat(05-02): wire ScreenUpload to GET /api/timezones and POST /api/upload |

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] Hevy file picker wired with ref and onChange**
- **Found during:** Task 2
- **Issue:** The plan specified `update({ hevyFile: e.target.files[0] })` in a file picker onChange, but the original `screen_upload.jsx` had no `<input>` element for Hevy files — it only showed a static placeholder drop zone in file mode.
- **Fix:** Added `hevyInput` ref + hidden `<input type="file" accept=".csv">` with Browse button, mirroring the FIT file picker pattern. File mode now shows filename + check icon when a file is selected.
- **Files modified:** static/src/screen_upload.jsx
- **Commit:** 0f59522

No other deviations from plan.

## Known Stubs

None. The upload screen is fully wired. The `state.hevyMode === "api"` branch still shows a static mock user profile ("maya.k@hevy") — this is intentional per context (OAuth Hevy API is a v2 deferred item, per 05-CONTEXT.md). The file mode branch is fully functional.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers:

| Flag | File | Status |
|------|------|--------|
| T-05-02-01: File DnD tampering | screen_upload.jsx | Accepted — server validates via fit_parser + hevy_parser |
| T-05-02-02: uploadError display | screen_upload.jsx | Mitigated — only body.error rendered, body.detail field not shown |
| T-05-02-03: Large file DoS | screen_upload.jsx | Accepted — local single-user app |

## Self-Check: PASSED

- static/src/data.jsx: FOUND at /workspace/GarminHevyMerge/static/src/data.jsx
- static/src/screen_upload.jsx: FOUND at /workspace/GarminHevyMerge/static/src/screen_upload.jsx
- Commit 1b779e5: FOUND
- Commit 0f59522: FOUND
- test_app_api.py: 9 passed
