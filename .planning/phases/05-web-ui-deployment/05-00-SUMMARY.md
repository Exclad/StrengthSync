---
phase: "05"
plan: "00"
subsystem: test-infrastructure
tags: [tdd, wave-0, flask, pytest, stubs]
dependency_graph:
  requires: []
  provides: [test_app_api_stubs, app_client_fixture]
  affects: [05-01-PLAN.md, 05-02-PLAN.md]
tech_stack:
  added: []
  patterns: [flask-test-client, pytest-fixture-extension]
key_files:
  created:
    - tests/test_app_api.py
  modified:
    - tests/conftest.py
decisions:
  - "_ROOT in test_app_api.py resolves to project root — worktree file-not-found errors are expected and pre-existing; tests will pass correctly in main workspace"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-24T04:34:49Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 05 Plan 00: Wave 0 Test Infrastructure Summary

**One-liner:** 9 pytest RED stubs for all Phase 5 Flask API routes with app_client fixture wired into conftest.py.

## What Was Built

Wave 0 test infrastructure for Phase 5 (Web UI + Deployment). Created the full set of Nyquist-compliant failing tests that Wave 1 will turn GREEN by implementing the corresponding Flask routes.

### Task 1 — app_client fixture (conftest.py)

Appended a `Phase 5 fixtures` block to `tests/conftest.py` containing the `app_client` pytest fixture. The fixture:
- Imports the Flask app from `app.py` via `sys.path.insert`
- Sets `TESTING=True` to surface exceptions as 500 responses
- Sets `SECRET_KEY` so Flask session signing works during tests
- Yields a `test_client()` context manager

All 7 pre-existing fixtures (sample_fit_path, output_dir, sample_hevy_path, sample_fit_workout, sample_hevy_workouts, tmp_db_path, sample_match_result) were left untouched.

### Task 2 — 9 RED stub tests (tests/test_app_api.py)

Created `tests/test_app_api.py` with exactly 9 stub test functions covering every Phase 5 API route:

| Test Function | Route | Wave 0 Status |
|---|---|---|
| test_index_serves_html | GET / | GREEN (route exists) |
| test_upload_valid_files | POST /api/upload | RED (route missing) |
| test_upload_invalid_fit | POST /api/upload | RED (route missing) |
| test_upload_corrupt_fit | POST /api/upload | RED (route missing) |
| test_upload_invalid_csv | POST /api/upload | RED (route missing) |
| test_timezones_endpoint | GET /api/timezones | RED (route missing) |
| test_map_suggest | POST /api/map/suggest | RED (route missing) |
| test_map_confirm | POST /api/map/confirm | RED (route missing) |
| test_export_returns_fit | POST /api/export | RED (route missing) |

## Verification Results

```
9 tests collected
1 PASSED (test_index_serves_html — GET / exists)
8 FAILED (routes not yet implemented — correct Wave 0 behavior)
```

Pre-existing test suite: 36 tests pass, 22 errors (pre-existing worktree file-not-found for sample files — not caused by this plan).

## Commits

| Task | Commit | Message |
|---|---|---|
| Task 1 | 6d59824 | test(05-00): add app_client fixture to conftest.py |
| Task 2 | 6457318 | test(05-00): create test_app_api.py with 9 RED stub tests |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The test file itself is the stub artifact by design (Wave 0 TDD pattern). No implementation stubs introduced.

## Threat Flags

None. The test-only SECRET_KEY ("test-secret-key-phase5") is isolated to the test context and never used in production (app.py does not configure SECRET_KEY from tests). Sample files (original_garmin.fit, original_hevy.csv) are dev-only fixtures with no PII.

## Self-Check: PASSED

- tests/test_app_api.py: FOUND
- tests/conftest.py app_client fixture: FOUND
- Commit 6d59824: FOUND
- Commit 6457318: FOUND
