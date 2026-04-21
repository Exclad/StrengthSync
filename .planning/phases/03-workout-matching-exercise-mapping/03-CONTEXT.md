# Phase 3: Workout Matching + Exercise Mapping - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the timezone-aware workout matcher (`matcher.py`) and SQLite-backed exercise mapper (`mapper.py` + `database.py`) as pure Python modules with no UI. Phase 3 delivers the logic layer only — no Flask routes, no HTML. Phase 5 drives the user-facing flows (mapping review screen, manual match override UI, muscle-group picker).

</domain>

<decisions>
## Implementation Decisions

### Matching Tolerance
- **D-01:** Tolerance window is **30 minutes** (ROADMAP value wins over REQUIREMENTS.md's "1-hour window"). REQUIREMENTS.md is out of date — update it during planning.
- **D-02:** When multiple Hevy workouts fall within tolerance of the same Garmin workout, **closest match wins** (smallest UTC time delta). Simple, deterministic, no ambiguity prompting in Phase 3.

### Garmin Exercise Enum Source
- **D-03:** Exercise name → FIT enum mapping is loaded from a **bundled CSV** committed to the repo at `data/garmin_exercises.csv`. Columns: `exercise_name`, `exercise_enum_int`, `exercise_category` (muscle group). Extracted from FIT SDK Profile once; no runtime SDK dependency.
- **D-04:** `mapper.py` exposes a `get_exercises_by_category(category: str) -> list[GarminExercise]` function. Phase 5 calls this to power the muscle-group → exercise picker UI.
- **D-05:** Fuzzy matching (rapidfuzz) returns **ranked candidates** (list of `(GarminExercise, score)` tuples), not just top-1. Score threshold for auto-accept: **≥ 70**. Below 70 = unresolved — Phase 5 prompts the user to pick via the category → exercise flow.
- **D-06:** "Unresolved" exercises are returned with status `UNRESOLVED` from `suggest_mapping()`. Phase 5 handles the UI flow to resolve them. Phase 3 does not apply a silent fallback enum — no data should be silently misrepresented.

### SQLite Schema & Lifecycle
- **D-07:** Database file lives at `data/exercise_mappings.db` (same folder as the bundled exercise CSV). `database.py` handles schema init and queries.
- **D-08:** Only **user-confirmed mappings** are written to the DB. Fuzzy suggestions are ephemeral (in-memory only) until the user confirms. Prevents polluting the DB with wrong auto-maps across sessions. Schema: `confirmed_mappings(hevy_exercise_name TEXT PRIMARY KEY, garmin_exercise_enum_int INTEGER, garmin_exercise_name TEXT, confirmed_at TIMESTAMP)`.

### Module Interface
- **D-09:** Both modules expose **plain module-level functions** — no classes. Phase 4 imports them directly; pytest calls them with fixture data.
  - `match_workouts(fit: FitWorkout, hevy_list: list[HevyWorkout], timezone_str: str) -> MatchResult`
  - `suggest_mapping(hevy_name: str) -> list[tuple[GarminExercise, float]]`
  - `confirm_mapping(hevy_name: str, garmin_exercise: GarminExercise) -> None`
  - `get_confirmed_mapping(hevy_name: str) -> GarminExercise | None`
  - `get_exercises_by_category(category: str) -> list[GarminExercise]`
- **D-10:** Manual workout pairing (MATCH-03) uses `force_match(fit: FitWorkout, hevy: HevyWorkout) -> MatchResult` — bypasses tolerance check entirely. Phase 5 calls this when the user selects a manual pair.

### Claude's Discretion
- `MatchResult` dataclass fields — include at minimum: `fit_workout`, `hevy_workout`, `delta_minutes: float`, `is_forced: bool`
- Whether `matcher.py` converts Hevy naive datetimes to UTC inline or expects pre-converted inputs — whichever is cleaner
- How `database.py` is initialized (auto-create on first import vs explicit `init_db()` call) — explicit `init_db()` is preferred for testability
- How many fuzzy candidates `suggest_mapping()` returns by default — top 5 is reasonable

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Constraints
- `CLAUDE.md` — FIT epoch, weight encoding, fitparse read-only, Hevy timestamp format (`"Apr 17, 2026, 5:46 PM"` = local time), cardio row handling, FIT merge strategy
- `.planning/REQUIREMENTS.md` — MATCH-01, MATCH-02, MATCH-03, MAP-01, MAP-02, MAP-03, MAP-04 are the requirements for this phase. Note: MATCH-02's "1-hour window" is superseded by D-01 (30 minutes).
- `.planning/ROADMAP.md` §Phase 3 — Six success criteria define exactly what must be true for Phase 3 to pass
- `.planning/phases/02-core-parsers/02-CONTEXT.md` — D-05: `HevyWorkout.start_time`/`end_time` are naive local datetimes; Phase 3 applies timezone. D-06: `skipped_cardio` already in dataclass; Phase 5 surfaces it.

### No external specs
No external ADRs beyond the above project files. FIT SDK exercise data will be extracted into `data/garmin_exercises.csv` during Phase 3 planning/execution.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `models.py` — `FitWorkout`, `HevyWorkout`, `HevyExercise`, `HevySet` dataclasses. `HevyWorkout.start_time` and `.end_time` are naive local datetimes ready for timezone conversion.
- `fit_parser.py` — `parse_fit_file(path) -> FitWorkout` with UTC-equivalent timestamps from fitparse.
- `hevy_parser.py` — `parse_hevy_csv(path) -> list[HevyWorkout]` with naive local datetimes.
- `tests/conftest.py` — existing pytest fixtures with sample file paths; Phase 3 adds matcher/mapper fixtures here.

### Established Patterns
- Python dataclasses for typed models (established in Phase 2)
- Module-level functions, not classes (Phase 2 pattern)
- pytest with sample files as fixtures (`original_garmin.fit`, `original_hevy.csv`)
- `data/` directory will be created in Phase 3 for CSV and DB

### Integration Points
- Phase 4 (`fit_generator.py`) imports `MatchResult` from `matcher.py` and confirmed mappings from `mapper.py` to drive FIT assembly
- Phase 5 (`app.py`) calls `get_exercises_by_category()` and `force_match()` for UI flows
- `database.py` is a dependency of `mapper.py` only — `matcher.py` has no DB dependency

</code_context>

<specifics>
## Specific Ideas

- The muscle-group → exercise picker flow is a Phase 5 UI concern. Phase 3 only needs to provide the `get_exercises_by_category()` data layer function and return `UNRESOLVED` status so Phase 5 knows which exercises need user input.
- `data/garmin_exercises.csv` must include the `exercise_category` column (e.g. "LEGS", "CHEST", "BACK") — this column is the grouping key for the Phase 5 picker.
- The 30-minute tolerance is a constant — define it as `MATCH_TOLERANCE_MINUTES = 30` in `matcher.py` so it's easy to find and adjust.

</specifics>

<deferred>
## Deferred Ideas

- Muscle-group → exercise picker UI — Phase 5
- Surfacing `skipped_cardio` warnings to the user — Phase 5
- Configurable tolerance window exposed in UI — Phase 5 or later

</deferred>

---

*Phase: 03-workout-matching-exercise-mapping*
*Context gathered: 2026-04-21*
