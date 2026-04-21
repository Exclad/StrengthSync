# Phase 2: Core Parsers - Research

**Researched:** 2026-04-20
**Domain:** FIT file parsing (fitparse) + Hevy CSV parsing (stdlib csv + dataclasses)
**Confidence:** HIGH

## Summary

Phase 2 builds two parsers from known inputs: `original_garmin.fit` and `original_hevy.csv`.
Both sample files have been inspected directly during research. No external unknowns remain — the
scope is tightly bounded by CONTEXT.md decisions D-01 through D-07.

The FIT parser uses fitparse 1.2.0 (already installed) with `get_value()` for field extraction.
The sample Garmin file contains only heart-rate and distance in `record` messages — no GPS, no
cadence, no power. FitWorkout must return empty lists for absent sensors as per D-04; the
session message holds calories, start/end timestamps, and device summary.

The Hevy parser uses stdlib `csv.DictReader` (pandas is **not yet installed**). The CSV has 1,528
rows across 95 workouts. Cardio detection via D-07 (no weight AND no reps) correctly flags 15
rows covering 5 exercise names: Treadmill, Stair Machine, Stair Machine (Floors), Stair Machine
(Steps), Walking. Bodyweight exercises (no weight, has reps: Decline Crunch, Russian Twist) are
correctly NOT flagged as cardio. The strptime format `"%b %d, %Y, %I:%M %p"` parses all observed
timestamp variants including single-digit days.

**Primary recommendation:** Implement both parsers as module-level functions (no classes needed),
using Python dataclasses with `field(default_factory=list)` for optional biometric lists.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Switch `fit_parser.py` from fit-tool to **fitparse** for all field-level extraction.
  fitparse reads every message type including Garmin-proprietary messages (140, 288, 326, 327)
  that fit-tool silently drops. fit-tool remains the write library only — never used for reading
  in Phase 2+.
- **D-02:** Add a new `parse_fit_file(path) -> FitWorkout` function alongside the existing
  `read_fit_file()` stub. Do NOT replace `read_fit_file()` — poc_roundtrip.py still calls it.
  The planner may deprecate the stub in a future phase.
- **D-03:** `FitWorkout` uses **typed lists per biometric type**: `heart_rate_samples:
  list[HRSample]`, `gps_track: list[GPSPoint]`, `cadence_samples: list[CadenceSample]`, etc.
  Each biometric type gets its own typed dataclass.
- **D-04:** Absent sensors are represented as **empty lists** (not None). `gps_track:
  list[GPSPoint] = field(default_factory=list)` — empty means sensor absent. No None checks
  needed downstream.
- **D-05:** `HevyParser` parses timestamps (`"Apr 17, 2026, 5:46 PM"`) to **naive `datetime`
  objects** via `strptime`. No timezone parameter in Phase 2.
- **D-06:** `HevyWorkout` has two lists: `exercises: list[HevyExercise]` (strength rows only)
  and `skipped_cardio: list[str]` (exercise names of rows detected as cardio).
- **D-07:** Cardio detection rule: **no weight AND no reps** = cardio row. If `weight_kg` is
  empty/None AND `reps` is empty/None, the row is treated as cardio.

### Claude's Discretion
- Exact field names within `HRSample`, `GPSPoint`, etc. — follow fitparse field naming conventions
- Handling of empty/`None` cells in Hevy CSV (e.g. `rpe`, `distance_km`, `superset_id`) —
  store as `None`, not 0
- `HevySet` schema fields and whether to include `set_type` and `rpe` — include all non-empty
  Hevy columns
