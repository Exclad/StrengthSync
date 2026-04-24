# Phase 2: Core Parsers - Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 6 (3 new, 3 modified/extended)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `fit_parser.py` (extend) | parser/utility | file-I/O, transform | `fit_parser.py` (existing stub) | exact (same file) |
| `hevy_parser.py` (new) | parser/utility | file-I/O, transform | `fit_parser.py` (stub pattern) | role-match |
| `models.py` (new) | model | n/a (data definition) | `fit_generator.py` (dataclass usage pattern) | partial |
| `tests/conftest.py` (extend) | test | n/a | `tests/conftest.py` (existing) | exact (same file) |
| `tests/test_fit_parser.py` (new) | test | file-I/O | `tests/test_fit_roundtrip.py` | role-match |
| `tests/test_hevy_parser.py` (new) | test | file-I/O | `tests/test_fit_roundtrip.py` | role-match |

---

## Pattern Assignments

### `fit_parser.py` — extend with `parse_fit_file()`

**Analog:** `fit_parser.py` (lines 1–23, the existing stub)

**Existing file to preserve verbatim** (lines 1–23):
```python
"""FIT file reader module.

Uses fit-tool (read path) and fitparse (verification).
Phase 1: minimal implementation — Phase 2 extends with full field extraction.
"""
from fit_tool.fit_file import FitFile


def read_fit_file(path: str) -> FitFile:
    """Read a FIT file using fit-tool. Returns a FitFile object.

    Args:
        path: Absolute or relative path to the .fit file.

    Returns:
        FitFile object with .records list and .header.

    Raises:
        FileNotFoundError: If path does not exist.
        Exception: If fit-tool cannot parse the file.
    """
    return FitFile.from_file(path)
```

**New imports to add** (append after existing `from fit_tool...` line):
```python
import pathlib
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from fitparse import FitFile as FitParseFile
from models import FitWorkout, HRSample, GPSPoint, CadenceSample, PowerSample
```

**Core parse function pattern** (derived from RESEARCH.md verified examples):
```python
_SEMICIRCLES_TO_DEG = 180.0 / (2 ** 31)


def parse_fit_file(path: str) -> FitWorkout:
    """Parse a FIT file using fitparse and return a typed FitWorkout.

    Uses fitparse (not fit-tool) to capture all message types including
    Garmin-proprietary messages (140, 288, 326, 327) that fit-tool drops.

    Args:
        path: Absolute or relative path to the .fit file.

    Returns:
        FitWorkout dataclass with typed sensor lists. Absent sensors are
        empty lists (never None) per D-04.

    Raises:
        fitparse.FitParseError: If the file cannot be parsed.
    """
    hr_samples: list[HRSample] = []
    gps_track: list[GPSPoint] = []
    cadence_samples: list[CadenceSample] = []
    power_samples: list[PowerSample] = []
    start_time = None
    end_time = None
    total_calories = None
    total_elapsed_time = None
    device_serial = None

    with FitParseFile(path) as fitfile:
        for msg in fitfile.get_messages("record"):
            ts = msg.get_value("timestamp")        # naive datetime (UTC-equivalent)
            hr = msg.get_value("heart_rate")       # int bpm or None
            lat = msg.get_value("position_lat")    # int semicircles or None
            lng = msg.get_value("position_long")   # int semicircles or None
            cad = msg.get_value("cadence")         # int rpm or None
            pwr = msg.get_value("power")           # int watts or None

            if hr is not None and ts is not None:
                hr_samples.append(HRSample(timestamp=ts, heart_rate=hr))
            if lat is not None and lng is not None and ts is not None:
                gps_track.append(GPSPoint(
                    timestamp=ts,
                    lat=lat * _SEMICIRCLES_TO_DEG,
                    lon=lng * _SEMICIRCLES_TO_DEG,
                ))
            if cad is not None and ts is not None:
                cadence_samples.append(CadenceSample(timestamp=ts, cadence=cad))
            if pwr is not None and ts is not None:
                power_samples.append(PowerSample(timestamp=ts, power=pwr))

        sessions = list(fitfile.get_messages("session"))
        if sessions:
            s = sessions[0]
            start_time = s.get_value("start_time")
            total_calories = s.get_value("total_calories")
            total_elapsed_time = s.get_value("total_elapsed_time")
            if start_time is not None and total_elapsed_time is not None:
                end_time = start_time + timedelta(seconds=total_elapsed_time)

        for msg in fitfile.get_messages("device_info"):
            if msg.get_value("device_index") == 0:  # "creator" device
                device_serial = msg.get_value("serial_number")
                break

    return FitWorkout(
        start_time=start_time,
        end_time=end_time,
        total_calories=total_calories,
        total_elapsed_time=total_elapsed_time,
        device_serial=device_serial,
        heart_rate_samples=hr_samples,
        gps_track=gps_track,
        cadence_samples=cadence_samples,
        power_samples=power_samples,
    )
```

