---
phase: 03-workout-matching-exercise-mapping
fixed_at: 2026-04-21T00:00:00Z
review_path: .planning/phases/03-workout-matching-exercise-mapping/03-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-21T00:00:00Z
**Source review:** .planning/phases/03-workout-matching-exercise-mapping/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — Info findings IN-01, IN-02 excluded per fix_scope)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: `fit.start_time` used without None guard in `matcher.py`

**Files modified:** `matcher.py`
**Commit:** 4c7fb99
**Applied fix:** Added `if fit.start_time is None: return None` at the top of `match_workouts()`, before the timezone lookup and loop. This prevents a `TypeError` when a FIT file has no session start time (e.g. corrupt or truncated file).

---

### WR-02: `database.py` does not create the `data/` directory before connecting

**Files modified:** `database.py`
**Commit:** 1aa2150
**Applied fix:** Added `db_path = pathlib.Path(db_path)` and `db_path.parent.mkdir(parents=True, exist_ok=True)` inside `init_db()` before the `sqlite3.connect()` call. Safe for both production (`data/`) and test usage (`tmp_path/`).

---

### WR-03: Module-level `_load_exercises()` call in `mapper.py` crashes on import when CSV is absent

**Files modified:** `mapper.py`
**Commit:** 2c2e6ee
**Applied fix:** Added an explicit `if not _CSV_PATH.exists()` check at the top of `_load_exercises()` that raises `FileNotFoundError` with a clear message pointing the developer to run `scripts/extract_garmin_exercises.py`. Replaces the opaque `FileNotFoundError` from `open()` with an actionable diagnostic.

---

_Fixed: 2026-04-21T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
