# Phase 2: Core Parsers - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build `FitParser` and `HevyParser` that correctly extract typed workout data from the sample files (`original_garmin.fit` and `original_hevy.csv`), with all known edge cases handled. No matching, no mapping, no UI — parsers only.

</domain>

<decisions>
## Implementation Decisions

### FIT Read Library
- **D-01:** Switch `fit_parser.py` from fit-tool to **fitparse** for all field-level extraction. fitparse reads every message type including Garmin-proprietary messages (140, 288, 326, 327) that fit-tool silently drops. fit-tool remains the write library only — never used for reading in Phase 2+.
- **D-02:** Add a new `parse_fit_file(path) -> FitWorkout` function alongside the existing `read_fit_file()` stub. Do NOT replace `read_fit_file()` — poc_roundtrip.py still calls it. The planner may deprecate the stub in a future phase.

### FitWorkout Dataclass Schema
- **D-03:** `FitWorkout` uses **typed lists per biometric type**: `heart_rate_samples: list[HRSample]`, `gps_track: list[GPSPoint]`, `cadence_samples: list[CadenceSample]`, etc. Each biometric type gets its own typed dataclass. Clear, strongly typed, easy to unit test.
- **D-04:** Absent sensors are represented as **empty lists** (not None). `gps_track: list[GPSPoint] = field(default_factory=list)` — empty means sensor absent. No None checks needed downstream.

### HevyParser and HevyWorkout Schema
- **D-05:** `HevyParser` parses timestamps (`"Apr 17, 2026, 5:46 PM"`) to **naive `datetime` objects** via `strptime`. No timezone parameter in Phase 2. Phase 3 applies the user's IANA timezone for UTC conversion — that concern stays out of Phase 2.
- **D-06:** `HevyWorkout` has two lists: `exercises: list[HevyExercise]` (strength rows only) and `skipped_cardio: list[str]` (exercise names of rows detected as cardio). The caller sees exactly what was dropped. UI can surface these in Phase 5.
- **D-07:** Cardio detection rule: **no weight AND no reps** = cardio row. If `weight_kg` is empty/None AND `reps` is empty/None, the row is treated as cardio. This catches all current sample cases (Treadmill, Stair Machine) without a brittle hardcoded name list.

### Claude's Discretion
- Exact field names within `HRSample`, `GPSPoint`, etc. — follow fitparse field naming conventions
- Handling of empty/`None` cells in Hevy CSV (e.g. `rpe`, `distance_km`, `superset_id`) — store as `None`, not 0
- `HevySet` schema fields and whether to include `set_type` and `rpe` — include all non-empty Hevy columns
- Whether to split `HevyParser` into a class or keep as module-level functions — planner decides

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Constraints
- `CLAUDE.md` — Critical technical facts: FIT epoch, weight field encoding, fitparse is read-only (never write), fit-tool is write library, Hevy timestamp format, cardio row handling, FIT merge strategy
- `.planning/REQUIREMENTS.md` — FIT-02, HEVY-01, HEVY-02 are the requirements for this phase
- `.planning/ROADMAP.md` §Phase 2 — Four success criteria define exactly what must be true for Phase 2 to pass
- `.planning/phases/01-fit-round-trip-proof-of-concept/01-CONTEXT.md` — D-03 and D-04: fit-tool write library decisions; D-05: module structure (`fit_parser.py`, `fit_generator.py`)

### No external specs
No external ADRs or third-party spec documents beyond the above project files.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fit_parser.py` — has `read_fit_file(path) -> FitFile` stub (fit-tool). Phase 2 adds `parse_fit_file()` alongside it; stub stays unchanged.
- `fit_generator.py` — write module, not touched in Phase 2.
- `poc_roundtrip.py` — calls `read_fit_file()`; must not break.
- `tests/` — existing test scaffold; Phase 2 adds parser unit tests here.

### Established Patterns
- Python dataclasses preferred (established in Phase 1 plan via `FitWorkout`/`HevyWorkout` naming in ROADMAP success criteria)
- Project venv at `.venv/`; fitparse already installed (`fitparse==1.2.0`)
- Test files go under `tests/`; pytest is the test runner

### Integration Points
- `original_garmin.fit` — fixture for FitParser unit tests
- `original_hevy.csv` — fixture for HevyParser unit tests; confirmed cardio rows (Treadmill, Stair Machine) present
- Phase 3 will import `HevyWorkout.start_time` / `HevyWorkout.end_time` (naive datetimes) and apply timezone conversion before matching

</code_context>

<specifics>
## Specific Ideas

- The cardio detection rule (no weight AND no reps) was chosen over a hardcoded name list specifically because new cardio exercise names should not require code changes.
- `skipped_cardio` stores exercise **names** (strings), not full row objects — enough for a UI warning like "3 cardio exercises were skipped: Treadmill, Stair Machine (Floors)".
- `read_fit_file()` remains a fit-tool wrapper — its only caller is `poc_roundtrip.py` which uses it for validation, not field extraction. Don't touch it.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-core-parsers*
*Context gathered: 2026-04-20*
