---
phase: 02-core-parsers
plan: 03
subsystem: hevy-parser
tags:
  - python
  - csv
  - hevy
  - parser
dependency_graph:
  requires:
    - models.HevyWorkout
    - models.HevyExercise
    - models.HevySet
  provides:
    - hevy_parser.parse_hevy_csv
    - hevy_parser._is_cardio
    - hevy_parser._opt_float
    - hevy_parser._opt_int
    - hevy_parser.HEVY_TS_FMT
  affects:
    - Phase 3 (timezone conversion imports HevyWorkout.start_time/end_time naive datetimes)
    - Phase 4 (merge consumes list[HevyWorkout])
tech_stack:
  added: []
  patterns:
    - stdlib csv.DictReader for structured CSV with known column names
    - Grouping by raw string tuple key before datetime parsing
    - Optional coercion helpers (_opt_float, _opt_int) returning None for empty cells
    - D-07 structural cardio detection (no weight AND no reps)
key_files:
  created:
    - hevy_parser.py
  modified: []
decisions:
  - "Grouping key uses raw strings (row title/start/end) not parsed datetimes — avoids parsing before dedup"
  - "superset_id uses 'row.get(superset_id) or None' — empty string from CSV becomes None"
  - "_opt_float and _opt_int call .strip() before testing truthiness — handles whitespace-only cells"
  - "Cardio detection checks BOTH weight_kg AND reps absent (D-07) — catches all 5 cardio exercise types structurally"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-21"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 02 Plan 03: Hevy CSV Parser Summary

parse_hevy_csv() implemented using stdlib csv.DictReader with D-07 structural cardio detection; groups 1528 rows into 95 HevyWorkout objects with null coercion, 5 cardio exercise names collected in skipped_cardio.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Implement hevy_parser.py with parse_hevy_csv() | 3eb46b7 | hevy_parser.py |

## What Was Built

### hevy_parser.py — Hevy CSV Parser

**Module constant:**
- `HEVY_TS_FMT = "%b %d, %Y, %I:%M %p"` — verified against all 95 workouts, handles single-digit days ("Mar 9, 2026, 10:58 AM") and double-digit days ("Apr 17, 2026, 5:46 PM")

**Helper functions:**
- `_opt_float(val: str) -> float | None` — calls `.strip()` before testing truthiness; returns None for empty/whitespace CSV cells
- `_opt_int(val: str) -> int | None` — same pattern for integer fields (reps, set_index)
- `_is_cardio(row: dict) -> bool` — D-07: returns True only when BOTH `weight_kg` AND `reps` are empty/whitespace; catches Treadmill, Stair Machine, Stair Machine (Floors), Stair Machine (Steps), Walking without a hardcoded name list

**Core function — parse_hevy_csv():**
- Grouping key: `(row["title"], row["start_time"], row["end_time"])` — raw strings, not parsed datetimes, avoiding parse-before-dedup
- Groups 1528 CSV rows into 95 HevyWorkout objects in order of first appearance
- Cardio rows: exercise name appended to `skipped_cardio` (deduped); row skipped via `continue`
- Strength rows: grouped into HevyExercise per exercise title, HevySet appended with all optional fields null-coerced
- `superset_id=row.get("superset_id") or None` — empty string from CSV becomes None (absent in all 1528 sample rows)

### Verified Sample Data Results

| Metric | Value |
|--------|-------|
| Workouts parsed | 95 |
| Total CSV rows | 1528 |
| Cardio rows flagged | 15 |
| Unique cardio names | 5 (Treadmill, Stair Machine, Stair Machine (Floors), Stair Machine (Steps), Walking) |
| Bodyweight rows (no weight, has reps) | 13 — correctly NOT flagged as cardio |

## Tests

### All 5 Hevy Parser Tests GREEN

| Test | Status | What it verifies |
|------|--------|-----------------|
| test_parse_hevy_workout_count | PASSED | 95 HevyWorkout objects returned |
| test_parse_hevy_timestamps | PASSED | start_time/end_time are naive datetime (tzinfo=None) per D-05 |
| test_parse_hevy_null_coercion | PASSED | Empty cells are None (not 0 or ""); bodyweight reps present |
| test_parse_hevy_cardio_detection | PASSED | "Treadmill" in skipped_cardio, not in exercises |
| test_parse_hevy_bodyweight_not_cardio | PASSED | "Decline Crunch" in exercises, not skipped_cardio |

### Phase 1 Regression GREEN

`pytest tests/test_fit_roundtrip.py -x` — 2 passed (hevy_parser.py did not touch fit_parser.py).

## Forbidden Imports Check

`grep -E "(import pandas|import pytz|import zoneinfo|import fitparse)" hevy_parser.py` — no output (clean).

## Deviations from Plan

None — plan executed exactly as written. Implementation matched the exact code patterns specified in the plan action block.

## Known Stubs

None. parse_hevy_csv() is fully implemented with all 5 tests GREEN.

## Threat Flags

No new trust boundaries introduced beyond those in the plan's threat model. hevy_parser.py performs local file I/O only against trusted fixtures; no network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- hevy_parser.py: FOUND at /workspace/GarminHevyMerge/hevy_parser.py
- `def parse_hevy_csv`: FOUND
- `def _is_cardio`: FOUND
- `def _opt_float`: FOUND
- `def _opt_int`: FOUND
- `HEVY_TS_FMT`: FOUND
- `from models import HevyWorkout`: FOUND
- Commit 3eb46b7: FOUND
- 5 Hevy tests: PASSED
- Phase 1 regression: PASSED