**Error handling pattern** (from `fit_generator.py` lines 42–44):
```python
try:
    FitFile.from_file(in_path)
except Exception as exc:
    raise ValueError(f"fit-tool could not parse {in_path!r}: {exc}") from exc
```
Apply same wrapping style to `parse_fit_file`: let `FitParseError` propagate naturally; Phase 5 adds user-facing messages.

---

### `hevy_parser.py` — new module

**Analog:** `fit_parser.py` (module-level functions, docstring style, pathlib, raise-on-bad-input)

**Imports pattern** (mirroring `fit_parser.py` style + `fit_generator.py` pathlib use):
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

**Module constant + helper functions**:
```python
HEVY_TS_FMT = "%b %d, %Y, %I:%M %p"
# Verified against all 95 workouts in original_hevy.csv
# Handles: "Apr 17, 2026, 5:46 PM"  and  "Mar 9, 2026, 10:58 AM" (single-digit day)


def _opt_float(val: str) -> float | None:
    """Return float or None for empty CSV cell."""
    return float(val) if val.strip() else None


def _opt_int(val: str) -> int | None:
    """Return int or None for empty CSV cell."""
    return int(val) if val.strip() else None


def _is_cardio(row: dict) -> bool:
    """D-07: no weight AND no reps = cardio row.

    Catches: Treadmill, Stair Machine, Stair Machine (Floors),
             Stair Machine (Steps), Walking — without a hardcoded name list.
    Does NOT flag: Decline Crunch, Russian Twist (no weight, has reps).
    """
    return not row["weight_kg"].strip() and not row["reps"].strip()
```

**Core grouping + cardio detection pattern** (from RESEARCH.md Pattern 3, verified):
```python
def parse_hevy_csv(path: str) -> list[HevyWorkout]:
    """Parse a Hevy CSV export into a list of HevyWorkout objects.

    Groups rows by (title, start_time, end_time) into workouts.
    Cardio rows (D-07: no weight AND no reps) are collected in
    HevyWorkout.skipped_cardio rather than exercises.

    Args:
        path: Absolute or relative path to the Hevy CSV file.

    Returns:
        List of HevyWorkout objects ordered by first appearance.
        Timestamps are naive local datetimes (D-05); Phase 3 applies UTC conversion.

    Raises:
        FileNotFoundError: If path does not exist.
        ValueError: If timestamp parsing fails on an unexpected format.
    """
    workouts: dict[tuple, HevyWorkout] = {}
    workout_exercises: dict[tuple, dict[str, HevyExercise]] = {}

    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = (row["title"], row["start_time"], row["end_time"])
            if key not in workouts:
                workouts[key] = HevyWorkout(
                    title=row["title"],
                    start_time=datetime.strptime(row["start_time"], HEVY_TS_FMT),
                    end_time=datetime.strptime(row["end_time"], HEVY_TS_FMT),
                    description=row.get("description", ""),
                    exercises=[],
                    skipped_cardio=[],
                )
                workout_exercises[key] = {}

            wo = workouts[key]

            if _is_cardio(row):
                name = row["exercise_title"]
                if name not in wo.skipped_cardio:
                    wo.skipped_cardio.append(name)
                continue

            ex_title = row["exercise_title"]
            if ex_title not in workout_exercises[key]:
                ex = HevyExercise(title=ex_title, sets=[])
                workout_exercises[key][ex_title] = ex
                wo.exercises.append(ex)

            workout_exercises[key][ex_title].sets.append(HevySet(
                set_index=_opt_int(row["set_index"]),
                set_type=row.get("set_type", "normal"),
                weight_kg=_opt_float(row["weight_kg"]),
                reps=_opt_int(row["reps"]),
                distance_km=_opt_float(row.get("distance_km", "")),
                duration_seconds=_opt_float(row.get("duration_seconds", "")),
                rpe=_opt_float(row.get("rpe", "")),
                superset_id=row.get("superset_id") or None,
            ))

    return list(workouts.values())
```

