---
phase: 06-monetization-ui-polish
plan: "01"
subsystem: api
tags: [flask, sqlite, api, mappings]
dependency_graph:
  requires: []
  provides: [POST /api/map/reset]
  affects: [database.py, app.py]
tech_stack:
  added: []
  patterns: [DELETE FROM table, jsonify ok+count response]
key_files:
  created: []
  modified:
    - database.py
    - app.py
decisions:
  - "No auth/confirmation logic in backend — confirmation modal is frontend responsibility (Wave 3)"
  - "Returns deleted row count alongside ok:true for transparency to callers"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-25T01:05:33Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 2
---

# Phase 06 Plan 01: Add POST /api/map/reset Endpoint Summary

Backend prerequisite for the Settings screen "Clear all exercise mappings" button — adds `reset_all_mappings_db` to database.py and `POST /api/map/reset` to app.py, truncating the confirmed_mappings table and returning the deleted row count.

## What Was Built

- `reset_all_mappings_db(db_path)` in `database.py`: issues `DELETE FROM confirmed_mappings`, commits, returns `cur.rowcount`
- `POST /api/map/reset` route in `app.py` (`api_map_reset`): calls the DB function, returns `{"ok": true, "deleted": N}`
- No request body parsing — the endpoint is intentionally parameter-free; the UI confirmation modal guards against accidents

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add reset_all_mappings_db and POST /api/map/reset | f37b7bf | database.py, app.py |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. T-06-01 threat (Tampering via unauthenticated local POST) was evaluated in the threat model and accepted — single-user local app, UI confirmation modal provides accidental-deletion guard.

## Self-Check: PASSED

- database.py: FOUND
- app.py: FOUND
- commit f37b7bf: FOUND
