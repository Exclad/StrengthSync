# Phase 2: Core Parsers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 02-core-parsers
**Areas discussed:** FIT read library, Dataclass schema, Hevy timestamp handling, Cardio row handling

---

## FIT Read Library

| Option | Description | Selected |
|--------|-------------|----------|
| fitparse for extraction | Switch fit_parser.py to fitparse; reads all message types including proprietary 140/288/326/327 | ✓ |
| fit-tool only, accept gaps | Keep fit-tool as reader; proprietary messages not parsed; Phase 4 handles separately | |
| Both fitparse + fit-tool | Use both libraries for different concerns (header vs fields) | |

**User's choice:** fitparse for extraction

---

| Option | Description | Selected |
|--------|-------------|----------|
| New parse_fit_file() alongside | Add new function returning FitWorkout; keep existing read_fit_file() stub intact | ✓ |
| Replace read_fit_file() entirely | read_fit_file() returns FitWorkout; breaks poc_roundtrip.py caller | |

**User's choice:** New parse_fit_file() alongside existing stub

---

## Dataclass Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Typed lists per biometric | heart_rate_samples: list[HRSample], gps_track: list[GPSPoint], etc. — strongly typed | ✓ |
| Mixed record list by message type | records: list[FitRecord] with mesg_type enum — flexible but loose typing | |
| Two-bucket split | biometric_records: list[dict] (raw) + typed exercise_sessions | |

**User's choice:** Typed lists per biometric

---

| Option | Description | Selected |
|--------|-------------|----------|
| Empty list = absent (Recommended) | gps_track: list[GPSPoint] = field(default_factory=list) — empty means sensor absent | ✓ |
| Optional[list] = None for absent | None = sensor absent; empty list = sensor present but no data | |

**User's choice:** Optional fields, empty list = absent

---

## Hevy Timestamp Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Naive datetime, no timezone | Parse with strptime to naive datetime; Phase 3 applies IANA timezone | ✓ |
| Require timezone at parse time | HevyParser takes tz param, returns UTC-aware datetimes now | |

**User's choice:** Naive datetime, no timezone in Phase 2

---

## Cardio Row Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Separate skipped_cardio list on HevyWorkout | exercises (strength only) + skipped_cardio: list[str] of exercise names | ✓ |
| Flag on HevyExercise (is_cardio: bool) | Included in exercises list but flagged; caller must filter | |
| Log and silently drop | Warning logged, nothing returned; no machine-readable signal | |

**User's choice:** Separate skipped_cardio list on HevyWorkout

---

| Option | Description | Selected |
|--------|-------------|----------|
| No weight AND no reps = cardio | Field-based rule; catches all current cases without hardcoded names | ✓ |
| Hardcoded exercise name list | CARDIO_EXERCISES set; brittle to new exercise names | |
| Has distance/duration but no reps | More field-specific detection | |

**User's choice:** No weight AND no reps = cardio

---

## Claude's Discretion

- Exact field names within typed biometric dataclasses (follow fitparse conventions)
- Empty cell handling for optional Hevy columns (rpe, distance_km, superset_id) — store as None
- HevySet schema fields — include all non-empty Hevy CSV columns
- Whether HevyParser is a class or module-level functions

## Deferred Ideas

None — discussion stayed within phase scope.
