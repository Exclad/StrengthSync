---
phase: 03-workout-matching-exercise-mapping
plan: "02"
subsystem: matcher
tags: [matcher, timezone, dateutil, workout-matching, tdd]
dependency_graph:
  requires:
    - models.FitWorkout
    - models.HevyWorkout
    - models.MatchResult
  provides:
    - matcher.match_workouts
    - matcher.force_match
    - matcher.MATCH_TOLERANCE_MINUTES
    - tests/test_matcher.py
  affects:
    - fit_generator.py (Phase 4 — imports match_workouts, MatchResult)
    - app.py (Phase 5 — calls force_match for manual pairing UI)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN (test commit before implementation commit)
    - Inline timezone conversion via dateutil.tz.gettz() + replace(tzinfo=) + astimezone(UTC)
    - Module-level functions, no classes (D-09)
    - ValueError raised immediately when tz.gettz() returns None (T-03-04 mitigation)
key_files:
  created:
    - matcher.py
    - tests/test_matcher.py
  modified: []
decisions:
  - "Inline timezone conversion in match_workouts() — caller passes timezone_str; no pre-conversion required from caller (D-09)"
  - "MATCH_TOLERANCE_MINUTES=30 as typed int constant at module level — easy to discover and adjust (D-01)"
  - "No try/except blocks — exceptions propagate naturally per codebase pattern"
  - "from __future__ import annotations used for MatchResult | None return type on Python 3.9+ compatibility"
metrics:
  duration_minutes: 1
  completed_date: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
  tests_added: 6
  tests_passing: 31
---

# Phase 03 Plan 02: matcher.py — Timezone-Aware Workout Matching

**One-liner:** match_workouts() converts Hevy naive local datetimes to UTC via IANA timezone, finds closest Hevy workout within 30-minute tolerance; force_match() bypasses tolerance for manual pairing.

## What Was Built

### Task 1: tests/test_matcher.py (TDD RED)

Created 6 failing tests covering all three MATCH requirements:

- `test_match_singapore_timezone` (MATCH-01): Verifies Hevy naive local 17:46 Singapore time converts to UTC 09:46, matches Garmin 09:45:49 with delta 0.183 minutes
- `test_invalid_timezone` (MATCH-01): Verifies ValueError raised with message "Unknown IANA timezone" for invalid IANA string "Not/AZone"
- `test_auto_match_within_tolerance` (MATCH-02): 15-minute UTC gap → matched, delta_minutes == 15.0
- `test_no_match_returns_none` (MATCH-02): 31-minute UTC gap → None (outside 30-min window)
- `test_closest_candidate_wins` (MATCH-02): Two candidates at 5 min and 20 min → 5-minute candidate wins (D-02)
- `test_force_match` (MATCH-03): 8-hour gap bypassed; MatchResult(is_forced=True, delta_minutes=0.0)

RED state confirmed: `ModuleNotFoundError: No module named 'matcher'` before implementation.

### Task 2: matcher.py (TDD GREEN)

Implemented the timezone-aware workout matcher:

- `MATCH_TOLERANCE_MINUTES: int = 30` — module-level constant (D-01)
- `match_workouts(fit, hevy_list, timezone_str) -> MatchResult | None`: validates timezone with `tz.gettz()` (None → ValueError), iterates hevy_list, converts each naive local datetime to naive UTC via `replace(tzinfo=user_tz).astimezone(tz.UTC).replace(tzinfo=None)`, computes abs delta in minutes, tracks best candidate with delta ≤ 30 (D-02 closest wins)
- `force_match(fit, hevy) -> MatchResult`: returns `MatchResult(fit_workout=fit, hevy_workout=hevy, delta_minutes=0.0, is_forced=True)`

No try/except blocks — exceptions propagate naturally per codebase pattern.

## Test Results

```
6 passed in 0.39s (matcher tests)
31 passed in 4.44s (full suite excluding test_mapper.py — mapper.py is Plan 03 scope)
```

Singapore timezone end-to-end verification:
```
Singapore match OK: delta=0.183 min
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — matcher.py is fully functional. MATCH_TOLERANCE_MINUTES is a real constant (not placeholder). match_workouts() performs real UTC arithmetic.

## Threat Flags

No new threat surface beyond the plan's threat model.

- T-03-04 mitigated: `tz.gettz("Not/AZone")` returns None; ValueError raised before any datetime arithmetic. Verified by test_invalid_timezone.

## Self-Check: PASSED

- matcher.py exists at /workspace/GarminHevyMerge/matcher.py: FOUND
- tests/test_matcher.py exists with 6 test functions: FOUND
- MATCH_TOLERANCE_MINUTES == 30: VERIFIED
- Singapore delta 0.183 min: VERIFIED
- Commit ddb774d (RED tests): FOUND
- Commit c86c4dd (GREEN matcher.py): FOUND
- All 6 matcher tests GREEN: VERIFIED
