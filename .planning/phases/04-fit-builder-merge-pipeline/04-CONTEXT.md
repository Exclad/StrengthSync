# Phase 4: FIT Builder + Merge Pipeline - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Assemble the full merge pipeline: take a `MatchResult` (paired Garmin + Hevy workout) and produce a valid FIT binary that Garmin Connect accepts. All Garmin biometric messages pass through verbatim (including proprietary message types). Hevy exercise data is injected with correct field scaling. CRC validation gates the output before it is offered for download. A preview data structure is produced before file generation so Phase 5 can show a before/after comparison to the user.

No Flask routes, no HTML — pure Python modules. Phase 5 calls these functions.

</domain>

<decisions>
## Implementation Decisions

### Biometric Pass-Through
- **D-01:** Use a **byte-level splice** approach to preserve 100% of Garmin FIT data:
  1. Parse the Garmin FIT binary directly to identify record boundaries and message types
  2. Extract timestamps from existing mesg 225 (set) records *before* removing them
  3. Copy all non-set/non-exercise_title message bytes verbatim into the output stream
  4. Append garmin-fit-sdk-encoded Hevy set messages at the end
  5. Recompute the FIT file CRC over the full output
- **D-02:** fitparse reconstruction is **not used** for the pass-through path — fitparse cannot faithfully round-trip Garmin-proprietary message types (140, 288, 326, 327), which fit-tool also drops. Byte-level copy is the only approach that guarantees 100% survival of proprietary messages.

### Set Timestamps
- **D-03:** Per-set timestamps come from the **original Garmin mesg 225 records**. The user presses the Garmin lap button to mark set/rest boundaries, so the FIT file already has accurate per-set start times. Extract these timestamps before splicing out the original set messages, then assign them to Hevy sets by position (1st Garmin set → 1st Hevy set, etc.).
- **D-04:** **Mismatch fallback:** If Hevy has more sets than Garmin recorded (e.g., user forgot to press lap once), distribute the extra Hevy sets linearly across the remaining workout time. Garmin real timestamps take priority; linear distribution is the fallback only.
- **D-05:** If Garmin has more set timestamps than Hevy has sets, the extra Garmin timestamps are unused (no padding with empty sets).

### Preview Data Contract
- **D-06:** `build_preview()` returns a `MergePreview` dataclass containing a **full before/after comparison**:
  - `biometric_summary`: total_elapsed_time, total_calories, avg_heart_rate, max_heart_rate (from Garmin FIT session message)
  - `before_sets`: list of `GarminSetRecord` — the original Garmin set data: timestamp, exercise_enum_int, exercise_name, reps, weight_kg (decoded from raw FIT set messages)
  - `after_sets`: list of `HevySetRecord` — the Hevy replacements: timestamp (from D-03), garmin_exercise (GarminExercise), hevy_exercise_name, reps, weight_kg
- **D-07:** `MergePreview` and its nested dataclasses are defined in `models.py` alongside the other typed models.

### fit_generator.py Interface
- **D-08:** Two separate public functions:
  - `build_preview(match: MatchResult, timezone_str: str) -> MergePreview` — no file written; safe to call multiple times
  - `build_merged_fit(match: MatchResult, timezone_str: str, out_path: str) -> str` — writes FIT file to out_path, returns out_path
- **D-09:** Phase 5 flow: call `build_preview()` first → show to user → on confirm, call `build_merged_fit()`. Both functions share the same internal merge logic (extract, splice, encode); the split is at the file-write boundary only.

### garmin-fit-sdk Weight Encoding
- **D-10:** Pass weight as **kg (float)** to garmin-fit-sdk — the SDK applies ×16 scale internally. Do NOT multiply by 1000. CLAUDE.md's "grams × 1000" describes the raw FIT binary spec, not the garmin-fit-sdk Python API (confirmed in Phase 1).

### CRC Validation
- **D-11:** After writing the merged FIT file, validate it via two layers:
  1. FIT CRC: recomputed over the full output bytes during the byte-level splice (not a post-hoc check — the splice builds a CRC-valid file)
  2. Parse gate: pass the output file through `FitFile.from_file()` (fit-tool) to confirm it can be opened without error
- **D-12:** If either validation fails, raise a descriptive exception (not a bare RuntimeError) with enough detail for Phase 5 to show the user a clear error message.

