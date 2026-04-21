---
phase: 02-core-parsers
plan: 01
subsystem: models-and-test-scaffold
tags:
  - python
  - dataclasses
  - pytest
  - fit
  - hevy
  - scaffolding
dependency_graph:
  requires: []
  provides:
    - models.FitWorkout
    - models.HRSample
    - models.GPSPoint
    - models.CadenceSample
    - models.PowerSample
    - models.HevyWorkout
    - models.HevyExercise
    - models.HevySet
    - tests.conftest.sample_hevy_path
    - tests.test_fit_parser (RED stubs)
    - tests.test_hevy_parser (RED stubs)
  affects:
    - fit_parser.py (Plan 02 implements parse_fit_file against these contracts)
    - hevy_parser.py (Plan 03 implements parse_hevy_csv against these contracts)
tech_stack:
  added: []
  patterns:
    - Python dataclasses with field(default_factory=list) for optional sensor lists
    - from __future__ import annotations for PEP 563 forward references
    - pytest fixtures with absolute path assertions
key_files:
  created:
    - models.py
    - tests/test_fit_parser.py
    - tests/test_hevy_parser.py
  modified:
    - tests/conftest.py
decisions:
  - "models.py created as shared module — both parsers and Phase 3+ merge import from it"
  - "FitWorkout sensor lists use field(default_factory=list) per D-04 — absent sensors are empty lists, never None"
  - "HevyWorkout/HevyExercise list fields have no default_factory — parser always provides them"
  - "Test stubs use exact import paths so Plans 02/03 must satisfy the contracts to turn GREEN"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-04-21"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 1
---

# Phase 02 Plan 01: Test Scaffold and Shared Dataclass Contracts Summary

Wave 0 scaffold: 8 shared dataclasses in models.py, sample_hevy_path fixture in conftest.py, and 8 failing RED tests (3 FIT + 5 Hevy) that Plans 02 and 03 must satisfy.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create models.py with all shared dataclasses | 976d9c1 | models.py |
| 2 | Extend conftest.py with sample_hevy_path fixture | 0ff1250 | tests/conftest.py |
| 3 | Create test_fit_parser.py and test_hevy_parser.py stubs | 57cbd93 | tests/test_fit_parser.py, tests/test_hevy_parser.py |

## What Was Built

### models.py — 8 Shared Dataclasses

All 8 dataclasses created with exact field signatures as specified:

**FIT biometric types:**
- `HRSample(timestamp: datetime, heart_rate: int)` — bpm from fitparse record messages
- `GPSPoint(timestamp: datetime, lat: float, lon: float)` — degrees converted from semicircles
- `CadenceSample(timestamp: datetime, cadence: int)` — rpm
- `PowerSample(timestamp: datetime, power: int)` — watts

**FIT workout aggregate:**
- `FitWorkout(start_time, end_time, total_calories, total_elapsed_time, device_serial)` — 4 sensor lists use `field(default_factory=list)` per D-04

**Hevy types:**
- `HevySet(set_index, set_type, weight_kg, reps, distance_km, duration_seconds, rpe, superset_id)` — all optional fields are `T | None`
- `HevyExercise(title: str, sets: list[HevySet])`
- `HevyWorkout(title, start_time, end_time, description, exercises, skipped_cardio)` — no default_factory needed

**Verification:** `from models import FitWorkout, HRSample, GPSPoint, CadenceSample, PowerSample, HevyWorkout, HevyExercise, HevySet` exits 0. `grep -c "^@dataclass" models.py` returns 8. Exactly 4 `field(default_factory=list)` calls. No fitparse/fit-tool imports.

### tests/conftest.py — Extended with Hevy Fixture

Appended `SAMPLE_HEVY` constant and `sample_hevy_path` fixture. All existing Phase 1 fixtures (SAMPLE_FIT, OUTPUT_DIR, sample_fit_path, output_dir) preserved verbatim.

### tests/test_fit_parser.py — 3 RED Tests

| Test | What it verifies |
|------|-----------------|
| `test_parse_fit_returns_hr_samples` | FitWorkout.heart_rate_samples is non-empty list of HRSample |
| `test_parse_fit_gps_absent_is_empty_list` | gps_track, cadence_samples, power_samples are `[]` not None |
| `test_parse_fit_session_metadata` | start_time, end_time, total_calories=266 from session message; tzinfo=None |

### tests/test_hevy_parser.py — 5 RED Tests

| Test | What it verifies |
|------|-----------------|
| `test_parse_hevy_workout_count` | Returns exactly 95 HevyWorkout objects |
| `test_parse_hevy_timestamps` | start_time/end_time are naive datetime (tzinfo=None) per D-05 |
| `test_parse_hevy_null_coercion` | Empty CSV cells are None, not 0 or "" per HEVY-01 |
| `test_parse_hevy_cardio_detection` | Treadmill in skipped_cardio, not in exercises per D-07 |
| `test_parse_hevy_bodyweight_not_cardio` | Decline Crunch in exercises, not skipped_cardio per D-07 |

## Phase 1 Regression

`pytest tests/test_fit_roundtrip.py -x` — 2 passed (no regression).

## Known Stubs

None. This plan is Wave 0 (contracts only) — the test failures are expected RED state, not stubs. Plans 02 and 03 implement the parser functions that turn these tests GREEN.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- models.py: FOUND
- tests/conftest.py (modified): FOUND
- tests/test_fit_parser.py: FOUND
- tests/test_hevy_parser.py: FOUND
- Commit 976d9c1: FOUND (feat: models.py)
- Commit 0ff1250: FOUND (feat: conftest.py extension)
- Commit 57cbd93: FOUND (test: RED stubs)