---

### `models.py` — new shared dataclasses module

**Analog:** `fit_generator.py` (lines 1–16, module docstring + imports pattern); dataclass usage pattern inferred from RESEARCH.md schema

**Module docstring + imports pattern** (copy style from `fit_generator.py` lines 1–16):
```python
"""Shared dataclasses for FitWorkout and HevyWorkout.

Imported by fit_parser.py, hevy_parser.py, and Phase 3+ merge modules.
All FIT timestamps are naive UTC-equivalent datetimes (fitparse output).
All Hevy timestamps are naive local datetimes (Phase 3 applies timezone).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
```

**FitWorkout dataclasses pattern** (from RESEARCH.md verified schema):
```python
@dataclass
class HRSample:
    timestamp: datetime   # naive UTC-equivalent, from fitparse
    heart_rate: int       # bpm


@dataclass
class GPSPoint:
    timestamp: datetime
    lat: float            # degrees (converted from semicircles)
    lon: float            # degrees (converted from semicircles)


@dataclass
class CadenceSample:
    timestamp: datetime
    cadence: int          # rpm


@dataclass
class PowerSample:
    timestamp: datetime
    power: int            # watts


@dataclass
class FitWorkout:
    start_time: datetime | None
    end_time: datetime | None
    total_calories: int | None
    total_elapsed_time: float | None
    device_serial: int | None
    heart_rate_samples: list[HRSample] = field(default_factory=list)
    gps_track: list[GPSPoint] = field(default_factory=list)
    cadence_samples: list[CadenceSample] = field(default_factory=list)
    power_samples: list[PowerSample] = field(default_factory=list)
```

**HevyWorkout dataclasses pattern** (from RESEARCH.md verified schema):
```python
@dataclass
class HevySet:
    set_index: int | None
    set_type: str                   # "normal" (only value in sample)
    weight_kg: float | None         # None for bodyweight exercises
    reps: int | None                # None for bodyweight exercises
    distance_km: float | None
    duration_seconds: float | None
    rpe: float | None               # 561/1528 rows have RPE
    superset_id: str | None         # absent in all sample rows; future-compatible


@dataclass
class HevyExercise:
    title: str
    sets: list[HevySet]


@dataclass
class HevyWorkout:
    title: str
    start_time: datetime            # naive local time (D-05)
    end_time: datetime              # naive local time (D-05)
    description: str                # workout notes, may be empty string
    exercises: list[HevyExercise]   # strength rows only (D-06)
    skipped_cardio: list[str]       # exercise names of cardio rows (D-06)
```

---

### `tests/conftest.py` — extend with Hevy fixture

**Analog:** `tests/conftest.py` (lines 1–25, existing file — copy exact structure)

**Existing content to preserve** (lines 1–25):
```python
"""Shared pytest fixtures for Phase 1 tests."""
import os
import pytest

# Absolute path to the sample Garmin FIT file (committed to repo)
SAMPLE_FIT = "/workspace/GarminHevyMerge/original_garmin.fit"

# Output directory for generated FIT files
OUTPUT_DIR = "/workspace/GarminHevyMerge/output"


@pytest.fixture
def sample_fit_path():
    """Return the absolute path to the sample Garmin FIT file."""
    assert os.path.exists(SAMPLE_FIT), f"Sample FIT not found: {SAMPLE_FIT}"
    return SAMPLE_FIT


@pytest.fixture
def output_dir(tmp_path):
    """Return a temporary directory for test output files.
    Uses pytest's tmp_path to avoid polluting the project output/ directory during tests.
    """
    return str(tmp_path)
```

