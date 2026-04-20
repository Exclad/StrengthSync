# Project Research Summary

**Project:** Garmin-Hevy Workout Sync
**Domain:** FIT file manipulation / local fitness data merger tool
**Researched:** 2026-04-20
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a local Python web app with a single, binary success criterion: produce a FIT file that Garmin Connect accepts without rejection. The merge concept is straightforward — treat the Garmin FIT file as the biometric source of truth, strip its exercise messages, inject Hevy's accurate strength data in their place, and write a valid FIT binary. The technical complexity is concentrated entirely in the FIT write path. Reading FIT is a solved problem (fitparse is mature and reliable). Writing valid FIT is significantly harder: field types have hidden scaling (weight is stored as kg × 1000), message ordering is strict, CRC must be recomputed over the entire file, and definition records must precede data records. The recommended approach uses `fit-tool` as the primary read/write library because it is the only Python library with clearly documented write support. This must be validated against a real Garmin Connect upload before any other code is written.

The secondary complexity is data alignment. Hevy timestamps are local time with no timezone annotation; Garmin FIT timestamps are UTC using a non-Unix epoch (1989-12-31, not 1970-01-01). These two facts together mean workout matching will silently fail for every user not in UTC unless the app applies explicit timezone conversion. A user in Singapore (UTC+8) will see an 8-hour gap between sources without this correction — 100% match failure rate. This is not a niche edge case; it is the default experience for any user outside UTC. The app must surface timezone selection prominently at the top of the workflow.

The third area of complexity is the exercise mapping crosswalk. Hevy stores free-text exercise names; Garmin FIT stores integer enum values from a fixed exercise profile. There is no standard mapping between them. The app must build and persist this mapping with explicit user confirmation. Machine-specific exercises ("Leg Press Horizontal (Machine)", "Iso-Lateral Row (Machine)") have no Garmin enum equivalents and must fall back to custom exercise entries. Cardio rows (Treadmill, Stair Machine) appear inline in Hevy strength exports and must be detected and skipped explicitly rather than crashing FIT message construction.

## Key Findings

### Recommended Stack

The FIT write library decision is the make-or-break call for the entire project. `fitparse` — the most widely known Python FIT library — is read-only and cannot produce output files. This eliminates it as the sole library on the critical path. The recommended choice is `fit-tool`, a third-party Python library with documented read and write support. If `fit-tool` write produces files Garmin Connect rejects, the fallback is the official `garmin-fit-sdk` Python package, but its encoder support in the Python bindings is unconfirmed and must be verified before treating it as a fallback. Both must be treated as unconfirmed until a round-trip test passes against real Garmin Connect. The web layer is Flask (not FastAPI) — this is a single-user local tool with 3 synchronous endpoints; FastAPI's async and Pydantic overhead provide no benefit here. SQLite via stdlib `sqlite3` handles exercise mapping persistence; no ORM is warranted for a single-table schema.

**Core technologies:**
- `fit-tool`: FIT read + write — only Python library with documented write support; single dependency on critical path
- Flask 3.x: web server — minimal boilerplate for file upload/download; single-user local tool does not need async
- pandas 2.x: Hevy CSV parsing — Hevy's datetime format ("Apr 17, 2026, 5:46 PM") is non-ISO and requires non-trivial parsing
- `python-dateutil`: Hevy timestamp parsing — handles the non-ISO 12-hour locale format
- `zoneinfo` (stdlib, Python 3.9+): timezone conversion — IANA timezone database built-in; no install required
- SQLite via `sqlite3` (stdlib): exercise mapping persistence — one-table schema, no ORM needed
- pytest: merge logic unit tests — timestamp matching, weight scaling, and exercise mapping logic must be tested independently of the web layer

### Expected Features

