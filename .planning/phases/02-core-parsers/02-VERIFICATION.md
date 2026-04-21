---
phase: 02-core-parsers
verified: 2026-04-21T00:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification: []
---

# Phase 2: Core Parsers Verification Report

**Phase Goal:** FitParser and HevyParser correctly extract typed workout data from the sample files, with all known edge cases handled
**Verified:** 2026-04-21T00:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                                                            | Status     | Evidence                                                                                                                          |
|----|------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------------------------------|
| 1  | Developer can run FitParser against original_garmin.fit and receive a typed FitWorkout with all biometric record types (HR, GPS, cadence, power, calories, device info) and session timestamps | VERIFIED   | `parse_fit_file()` returns `FitWorkout` with 1597 `HRSample` objects, `total_calories=266`, `start_time=2026-04-17 09:45:49` (naive), `end_time` computed via `timedelta`; GPS/cadence/power are `[]` — correct for sample file (sensor absent) |
| 2  | Developer can run HevyParser against original_hevy.csv and receive a list of HevyWorkout dataclasses — timestamps via strptime, empty cells as None, bodyweight handled | VERIFIED   | `parse_hevy_csv()` returns 95 `HevyWorkout` objects; `start_time.tzinfo is None`; `weight_kg=None` confirmed for bodyweight sets; `reps` present when `weight_kg` absent |
| 3  | Cardio rows (Treadmill, Stair Machine) are detected during parsing and placed in `skipped_cardio`, not crashing or silently corrupting exercises                  | VERIFIED   | 5 cardio names confirmed in `skipped_cardio`: Treadmill, Stair Machine, Stair Machine (Floors), Stair Machine (Steps), Walking; none appear in `exercises` |
| 4  | Unit tests pass for both parsers using the sample files as fixtures                                                                                              | VERIFIED   | All 10 tests pass: 3 FIT parser + 5 Hevy parser + 2 Phase 1 regression (`pytest` 10/10 GREEN in 4.28 s)                         |
| 5  | models.py exports all 8 dataclasses with exact field signatures                                                                                                  | VERIFIED   | `grep -c "^@dataclass" models.py` → 8; all 8 classes importable; exactly 4 `field(default_factory=list)` calls (FitWorkout sensor lists); no fitparse/fit-tool imports |
| 6  | Absent sensors are empty lists, never None (D-04)                                                                                                                | VERIFIED   | `gps_track == []`, `cadence_samples == []`, `power_samples == []` confirmed by test and smoke check; `field(default_factory=list)` on all 4 sensor fields |
| 7  | FIT and Hevy timestamps are naive datetimes — no tzinfo (D-05)                                                                                                   | VERIFIED   | `start_time.tzinfo is None` confirmed by `test_parse_fit_session_metadata` and `test_parse_hevy_timestamps`; no pytz/zoneinfo imports in either parser |
| 8  | Bodyweight exercises (no weight, has reps) are classified as strength, not cardio (D-07)                                                                         | VERIFIED   | `Decline Crunch` appears in `exercises` list, not in `skipped_cardio`; confirmed by `test_parse_hevy_bodyweight_not_cardio` and smoke check |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact                     | Expected                                  | Status     | Details                                                                                                                         |
|------------------------------|-------------------------------------------|------------|---------------------------------------------------------------------------------------------------------------------------------|
| `models.py`                  | 8 shared dataclasses                      | VERIFIED   | 76 lines; 8 `@dataclass` decorators; `from __future__ import annotations`; 4 `field(default_factory=list)` on FitWorkout only  |
| `fit_parser.py`              | `parse_fit_file()` using fitparse         | VERIFIED   | 106 lines; both `read_fit_file()` (Phase 1 stub, preserved) and `parse_fit_file()` present; fitparse via `FitParseFile` alias  |
| `hevy_parser.py`             | `parse_hevy_csv()` using csv.DictReader   | VERIFIED   | 97 lines; `parse_hevy_csv`, `_is_cardio`, `_opt_float`, `_opt_int`, `HEVY_TS_FMT` all present                                 |
| `tests/conftest.py`          | Both `sample_fit_path` and `sample_hevy_path` fixtures | VERIFIED | Both fixtures present; `SAMPLE_FIT` and `SAMPLE_HEVY` constants; all Phase 1 fixtures preserved verbatim                       |
| `tests/test_fit_parser.py`   | 3 unit tests                              | VERIFIED   | 3 test functions present; all 3 GREEN                                                                                           |
| `tests/test_hevy_parser.py`  | 5 unit tests                              | VERIFIED   | 5 test functions present; all 5 GREEN                                                                                           |

---

### Key Link Verification

| From                    | To                              | Via                                        | Status  | Details                                                      |
|-------------------------|---------------------------------|--------------------------------------------|---------|--------------------------------------------------------------|
| `fit_parser.py`         | `models.FitWorkout`             | `from models import FitWorkout, HRSample, GPSPoint, CadenceSample, PowerSample` | WIRED   | Import present line 9; `FitWorkout(...)` constructed and returned |
| `fit_parser.py`         | `fitparse.FitFile`              | `from fitparse import FitFile as FitParseFile` | WIRED   | Import present line 8; `FitParseFile(path)` called in context manager |
| `fit_parser.py`         | `fit_tool.fit_file.FitFile`     | `from fit_tool.fit_file import FitFile`    | WIRED   | Original Phase 1 import preserved line 6; `read_fit_file()` intact |
| `hevy_parser.py`        | `models.HevyWorkout`            | `from models import HevyWorkout, HevyExercise, HevySet` | WIRED   | Import present line 9; all 3 model classes constructed in `parse_hevy_csv` |
| `hevy_parser.py`        | `csv.DictReader`                | `import csv`                               | WIRED   | `csv` imported line 2; `csv.DictReader(f)` called in function body |
| `tests/test_fit_parser.py` | `fit_parser.parse_fit_file`  | `from fit_parser import parse_fit_file`    | WIRED   | Import line 7; called in all 3 tests                         |
| `tests/test_hevy_parser.py` | `hevy_parser.parse_hevy_csv` | `from hevy_parser import parse_hevy_csv`  | WIRED   | Import line 8; called in all 5 tests                         |
| `tests/conftest.py`     | `original_hevy.csv`             | `SAMPLE_HEVY` constant with `os.path.exists` assertion | WIRED   | `SAMPLE_HEVY = "/workspace/GarminHevyMerge/original_hevy.csv"` line 28 |

