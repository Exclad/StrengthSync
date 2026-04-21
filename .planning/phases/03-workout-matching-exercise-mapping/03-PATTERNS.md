# Phase 3: Workout Matching + Exercise Mapping - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 8 (4 new modules + 2 new test files + 1 new data file + 1 modified conftest)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `matcher.py` | service | request-response | `hevy_parser.py` | role-match (same module-level function pattern, different data flow) |
| `mapper.py` | service | request-response | `hevy_parser.py` | role-match (same module-level function pattern, same CSV-loading idiom) |
| `database.py` | utility | CRUD | `hevy_parser.py` | partial-match (module-level functions, file I/O, similar error handling shape) |
| `models.py` (modify) | model | — | `models.py` | exact (add two dataclasses to existing file) |
| `data/garmin_exercises.csv` | config | — | none | no analog (generated artifact) |
| `scripts/extract_garmin_exercises.py` | utility | batch | `hevy_parser.py` | partial-match (CSV write using stdlib, pathlib) |
| `tests/test_matcher.py` | test | — | `tests/test_hevy_parser.py` | exact (same fixture pattern, same assertion style) |
| `tests/test_mapper.py` | test | — | `tests/test_hevy_parser.py` | exact (same fixture pattern, same assertion style) |
| `tests/conftest.py` (modify) | test | — | `tests/conftest.py` | exact (add fixtures using same pattern) |

---

## Pattern Assignments

### `matcher.py` (service, request-response)

**Analog:** `hevy_parser.py`

**Imports pattern** (`hevy_parser.py` lines 1-9):
```python
"""Hevy CSV parser module.

Uses stdlib csv.DictReader — pandas is not installed and not needed.
Phase 2: parses to naive local datetimes (D-05). Phase 3 applies timezone conversion.
"""
import csv
import pathlib
from datetime import datetime
from models import HevyWorkout, HevyExercise, HevySet
```

Apply to `matcher.py` as:
```python
"""Workout matcher module.

Converts Hevy naive local datetimes to UTC using python-dateutil (MATCH-01).
Tolerance window: MATCH_TOLERANCE_MINUTES = 30 (D-01).
Closest UTC delta wins when multiple candidates match (D-02).
"""
from __future__ import annotations
from dataclasses import dataclass
from dateutil import tz
from models import FitWorkout, HevyWorkout
```

**Core function pattern** (`hevy_parser.py` lines 36-55 — module-level function with docstring, Args/Returns/Raises):
```python
def parse_hevy_csv(path: str) -> list[HevyWorkout]:
    """Parse a Hevy CSV export into a list of HevyWorkout objects.

    ...

    Args:
        path: Absolute or relative path to the Hevy CSV export file.

    Returns:
        List of HevyWorkout objects in order of first appearance.
        Timestamps are naive local datetimes (D-05); Phase 3 applies UTC conversion.

    Raises:
        FileNotFoundError: If path does not exist.
        ValueError: If a timestamp cannot be parsed with HEVY_TS_FMT.
    """
```

Apply to `matcher.py` `match_workouts()` — use identical docstring format with Args/Returns/Raises. Raises block must document `ValueError` for invalid timezone string.

**Core algorithm pattern** (from RESEARCH.md Pattern 1 — verified):
```python
MATCH_TOLERANCE_MINUTES = 30  # D-01: constant at module top for easy adjustment

def match_workouts(
    fit: FitWorkout,
    hevy_list: list[HevyWorkout],
    timezone_str: str,
) -> MatchResult | None:
    user_tz = tz.gettz(timezone_str)
    if user_tz is None:
        raise ValueError(f"Unknown IANA timezone: {timezone_str!r}")

    best: MatchResult | None = None
    for hevy in hevy_list:
        aware = hevy.start_time.replace(tzinfo=user_tz)
        hevy_utc = aware.astimezone(tz.UTC).replace(tzinfo=None)
        delta_minutes = abs((fit.start_time - hevy_utc).total_seconds()) / 60
        if delta_minutes <= MATCH_TOLERANCE_MINUTES:
            if best is None or delta_minutes < best.delta_minutes:
                best = MatchResult(
                    fit_workout=fit,
                    hevy_workout=hevy,
                    delta_minutes=delta_minutes,
                    is_forced=False,
                )
    return best

def force_match(fit: FitWorkout, hevy: HevyWorkout) -> MatchResult:
    """Bypass tolerance check; produce a forced MatchResult (D-10)."""
    return MatchResult(
        fit_workout=fit,
        hevy_workout=hevy,
        delta_minutes=0.0,
        is_forced=True,
    )
```