**Must have (table stakes) — Phase 1:**
- File upload: Garmin .fit + Hevy .csv — the entire input surface
- Timezone selection (IANA named timezones, not raw UTC offset) — matching fails completely without this for non-UTC users
- Auto-matched workout pairing with confidence indicator — auto-match within 30 min window
- Exercise name mapping review screen — highest-friction UX step; no silent drops allowed
- Persistent exercise mapping storage (SQLite) — users must not re-map exercises every session
- Unmapped exercise warning before export — explicit user confirmation required to skip unmapped exercises
- FIT file generation preserving all Garmin biometrics — this is the product's core value proposition
- Output FIT CRC validation + required message type check — trust collapses after the first silent corruption
- Download merged .fit file — the entire output promise
- Actionable error messages for all failure modes

**Should have (differentiators) — Phase 2:**
- Pre-export side-by-side preview (Garmin biometrics vs Hevy exercises before download)
- Manual workout match override (for edge cases where auto-match fails)
- Fuzzy exercise name matching with confidence scoring (edit-distance / rapidfuzz)
- Extended output FIT validation (record count comparison, deep re-parse)

**Defer (v2+):**
- Direct Garmin Connect API upload (OAuth2 approval; fragile; terms-of-service risk)
- Hevy API / OAuth2 integration (Phase 3 — CSV upload sufficient for MVP)
- Batch processing multiple workouts (Phase 4 — adds matching-ambiguity edge cases)
- Workout analytics or charts (out of scope; Garmin Connect already provides this)
- Mobile app or cloud hosting (explicitly out of scope)

### Architecture Approach

The pipeline has six sequential stages with clean component boundaries. FitParser and HevyParser are pure parsing components that produce typed dataclasses — they own no business logic. WorkoutMatcher operates on UTC datetimes only; the timezone offset is passed explicitly as a parameter and is never baked into data models. ExerciseMapper owns the SQLite lookup, fuzzy fallback, and UNMAPPED sentinel return — it must complete before FitBuilder is invoked. FitBuilder is the most critical component: it must write all biometric messages verbatim in the correct order, reconstruct set messages from Hevy data with correct field scaling, and delegate CRC calculation entirely to the library. The Flask app orchestrates all components and owns session state and temp file management. No component except Flask and MappingStore touches the filesystem.

**Major components:**
1. `FitParser` — reads FIT binary, separates biometric messages (preserve verbatim) from exercise messages (discard and replace), extracts UTC session times using the Garmin epoch offset
2. `HevyParser` — reads Hevy CSV, groups rows by workout+start_time, parses non-ISO timestamps with explicit strptime, handles empty cells as None (not zero), classifies cardio rows for skip
3. `WorkoutMatcher` — converts Hevy local timestamps to UTC using user-supplied timezone, finds best Garmin match within 30 min window, returns delta and confidence level
4. `ExerciseMapper` + `MappingStore` — SQLite exact lookup then rapidfuzz fuzzy fallback then UNMAPPED sentinel; all DB writes owned here
5. `FitBuilder` — constructs merged FIT binary in correct message order, scales weights (kg * 1000), estimates per-set timestamps from workout time range, delegates CRC to library
6. Flask App — HTTP routing, file temp storage, session state, timezone persistence

### Critical Pitfalls

1. **fitparse cannot write FIT files** — it is read-only; using it as the sole library leaves the output pipeline unimplemented. Use `fit-tool` for write; validate with a real Garmin Connect upload on Day 1 before any other code.

2. **FIT epoch is 1989-12-31, not 1970-01-01** — off by 631,065,600 seconds; timestamps written with Unix epoch appear ~36 years in the future in Garmin Connect. Use `GARMIN_EPOCH = datetime(1989, 12, 31, tzinfo=timezone.utc)`; add a timestamp round-trip unit test immediately.

3. **FIT weight field is integer in kg * 1000** — passing a float (e.g., 60.0) stores 60 grams, destroying all weight data silently. Use `fit_weight = int(hevy_weight_kg * 1000)`. Verify in round-trip test.