- Whether to split `HevyParser` into a class or keep as module-level functions — planner decides

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIT-02 | User can upload a Garmin `.fit` file and the app correctly extracts all biometric records (heart rate samples, rest periods, calories, GPS, cadence, power, device info) and exercise metadata | fitparse 1.2.0 API confirmed; sample file inspected — HR+distance present, GPS/cadence/power absent (empty lists); session provides calories and timestamps |
| HEVY-01 | User can upload a Hevy CSV export and the app correctly parses exercises, sets, reps, weights, and timestamps (format: `"Apr 17, 2026, 5:46 PM"`, local time) | strptime format `"%b %d, %Y, %I:%M %p"` verified against all timestamp variants in sample; 95 workouts, 1528 rows; bodyweight exercises (no weight, has reps) handled correctly |
| HEVY-02 | App detects and handles mixed cardio rows (e.g. Treadmill, Stair Machine) in the Hevy CSV — skips or flags them with a clear message rather than crashing | D-07 rule correctly identifies all 15 cardio rows in sample; 5 exercise names flagged; returned in `skipped_cardio: list[str]` per D-06 |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FIT field extraction | Backend module (fit_parser.py) | — | Parse-time transformation, no UI concern |
| FIT dataclass schema | Backend module (fit_parser.py) | Phase 4 merge | Schema designed for Phase 4 consumption |
| Hevy CSV parsing | Backend module (hevy_parser.py) | — | File I/O + type coercion, no UI concern |
| Cardio detection + flagging | Backend module (hevy_parser.py) | Phase 5 UI | Detection here; surfacing in UI is Phase 5 |
| Timezone conversion | DEFERRED to Phase 3 | — | Phase 2 produces naive datetimes only (D-05) |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fitparse | 1.2.0 | FIT file reading and field extraction | Already installed; reads Garmin-proprietary messages that fit-tool drops; `get_value()` returns None for absent fields |
| Python stdlib `csv` | 3.11 stdlib | Hevy CSV parsing | pandas not installed; DictReader sufficient for structured CSV with known columns |
| Python `dataclasses` | 3.11 stdlib | Typed output dataclasses | Project pattern established in Phase 1; `field(default_factory=list)` for optional lists |
| Python `datetime` | 3.11 stdlib | Timestamp parsing | strptime for Hevy; fitparse returns datetime objects directly |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fitparse exceptions | 1.2.0 | Error handling | `FitParseError`, `FitCRCError`, `FitHeaderError`, `FitEOFError` — catch on parse_fit_file entry |
| Python `pathlib` | 3.11 stdlib | Path handling | Pattern established in fit_generator.py |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdlib csv | pandas | pandas not installed; adds dependency for simple row iteration; not worth it for Phase 2 |
| module functions | class-based parsers | Classes add boilerplate with no benefit for stateless parse operations |

**Installation:**

No new packages needed — fitparse 1.2.0 is already in `.venv/`. `requirements.txt` does not
currently list pandas; do not add it in Phase 2.

**Version verification:** [VERIFIED: live venv inspection]
- fitparse: 1.2.0 (installed in `.venv/lib/python3.11/site-packages/fitparse`)
- Python: 3.11.2 (global)
- pandas: NOT installed (confirmed `ModuleNotFoundError`)

---

## Architecture Patterns

### System Architecture Diagram

```
original_garmin.fit
        |
        v
  fitparse.FitFile
        |
   get_messages()
        |
   +-----------+----------+----------+-----------+
   |           |          |          |           |
  record     session  device_info   set       event
   |           |          |
  HR/dist   calories/    device
  samples   timestamps   metadata
   |           |          |
   +-----+-----+----------+
         |
      FitWorkout
      (dataclass)
      - start_time: datetime
      - end_time: datetime
      - total_calories: int | None
      - heart_rate_samples: list[HRSample]
      - gps_track: list[GPSPoint]        <- empty (sensor absent)
      - cadence_samples: list[CadenceSample]  <- empty
      - power_samples: list[PowerSample] <- empty
      - device_serial: int | None
```

```
original_hevy.csv
        |
        v
  csv.DictReader
        |
  iterate rows
        |
   +----+----+
   |         |
cardio?   strength
(D-07)    row
   |         |
   v         v
skipped   group by
_cardio   (title + start + end)
list[str]     |
          HevyExercise
          (group sets)
              |
          HevyWorkout
          (dataclass)
          - title: str
          - start_time: datetime
          - end_time: datetime
          - exercises: list[HevyExercise]
          - skipped_cardio: list[str]
```