**MatchResult dataclass pattern** (`models.py` lines 38-47 — existing dataclass style):
```python
@dataclass
class FitWorkout:
    start_time: datetime | None
    end_time: datetime | None
    total_calories: int | None
    total_elapsed_time: float | None
    device_serial: int | None
    heart_rate_samples: list[HRSample] = field(default_factory=list)
    ...
```

Apply to `MatchResult` in `matcher.py` (add to `models.py` instead, to keep dataclasses centralised — or define in `matcher.py` if planner prefers locality; either is consistent with the codebase):
```python
@dataclass
class MatchResult:
    fit_workout: FitWorkout
    hevy_workout: HevyWorkout
    delta_minutes: float   # 0.0 for forced matches
    is_forced: bool        # True when set via force_match()
```

**No error-wrapping pattern:** `hevy_parser.py` lets exceptions propagate naturally (FileNotFoundError, ValueError). Copy this — no try/except in public functions unless converting exception type.

---

### `mapper.py` (service, request-response)

**Analog:** `hevy_parser.py`

**Imports pattern** (copy module docstring + import block style from `hevy_parser.py` lines 1-9):
```python
"""Exercise mapper module.

Fuzzy-matches Hevy exercise names against Garmin exercise enums (MAP-02).
Confirmed mappings are persisted via database.py (MAP-01).
Only user-confirmed mappings enter the DB (D-08).
"""
from __future__ import annotations
import csv
import pathlib
import re
from dataclasses import dataclass
from rapidfuzz import process, fuzz
from models import GarminExercise  # GarminExercise added to models.py
import database
```

**Module-level constant + loaded data pattern** (`hevy_parser.py` line 11 — module-level constant):
```python
HEVY_TS_FMT = "%b %d, %Y, %I:%M %p"
```

Apply to `mapper.py`:
```python
UNRESOLVED_THRESHOLD = 70          # D-05: score below this = UNRESOLVED (MAP-03)
_CSV_PATH = pathlib.Path(__file__).parent / "data" / "garmin_exercises.csv"
_GARMIN_EXERCISES: list[GarminExercise] = []  # populated at module load (see below)

def _load_exercises() -> list[GarminExercise]:
    """Load garmin_exercises.csv once at module import."""
    with open(_CSV_PATH, newline="", encoding="utf-8") as f:
        return [
            GarminExercise(
                exercise_name=row["exercise_name"],
                exercise_enum_int=int(row["exercise_enum_int"]),
                exercise_category=row["exercise_category"],
                exercise_category_enum_int=int(row["exercise_category_enum_int"]),
            )
            for row in csv.DictReader(f)
        ]

_GARMIN_EXERCISES = _load_exercises()

GENERIC_FALLBACK = GarminExercise(
    exercise_name="unknown",
    exercise_enum_int=65534,
    exercise_category="unknown",
    exercise_category_enum_int=65534,
)
```

**Helper function pattern** (`hevy_parser.py` lines 16-23 — private helpers with one-line docstrings):
```python
def _opt_float(val: str) -> float | None:
    """Return float or None for an empty CSV cell."""
    return float(val) if val.strip() else None

def _opt_int(val: str) -> int | None:
    """Return int or None for an empty CSV cell."""
    return int(float(val)) if val.strip() else None
```

Apply to `mapper.py` `normalize()`:
```python
def normalize(name: str) -> str:
    """Strip parenthetical qualifiers; lowercase; underscores/hyphens → spaces."""
    name = re.sub(r'\s*\(.*?\)\s*', ' ', name)
    return re.sub(r'\s+', ' ', name.lower().replace('_', ' ').replace('-', ' ')).strip()
```

