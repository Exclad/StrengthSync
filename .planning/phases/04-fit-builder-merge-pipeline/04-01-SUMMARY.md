---
phase: 04-fit-builder-merge-pipeline
plan: "01"
subsystem: models-parsers-test-stubs
tags: [models, fit-parser, test-stubs, phase4-foundation]
dependency_graph:
  requires: []
  provides:
    - models.BiometricSummary
    - models.GarminSetRecord
    - models.HevySetRecord
    - models.MergePreview
    - models.FitWorkout.avg_heart_rate
    - models.FitWorkout.max_heart_rate
    - fit_parser.parse_fit_file.avg_heart_rate
    - fit_parser.parse_fit_file.max_heart_rate
    - tests.conftest.sample_match_result
    - tests.test_fit_generator (7 xfail stubs)
  affects:
    - fit_generator.py (build_preview/build_merged_fit stubs added)
tech_stack:
  added: []
  patterns:
    - pytest xfail stubs for wave-based implementation
    - fitparse session message HR field extraction
key_files:
  created:
    - tests/test_fit_generator.py
  modified:
    - models.py
    - fit_parser.py
    - fit_generator.py
    - tests/conftest.py
decisions:
  - "Added build_preview, build_merged_fit, _validate_fit_output stubs to fit_generator.py so test imports succeed at collection time (Rule 3: fix blocking import error)"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-23"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 4 Plan 01: Wave 1 Foundation Summary

Wave 1 foundation: Phase 4 dataclasses added to models.py, FitWorkout extended with HR fields, fit_parser updated to extract avg/max HR from session messages, sample_match_result fixture added to conftest.py, and test_fit_generator.py created with 7 xfail stubs covering FIT-03, FIT-04, MERGE-01 through MERGE-04.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend models.py with Phase 4 dataclasses + FitWorkout HR fields | e2f8352 | models.py |
| 2 | Update fit_parser.py, add conftest fixture, create test stubs | 5c5d40a | fit_parser.py, fit_generator.py, tests/conftest.py, tests/test_fit_generator.py |

## Verification Results

- `from models import BiometricSummary, GarminSetRecord, HevySetRecord, MergePreview` — imports clean
- `FitWorkout` has `avg_heart_rate` and `max_heart_rate` fields (both `int | None = None`)
- `parse_fit_file("original_garmin.fit").avg_heart_rate == 114` — confirmed
- `parse_fit_file("original_garmin.fit").max_heart_rate == 151` — confirmed
- `pytest tests/test_fit_generator.py` — 7 tests collected, 7 xfailed (0 failures)
- Phase 3 tests still pass: 13/13
- Full suite (38 tests): all passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added function stubs to fit_generator.py**
- **Found during:** Task 2 — test file imports `from fit_generator import build_preview, build_merged_fit`; these did not exist
- **Issue:** `pytest --collect-only` would fail with ImportError, blocking test collection
- **Fix:** Added `build_preview`, `build_merged_fit`, and `_validate_fit_output` stubs raising `NotImplementedError` with descriptive messages referencing the wave that implements them
- **Files modified:** fit_generator.py
- **Commit:** 5c5d40a

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `build_preview` | fit_generator.py | Wave 3 implements — stub added to unblock test collection |
| `build_merged_fit` | fit_generator.py | Wave 3/4 implements — stub added to unblock test collection |
| `_validate_fit_output` | fit_generator.py | Wave 4 implements — stub added to unblock test collection |

These stubs are intentional foundations. All 7 tests referencing them are marked `xfail` and will be made to pass in subsequent waves (plans 04-02 through 04-04).

## Self-Check: PASSED

- `models.py` BiometricSummary/GarminSetRecord/HevySetRecord/MergePreview: FOUND
- `fit_parser.py` avg_heart_rate/max_heart_rate extraction: FOUND (4 lines)
- `tests/conftest.py` sample_match_result fixture: FOUND
- `tests/test_fit_generator.py` 7 test functions: FOUND
- Commit e2f8352: FOUND
- Commit 5c5d40a: FOUND