4. **Hevy timestamps are local time, non-ISO format** — `"Apr 17, 2026, 5:46 PM"` is not UTC and not parseable by `fromisoformat()`. Use `datetime.strptime(s.strip('"'), "%b %d, %Y, %I:%M %p")` then apply `zoneinfo` for UTC conversion. A Singapore user sees an 8-hour mismatch without this; matching fails 100%.

5. **Mixed cardio rows in Hevy strength exports** — the sample file contains Treadmill and Stair Machine rows with empty weight_kg/reps. Attempting FIT set message construction on these rows crashes. Detect during parsing: if weight_kg and reps are both None, classify as cardio and skip with a logged warning.

6. **CRC must be recomputed after every write** — any byte-level modification without CRC recalculation causes immediate Garmin Connect rejection with a "corrupt file" error. Never manually splice bytes; always use the library's write() / to_bytes() method.

7. **FIT exercise_name is an integer enum, not a string** — writing Hevy's free-text names into exercise_name fields writes garbage. Each Hevy name must map to a Garmin numeric enum value; exercises with no equivalent must use exercise_name=0 (unspecified) plus an exercise_title message for the display string.

## Implications for Roadmap

Based on research, the single largest risk is FIT write validity. All other work is meaningless if the output file is rejected. The roadmap must front-load this risk above everything else.

### Phase 1: FIT Round-Trip Proof-of-Concept

**Rationale:** FIT write validity is the only project-killing risk. If the output file is rejected by Garmin Connect, the project has no value regardless of how polished the UI is. This must pass before a single line of application code is written. This is a hard gate for all subsequent phases.

**Delivers:** Confirmed library stack, validated Garmin Connect acceptance of Python-written FIT files, reusable round-trip test as a regression harness.

**Milestone sequence:**
1. Install fit-tool; confirm `from fit_tool.fit_file import FitFile` imports cleanly
2. Write `scripts/roundtrip_test.py`: read `original_garmin.fit` then write identical output then parse back then compare field values
3. Upload output to Garmin Connect manually — confirm acceptance
4. If rejected: debug message ordering, CRC, required fields. If still failing, verify garmin-fit-sdk Python encoder exists and pivot.
5. Write a second test: construct a minimal FIT file from scratch (file_id + session + one set) — upload and confirm

**Gate:** Do not proceed to Phase 2 until both round-trip and from-scratch minimal FIT files pass Garmin Connect upload.

**Pitfalls this avoids:** fitparse-is-read-only, FIT epoch vs Unix epoch, CRC recalculation, missing file_id, message definition ordering, weight scaling

**Research flag:** EMPIRICAL — this phase is an upload test, not a documentation exercise. The answer is only known after uploading to Garmin Connect.

### Phase 2: Core Parsers

**Rationale:** With the write path proven, build the two parsing components that feed all downstream work. Both data formats are fully characterized from sample file inspection — no unknowns remain.

**Delivers:** `FitParser` producing `FitWorkout` dataclasses, `HevyParser` producing `HevyWorkout[]` dataclasses, comprehensive unit tests using sample files.

**Key constraints:**
- Parse Hevy timestamps with explicit strptime format `"%b %d, %Y, %I:%M %p"` — do not use fromisoformat()
- Parse empty CSV cells as None, not 0 — distinguish bodyweight (weight=0.0) from non-applicable (weight=None)
- Classify cardio rows during parsing — return them flagged rather than crashing downstream
- Convert Garmin FIT timestamps using `GARMIN_EPOCH = datetime(1989, 12, 31, tzinfo=timezone.utc)`
- Separate biometric messages from exercise messages during FIT parsing

**Research flag:** NONE — both formats fully characterized from sample files.

### Phase 3: Workout Matching + Exercise Mapping

**Rationale:** These two components connect the parsed data. Matcher depends on parsers. Mapper depends on having a confirmed Garmin exercise enum list extracted from the FIT SDK profile.