**Core function pattern** (from RESEARCH.md Pattern 2 — verified against rapidfuzz 3.14.5):
```python
def suggest_mapping(
    hevy_name: str,
    limit: int = 5,
) -> list[tuple[GarminExercise, float]]:
    """Return up to `limit` ranked (GarminExercise, score) candidates.

    Score threshold for auto-accept: UNRESOLVED_THRESHOLD (70).
    Never writes to DB (D-08).

    Args:
        hevy_name: Raw exercise name from Hevy CSV.
        limit: Maximum candidates to return. Default 5.

    Returns:
        List of (GarminExercise, float_score) tuples, descending score.
    """
    normalized_query = normalize(hevy_name)
    results = process.extract(
        normalized_query,
        _GARMIN_EXERCISES,
        scorer=fuzz.WRatio,
        processor=lambda x: normalize(x.exercise_name) if isinstance(x, GarminExercise) else x,
        limit=limit,
    )
    return [(exercise, score) for exercise, score, _idx in results]

def get_exercises_by_category(category: str) -> list[GarminExercise]:
    """Return all GarminExercises matching the given category string (D-04)."""
    return [e for e in _GARMIN_EXERCISES if e.exercise_category == category]

def confirm_mapping(hevy_name: str, garmin_exercise: GarminExercise) -> None:
    """Persist a user-confirmed mapping to SQLite (D-08, MAP-01)."""
    database.confirm_mapping_db(
        hevy_name=hevy_name,
        enum_int=garmin_exercise.exercise_enum_int,
        garmin_name=garmin_exercise.exercise_name,
    )

def get_confirmed_mapping(hevy_name: str) -> GarminExercise | None:
    """Look up a previously confirmed mapping from SQLite (MAP-01).

    Returns None if hevy_name has never been confirmed.
    """
    row = database.get_confirmed_mapping_db(hevy_name)
    if row is None:
        return None
    enum_int, garmin_name = row
    # Reconstruct from loaded list to get category fields
    for ex in _GARMIN_EXERCISES:
        if ex.exercise_enum_int == enum_int and ex.exercise_name == garmin_name:
            return ex
    # Name found in DB but not in CSV (e.g., CSV was regenerated) — return partial
    return GarminExercise(
        exercise_name=garmin_name,
        exercise_enum_int=enum_int,
        exercise_category="unknown",
        exercise_category_enum_int=65534,
    )
```

---

### `database.py` (utility, CRUD)

**Analog:** `hevy_parser.py` (module-level functions, pathlib for path resolution)

**Imports pattern** (`hevy_parser.py` lines 6-8 — stdlib-only imports):
```python
import csv
import pathlib
from datetime import datetime
```

Apply to `database.py`:
```python
"""SQLite persistence for confirmed exercise mappings (MAP-01, D-07, D-08).

init_db() must be called explicitly before any read/write operation.
All sqlite3 calls use parameterized queries (?-style) — no string formatting in SQL.
"""
import sqlite3
import pathlib

DB_PATH = pathlib.Path(__file__).parent / "data" / "exercise_mappings.db"
```

**Pathlib module-relative path pattern** (`tests/conftest.py` lines 6-9):
```python
_PROJECT_ROOT = pathlib.Path(__file__).parent.parent

SAMPLE_FIT = str(_PROJECT_ROOT / "original_garmin.fit")
```

Apply to `database.py` — derive DB_PATH from `__file__` so tests can `monkeypatch` or pass `tmp_path` overrides without cwd dependency (Pitfall 3).

