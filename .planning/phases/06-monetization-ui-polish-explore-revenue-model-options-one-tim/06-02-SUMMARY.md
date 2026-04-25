---
phase: 06-monetization-ui-polish
plan: 02
subsystem: frontend-ui
tags: [dark-mode, empty-states, css, jsx, visual-fix]
one_liner: "Dark mode brand mark CSS fix + Library/History empty state upgrades with icon, expanded copy, and Start-a-sync CTA"

dependency_graph:
  requires: []
  provides: [dark-mode-brand-mark-fix, library-empty-state-cta, history-empty-state-cta]
  affects: [templates/index.html, static/src/screen_library.jsx, static/src/screen_history.jsx]

tech_stack:
  added: []
  patterns: [css-theme-override, react-empty-state-pattern, flex-column-centered-card]

key_files:
  created: []
  modified:
    - templates/index.html
    - static/src/screen_library.jsx
    - static/src/screen_history.jsx

decisions:
  - "Used var(--surface-2) + border var(--line) for dark brand mark — matches existing dark surface token hierarchy"
  - "Empty state icon size upgraded from 28 to 32px per UI-SPEC specification"
  - "Icon color changed from var(--ink-3) to var(--ink-4) per UI-SPEC — subtler in empty state context"
  - "onBack() prop already wired in both components — CTA reuses existing navigation callback"

metrics:
  duration_minutes: 5
  completed_date: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
  files_created: 0
---

# Phase 06 Plan 02: Dark Mode Fix + Empty State Upgrades Summary

Dark mode brand mark CSS fix + Library/History empty state upgrades with icon, expanded copy, and Start-a-sync CTA.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Dark mode brand mark CSS fix | 940bbde | templates/index.html |
| 2 | Upgrade Library and History empty states | 869c3dd | static/src/screen_library.jsx, static/src/screen_history.jsx |

## What Was Built

### Task 1: Dark Mode Brand Mark Fix (D-06)

Added `[data-theme="dark"] .brand-mark` CSS override immediately after the dark theme variable block in `templates/index.html`. The brand mark previously used `background: var(--ink)` which in dark mode resolves to `#F4F3EE` (near-white) — nearly invisible against the `#0C0C0A` dark topbar background.

Fix applies:
- `background: var(--surface-2)` — resolves to `#1E1E1B`, a visible dark surface
- `border: 1px solid var(--line)` — subtle edge definition against the dark bg

The lime "S" letter (`color: var(--accent)` = `#E6FF3D`) and the `::before` stripe gradient both remain inherited from the base `.brand-mark` rule and are unaffected.

### Task 2: Library and History Empty State Upgrades (D-07, D-08)

Both empty state blocks replaced with the upgraded flex-column centered layout per UI-SPEC:

**Library empty state:**
- Icon: `<IconDumbbell size={32}/>` at `var(--ink-4)`
- Heading: "No exercise mappings saved yet" — 13px weight 600
- Body: Full copy explaining mappings persist across syncs — 13px, line-height 1.5, max-width 420
- CTA: `.btn.btn-dark.btn-sm` "Start a sync" — calls `onBack()` routing to sync page

**History empty state:**
- Icon: `<IconHistory size={32}/>` at `var(--ink-4)`
- Heading: "No merged files yet" — 13px weight 600
- Body: Full copy explaining local output folder + Garmin Connect readiness — 13px, line-height 1.5, max-width 420
- CTA: `.btn.btn-dark.btn-sm` "Start a sync" — calls `onBack()` routing to sync page

Both use `display: flex; flex-direction: column; align-items: center; padding: 48px 32px; gap: 8px` with CTA `margin-top: 16px`.

## Deviations from Plan

None — plan executed exactly as written. CSS insertion point, JSX replacement blocks, copy, and layout values all match plan specifications verbatim.

## Known Stubs

None. The CTA buttons call `onBack()` which is already wired to `setPage("sync")` in app.jsx — no stub navigation.

## Threat Flags

None. Pure CSS and JSX visual changes with no new data flows, network endpoints, or trust boundaries.

## Self-Check: PASSED

- [x] `templates/index.html` line 52: `[data-theme="dark"] .brand-mark` rule exists with `surface-2` and `var(--line)`
- [x] `static/src/screen_library.jsx`: "No exercise mappings saved yet", "Start a sync", `btn-dark btn-sm`, `48px 32px`, `onBack()` — all present
- [x] `static/src/screen_history.jsx`: "No merged files yet", "Start a sync", `btn-dark btn-sm`, `48px 32px`, `onBack()` — all present
- [x] Commits 940bbde and 869c3dd exist in git log