**Delivers:** `WorkoutMatcher` with timezone-aware UTC comparison and 30 min tolerance window, `ExerciseMapper` with SQLite persistence and UNMAPPED sentinel, `MappingStore` CRUD, mapping table pre-seeded for exercises in sample file.

**Key constraints:**
- Collect timezone as IANA name (e.g., "Asia/Singapore"); convert using `zoneinfo.ZoneInfo`
- Match on time-range overlap, not just start-time proximity — tolerates clock drift and watch-start lag
- Build Garmin exercise enum table from FIT SDK profile before writing mapper — exercises with no enum use custom_exercise path
- set_index in Hevy is 0-based; FIT expects 1-based set_order — add 1 during mapping

**Research flag:** MEDIUM — Garmin exercise enum numeric values need extraction from actual FIT SDK profile.xlsx for exercises present in the sample file.

### Phase 4: FIT Builder + Full Merge Integration

**Rationale:** FitBuilder is the most complex component and depends on all previous phases being correct. It assembles biometric pass-through with Hevy exercise injection in the exact message order Garmin Connect expects.

**Delivers:** `FitBuilder.build()` producing valid merged FIT bytes, end-to-end integration test (parse both sample files then match then map then build then upload to Garmin Connect), output CRC validation function.

**Required message order in output FIT:**
1. file_id
2. device_info
3. user_profile
4. sport
5. workout (name from Hevy workout title)
6. workout_step * N (one per exercise, from Hevy)
7. event (timer_start)
8. record * T (full biometric time-series — verbatim from Garmin)
9. lap * N (preserve if present)
10. set * S (one per Hevy set; weight scaled kg * 1000; timestamps estimated)
11. exercise_title * E (one per unique exercise; mapped Garmin IDs)
12. event (timer_stop)
13. session (preserve all biometric fields)
14. activity

**Key constraints:**
- Weight: `fit_weight = int(hevy_weight_kg * 1000)`
- set_type mapping: "normal"/"drop_set"/"failure" maps to FIT `active`; "warmup" maps to FIT `active`
- RPE: drop gracefully — no FIT equivalent; note this in UI
- Add UI warning: "Delete the original Garmin Connect activity before uploading the merged file"
- Validate output CRC by re-parsing with fitparse

**Research flag:** LOW — FIT spec patterns are fully documented. Complexity is implementation, not unknowns.

### Phase 5: Flask Web UI

**Rationale:** Build the UI last, once the core pipeline is proven end-to-end. A working pipeline without a UI is more valuable than a polished UI over an unproven pipeline.

**Delivers:** File upload endpoints (FIT + CSV), timezone selection dropdown (IANA names), exercise mapping review screen with UNMAPPED exercise gating, merge trigger, file download, actionable error messages.

**Key constraints:**
- Timezone selector: dropdown of common IANA names; show current offset next to name
- Unmapped exercise screen: block export until user maps or explicitly confirms skip
- Upload validation: detect wrong file type immediately (GPX instead of FIT, non-Hevy CSV)
- Merged filename: `merged_<workout_date>.fit`
- Match confidence display: show delta in minutes and direction

**Research flag:** NONE — standard Flask patterns.

### Phase 6: Hardening + Docker

**Rationale:** After core flow is validated with real data, address error recovery, edge cases, and deployment packaging.

**Delivers:** Docker container, comprehensive error handling for all documented failure modes, SQLite preferences (last-used timezone, match window), setup documentation.

**Research flag:** NONE — standard patterns.

### Phase Ordering Rationale

