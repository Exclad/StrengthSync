---
phase: 03-workout-matching-exercise-mapping
plan: "01"
subsystem: models-database-foundation
tags: [models, database, sqlite, garmin-exercises, foundation]
dependency_graph:
  requires: []
  provides:
    - models.GarminExercise
    - models.MatchResult
    - database.init_db
    - database.confirm_mapping_db
    - database.get_confirmed_mapping_db
    - database.DB_PATH
    - data/garmin_exercises.csv
  affects:
    - mapper.py (Wave 2 — imports GarminExercise, database)
    - matcher.py (Wave 2 — imports MatchResult)
    - fit_generator.py (Phase 4 — consumes MatchResult)
tech_stack:
  added:
    - sqlite3 (stdlib — no new install)
    - rapidfuzz==3.14.5 (added to requirements.txt)
    - python-dateutil==2.9.0.post0 (added to requirements.txt)
    - pandas==3.0.2 (added to requirements.txt)
  patterns:
    - TDD RED/GREEN for all new code
    - Parameterized SQLite queries (?-style) — T-03-01 mitigation
    - pathlib.Path(__file__).parent for module-relative paths
    - Module-level functions, no classes (D-09)
key_files:
  created:
    - models.py (extended — appended GarminExercise and MatchResult)
    - database.py
    - scripts/extract_garmin_exercises.py
    - data/garmin_exercises.csv
    - .gitignore
    - tests/test_models_phase3.py
    - tests/test_database.py
  modified:
    - requirements.txt (added rapidfuzz, python-dateutil, pandas)
    - .planning/REQUIREMENTS.md (MATCH-02 tolerance corrected to 30 minutes)
decisions:
  - "GarminExercise and MatchResult placed in models.py (not matcher.py) to keep dataclasses centralised"
  - "DB_PATH uses pathlib.Path(__file__).parent for cwd-independent resolution (Pitfall 3)"
  - "All database.py SQL uses ? parameterized queries — no f-string or .format() in SQL (T-03-01)"
  - "MATCH-02 REQUIREMENTS.md corrected from 1-hour to 30-minute window (D-01 wins)"
metrics:
  duration_minutes: 2
  completed_date: "2026-04-21"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 2
  tests_added: 12
  tests_passing: 25
---

# Phase 03 Plan 01: Foundation — Models, Database, Garmin Exercise CSV

**One-liner:** GarminExercise and MatchResult dataclasses in models.py, SQLite persistence layer in database.py, and 1846-row garmin_exercises.csv extracted from garmin_fit_sdk Profile.

## What Was Built

### Task 1: models.py extended (TDD)

Appended two dataclasses to the end of models.py after HevyWorkout:

- `GarminExercise`: exercise_name (str), exercise_enum_int (int), exercise_category (str), exercise_category_enum_int (int) — used by mapper.py (Wave 2) and Phase 4 FIT set message fields 7 and 8
- `MatchResult`: fit_workout (FitWorkout), hevy_workout (HevyWorkout), delta_minutes (float), is_forced (bool) — consumed by fit_generator.py (Phase 4)

No import changes needed: `from __future__ import annotations` already handles forward references.

**TDD:** 5 RED tests committed before implementation; all 5 GREEN after.

### Task 2: database.py created (TDD)

SQLite persistence layer for confirmed Hevy→Garmin exercise mappings:

- `init_db(db_path)` — CREATE TABLE IF NOT EXISTS, safe to call multiple times (D-07)
- `confirm_mapping_db(hevy_name, enum_int, garmin_name, db_path)` — INSERT OR REPLACE upsert (D-08)
- `get_confirmed_mapping_db(hevy_name, db_path)` — returns (enum_int, garmin_name) tuple or None
- `DB_PATH` — pathlib.Path resolving to `data/exercise_mappings.db` relative to database.py

All SQL uses `?` parameterized queries — no string interpolation in SQL (T-03-01 threat mitigation verified).

**TDD:** 7 RED tests committed before implementation; all 7 GREEN after. SQL injection test included.

### Task 3: data/garmin_exercises.csv generated; requirements.txt, .gitignore, REQUIREMENTS.md updated

- `scripts/extract_garmin_exercises.py` — one-time script that reads garmin_fit_sdk Profile["types"] and writes the CSV; committed for reproducibility
- `data/garmin_exercises.csv` — 1846 rows, 4 columns (exercise_name, exercise_enum_int, exercise_category, exercise_category_enum_int), 51 categories extracted
- `requirements.txt` — added rapidfuzz==3.14.5, python-dateutil==2.9.0.post0, pandas==3.0.2
- `.gitignore` — created; excludes data/exercise_mappings.db, __pycache__/, *.pyc, .venv/
- `.planning/REQUIREMENTS.md` — MATCH-02 tolerance corrected from "1-hour window" to "30-minute window" (D-01)

## Test Results

```
25 passed in 4.29s
```

All pre-existing tests remain GREEN. 12 new tests added (5 for models, 7 for database).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all artifacts are complete and functional. The CSV contains real SDK data; the database schema is production-ready.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model. T-03-01 (SQL injection in database.py) is mitigated: all SQL uses `?` parameterized queries, verified by test_no_sql_injection_in_queries.

## Self-Check: PASSED

- models.py exists and exports GarminExercise, MatchResult: FOUND
- database.py exists and exports init_db, confirm_mapping_db, get_confirmed_mapping_db, DB_PATH: FOUND
- data/garmin_exercises.csv exists with 1846 rows: FOUND
- scripts/extract_garmin_exercises.py: FOUND
- .gitignore with data/exercise_mappings.db entry: FOUND
- REQUIREMENTS.md MATCH-02 reads "30-minute window": FOUND
- Commits: 2c75517 (RED models tests), b487b59 (GREEN models), 4f135fd (RED database tests), 04994bd (GREEN database), b069465 (Task 3): all FOUND
