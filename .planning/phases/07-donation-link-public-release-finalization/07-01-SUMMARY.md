---
phase: 07-hevy-import-ux-donation-link
plan: "01"
subsystem: backend
tags: [hevy-api, cache, donation-link, flask-routes, tdd-green]
dependency_graph:
  requires: [07-00]
  provides: [backend-phase7-wave1]
  affects: [app.py, hevy_parser.py]
tech_stack:
  added: []
  patterns: [urllib-stdlib-http, shutil-copy2-cache, tdd-red-green]
key_files:
  created: []
  modified:
    - hevy_parser.py
    - app.py
decisions:
  - "API key for /api/hevy/test received in JSON body (not query param) — prevents key appearing in Flask access logs (T-07-01)"
  - "Cache write in /api/upload is best-effort non-fatal — OSError is silently caught so primary upload flow is never blocked (T-07-02)"
  - "DONATION_URL set to '#' placeholder — plan-specified value; operator replaces with real URL"
  - "parse_hevy_api_response produces naive UTC datetimes (not local) — caller sets hevy_tz_mode=utc to skip localization in matcher.py"
  - "_fetch_hevy_api_workouts uses max_pages=200 and timeout=15s — prevents runaway pagination (T-07-05)"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-26T06:30:00Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 7 Plan 01: Backend Routes and Cache Write Summary

Backend extension implementing Hevy API integration, cache management, and donation URL constant — turning all 5 Phase 7 RED stubs GREEN with parse_hevy_api_response(), 4 new Flask routes, /api/config, and /api/upload cache write.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add parse_hevy_api_response() to hevy_parser.py | 9e8dba5 | hevy_parser.py |
| 2 | Extend app.py — constants, 4 new routes, extended /api/upload | 4ba6608 | app.py |

## Results

- 14 previously passing tests in worktree: GREEN (unchanged)
- 5 RED stubs from Wave 0: all GREEN
- Full worktree suite: `19 passed, 0 failed`

### Stubs turned GREEN

- `test_parse_hevy_api_response` — parse_hevy_api_response() converts API dicts to list[HevyWorkout] with naive UTC timestamps
- `test_hevy_cache_status` — GET /api/hevy/cache-status returns 200 with exists/workout_count/last_updated
- `test_upload_writes_cache` — POST /api/upload copies hevy CSV to data/hevy_cache.csv
- `test_hevy_test_invalid_key` — POST /api/hevy/test with bad key returns {ok: false, reason: ...}
- `test_hevy_workouts_fallback` — GET /api/hevy/workouts returns {error: no_cache_fallback} when API fails and no cache exists

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `DONATION_URL = "#"` in app.py (line ~53) — intentional placeholder. The operator must replace `"#"` with a real donation URL (Ko-fi, GitHub Sponsors, PayPal.me). Waves 2b/2c will wire this into the Settings UI via GET /api/config.

## Threat Flags

None — all threat model mitigations from 07-01-PLAN.md are implemented:
- T-07-01: API key in JSON body (not query param)
- T-07-02: Cache write only after hevy_workouts confirmed non-empty
- T-07-05: max_pages=200 guard and timeout=15s in _fetch_hevy_api_workouts

## Self-Check: PASSED

- hevy_parser.py modified: FOUND
- app.py modified: FOUND
- Commit 9e8dba5 exists: FOUND
- Commit 4ba6608 exists: FOUND
- 19/19 worktree tests GREEN: CONFIRMED
- 5 RED stubs from Wave 0 now GREEN: CONFIRMED
