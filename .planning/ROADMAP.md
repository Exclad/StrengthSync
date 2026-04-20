# Roadmap: Garmin-Hevy Workout Sync

## Overview

Five phases from proof-of-concept to working local web app. Phase 1 is a hard gate: if no Python library can write FIT files Garmin Connect accepts, the architecture pivots before any application code is written. Once the write path is proven, parsers, matching, the merge pipeline, and the web UI follow in dependency order. Every phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: FIT Round-Trip Proof-of-Concept** - Validate that Python can write a FIT file Garmin Connect accepts — hard gate for all other work (complete 2026-04-20)
- [ ] **Phase 2: Core Parsers** - Build FitParser and HevyParser producing typed dataclasses from sample files
- [ ] **Phase 3: Workout Matching + Exercise Mapping** - Timezone-aware matcher and SQLite-backed exercise mapper with fuzzy suggestions
- [ ] **Phase 4: FIT Builder + Merge Pipeline** - Assemble the full merge: biometric pass-through, Hevy exercise injection, weight scaling, CRC validation
- [ ] **Phase 5: Web UI + Deployment** - Flask upload/download UI, mapping review screen, timezone picker, error messages, and local run packaging

## Phase Details

### Phase 1: FIT Round-Trip Proof-of-Concept
**Goal**: Developer has confirmed that a Python FIT write library produces files Garmin Connect accepts, and the project structure is initialized inside GarminHevyMerge/
**Depends on**: Nothing (first phase)
**Requirements**: FIT-01, STRUCT-01
**Success Criteria** (what must be TRUE):
  1. Python is installed globally on the machine (`python --version` works in any terminal, not only a virtualenv)
  2. `fit-tool` (or confirmed fallback library) can read `original_garmin.fit`, write a byte-for-byte equivalent output, and re-parse it without errors
  3. The output FIT file from the round-trip script uploads to Garmin Connect without rejection — manually verified by the developer
  4. A minimal from-scratch FIT file (file_id + session + one set message) also uploads to Garmin Connect without rejection
  5. All project files (scripts, sample files, `.planning/`) reside inside `GarminHevyMerge/` — no files outside this root
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Environment setup: Python install, venv, dependencies, module stubs, test scaffold (complete 2026-04-20)
- [x] 01-02-PLAN.md — Round-trip implementation: read_fit_file + write_roundtrip_fit + poc_roundtrip.py (complete 2026-04-20)
- [x] 01-03-PLAN.md — From-scratch FIT + Garmin Connect manual upload gate (complete 2026-04-20)

### Phase 2: Core Parsers
**Goal**: FitParser and HevyParser correctly extract typed workout data from the sample files, with all known edge cases handled
**Depends on**: Phase 1
**Requirements**: FIT-02, HEVY-01, HEVY-02
**Success Criteria** (what must be TRUE):
  1. Developer can run `FitParser` against `original_garmin.fit` and receive a typed `FitWorkout` dataclass containing all biometric record types (heart rate, GPS, cadence, power, calories, device info) and session timestamps in UTC using the Garmin epoch
  2. Developer can run `HevyParser` against `original_hevy.csv` and receive a list of `HevyWorkout` dataclasses with exercises, sets, reps, and weights correctly parsed — non-ISO timestamps parsed via explicit strptime, empty cells stored as None (not 0), bodyweight exercises handled
  3. Cardio rows (Treadmill, Stair Machine) in the Hevy CSV are detected during parsing and returned as flagged/skipped records rather than crashing or silently producing corrupt data
  4. Unit tests pass for both parsers using the sample files as fixtures
**Plans**: TBD

### Phase 3: Workout Matching + Exercise Mapping
**Goal**: The app can correctly pair Garmin and Hevy workouts by timestamp across any timezone, and can suggest and persist Hevy-to-Garmin exercise mappings using fuzzy matching backed by SQLite
**Depends on**: Phase 2
**Requirements**: MATCH-01, MATCH-02, MATCH-03, MAP-01, MAP-02, MAP-03, MAP-04
**Success Criteria** (what must be TRUE):
  1. Given `Asia/Singapore` (UTC+8) as the user timezone, the workout matcher correctly converts Hevy local timestamps to UTC and matches the sample Garmin and Hevy workouts within the 30-minute tolerance window — a Singapore user sees a match, not an 8-hour gap
  2. The matcher surfaces a confidence level (time delta in minutes) for each auto-matched pair so the developer can see match quality
  3. When auto-match fails or produces an incorrect result, the developer can manually specify which Garmin and Hevy workouts to pair
  4. Exercise mappings confirmed by the user are stored in SQLite and are retrieved correctly in a subsequent session without re-entry
  5. Fuzzy string matching (rapidfuzz) suggests Garmin exercise enum candidates for each Hevy exercise name with a confidence score
  6. Exercises with no Garmin enum equivalent (machine-specific movements) are assigned a generic strength fallback rather than raising an error
**Plans**: TBD

### Phase 4: FIT Builder + Merge Pipeline
**Goal**: The merge pipeline assembles a valid FIT binary — all Garmin biometrics preserved verbatim, Hevy exercise data injected with correct field scaling — and the output passes CRC validation and Garmin Connect upload
**Depends on**: Phase 3
**Requirements**: FIT-03, FIT-04, MERGE-01, MERGE-02, MERGE-03, MERGE-04
**Success Criteria** (what must be TRUE):
  1. The merged FIT file built from both sample files uploads to Garmin Connect without rejection — manually verified by the developer
  2. All Garmin biometric messages (heart rate time-series, rest periods, GPS track, calories, session metadata, device info) are present verbatim in the output — no biometric data is modified or dropped
  3. Hevy weight values appear correctly in Garmin Connect (e.g., a 60 kg set shows as 60 kg, not 60 grams) — confirming the kg × 1000 integer scaling is applied correctly
  4. The app computes a CRC on the output FIT file before offering download and shows a clear error message if validation fails — a deliberately corrupted file is detected and blocked
  5. Developer can preview the merged workout data (Garmin biometrics alongside Hevy exercise records) before the FIT file is generated
**Plans**: TBD

### Phase 5: Web UI + Deployment
**Goal**: A user who has never seen the app can upload their files, pick their timezone, review and confirm exercise mappings, and download a merged FIT file — all from a browser, launched with a single command
**Depends on**: Phase 4
**Requirements**: UI-01, UI-02, UI-03, UI-04, DEPLOY-01
**Success Criteria** (what must be TRUE):
  1. User can run `python app.py` in the `GarminHevyMerge/` folder (after `pip install -r requirements.txt`) and the browser opens automatically to the app — no other setup required beyond a global Python install
  2. User can upload a Garmin FIT file and Hevy CSV via drag-and-drop or file browser, and select their IANA timezone, all from a single upload screen
  3. User sees a mapping review screen listing all Hevy-to-Garmin exercise mappings with fuzzy suggestions; the app blocks the export button until all mappings are confirmed or explicitly skipped
  4. User can download the merged FIT file; a progress indicator is visible during processing so the user knows the app is working
  5. When the user uploads an invalid file (wrong type, corrupt FIT, non-Hevy CSV, failed match) the app shows a clear, actionable error message describing what went wrong and what to do next — it does not show a Python traceback or crash silently
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. FIT Round-Trip Proof-of-Concept | 3/3 | Complete | 2026-04-20 |
| 2. Core Parsers | 0/TBD | Not started | - |
| 3. Workout Matching + Exercise Mapping | 0/TBD | Not started | - |
| 4. FIT Builder + Merge Pipeline | 0/TBD | Not started | - |
| 5. Web UI + Deployment | 0/TBD | Not started | - |