---

### Data-Flow Trace (Level 4)

Not applicable — Phase 2 produces typed Python dataclasses from file I/O, not web components rendering to DOM. Data flow verified via behavioral spot-checks: real data confirmed flowing from sample files through parsers to dataclass fields.

---

### Behavioral Spot-Checks

| Behavior                                       | Command                                                   | Result                                        | Status |
|------------------------------------------------|-----------------------------------------------------------|-----------------------------------------------|--------|
| FIT parser returns 1597 HR samples             | Python import + assertion on `len(w.heart_rate_samples)` | 1597 confirmed                                | PASS   |
| FIT parser returns correct calories (266)      | Python assertion on `w.total_calories`                    | 266 confirmed                                 | PASS   |
| FIT absent sensors return `[]` not `None`      | Python assertion on `gps_track`, `cadence_samples`, `power_samples` | All `[]` confirmed                  | PASS   |
| FIT timestamp is naive (no tzinfo)             | Python assertion on `w.start_time.tzinfo is None`         | `None` confirmed                              | PASS   |
| Hevy parser returns exactly 95 workouts        | Python assertion on `len(ws)`                             | 95 confirmed                                  | PASS   |
| 5 cardio exercise names in skipped_cardio      | `sorted(set(all_cardio))`                                 | Treadmill, Stair Machine, Stair Machine (Floors), Stair Machine (Steps), Walking | PASS |
| Decline Crunch in exercises, not skipped_cardio | Python assertion on exercise/cardio lists               | Confirmed in exercises, absent from cardio    | PASS   |
| Full pytest suite                              | `.venv/bin/pytest tests/ -v`                             | 10 passed in 4.28 s                           | PASS   |

---

### Requirements Coverage

| Requirement | Source Plan     | Description                                                                                                                     | Status    | Evidence                                                                                                              |
|-------------|----------------|---------------------------------------------------------------------------------------------------------------------------------|-----------|-----------------------------------------------------------------------------------------------------------------------|
| FIT-02      | 02-01, 02-02   | User can upload a Garmin .fit file and the app correctly extracts all biometric records (heart rate, calories, GPS, cadence, power, device info) and exercise metadata | SATISFIED | `parse_fit_file()` extracts 1597 HR samples, session metadata (calories=266, start/end time, elapsed time), device serial; GPS/cadence/power correctly return `[]` when absent from sample file; 3 unit tests GREEN |
| HEVY-01     | 02-01, 02-03   | User can upload a Hevy CSV export and the app correctly parses exercises, sets, reps, weights, and timestamps                    | SATISFIED | `parse_hevy_csv()` groups 1528 rows into 95 workouts; timestamps parsed via `strptime` with `HEVY_TS_FMT`; empty cells coerced to `None` via `_opt_float`/`_opt_int`; bodyweight exercises retain `reps` with `weight_kg=None`; 5 unit tests GREEN |
| HEVY-02     | 02-01, 02-03   | App detects and handles mixed cardio rows (Treadmill, Stair Machine) — skips or flags them rather than crashing                 | SATISFIED | `_is_cardio()` detects all 5 cardio exercise types structurally (no weight AND no reps); 15 cardio rows across 5 names collected in `skipped_cardio`; parser does not crash or produce corrupt data; `test_parse_hevy_cardio_detection` GREEN |

No orphaned requirements — all 3 IDs declared across plans are accounted for. No Phase 2 requirements exist in REQUIREMENTS.md beyond these 3.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | —    | —       | —        | —      |

No TODOs, FIXMEs, placeholder returns, empty implementations, or hardcoded empty data found in `models.py`, `fit_parser.py`, or `hevy_parser.py`. No forbidden imports (pytz, zoneinfo, pandas, fitparse in hevy_parser) detected.

---

### Phase 1 Regression

`pytest tests/test_fit_roundtrip.py -v` — 2 passed. `read_fit_file()` preserved verbatim in `fit_parser.py` (line 12-25). `poc_roundtrip.py` imports unaffected.

---

### Human Verification Required

None — all Phase 2 success criteria are fully verifiable programmatically. The parsers operate on local fixture files; no browser interaction, external service, or visual output is required.

---

### Gaps Summary

No gaps. All 4 roadmap success criteria are met:

- SC1: `parse_fit_file()` returns `FitWorkout` with all biometric record types from `original_garmin.fit` — verified (1597 HR samples, calories, timestamps, device serial; GPS/cadence/power correctly absent as `[]`)
- SC2: `parse_hevy_csv()` returns 95 `HevyWorkout` objects with exercises, sets, weights, timestamps parsed correctly, empty cells as `None` — verified
- SC3: Cardio rows detected and placed in `skipped_cardio`, not exercises, not crashing — verified (5 cardio exercise names, structural detection rule D-07)
- SC4: Unit tests pass for both parsers — verified (10/10 GREEN including 2 Phase 1 regression tests)

---

_Verified: 2026-04-21T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
