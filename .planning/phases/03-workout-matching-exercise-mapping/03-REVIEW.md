---
phase: 03-workout-matching-exercise-mapping
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - models.py
  - database.py
  - scripts/extract_garmin_exercises.py
  - matcher.py
  - mapper.py
  - tests/test_models_phase3.py
  - tests/test_database.py
  - tests/test_matcher.py
  - tests/test_mapper.py
  - tests/conftest.py
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Ten source files reviewed: two core dataclass modules, two runtime modules (matcher, mapper), one one-time script, and five test files. The code is generally well-structured, parameterized SQL is used correctly, and timezone conversion logic is sound.

Three warnings require attention before Phase 5 wires these modules together. The most important is an unchecked `None` on `fit.start_time` in `matcher.py` that will raise `TypeError` at runtime if a FIT file is parsed without a valid session start. A missing directory guard in `database.py` will surface as an opaque `OperationalError` on first run. The module-level CSV load in `mapper.py` turns any absent `data/garmin_exercises.csv` into an import-time crash that breaks the entire test suite.

No security vulnerabilities were found. SQL queries are fully parameterized.

## Warnings

### WR-01: `fit.start_time` used without None guard in `matcher.py`

**File:** `matcher.py:45`
**Issue:** `FitWorkout.start_time` is typed `datetime | None` (models.py line 39). The subtraction `fit.start_time - hevy_utc` on line 45 raises `TypeError: unsupported operand type(s) for -: 'NoneType' and 'datetime'` if `start_time` is None. A FIT file with a missing session start (corrupt or truncated file) will crash the matcher instead of returning `None`.
**Fix:**
```python
def match_workouts(
    fit: FitWorkout,
    hevy_list: list[HevyWorkout],
    timezone_str: str,
) -> MatchResult | None:
    if fit.start_time is None:
        return None
    user_tz = tz.gettz(timezone_str)
    ...
```

---

### WR-02: `database.py` does not create the `data/` directory before connecting

**File:** `database.py:11`
**Issue:** `DB_PATH` points to `<project_root>/data/exercise_mappings.db`. If the `data/` directory does not exist (e.g. fresh clone, CI environment), `sqlite3.connect(str(db_path))` raises `sqlite3.OperationalError: unable to open database file` with no explanation. The error message does not indicate a missing directory, making this hard to diagnose.
**Fix:** Add a `mkdir` call inside `init_db()` before connecting:
```python
def init_db(db_path: str | pathlib.Path = DB_PATH) -> None:
    db_path = pathlib.Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS confirmed_mappings ...
        """)
```
This is safe for both production (`data/`) and test usage (`tmp_path/`).

---

### WR-03: Module-level `_load_exercises()` call in `mapper.py` crashes on import when CSV is absent

**File:** `mapper.py:43`
**Issue:** `_GARMIN_EXERCISES: list[GarminExercise] = _load_exercises()` executes at import time. If `data/garmin_exercises.csv` has not been generated yet (i.e. `scripts/extract_garmin_exercises.py` has not been run), every `import mapper` — including all test collection — raises `FileNotFoundError`. This gives no actionable error message to a new developer and fails the entire test suite instead of just mapper tests.
**Fix:** Add a clear error message in `_load_exercises()`:
```python
def _load_exercises() -> list[GarminExercise]:
    if not _CSV_PATH.exists():
        raise FileNotFoundError(
            f"Garmin exercises CSV not found: {_CSV_PATH}\n"
            "Run: .venv/bin/python scripts/extract_garmin_exercises.py"
        )
    with open(_CSV_PATH, newline="", encoding="utf-8") as f:
        ...
```
The CSV is already committed to the repo (`data/garmin_exercises.csv` exists), so this is a belt-and-suspenders improvement rather than a blocking bug in the current state. However it becomes critical if the `data/` directory is ever added to `.gitignore`.

---

## Info

### IN-01: Hardcoded Python version in `scripts/extract_garmin_exercises.py`

**File:** `scripts/extract_garmin_exercises.py:14`
**Issue:** `sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / ".venv" / "lib" / "python3.11" / "site-packages"))` hardcodes `python3.11`. If the project's venv is ever recreated under Python 3.10 or 3.12 (e.g. `python3.12 -m venv .venv`), this path will not exist and `from garmin_fit_sdk.profile import Profile` will raise `ModuleNotFoundError`.
**Fix:** Either remove the manual `sys.path` manipulation (the script already instructs users to run it as `.venv/bin/python scripts/...` which puts site-packages on the path automatically), or use a glob to find the correct minor version:
```python
# Option A: Remove sys.path manipulation entirely (preferred)
# Run as: .venv/bin/python scripts/extract_garmin_exercises.py

# Option B: Dynamic version detection
import glob
venv_lib = pathlib.Path(__file__).parent.parent / ".venv" / "lib"
py_dirs = sorted(venv_lib.glob("python3.*"))
if py_dirs:
    sys.path.insert(0, str(py_dirs[-1] / "site-packages"))
```
Option A is simpler since the docstring already documents the correct invocation.

---

### IN-02: Duplicate `db_path` fixture in `tests/test_mapper.py` already defined in `conftest.py`

**File:** `tests/test_mapper.py:21-25`
**Issue:** `test_mapper.py` defines a local `db_path` fixture that is functionally identical to `tmp_db_path` in `conftest.py` (both create a temp DB and call `init_db`). The names differ (`db_path` vs `tmp_db_path`), so there is no actual conflict, but maintaining two near-identical fixtures in the same test suite creates confusion about which to use in future tests.
**Fix:** Either rename `conftest.py`'s fixture to `db_path` and remove the local one, or document in a comment why the local fixture exists. No behavior change needed.

---

_Reviewed: 2026-04-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
