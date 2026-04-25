---
phase: 06-monetization-ui-polish
plan: "03"
subsystem: frontend-error-ux
tags: [error-copy, ux-polish, exercise-mapping, unresolved-affordance]
dependency_graph:
  requires: []
  provides: [actionable-error-copy, unresolved-exercise-affordance]
  affects: [screen_upload.jsx, screen_match.jsx, screen_map.jsx]
tech_stack:
  added: []
  patterns: [problem-cause-action error copy, conditional class pattern, forced-open search]
key_files:
  created: []
  modified:
    - static/src/screen_upload.jsx
    - static/src/screen_match.jsx
    - static/src/screen_map.jsx
decisions:
  - "Smart error detection in upload: detect FIT parse/invalid/CSV errors by string matching on backend rawError"
  - "Replace all three screen catch blocks with consistent 'couldn't reach the app' copy"
  - "Force showSearch open for unmapped exercises via condition change from {showSearch} to {showSearch || exercise.status === 'unmapped'}"
  - "Warn-tinted inset box inserted BEFORE the AI suggestions row in MappingDetail for unmapped status"
  - "Skip button uses template literal for conditional class rather than two separate elements"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 06 Plan 03: Error Copy and UNRESOLVED Exercise Affordance Summary

Actionable error copy across Upload/Match/Map screens and a prominent warn-tinted UNRESOLVED affordance in MappingDetail with forced search expansion and promoted skip button.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update error copy in screen_upload.jsx and screen_match.jsx | 36bcdf8 | static/src/screen_upload.jsx, static/src/screen_match.jsx |
| 2 | Update map error copy and UNRESOLVED affordance in screen_map.jsx | 27c0dd7 | static/src/screen_map.jsx |

## What Was Built

### Task 1 — Upload and Match Error Copy

**screen_upload.jsx:** Replaced the generic `body.error || 'Upload failed.'` fallback with smart error detection in `handleContinue`. The logic inspects the backend `rawError` string and routes to one of four messages:
- FIT parse/invalid errors: prefixes with "Couldn't read the FIT file." and appends "Try exporting a fresh copy from Garmin Connect."
- Generic FIT errors: "That file doesn't look like a Garmin FIT file. Export from Garmin Connect → Activity → ⋯ → Export original."
- CSV/Hevy errors: "The CSV doesn't match Hevy's export format. In Hevy: Profile → Settings → Export Workout Data → Download."
- Fallback (no rawError): same FIT message as default.

The network catch block ("Network error. Is the app running?") was left unchanged — already actionable per UI-SPEC.

**screen_match.jsx:** Both the auto-match `useEffect` and the `handleManualMatch` fetch paths were updated identically (both had the same inline pattern, replaced using `replace_all`). No-match and ambiguous-match errors now detect keywords in the backend error string. Network catch updated to "Network error — couldn't reach the app. Refresh and try again if the problem persists."

### Task 2 — Map Error Copy and UNRESOLVED Affordance

**Error copy:**
- `handleConfirm` non-OK path: "Couldn't save that mapping. Check the app is still running and try again."
- `handleConfirm` catch: "Network error — couldn't reach the app. Refresh and try again if the problem persists."

**Unresolved chip:** Changed from `<span className="chip warn">` to `<span className={chip ${unresolvedCount > 0 ? 'bad' : 'warn'}}>` and copy from "UNRESOLVED" to "NEED ACTION".

**MappingDetail UNRESOLVED affordance (D-10):**
- For `exercise.status === 'unmapped'`: a warn-tinted inset box (`color-mix(in oklab, var(--warn) 8%, var(--surface))` background with matching border) inserted before the "AI suggestions" row. Contains an `IconWarn` + "No automatic match found" heading and sub-text guiding the user to search or skip.
- The search panel condition changed from `{showSearch && (...)}` to `{(showSearch || exercise.status === 'unmapped') && (...)}` — search is always expanded for unmapped exercises.
- For `exercise.status === 'needs-review'`: italic 12px warn-colored note "Low confidence match. Review before continuing." inserted above the suggestion list.
- Skip button: conditional class (`btn-sm` dropped for unmapped) and copy ("Skip — keep Garmin's original exercise" vs. "Skip this exercise — keep Garmin's guess").

## Deviations from Plan

None — plan executed exactly as written. The `replace_all` approach was used for `screen_match.jsx` because both `useEffect` and `handleManualMatch` had identical error handler patterns, which was the intended outcome per the plan's Task 1 action instructions.

## Known Stubs

None. All changes are string/logic only — no data sources, no placeholder values.

## Threat Flags

No new trust boundaries introduced. Error copy renders backend-provided strings in banners (T-06-03, accepted in threat model — no server internals exposed beyond what already existed).

## Self-Check

### Files exist:
- static/src/screen_upload.jsx — FOUND (modified)
- static/src/screen_match.jsx — FOUND (modified)
- static/src/screen_map.jsx — FOUND (modified)

### Commits exist:
- 36bcdf8: feat(06-03): update Upload and Match screen error copy — FOUND
- 27c0dd7: feat(06-03): update Map screen error copy and UNRESOLVED exercise affordance — FOUND

### Acceptance criteria:
- `grep "doesn't look like a Garmin FIT file" screen_upload.jsx` — PASS (line 56, 62)
- `grep "Export Workout Data" screen_upload.jsx` — PASS (line 58)
- `grep "No Hevy workout found within 30 minutes" screen_match.jsx` — PASS (lines 21, 29, 54, 62)
- `grep "couldn't reach the app" screen_match.jsx` — PASS (lines 38, 71)
- `grep -c "Match failed\." screen_match.jsx` — PASS (0)
- `grep "NEED ACTION" screen_map.jsx` — PASS (line 289)
- `grep "Couldn't save that mapping" screen_map.jsx` — PASS (line 83)
- `grep "No automatic match found" screen_map.jsx` — PASS (line 464)
- `grep "Low confidence match" screen_map.jsx` — PASS (line 509)
- `grep "status === 'unmapped'" screen_map.jsx` — PASS (multiple matches including forced search at line 484)
- `grep "Skip — keep Garmin" screen_map.jsx` — PASS (line 550)
- `grep -c "Confirm failed\." screen_map.jsx` — PASS (0)

## Self-Check: PASSED