### Recommended Project Structure

```
GarminHevyMerge/
├── fit_parser.py       # parse_fit_file() added; read_fit_file() UNCHANGED
├── hevy_parser.py      # NEW: parse_hevy_csv() -> list[HevyWorkout]
├── models.py           # NEW: all dataclasses (FitWorkout, HevyWorkout, etc.)
├── tests/
│   ├── conftest.py     # EXTEND: add sample_hevy_path fixture
│   ├── test_fit_parser.py   # NEW: FitParser unit tests
│   └── test_hevy_parser.py  # NEW: HevyParser unit tests
```

Alternatively, dataclasses may live in `fit_parser.py` and `hevy_parser.py` respectively if
the planner prefers co-location over a shared models module. Either approach is acceptable —
Claude's discretion per CONTEXT.md.

### Pattern 1: fitparse Field Extraction

**What:** Use `get_value(field_name)` on each `DataMessage`; returns `None` if field absent.
**When to use:** For all FIT record message field reads.

```python
# Source: /dtcooper/python-fitparse (Context7 verified)
from fitparse import FitFile

with FitFile(path) as fitfile:
    for record in fitfile.get_messages("record"):
        hr = record.get_value("heart_rate")       # int or None
        ts = record.get_value("timestamp")        # datetime (naive, UTC-equivalent) or None
        lat = record.get_value("position_lat")    # int semicircles or None
        lng = record.get_value("position_long")   # int semicircles or None
        if hr is not None and ts is not None:
            hr_samples.append(HRSample(timestamp=ts, heart_rate=hr))
```

### Pattern 2: GPS Semicircle Conversion

**What:** FIT stores lat/lon as semicircles (signed 32-bit integers). GPS absent in sample file
but must be handled.
**Formula:** `degrees = semicircles * (180 / 2**31)`

```python
# Source: [ASSUMED] — standard FIT protocol conversion
_SEMICIRCLES_TO_DEG = 180.0 / (2 ** 31)

def _to_degrees(semicircles: int) -> float:
    return semicircles * _SEMICIRCLES_TO_DEG
```

### Pattern 3: Hevy CSV Grouping into Workouts

**What:** Multiple rows share the same `(title, start_time, end_time)` tuple — group them.
**When to use:** Top-level HevyParser loop.

```python
# Source: [VERIFIED: direct CSV inspection]
from csv import DictReader
from collections import defaultdict
from datetime import datetime

HEVY_TS_FMT = "%b %d, %Y, %I:%M %p"

def parse_hevy_csv(path: str) -> list[HevyWorkout]:
    workouts: dict[tuple, HevyWorkout] = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in DictReader(f):
            key = (row["title"], row["start_time"], row["end_time"])
            if key not in workouts:
                workouts[key] = HevyWorkout(
                    title=row["title"],
                    start_time=datetime.strptime(row["start_time"], HEVY_TS_FMT),
                    end_time=datetime.strptime(row["end_time"], HEVY_TS_FMT),
                    exercises=[],
                    skipped_cardio=[],
                )
            # D-07: cardio detection
            is_cardio = not row["weight_kg"].strip() and not row["reps"].strip()
            ...
```

### Pattern 4: Hevy Null Coercion

**What:** Empty CSV cells arrive as empty string `""`. Must convert to `None` per D-05.
**When to use:** All optional Hevy fields (rpe, distance_km, superset_id, etc.)

```python
# Source: [VERIFIED: direct CSV inspection — 561 rows have empty rpe]
def _opt_float(val: str) -> float | None:
    return float(val) if val.strip() else None

def _opt_int(val: str) -> int | None:
    return int(val) if val.strip() else None
```

### Anti-Patterns to Avoid

- **Using fit-tool for reading:** fit-tool silently drops Garmin message types 140, 288, 326, 327
  and unknown field IDs. [VERIFIED: Phase 1 deviation documented in STATE.md]
- **Replacing `read_fit_file()`:** poc_roundtrip.py imports it directly; removal breaks Phase 1
  tests. D-02 says add `parse_fit_file()` alongside it.