**New fixture to append** (copy `sample_fit_path` structure exactly):
```python
# Absolute path to the sample Hevy CSV file (committed to repo)
SAMPLE_HEVY = "/workspace/GarminHevyMerge/original_hevy.csv"


@pytest.fixture
def sample_hevy_path():
    """Return the absolute path to the sample Hevy CSV file."""
    assert os.path.exists(SAMPLE_HEVY), f"Sample Hevy CSV not found: {SAMPLE_HEVY}"
    return SAMPLE_HEVY
```

---

### `tests/test_fit_parser.py` — new test file

**Analog:** `tests/test_fit_roundtrip.py` (lines 1–30) — copy import block, fixture usage, assertion style

**Imports + structure pattern** (from `test_fit_roundtrip.py` lines 1–11):
```python
"""Tests for parse_fit_file(): typed field extraction from original_garmin.fit.

Phase 2: verifies FitWorkout dataclass population, empty sensor lists, and
session metadata. read_fit_file() regression covered by test_fit_roundtrip.py.
"""
import pytest
import fitparse
from fit_parser import parse_fit_file
from models import FitWorkout, HRSample
```

**Test structure pattern** (from `test_fit_roundtrip.py` lines 12–29):
```python
def test_parse_fit_returns_hr_samples(sample_fit_path):
    """parse_fit_file() must return FitWorkout with non-empty heart_rate_samples."""
    result = parse_fit_file(sample_fit_path)
    assert isinstance(result, FitWorkout)
    assert len(result.heart_rate_samples) > 0
    assert isinstance(result.heart_rate_samples[0], HRSample)


def test_parse_fit_gps_absent_is_empty_list(sample_fit_path):
    """GPS absent in sample file — gps_track must be [] not None (D-04)."""
    result = parse_fit_file(sample_fit_path)
    assert result.gps_track == [], "absent sensor must be empty list, not None"


def test_parse_fit_session_metadata(sample_fit_path):
    """parse_fit_file() must extract start_time and total_calories from session."""
    result = parse_fit_file(sample_fit_path)
    assert result.start_time is not None
    assert result.total_calories == 266  # known value from sample file
```

---

### `tests/test_hevy_parser.py` — new test file

**Analog:** `tests/test_fit_roundtrip.py` (same structure) + Hevy-specific assertions from RESEARCH.md verification data

**Imports + structure pattern**:
```python
"""Tests for parse_hevy_csv(): workout grouping, cardio detection, null coercion.

Phase 2: verifies HevyWorkout count, timestamp parsing, cardio flagging (D-07),
and bodyweight-exercise handling against original_hevy.csv.
"""
import pytest
from datetime import datetime
from hevy_parser import parse_hevy_csv
from models import HevyWorkout
```

**Test structure pattern** (copy `test_fit_roundtrip.py` assertion style):
```python
def test_parse_hevy_workout_count(sample_hevy_path):
    """parse_hevy_csv() must return 95 HevyWorkout objects."""
    workouts = parse_hevy_csv(sample_hevy_path)
    assert len(workouts) == 95


def test_parse_hevy_timestamps(sample_hevy_path):
    """Timestamps must parse to naive datetime objects (D-05)."""
    workouts = parse_hevy_csv(sample_hevy_path)
    wo = workouts[0]
    assert isinstance(wo.start_time, datetime)
    assert wo.start_time.tzinfo is None, "timestamps must be naive (D-05)"


def test_parse_hevy_null_coercion(sample_hevy_path):
    """Empty CSV cells must be None, not 0 or empty string."""
    workouts = parse_hevy_csv(sample_hevy_path)
    # Find a bodyweight exercise set (no weight) and assert weight_kg is None
    for wo in workouts:
        for ex in wo.exercises:
            for s in ex.sets:
                if s.weight_kg is None:
                    return  # found a None weight — pass
    pytest.fail("Expected at least one set with weight_kg=None")


def test_parse_hevy_cardio_detection(sample_hevy_path):
    """Cardio rows (Treadmill etc.) must appear in skipped_cardio, not exercises."""
    workouts = parse_hevy_csv(sample_hevy_path)
    all_cardio = [name for wo in workouts for name in wo.skipped_cardio]
    assert "Treadmill" in all_cardio


def test_parse_hevy_bodyweight_not_cardio(sample_hevy_path):
    """Bodyweight exercises (no weight, has reps) must NOT be in skipped_cardio."""
    workouts = parse_hevy_csv(sample_hevy_path)
    all_cardio = [name for wo in workouts for name in wo.skipped_cardio]
    assert "Decline Crunch" not in all_cardio, (
        "Decline Crunch has reps — D-07 requires BOTH weight AND reps absent for cardio"
    )
```