### Claude's Discretion
- Exact structure of the minimal FIT binary parser (just enough to identify record boundaries and local→global message number mappings; does not need to decode field values for pass-through records)
- Whether definition messages for mesg 225/227 are also removed from the Garmin pass-through stream, or left in (leaving orphaned definition messages is harmless per FIT spec)
- Internal helper function decomposition within fit_generator.py
- How `MergePreview.biometric_summary` handles None fields (e.g., no HR sensor data)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Constraints
- `CLAUDE.md` — FIT epoch, weight encoding (raw FIT spec vs. garmin-fit-sdk API), fitparse is read-only, FIT merge strategy (pass record/session/lap/event/device_info verbatim; replace mesg 225/227)
- `.planning/REQUIREMENTS.md` — FIT-03, FIT-04, MERGE-01, MERGE-02, MERGE-03, MERGE-04 are the requirements for this phase
- `.planning/ROADMAP.md` §Phase 4 — Five success criteria define exactly what must be true for Phase 4 to pass
- `.planning/STATE.md` — D-02 deviation note: fit-tool drops proprietary message types 140/288/326/327; byte-level splice is required. Also: fit-tool venv patch (field.py UnicodeDecodeError) not persisted — may need re-applying if venv is rebuilt.

### Prior Phase Context
- `.planning/phases/01-fit-round-trip-proof-of-concept/01-CONTEXT.md` — D-03: garmin-fit-sdk is the validated writer (fit-tool rejected by Garmin Connect). D-02: functional equivalence is the bar, not byte-identical reconstruction.
- `.planning/phases/03-workout-matching-exercise-mapping/03-CONTEXT.md` — D-09: `MatchResult` interface (fit_workout, hevy_workout, delta_minutes, is_forced). D-05: confirmed mappings retrieved via `get_confirmed_mapping(hevy_name)`. D-06: UNRESOLVED exercises → Phase 5 resolves them; Phase 4 should handle or surface gracefully.

### Library API Contracts
- `fit_generator.py` (existing) — `build_minimal_strength_fit()` shows garmin-fit-sdk Encoder usage: semantic values (kg, seconds), FIT epoch offset, mesg_num lookup via `FitProfile['mesg_num']`. Phase 4 extends this file.
- `models.py` (existing) — `FitWorkout`, `HevyWorkout`, `HevyExercise`, `HevySet`, `GarminExercise` dataclasses. `MergePreview` and nested record types to be added here.

### No external specs
No external ADRs beyond the above project files.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fit_generator.py` — `build_minimal_strength_fit()` is the reference implementation for garmin-fit-sdk Encoder usage; Phase 4's `build_merged_fit()` follows the same encoder pattern for the set messages
- `fit_parser.py` — `parse_fit_file(path) -> FitWorkout` for reading Garmin FIT; Phase 4 also needs a lower-level binary read of the same file (fitparse for high-level data + raw bytes for the splice)
- `matcher.py` — `match_workouts()` returns `MatchResult`; `force_match()` for manual pairs. Phase 4 consumes these outputs.
- `mapper.py` — `get_confirmed_mapping(hevy_name) -> GarminExercise | None`; `suggest_mapping()` for unresolved exercises
- `models.py` — All existing dataclasses; `MergePreview`, `GarminSetRecord`, `HevySetRecord` to be added
- `data/garmin_exercises.csv` — Exercise enum lookup table; already used by mapper.py
- `data/exercise_mappings.db` — Confirmed mappings SQLite DB; read via `get_confirmed_mapping()`

### Established Patterns
- Module-level functions, not classes (Phase 2/3 pattern) — `build_preview()` and `build_merged_fit()` follow this
- Typed dataclasses for all data models (Python 3.9+ syntax)
- pytest with `original_garmin.fit` + `original_hevy.csv` as fixtures
- Explicit `init_db()` call rather than auto-create on import (Phase 3 pattern)

### Integration Points
- Phase 5 (`app.py`) calls `build_preview()` then `build_merged_fit()` after user confirms
- Phase 5 passes the `MatchResult` from `matcher.py` (already in Phase 3) directly to Phase 4 functions
- Output FIT file path is determined by Phase 5 (e.g., a temp file or `output/merged.fit`)

</code_context>

<specifics>
## Specific Ideas

- The user manually presses the Garmin lap button to mark each set boundary — so the Garmin FIT already has accurate per-set timestamps in its existing mesg 225 records. This is the preferred timestamp source; linear fallback only for overflow.
- garmin-fit-sdk weight field: pass kg, SDK applies ×16. CLAUDE.md's "grams × 1000" is the raw FIT wire format, not the Python SDK API — do not apply manual scaling.

</specifics>

<deferred>
## Deferred Ideas

- Handling UNRESOLVED exercise mappings at the Phase 4 level — Phase 5 resolves unmapped exercises via the review UI before calling build_preview(). Phase 4 can assume all exercises passed to it have confirmed mappings (or raise if not).
- Batch processing (multiple workout pairs) — v2 deferred per roadmap.

</deferred>

---

*Phase: 04-fit-builder-merge-pipeline*
*Context gathered: 2026-04-22*