- **Using `None` for absent sensor lists:** D-04 mandates empty lists. Phase 4 will iterate
  these lists directly — `None` would require None-checks everywhere downstream.
- **Pandas for Hevy parsing:** pandas is not installed; requires adding a new dependency that
  is not needed for simple CSV row iteration.
- **Storing empty CSV cells as `0`:** HEVY-01 explicitly requires `None` for empty cells. `0`
  would corrupt weight and reps data for bodyweight exercises.
- **Hardcoding cardio names:** D-07 chose the no-weight+no-reps rule precisely to avoid a
  brittle name list. Never add a name allowlist for cardio detection.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FIT field type coercion | Custom binary parser | fitparse `get_value()` | fitparse handles FIT type system, scaling, offsets, subfields, and unknown message handling |
| FIT timestamp conversion | Manual FIT epoch math | fitparse datetime output | fitparse already applies the 631,065,600-second FIT epoch offset; output is UTC-equivalent naive datetime |
| CSV column parsing | Manual `split(",")` | `csv.DictReader` | Handles quoted fields, commas inside strings, BOM |
| Cardio name detection | Name lookup table | D-07 structural rule | Name list becomes stale when user adds new cardio exercises |

**Key insight:** Both fitparse (FIT epoch, field scaling) and csv.DictReader (quoting) solve
problems that look trivial but have correctness traps. Use them.

---

## Common Pitfalls

### Pitfall 1: fitparse Returns Naive Datetimes (UTC-Equivalent)

**What goes wrong:** fitparse timestamps have `tzinfo=None` but represent UTC. Code that
compares them directly with timezone-aware datetimes raises `TypeError`. Code that assumes
they are local time will be wrong by the user's UTC offset.
**Why it happens:** FIT spec stores timestamps as seconds since 1989-12-31 UTC. fitparse
converts to Python datetime but does not attach tzinfo.
**How to avoid:** Treat all fitparse datetimes as UTC-equivalent naive datetimes. Store them
as-is in FitWorkout. Phase 3 handles timezone conversion — Phase 2 must not attach tzinfo.
**Warning signs:** Any import of `pytz` or `zoneinfo` in `fit_parser.py` is a Phase 2 violation.

[VERIFIED: live inspection — `record.get_value('timestamp').tzinfo is None`; confirmed UTC
by raw_value + FIT offset = correct UTC datetime]

### Pitfall 2: Bodyweight Exercises Miscategorized as Cardio

**What goes wrong:** Exercises like Decline Crunch (no weight, has reps) get flagged as cardio
under a naive "no weight = cardio" rule, dropping strength data.
**Why it happens:** D-07 requires BOTH weight AND reps to be absent. Implementing only
`not weight_kg` without checking `reps` creates false positives.
**How to avoid:** Gate is `not row["weight_kg"].strip() AND not row["reps"].strip()`.
**Warning signs:** Unit test should assert Decline Crunch appears in `exercises`, not `skipped_cardio`.

[VERIFIED: 13 rows have no weight but have reps — Decline Crunch (9), Squat Machine (1),
Crunch (2), Russian Twist Bodyweight (1)]

### Pitfall 3: Walking Rows Are Also Cardio (Not Just Named Exercises)

**What goes wrong:** Assuming only "Stair Machine" and "Treadmill" are cardio. Walking rows
in the sample also have no weight and no reps.
**Why it happens:** The CONTEXT.md examples list Treadmill and Stair Machine, but the actual
dataset includes Walking and "Stair Machine (Steps)" as well.
**How to avoid:** Apply D-07 rule structurally — it handles all current cardio types including
Walking without code changes.
**Warning signs:** Hardcoded name list missing "Walking" while the D-07 rule already handles it.

[VERIFIED: live data — 3 Walking rows, 1 Stair Machine (Steps) row, all no-weight+no-reps]

### Pitfall 4: GPS Absent But Field Referenced

