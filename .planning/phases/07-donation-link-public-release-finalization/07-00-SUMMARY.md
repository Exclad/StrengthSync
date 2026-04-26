---
phase: 07-hevy-import-ux-donation-link
plan: "00"
subsystem: tests
tags: [tdd, red-stubs, phase7, hevy-api, test-infrastructure]
dependency_graph:
  requires: []
  provides: [test-contracts-phase7-wave1]
  affects: [tests/test_app_api.py, tests/test_hevy_parser.py]
tech_stack:
  added: []
  patterns: [tdd-red-green, stub-before-impl]
key_files:
  created: []
  modified:
    - tests/test_app_api.py
    - tests/test_hevy_parser.py
decisions:
  - "parse_hevy_api_response import placed inside test body (not module level) to keep 5 existing hevy_parser tests GREEN while new stub is RED"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-26T06:07:51Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 7 Plan 00: RED Stubs for Phase 7 Behaviors Summary

5 RED test stubs establishing API contracts for Hevy API integration — cache-status, upload-cache-write, hevy-test key validation, hevy-workouts fallback, and parse_hevy_api_response conversion.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add 4 RED stubs to test_app_api.py | f55c1cc | tests/test_app_api.py |
| 2 | Add 1 RED stub to test_hevy_parser.py | 2a075ad | tests/test_hevy_parser.py |

## Results

- 67 existing tests: GREEN (unchanged)
- 5 new stubs: RED (expected — routes and function don't exist yet)
- Full suite: `5 failed, 67 passed`

### New stubs added

**tests/test_app_api.py:**
- `test_hevy_cache_status` — GET /api/hevy/cache-status returns 200 with exists/workout_count/last_updated
- `test_upload_writes_cache` — POST /api/upload copies hevy CSV to data/hevy_cache.csv
- `test_hevy_test_invalid_key` — POST /api/hevy/test with bad key returns {ok: false, reason: ...}
- `test_hevy_workouts_fallback` — GET /api/hevy/workouts returns {error: no_cache_fallback} when no cache

**tests/test_hevy_parser.py:**
- `test_parse_hevy_api_response` — parse_hevy_api_response() converts API dicts to list[HevyWorkout]

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Import Strategy] Kept parse_hevy_api_response import inside test body**

- **Found during:** Task 2
- **Issue:** The plan noted that a module-level import of `parse_hevy_api_response` would cause ImportError, failing ALL hevy_parser tests (not just the new stub). The plan explicitly allowed moving the import inside the test body.
- **Fix:** Import placed inside `test_parse_hevy_api_response()` body, matching the plan's fallback guidance. All 5 existing hevy_parser tests remain GREEN; only the new stub is RED.
- **Files modified:** tests/test_hevy_parser.py
- **Commit:** 2a075ad

**2. [Rule 3 - Blocking Issue] tests/ directory in .gitignore required force-add**

- **Found during:** Task 1 commit
- **Issue:** `.gitignore` includes `tests/` — git refused to stage test files normally.
- **Fix:** Used `git add -f` to force-add the test files as required by the plan (tests must be committed for Wave 1 agents to run them).
- **Files modified:** tests/test_app_api.py, tests/test_hevy_parser.py
- **Commits:** f55c1cc, 2a075ad

## Known Stubs

All 5 tests are intentional RED stubs. They represent the contracts Wave 1 implementation must satisfy. No unintentional stubs exist.

## Threat Flags

None — test files only; no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- tests/test_app_api.py exists: FOUND
- tests/test_hevy_parser.py exists: FOUND
- Commit f55c1cc exists: FOUND
- Commit 2a075ad exists: FOUND
- 67 existing tests GREEN: CONFIRMED
- 5 new stubs RED: CONFIRMED