**Core CRUD pattern** (from RESEARCH.md Pattern 3 — verified against sqlite3 3.40.1):
```python
def init_db(db_path: str | pathlib.Path = DB_PATH) -> None:
    """Create confirmed_mappings table if not exists. Safe to call multiple times (D-07)."""
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS confirmed_mappings (
                hevy_exercise_name        TEXT PRIMARY KEY,
                garmin_exercise_enum_int  INTEGER NOT NULL,
                garmin_exercise_name      TEXT NOT NULL,
                confirmed_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

def confirm_mapping_db(
    hevy_name: str,
    enum_int: int,
    garmin_name: str,
    db_path: str | pathlib.Path = DB_PATH,
) -> None:
    """Upsert a confirmed mapping. INSERT OR REPLACE is atomic (D-08)."""
    with sqlite3.connect(str(db_path)) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO confirmed_mappings VALUES (?,?,?,CURRENT_TIMESTAMP)",
            (hevy_name, enum_int, garmin_name),
        )

def get_confirmed_mapping_db(
    hevy_name: str,
    db_path: str | pathlib.Path = DB_PATH,
) -> tuple | None:
    """Return (garmin_exercise_enum_int, garmin_exercise_name) or None."""
    with sqlite3.connect(str(db_path)) as conn:
        return conn.execute(
            "SELECT garmin_exercise_enum_int, garmin_exercise_name "
            "FROM confirmed_mappings WHERE hevy_exercise_name=?",
            (hevy_name,),
        ).fetchone()
```

Note: `db_path` defaults to module-level `DB_PATH` so production code needs no argument, but tests pass `tmp_path / "test.db"` for isolation (Pitfall 5).

---

### `models.py` (modify — add two dataclasses)

**Analog:** `models.py` (exact — extend the existing file)

**Existing dataclass style** (`models.py` lines 12-15 and 38-47):
```python
@dataclass
class HRSample:
    timestamp: datetime
    heart_rate: int

@dataclass
class FitWorkout:
    start_time: datetime | None
    end_time: datetime | None
    ...
    heart_rate_samples: list[HRSample] = field(default_factory=list)
```

Add at end of `models.py` using identical style:
```python
@dataclass
class GarminExercise:
    exercise_name: str               # e.g. 'barbell_bench_press'
    exercise_enum_int: int           # category_subtype for FIT set message field 8
    exercise_category: str           # e.g. 'bench_press' — grouping key for Phase 5
    exercise_category_enum_int: int  # category int for FIT set message field 7


@dataclass
class MatchResult:
    fit_workout: FitWorkout
    hevy_workout: HevyWorkout
    delta_minutes: float   # 0.0 for forced matches; actual delta for auto-matches
    is_forced: bool        # True when produced by force_match()
```

The import block in `models.py` already has `from __future__ import annotations`, `dataclass`, `field`, and `datetime` — no new imports needed.

---

### `scripts/extract_garmin_exercises.py` (utility, batch)

**Analog:** `hevy_parser.py` (CSV write, pathlib, stdlib-only except for SDK import)

**Pattern** (from RESEARCH.md Pattern 4 — verified against garmin-fit-sdk 21.200.0):
```python
"""One-time script: extract exercise enums from garmin_fit_sdk Profile → data/garmin_exercises.csv.

Run once from project root:
    .venv/bin/python scripts/extract_garmin_exercises.py

Output: data/garmin_exercises.csv (1,846 rows, 4 columns)
Commit the CSV; never run this script at runtime.
"""
import csv
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / ".venv" / "lib" / "python3.11" / "site-packages"))
from garmin_fit_sdk.profile import Profile

types = Profile["types"]
cat_map = types["exercise_category"]
cat_by_name = {v: int(k) for k, v in cat_map.items() if k.isdigit()}

rows = []
for category_name, cat_enum in cat_by_name.items():
    ex_key = f"{category_name}_exercise_name"
    if ex_key in types:
        for k, v in types[ex_key].items():
            if k.isdigit():
                rows.append((v, int(k), category_name, cat_enum))

out = pathlib.Path(__file__).parent.parent / "data" / "garmin_exercises.csv"
out.parent.mkdir(exist_ok=True)
with open(out, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["exercise_name", "exercise_enum_int", "exercise_category", "exercise_category_enum_int"])
    writer.writerows(rows)

print(f"Wrote {len(rows)} exercises to {out}")
```

---

### `tests/test_matcher.py` (test)

**Analog:** `tests/test_hevy_parser.py` (exact — same fixture usage, same assertion style)

**Imports pattern** (`tests/test_hevy_parser.py` lines 1-9):
```python
"""Tests for parse_hevy_csv(): workout grouping, cardio detection, null coercion.

Phase 2 RED state: parse_hevy_csv does not yet exist in hevy_parser.py.
Tests will fail with ImportError until Plan 03 implements parse_hevy_csv().
"""
import pytest
from datetime import datetime
from hevy_parser import parse_hevy_csv
from models import HevyWorkout
```