**What goes wrong:** Phase 4 code tries to iterate `gps_track` expecting GPSPoint objects,
but the field was populated with `None` instead of `[]`, causing `TypeError: 'NoneType' is
not iterable`.
**Why it happens:** D-04 says empty lists, not None. If the parser returns `None` for absent GPS,
every downstream consumer needs a guard.
**How to avoid:** `gps_track: list[GPSPoint] = field(default_factory=list)`. Never return `None`.

[VERIFIED: live inspection — `position_lat` and `position_long` are `None` across all 1597
record messages in `original_garmin.fit`]

### Pitfall 5: `read_fit_file()` Broken by Phase 2 Changes

**What goes wrong:** Renaming or removing `read_fit_file()` from `fit_parser.py` causes
`poc_roundtrip.py` import to fail, breaking all Phase 1 tests.
**Why it happens:** D-02 says ADD `parse_fit_file()` alongside the stub, not replace it.
**How to avoid:** Keep `read_fit_file()` signature and docstring exactly as-is. Add the new
function below it.
**Warning signs:** `test_fit_roundtrip.py` fails with ImportError.

[VERIFIED: `from fit_parser import read_fit_file` in test_fit_roundtrip.py]

### Pitfall 6: fitparse CRC Error on Unusual Files

**What goes wrong:** A FIT file with a corrupted CRC raises `FitCRCError` rather than
yielding partial data.
**Why it happens:** fitparse validates CRC by default.
**How to avoid:** Wrap `FitFile(path)` construction in try/except catching `FitParseError`.
For Phase 2 purposes, let the exception propagate — the sample file passes. Phase 5 adds
user-facing error messages.

[CITED: context7.com/dtcooper/python-fitparse — CRC validation and error handling]

---

## Code Examples

Verified patterns from official sources:

### FitParser — Session Metadata Extraction

```python
# Source: /dtcooper/python-fitparse (Context7 verified)
# fitparse returns naive datetimes; treat as UTC-equivalent
with FitFile(path) as fitfile:
    sessions = list(fitfile.get_messages("session"))
    if sessions:
        s = sessions[0]
        start_time = s.get_value("start_time")       # naive datetime (UTC-equiv)
        total_calories = s.get_value("total_calories")  # int kcal or None
        total_elapsed = s.get_value("total_elapsed_time")  # float seconds or None
```

### FitParser — HR Sample Extraction

```python
# Source: /dtcooper/python-fitparse (Context7 verified) + live data inspection
hr_samples = []
with FitFile(path) as fitfile:
    for msg in fitfile.get_messages("record"):
        hr = msg.get_value("heart_rate")
        ts = msg.get_value("timestamp")
        if hr is not None and ts is not None:
            hr_samples.append(HRSample(timestamp=ts, heart_rate=hr))
# Sample file: 1597 record messages, all have heart_rate != None
```

### HevyParser — Timestamp Parsing

```python
# Source: [VERIFIED: tested against all 95 workouts in original_hevy.csv]
from datetime import datetime

HEVY_TS_FMT = "%b %d, %Y, %I:%M %p"

# Works for: "Apr 17, 2026, 5:46 PM", "Mar 9, 2026, 10:58 AM"
# (single-digit day, AM/PM both confirmed)
dt = datetime.strptime("Apr 17, 2026, 5:46 PM", HEVY_TS_FMT)
# -> datetime(2026, 4, 17, 17, 46, 0), tzinfo=None
```

### HevyParser — Cardio Detection (D-07)

```python
# Source: [VERIFIED: 15 cardio rows confirmed in original_hevy.csv]
def _is_cardio(row: dict) -> bool:
    """D-07: no weight AND no reps = cardio row."""
    return not row["weight_kg"].strip() and not row["reps"].strip()
```

---

## Dataclass Schema (Recommended)

Based on live sample file inspection. All fields verified against actual data.

### FitWorkout

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
    start_time: datetime                              # from session message
    end_time: datetime                                # from session timestamp
    total_calories: int | None                        # kcal, None if absent
    total_elapsed_time: float | None                  # seconds
    device_serial: int | None                         # from device_info creator
    heart_rate_samples: list[HRSample] = field(default_factory=list)
    gps_track: list[GPSPoint] = field(default_factory=list)          # empty in sample
    cadence_samples: list[CadenceSample] = field(default_factory=list)  # empty in sample
    power_samples: list[PowerSample] = field(default_factory=list)   # empty in sample