- FIT round-trip proof is first because it is the only binary unknown. All other work is wasted if this fails.
- Parsers before matcher/mapper because parsers feed all downstream components.
- Matcher + mapper before builder because the builder requires confirmed mappings and matched workouts.
- Builder before Flask UI because a working pipeline without a UI is more valuable than a UI wrapping a broken pipeline.
- Hardening last because edge cases are best addressed after the happy path is production-validated.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (round-trip proof):** Empirical only — must attempt a Garmin Connect upload. Cannot be researched away. Treat as a spike with a hard gate.
- **Phase 3 (exercise mapper):** Garmin exercise enum numeric values need extraction from the actual FIT SDK profile.xlsx for the watch firmware version in use.

Phases with standard patterns (skip research-phase):
- **Phase 2 (parsers):** Both data formats fully characterized from sample file inspection.
- **Phase 5 (Flask UI):** Standard Flask file upload/download patterns.
- **Phase 6 (hardening):** Standard Docker and error handling patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | fit-tool write support confirmed from community sources but NOT verified against live Garmin Connect upload; garmin-fit-sdk Python encoder existence is LOW confidence — must verify before treating as fallback |
| Features | HIGH | Table stakes derived from stable FIT spec knowledge, confirmed Hevy CSV format from direct sample inspection, and standard local-tool UX patterns |
| Architecture | MEDIUM-HIGH | FIT message types, ordering, and field semantics are from authoritative FIT spec knowledge; per-set timestamp estimation is the weakest architectural assumption |
| Pitfalls | HIGH | FIT epoch, weight scaling, CRC requirement, and message ordering are spec-documented facts; Hevy timestamp format and empty cell behavior are confirmed from direct sample file inspection |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **fit-tool write support (CRITICAL):** Must be validated against a real Garmin Connect upload in Phase 1, Day 1. If it fails: verify garmin-fit-sdk Python encoder exists at `https://github.com/garmin/fit-python-sdk`; if that also fails, manual binary encoding against FIT spec is the last resort.

- **garmin-fit-sdk Python encoder:** Existence of a Python-side encoder in the garmin-fit-sdk package is unconfirmed. Before treating as fallback, run `from garmin_fit_sdk import Encoder` and check the repo for encoder examples.

- **Garmin exercise enum values:** The FIT SDK profile defines numeric enum values for each exercise category. Phase 3 exercise mapper needs these extracted from the actual SDK profile (profile.xlsx or equivalent) for the exercises present in the sample file.

- **Hevy CSV format stability:** The confirmed format ("Apr 17, 2026, 5:46 PM") is from the sample file. Hevy may export timestamps differently across app versions or locale settings. Add a format-detection fallback with an explicit error if parsing fails.

- **Per-set timestamp estimation:** Hevy does not record per-set timestamps. Distributing sets linearly across workout duration is architecturally sound but untested against Garmin Connect's expectations for set message timing.

## Sources

### Primary (HIGH confidence)
- Direct inspection of `GarminHevyMerge/original_hevy.csv` — confirmed timestamp format, column schema, empty cell behavior, cardio mixed rows, RPE format, exercise names in sample data
- FIT Protocol Specification v21.x (training knowledge) — epoch definition, message types, CRC algorithm, field scaling, message ordering requirements
- FIT Activity SDK Profile (training knowledge) — exercise_name enum structure, set message fields, weight field scale factor

### Secondary (MEDIUM confidence)
- fit-tool PyPI and GitHub README — write support confirmed from multiple community sources; exact API ergonomics and mesg_num 225/227 coverage unverified
- fitparse library — read-only limitation is well-documented and consistent across all community references
- Python zoneinfo stdlib (3.9+) — IANA timezone database, DST handling
- HevyConnect reference project (TypeScript, abandoned) — implementation patterns inferred from project description; source not directly inspectable

### Tertiary (LOW confidence)
- garmin-fit-sdk Python bindings write support — unverified; check `https://github.com/garmin/fit-python-sdk` before treating as fallback
- Garmin Connect duplicate-upload rejection behavior — consistent community reports but not from official documentation

---
*Research completed: 2026-04-20*
*Ready for roadmap: yes*