---

## Shared Patterns

### Module Docstring Style
**Source:** `fit_parser.py` (lines 1–5) and `fit_generator.py` (lines 1–8)
**Apply to:** All new modules (`hevy_parser.py`, `models.py`)
```python
"""<Module purpose — one line>.

<Library choice rationale — one or two sentences.>
Phase N: <scope limitation note>.
"""
```

### Pathlib for Output Paths
**Source:** `fit_generator.py` lines 142–144
**Apply to:** Any file I/O that creates files
```python
out_path_obj = pathlib.Path(out_path)
out_path_obj.parent.mkdir(parents=True, exist_ok=True)
out_path_obj.write_bytes(data)
```
(Read operations use `open(path, ...)` directly — pathlib is for write-side path handling.)

### Pytest Fixture Style
**Source:** `tests/conftest.py` lines 12–25
**Apply to:** `tests/conftest.py` extension, all new test fixtures
```python
@pytest.fixture
def <fixture_name>():
    """<One-line description>."""
    assert os.path.exists(<PATH>), f"<Resource> not found: {<PATH>}"
    return <PATH>
```

### Test File Docstring Style
**Source:** `tests/test_fit_roundtrip.py` lines 1–5 and `tests/test_fit_scratch.py` lines 1–6
**Apply to:** `tests/test_fit_parser.py`, `tests/test_hevy_parser.py`
```python
"""Tests for <function>(): <what it verifies>.

Phase N <RED/GREEN> state: <current expectations>.
"""
```

### Error Propagation (no swallowing)
**Source:** `fit_generator.py` lines 42–44; `fit_parser.py` docstring Raises section
**Apply to:** `parse_fit_file()`, `parse_hevy_csv()`
- Wrap construction-time errors (`FitFile(path)`, `open(path)`) in try/except only if re-raising with context
- Let library exceptions (`FitParseError`, `ValueError` from strptime) propagate naturally in Phase 2
- Document raised exceptions in each function's `Raises:` docstring section

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Critical Constraints (from CLAUDE.md + CONTEXT.md)

These constraints must be enforced during implementation — planner must include them as explicit checklist items:

| Constraint | Source | Enforcement |
|------------|--------|-------------|
| Never use fit-tool for reading | CLAUDE.md, D-01 | `fit_parser.py` new function imports only `fitparse.FitFile`, not `fit_tool` |
| Never replace `read_fit_file()` | D-02 | Existing stub lines 1–23 preserved verbatim; new function appended below |
| Absent sensors = empty list, not None | D-04 | `field(default_factory=list)` in all FitWorkout sensor fields |
| Hevy timestamps = naive datetime | D-05 | No `pytz` / `zoneinfo` import anywhere in `fit_parser.py` or `hevy_parser.py` |
| Cardio = no weight AND no reps | D-07 | `_is_cardio` checks both conditions; unit test asserts Decline Crunch is NOT cardio |
| Empty CSV cells = None, not 0 | HEVY-01 | `_opt_float` / `_opt_int` helpers return None for empty string |
| pandas NOT used | RESEARCH.md | `hevy_parser.py` imports only `csv`, `datetime`, `models` |

---

## Metadata

**Analog search scope:** `/workspace/GarminHevyMerge/` (project root Python files and tests/)
**Files scanned:** `fit_parser.py`, `fit_generator.py`, `tests/conftest.py`, `tests/test_fit_roundtrip.py`, `tests/test_fit_scratch.py`
**Pattern extraction date:** 2026-04-20
