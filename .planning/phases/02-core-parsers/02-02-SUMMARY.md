---
phase: 02-core-parsers
plan: "02"
subsystem: fit_parser
tags:
  - python
  - fitparse
  - fit
  - parser
dependency_graph:
  requires:
    - "02-01"  # models.py with FitWorkout, HRSample, GPSPoint, CadenceSample, PowerSample
  provides:
    - "parse_fit_file() in fit_parser.py"
  affects:
    - "02-03"  # Hevy parser (parallel wave; no dependency)
    - "03"     # Phase 3 matcher imports FitWorkout
tech_stack:
  added:
    - "fitparse 1.2.0 — FIT field extraction via get_value(); context manager supported"
  patterns:
    - "FitFile context manager for resource-safe file parsing"
    - "Typed list accumulation with None-guard before append (absent sensors -> [])"
    - "Semicircle-to-degree conversion via _SEMICIRCLES_TO_DEG = 180.0 / 2**31"
    - "end_time computed as start_time + timedelta(seconds=total_elapsed_time)"
key_files:
  modified:
    - fit_parser.py
decisions:
  - "D-01 enforced: fitparse used for parse_fit_file(), fit-tool kept only for read_fit_file()"
  - "D-02 enforced: read_fit_file() stub preserved verbatim; parse_fit_file() appended below"
  - "D-04 enforced: absent sensors returned as [] not None"
  - "D-05 enforced: no pytz/zoneinfo import; fitparse naive datetimes stored as-is"
  - "Context manager (with FitParseFile(...) as fitfile:) used — fitparse 1.2.0 supports __enter__/__exit__ (verified)"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-21"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 02 Plan 02: FIT Parser Implementation Summary

**One-liner:** `parse_fit_file()` added to `fit_parser.py` using fitparse — extracts 1597 HR samples, session metadata (calories=266), and empty lists for absent GPS/cadence/power sensors.

## What Was Built

`parse_fit_file(path: str) -> FitWorkout` implemented in `/workspace/GarminHevyMerge/fit_parser.py` alongside the preserved `read_fit_file()` stub. The function uses fitparse 1.2.0's context manager API to parse `original_garmin.fit` and populate a typed `FitWorkout` dataclass.

## Implementation Approach

fitparse (D-01) used exclusively for `parse_fit_file()` — not fit-tool, which silently drops Garmin-proprietary message types 140, 288, 326, 327. The existing `fit_tool.fit_file.FitFile` import and `read_fit_file()` function were preserved byte-for-byte (D-02) since `poc_roundtrip.py` and `test_fit_roundtrip.py` import them directly.

`FitParseFile` alias is used for the fitparse import to avoid shadowing the `FitFile` name from fit-tool. Both imports coexist in the same module.

The context manager form `with FitParseFile(path) as fitfile:` was chosen over plain instantiation — fitparse 1.2.0 exposes `__enter__` and `__exit__` (verified via inspection), making it safe and the idiomatic approach for resource cleanup.

## Verified Sample File Values

| Field | Value | Source |
|-------|-------|--------|
| `heart_rate_samples` | 1597 entries | All 1597 record messages have `heart_rate != None` |
| `gps_track` | 0 entries (empty list) | `position_lat` is None across all records — D-04 verified |
| `cadence_samples` | 0 entries (empty list) | No cadence field present |
| `power_samples` | 0 entries (empty list) | No power field present |
| `total_calories` | 266 kcal | From session message |
| `start_time` | `2026-04-17 09:45:49` (naive, UTC-equivalent) | From session message |
| `end_time` | `2026-04-17 10:37:55.976000` (naive) | Computed: start + timedelta(total_elapsed_time) |
| `total_elapsed_time` | 3126.976 seconds | From session message |
| `device_serial` | present (int) | From device_info message, device_index == 0 |
| `start_time.tzinfo` | None | Confirmed naive — no timezone attached (D-05) |

## Regression Status

`test_fit_roundtrip.py` — GREEN. Both `test_roundtrip_reparses` and `test_output_dir_fixture_uses_tmp_path` pass. `poc_roundtrip.py` imports `read_fit_file` without error.

## Test Results

All 5 tests pass (3 new + 2 regression):

```
tests/test_fit_parser.py::test_parse_fit_returns_hr_samples      PASSED
tests/test_fit_parser.py::test_parse_fit_gps_absent_is_empty_list PASSED
tests/test_fit_parser.py::test_parse_fit_session_metadata         PASSED
tests/test_fit_roundtrip.py::test_roundtrip_reparses              PASSED
tests/test_fit_roundtrip.py::test_output_dir_fixture_uses_tmp_path PASSED
```

## Deviations from Plan

**1. [Rule — Pattern choice] Context manager used instead of plain instantiation**

The PLAN.md task specified "default to plain instantiation to avoid version-specific behavior", but the PATTERNS.md reference pattern and fitparse 1.2.0 both support the context manager. After verifying via Python introspection that `__enter__` and `__exit__` are present on `FitFile`, the context manager was used — it is the idiomatic resource-safe pattern and matches the PATTERNS.md canonical reference exactly. This is a minor stylistic alignment, not a correctness deviation.

## Known Stubs

None — `parse_fit_file()` is fully wired to `original_garmin.fit` and returns real data.

## Threat Flags

None — Phase 2 parses trusted local fixture files only. No new network endpoints, auth paths, or trust boundary crossings introduced.

## Self-Check

Files exist:
- [x] `fit_parser.py` — modified, `parse_fit_file()` present

Commits exist:
- [x] `a63d107` — feat(02-02): implement parse_fit_file() using fitparse in fit_parser.py

## Self-Check: PASSED
