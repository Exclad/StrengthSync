---
phase: 06-monetization-ui-polish
plan: "04"
subsystem: frontend-settings
tags: [settings, ui, localStorage, modal, nav]
dependency_graph:
  requires: [06-01]
  provides: [settings-screen, settings-nav-tab]
  affects: [shell.jsx, app.jsx, index.html]
tech_stack:
  added: []
  patterns: [CDN-React-JSX, localStorage-persistence, fetch-POST-confirm-modal]
key_files:
  created:
    - static/src/screen_settings.jsx
  modified:
    - static/src/shell.jsx
    - static/src/app.jsx
    - templates/index.html
decisions:
  - "Used inline fontFamily strings ('JetBrains Mono', ui-monospace, monospace) because --font-mono CSS variable is not defined in index.html"
  - "Used useMemo to derive filteredTz to avoid inline filter in JSX for performance clarity"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-25T01:35:46Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 6 Plan 04: Settings Screen Summary

**One-liner:** New ScreenSettings component with 4 settings groups (timezone, filename, output folder, DB reset) wired into the nav pill via shell.jsx and app.jsx routing.

## What Was Built

### Task 1 — static/src/screen_settings.jsx (commit ab659a5)

Created the Settings screen component (`window.ScreenSettings`) with four card-based groups:

- **Group A (Timezone Default):** Filter input + scrollable select (size=5) populated from `GET /api/timezones`. "Use browser timezone" button calls `Intl.DateTimeFormat().resolvedOptions().timeZone` and sets the value. Persists to `localStorage['ss-timezone']` on change.
- **Group B (Export Filename):** Text input with debounced (300ms) persistence to `localStorage['ss-filename-pattern']`. Live preview box below renders the pattern with today's date and "Strength_Training" as sample workout name.
- **Group C (Output Folder):** Text input with `onBlur` persistence to `localStorage['ss-output-folder']`. Chip below shows current resolved path.
- **Group D (Danger Zone):** Button with `bad`-tinted background opens a confirmation modal. Modal shows current mapping count (fetched from `GET /api/mappings`), calls `POST /api/map/reset` on confirm. Success shows "All mappings cleared." chip. Failure shows "Couldn't clear mappings. Check the app is still running and try again." error chip.

### Task 2 — shell.jsx, app.jsx, index.html (commit 64fd51b)

- **shell.jsx:** Added `["settings","Settings"]` to nav array. Rail already only renders for `page === "sync"` — Settings inherits this correctly with no additional change.
- **app.jsx:** Added `{page === "settings" && <ScreenSettings onBack={() => setPage("sync")} setPage={setPage}/>}` alongside Library/History routes. Added `setPage={setPage}` prop to ScreenUpload for "Change in Settings" link support.
- **templates/index.html:** Added `screen_settings.jsx` script tag before `screen_library.jsx` (line 422).

## Deviations from Plan

None — plan executed exactly as written.

The plan noted `--font-mono` CSS variable but it is not defined in `index.html`. Used inline `fontFamily: "'JetBrains Mono', ui-monospace, monospace"` as the plan's fallback instruction specified — this is not a deviation, it is the stated fallback path.

## Known Stubs

None. All four settings groups are fully wired:
- Timezone: reads from `GET /api/timezones`, persists to localStorage
- Filename pattern: persists to localStorage with live preview
- Output folder: persists to localStorage
- DB reset: calls real `POST /api/map/reset` endpoint (implemented in plan 06-01)

## Threat Flags

No new security surface introduced. POST /api/map/reset was already implemented in plan 06-01. The confirmation modal in the UI prevents accidental use. Single-user local app — no remote attacker vector.

## Self-Check

### Created files exist:
- `static/src/screen_settings.jsx` — FOUND
- Commit ab659a5 — FOUND
- Commit 64fd51b — FOUND

### Acceptance criteria verified:
- `grep '"settings","Settings"' shell.jsx` — PASS (line 20)
- `grep "page === .settings." app.jsx` — PASS (line 117)
- `grep "ScreenSettings" app.jsx` — PASS (line 117)
- `grep "setPage={setPage}" app.jsx` — PASS (line 123)
- `grep "screen_settings.jsx" index.html` — PASS (line 422)
- `grep "window.ScreenSettings" screen_settings.jsx` — PASS (line 214)
- `grep "TIMEZONE DEFAULT" screen_settings.jsx` — PASS (line 77)
- `grep "EXPORT FILENAME" screen_settings.jsx` — PASS (line 117)
- `grep "OUTPUT FOLDER" screen_settings.jsx` — PASS (line 137)
- `grep "DANGER ZONE" screen_settings.jsx` — PASS (line 154)
- `grep "ss-timezone" screen_settings.jsx` — PASS (lines 7, 88, 103)
- `grep "ss-filename-pattern" screen_settings.jsx` — PASS (lines 8, 28)
- `grep "api/map/reset" screen_settings.jsx` — PASS (line 193)
- `grep "All mappings cleared" screen_settings.jsx` — PASS (line 157)
- `grep "Couldn't clear mappings" screen_settings.jsx` — PASS (line 198)

## Self-Check: PASSED
