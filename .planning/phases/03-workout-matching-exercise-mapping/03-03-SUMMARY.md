---
phase: 03-workout-matching-exercise-mapping
plan: "03"
subsystem: exercise-mapper
tags: [mapper, fuzzy-matching, rapidfuzz, sqlite, exercise-mapping]
dependency_graph:
  requires:
    - models.GarminExercise
    - database.init_db
    - database.confirm_mapping_db
    - database.get_confirmed_mapping_db
    - database.DB_PATH
    - data/garmin_exercises.csv
  provides:
    - mapper.suggest_mapping
    - mapper.confirm_mapping
    - mapper.get_confirmed_mapping
    - mapper.get_exercises_by_category
    - mapper.UNRESOLVED_THRESHOLD
    - mapper.GENERIC_FALLBACK
  affects:
    - fit_generator.py (Phase 4 — imports confirmed mappings via get_confirmed_mapping)
    - app.py (Phase 5 — calls get_exercises_by_category for muscle-group picker UI)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN
    - rapidfuzz process.extract with WRatio scorer and normalize processor
    - Module-level CSV load at import time (_load_exercises)
    - DB delegation — mapper has no sqlite3 import, all persistence via database module
    - pathlib.Path(__file__).parent for CSV path resolution
key_files:
  created:
    - mapper.py
    - tests/test_mapper.py
  modified: []
decisions:
  - "normalize() strips parenthetical qualifiers before rapidfuzz matching — raises 'Bench Press (Dumbbell)' score from ~67 to >= 70"
  - "No sqlite3 import in mapper.py — all DB calls delegated to database module (clean separation)"
  - "GENERIC_FALLBACK uses 65534 (0xFFFE) sentinel for unknown exercise_enum_int and exercise_category_enum_int"
  - "get_confirmed_mapping() reconstructs full GarminExercise from _GARMIN_EXERCISES list; falls back to partial if CSV regenerated"
metrics:
  duration_minutes: 2
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
  tests_added: 7
  tests_passing: 38
---

# Phase 03 Plan 03: Exercise Mapper — Fuzzy Matching with SQLite Persistence

**One-liner:** mapper.py with rapidfuzz WRatio fuzzy matching, parenthetical-stripping normalize(), CSV-backed exercise catalog loaded at import, and SQLite-delegated confirmed mappings persistence.

## What Was Built

### Task 1: tests/test_mapper.py (RED phase)

7 failing tests covering MAP-01 through MAP-04:

- `test_confirm_and_retrieve` (MAP-01): DB round-trip — confirm then retrieve returns same GarminExercise
- `test_init_db_idempotent` (MAP-01): calling init_db() twice must not raise
- `test_suggest_mapping_bench_press` (MAP-02): suggest_mapping("Bench Press") returns top score >= 70
- `test_normalize_improves_score` (MAP-02): "Bench Press (Dumbbell)" scores >= 70 after normalization
- `test_unresolved_threshold_exported` (MAP-03): UNRESOLVED_THRESHOLD == 70 importable from mapper
- `test_generic_fallback` (MAP-04): GENERIC_FALLBACK.exercise_enum_int == 65534
- `test_get_exercises_by_category` (MAP-04): get_exercises_by_category("bench_press") returns non-empty list

All 7 tests failed with ModuleNotFoundError (correct RED state) — committed as RED gate.

### Task 2: mapper.py (GREEN phase)

Complete exercise mapper implementation:

- `_load_exercises()` — reads `data/garmin_exercises.csv` (1846 rows, 51 categories) at module import using csv.DictReader
- `normalize(name)` — strips parenthetical qualifiers via `re.sub(r'\s*\(.*?\)\s*', ' ', name)`, lowercases, replaces underscores/hyphens with spaces, collapses whitespace
- `suggest_mapping(hevy_name, limit=5)` — rapidfuzz `process.extract` with `fuzz.WRatio` scorer and normalize processor; returns `[(GarminExercise, float)]` descending by score
- `get_exercises_by_category(category)` — filters `_GARMIN_EXERCISES` by `exercise_category == category`
- `confirm_mapping(hevy_name, garmin_exercise, db_path=DB_PATH)` — delegates to `database.confirm_mapping_db()`
- `get_confirmed_mapping(hevy_name, db_path=DB_PATH)` — queries DB, reconstructs full GarminExercise from loaded list; returns partial if CSV was regenerated
- `UNRESOLVED_THRESHOLD = 70` — score threshold for auto-accept (MAP-03)
- `GENERIC_FALLBACK` — GarminExercise("unknown", 65534, "unknown", 65534) sentinel (MAP-04)

No sqlite3 import in mapper.py — all persistence delegated to database module.

## Verification Results

```
normalize('Bench Press (Dumbbell)') == 'bench press'  OK
suggest_mapping('Bench Press') top score: 90.0 >= 70   OK
38 passed in 4.26s
```

All 7 new mapper tests GREEN. Full suite 38/38 passing.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — mapper.py is fully functional with real CSV data (1846 exercises). All exports wired to live implementations.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model.

- T-03-06 (SQL injection via hevy_name): mitigated — mapper.py delegates to database.confirm_mapping_db() which uses ? parameterized queries. mapper.py has no SQL.
- T-03-07 (DoS via _load_exercises): accepted — 1846-row CSV load is ~5ms at import; single-user local app.
- T-03-08 (CSV tampering): accepted — CSV committed to repo, read-only at runtime.

## Self-Check: PASSED

- mapper.py exists: FOUND at /workspace/GarminHevyMerge/mapper.py
- tests/test_mapper.py exists with 7 tests: FOUND
- RED commit 8e83572: FOUND
- GREEN commit af5f4f0: FOUND
- All 7 tests pass: VERIFIED (38/38 full suite)
- UNRESOLVED_THRESHOLD == 70: VERIFIED
- GENERIC_FALLBACK.exercise_enum_int == 65534: VERIFIED
- normalize("Bench Press (Dumbbell)") == "bench press": VERIFIED
- No sqlite3 import in mapper.py: VERIFIED