```

**Verified against sample file:**
- `heart_rate_samples`: 1597 entries (all record messages have HR)
- `gps_track`: 0 entries (`position_lat` is None across all records)
- `cadence_samples`: 0 entries (no cadence field in records)
- `power_samples`: 0 entries (no power field in records)
- `total_calories`: 266 kcal
- `start_time`: `2026-04-17 09:45:49` (naive, UTC-equivalent)

### HevyWorkout

```python
@dataclass
class HevySet:
    set_index: int
    set_type: str                  # "normal" (only value in sample)
    weight_kg: float | None        # None for bodyweight exercises
    reps: int | None               # None for bodyweight exercises
    distance_km: float | None      # None unless cardio (skipped before reaching here)
    duration_seconds: float | None
    rpe: float | None              # 561/1528 rows have RPE

@dataclass
class HevyExercise:
    title: str
    sets: list[HevySet]

@dataclass
class HevyWorkout:
    title: str
    start_time: datetime           # naive, local time (D-05)
    end_time: datetime             # naive, local time (D-05)
    description: str               # workout notes, may be empty string
    exercises: list[HevyExercise]  # strength rows only
    skipped_cardio: list[str]      # exercise names of cardio rows (D-06)
```

**Verified against sample file:**
- 95 workouts, 1528 rows total
- 15 cardio rows, 5 unique cardio exercise names
- 13 bodyweight rows (no weight, has reps) — NOT cardio per D-07
- RPE: float (e.g. `9`, `9.5`, `10`) or absent — store as `float | None`
- `superset_id`: absent in all 1528 rows — include as `str | None` for future compatibility

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fit-tool for reading | fitparse for reading | Phase 2 (D-01) | fitparse sees all message types; fit-tool silently drops Garmin proprietary messages |
| fit-tool round-trip reconstruction | shutil.copy2 binary copy | Phase 1 deviation | fit-tool 0.9.15 cannot faithfully reconstruct; binary copy is the workaround |

**Deprecated/outdated in this project:**
- fit-tool for reading: causes silent data loss; never use for field extraction after Phase 1

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GPS semicircles conversion formula `degrees = semicircles * (180 / 2**31)` | Code Examples | Wrong GPS coordinates in output; low risk as GPS is absent in sample and not tested in Phase 2 |
| A2 | `total_elapsed_time` from session == workout wall-clock duration | Dataclass Schema | FIT may distinguish `total_elapsed_time` from `total_timer_time`; session message has both; planner may choose one |

---

## Open Questions

1. **Single `models.py` vs co-located dataclasses**
   - What we know: Phase 1 has no shared models file; fit_generator.py and fit_parser.py are separate
   - What's unclear: Phase 3+ will import both `FitWorkout` and `HevyWorkout`; co-location makes cross-imports awkward
   - Recommendation: Create `models.py` for all dataclasses; both parsers import from it

2. **`end_time` source for FitWorkout**
   - What we know: Session `timestamp` field = `2026-04-17 09:45:49` (same as `start_time` in raw data), but `total_elapsed_time` = 3126.976s
   - What's unclear: Whether `timestamp` or `start_time + elapsed` is the correct end_time
   - Recommendation: Compute `end_time = start_time + timedelta(seconds=total_elapsed_time)` — more reliable than relying on the session timestamp field

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | Runtime | ✓ | 3.11.2 (global) | — |
| fitparse | FIT parsing | ✓ | 1.2.0 (.venv) | — |
| pytest | Test runner | ✓ | 9.0.3 (.venv) | — |
| pandas | Hevy CSV parsing | ✗ | — | stdlib `csv.DictReader` (sufficient) |
| original_garmin.fit | FIT parser fixture | ✓ | present at project root | — |
| original_hevy.csv | Hevy parser fixture | ✓ | present at project root | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- pandas: not installed; stdlib `csv.DictReader` is the fallback and is fully sufficient for
  Phase 2's structured CSV parsing needs.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 |
| Config file | none (pytest auto-discovery) |
| Quick run command | `pytest tests/test_fit_parser.py tests/test_hevy_parser.py -x` |
| Full suite command | `pytest tests/ -v` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIT-02 | `parse_fit_file()` returns FitWorkout with HR samples | unit | `pytest tests/test_fit_parser.py::test_parse_fit_returns_hr_samples -x` | ❌ Wave 0 |
| FIT-02 | `parse_fit_file()` returns empty list for absent GPS | unit | `pytest tests/test_fit_parser.py::test_parse_fit_gps_absent_is_empty_list -x` | ❌ Wave 0 |
| FIT-02 | `parse_fit_file()` extracts session calories and timestamps | unit | `pytest tests/test_fit_parser.py::test_parse_fit_session_metadata -x` | ❌ Wave 0 |
| FIT-02 | `read_fit_file()` still works (regression) | unit | `pytest tests/test_fit_roundtrip.py -x` | ✅ exists |
| HEVY-01 | `parse_hevy_csv()` returns 95 HevyWorkout objects | unit | `pytest tests/test_hevy_parser.py::test_parse_hevy_workout_count -x` | ❌ Wave 0 |
| HEVY-01 | Timestamps parse correctly to naive datetime | unit | `pytest tests/test_hevy_parser.py::test_parse_hevy_timestamps -x` | ❌ Wave 0 |
| HEVY-01 | Empty cells stored as None (not 0) | unit | `pytest tests/test_hevy_parser.py::test_parse_hevy_null_coercion -x` | ❌ Wave 0 |
| HEVY-02 | Cardio rows (Treadmill) in skipped_cardio | unit | `pytest tests/test_hevy_parser.py::test_parse_hevy_cardio_detection -x` | ❌ Wave 0 |
| HEVY-02 | Bodyweight exercises (Decline Crunch) NOT in skipped_cardio | unit | `pytest tests/test_hevy_parser.py::test_parse_hevy_bodyweight_not_cardio -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest tests/test_fit_parser.py tests/test_hevy_parser.py -x`
- **Per wave merge:** `pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/test_fit_parser.py` — covers FIT-02 test cases above
- [ ] `tests/test_hevy_parser.py` — covers HEVY-01, HEVY-02 test cases above
- [ ] `tests/conftest.py` — extend with `sample_hevy_path` fixture pointing to `original_hevy.csv`

---

## Security Domain

Phase 2 parses local files from trusted sample fixtures only. No user-supplied files, no network
I/O, no authentication in this phase. ASVS categories V2, V3, V4, V6 do not apply.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Partial | Structural validation (cardio rule, null coercion); full user-input validation deferred to Phase 5 upload handler |
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V6 Cryptography | No | — |

---

## Sources

### Primary (HIGH confidence)

- `/dtcooper/python-fitparse` (Context7) — DataMessage API, `get_value()`, `get_messages()`,
  context manager, error handling
- Live codebase inspection — `fit_parser.py`, `fit_generator.py`, `tests/`, `conftest.py`
- Live data inspection — `original_garmin.fit` via fitparse (1597 records, 36 sets, 1 session,
  message type inventory)
- Live data inspection — `original_hevy.csv` via csv.DictReader (1528 rows, 95 workouts,
  15 cardio rows, null patterns)

### Secondary (MEDIUM confidence)

- CONTEXT.md decisions D-01 through D-07 — all research constrained and confirmed against these

### Tertiary (LOW confidence)

- GPS semicircles formula (A1) — standard FIT protocol convention, not directly verified against
  a GPS-containing file

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — fitparse 1.2.0 confirmed installed; all APIs verified against actual
  sample files; stdlib csv verified
- Architecture: HIGH — dataclass schemas derived from live field inspection of both sample files;
  no assumptions about field presence
- Pitfalls: HIGH — all pitfalls discovered through live inspection or documented Phase 1 deviations

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (stable: fitparse 1.2.0 pinned, sample files fixed)