Apply to `tests/test_matcher.py`:
```python
"""Tests for match_workouts() and force_match(): timezone conversion, tolerance, forced pairing."""
import pytest
from datetime import datetime
from matcher import match_workouts, force_match, MATCH_TOLERANCE_MINUTES
from models import FitWorkout, HevyWorkout, MatchResult
```

**Fixture-based test pattern** (`tests/test_hevy_parser.py` lines 12-16 — use conftest fixture, assert type and count):
```python
def test_parse_hevy_workout_count(sample_hevy_path):
    """parse_hevy_csv() must return 95 HevyWorkout objects (per RESEARCH.md live count)."""
    workouts = parse_hevy_csv(sample_hevy_path)
    assert len(workouts) == 95
    assert all(isinstance(w, HevyWorkout) for w in workouts)
```

**Inline fixture pattern** — for matcher tests, construct minimal FitWorkout/HevyWorkout objects inline (no CSV needed for unit tests):
```python
def _make_fit(start: datetime) -> FitWorkout:
    return FitWorkout(
        start_time=start, end_time=None, total_calories=None,
        total_elapsed_time=None, device_serial=None,
    )

def _make_hevy(start: datetime) -> HevyWorkout:
    return HevyWorkout(
        title="Test", start_time=start, end_time=start,
        description="", exercises=[], skipped_cardio=[],
    )
```

**Test naming pattern** (`tests/test_hevy_parser.py` — `test_<module>_<behavior>`):
- `test_match_singapore_timezone` — MATCH-01 (verified 0.18 min delta)
- `test_invalid_timezone` — MATCH-01 (ValueError path)
- `test_auto_match_within_tolerance` — MATCH-02
- `test_no_match_returns_none` — MATCH-02
- `test_closest_candidate_wins` — MATCH-02 (multiple candidates)
- `test_force_match` — MATCH-03

**tzinfo assertion pattern** (`tests/test_hevy_parser.py` line 25):
```python
assert wo.start_time.tzinfo is None, "timestamps must be naive (D-05)"
```

Use same pattern to assert UTC conversion produces correct naive datetime in matcher tests.

---

### `tests/test_mapper.py` (test)

**Analog:** `tests/test_hevy_parser.py` (exact)

**Imports pattern:**
```python
"""Tests for mapper.py and database.py: fuzzy matching, DB round-trip, thresholds."""
import pytest
from mapper import (
    suggest_mapping, confirm_mapping, get_confirmed_mapping,
    get_exercises_by_category, UNRESOLVED_THRESHOLD, GENERIC_FALLBACK,
)
from database import init_db
from models import GarminExercise
```

**tmp_path fixture pattern** — for DB isolation, use pytest's built-in `tmp_path`:
```python
@pytest.fixture
def db_path(tmp_path):
    """Isolated SQLite DB for each test."""
    p = tmp_path / "test_mappings.db"
    init_db(p)
    return p
```

This matches `conftest.py`'s `output_dir` fixture which also wraps `tmp_path`:
```python
@pytest.fixture
def output_dir(tmp_path):
    """Return a temporary directory for test output files."""
    return str(tmp_path)
```

**Test naming pattern:**
- `test_confirm_and_retrieve` — MAP-01 round-trip
- `test_init_db_idempotent` — MAP-01 (safe to call twice)
- `test_suggest_mapping_bench_press` — MAP-02
- `test_normalize_improves_score` — MAP-02
- `test_unresolved_threshold_exported` — MAP-03
- `test_generic_fallback` — MAP-04
- `test_get_exercises_by_category` — MAP-04 / D-04

---

### `tests/conftest.py` (modify — add fixtures)

**Analog:** `tests/conftest.py` (exact — extend the existing file)

**Existing fixture pattern** (`tests/conftest.py` lines 6-28):
```python
_PROJECT_ROOT = pathlib.Path(__file__).parent.parent

SAMPLE_FIT = str(_PROJECT_ROOT / "original_garmin.fit")

@pytest.fixture
def sample_fit_path():
    """Return the absolute path to the sample Garmin FIT file."""
    assert os.path.exists(SAMPLE_FIT), f"Sample FIT not found: {SAMPLE_FIT}"
    return SAMPLE_FIT
```

Add Phase 3 fixtures using identical style:
```python
@pytest.fixture
def sample_fit_workout(sample_fit_path):
    """Return a parsed FitWorkout from the sample FIT file."""
    from fit_parser import parse_fit_file
    return parse_fit_file(sample_fit_path)

@pytest.fixture
def sample_hevy_workouts(sample_hevy_path):
    """Return parsed list[HevyWorkout] from the sample Hevy CSV."""
    from hevy_parser import parse_hevy_csv
    return parse_hevy_csv(sample_hevy_path)

@pytest.fixture
def tmp_db_path(tmp_path):
    """Isolated SQLite DB path for mapper/database tests."""
    from database import init_db
    p = tmp_path / "test_mappings.db"
    init_db(p)
    return p
```

---

## Shared Patterns

### Module docstring convention
**Source:** `hevy_parser.py` lines 1-5, `fit_parser.py` lines 1-5
**Apply to:** `matcher.py`, `mapper.py`, `database.py`

Every module opens with a triple-quoted docstring that states: what it does, which library/approach it uses, which phase owns it, and any cross-phase contract (e.g., "Phase 3 converts; Phase 4 consumes").

### Module-level functions, not classes
**Source:** `hevy_parser.py`, `fit_parser.py` — both use only top-level functions
**Apply to:** `matcher.py`, `mapper.py`, `database.py`

No class definitions. All public API is module-level functions. This is a locked decision (D-09).

### Private helper naming
**Source:** `hevy_parser.py` lines 16-33 — `_opt_float`, `_opt_int`, `_is_cardio`
**Apply to:** `mapper.py` — `normalize()` should be `_normalize()` since it is an implementation detail, OR left as `normalize` if tests need to call it directly. Recommend `normalize` (public) since test_normalize_improves_score tests it directly.

### Pathlib for all file paths
**Source:** `tests/conftest.py` lines 6-9
**Apply to:** `database.py` (DB_PATH), `mapper.py` (_CSV_PATH), `scripts/extract_garmin_exercises.py`

Always use `pathlib.Path(__file__).parent / ...` for module-relative paths. Never use `os.path.join` or bare relative strings.

### Args/Returns/Raises docstring format
**Source:** `hevy_parser.py` lines 37-55, `fit_parser.py` lines 33-48
**Apply to:** All public functions in `matcher.py`, `mapper.py`, `database.py`

Every public function gets a one-line summary, then Args:, Returns:, Raises: sections. Omit sections that don't apply (e.g., no Raises if no exceptions propagate).

### Let exceptions propagate naturally
**Source:** `hevy_parser.py` (no try/except blocks — FileNotFoundError, ValueError propagate as-is)
**Apply to:** `matcher.py`, `mapper.py`, `database.py`

Do not wrap exceptions unless converting to a more specific type (e.g., converting `tz.gettz()` returning None into `ValueError`). Do not swallow or re-wrap sqlite3 errors.

### Parameterized sqlite3 queries
**Source:** RESEARCH.md Pattern 3 — verified (security constraint)
**Apply to:** `database.py` — all SQL statements use `?` placeholders. No f-string or `.format()` in SQL.

### `from __future__ import annotations`
**Source:** `models.py` line 1
**Apply to:** `matcher.py`, `mapper.py` — needed for `MatchResult | None` and `GarminExercise | None` return type hints on Python 3.9.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `data/garmin_exercises.csv` | config | — | Generated artifact; no existing CSV data files in codebase to model |

---

## Metadata

**Analog search scope:** `/workspace/GarminHevyMerge/` — all `.py` files, `tests/`, root level
**Files scanned:** `hevy_parser.py`, `fit_parser.py`, `models.py`, `tests/conftest.py`, `tests/test_hevy_parser.py`, `tests/test_fit_parser.py`
**Pattern extraction date:** 2026-04-21
