---
phase: 01-fit-round-trip-proof-of-concept
plan: 01
subsystem: infra
tags: [python, fit-tool, fitparse, garmin-fit-sdk, pytest, venv]

# Dependency graph
requires: []
provides:
  - Python 3.11.2 installed globally on the machine
  - Project venv at .venv/ with fit-tool==0.9.15, fitparse==1.2.0, garmin-fit-sdk==21.200.0, pytest==9.0.3
  - requirements.txt with pinned versions
  - fit_parser.py stub exporting read_fit_file(path: str) -> FitFile
  - fit_generator.py stub exporting write_roundtrip_fit and build_minimal_strength_fit
  - tests/ scaffold with 5 tests collected, zero import errors, correct RED state
affects: [01-02, 01-03]

# Tech tracking
tech-stack:
  added:
    - fit-tool==0.9.15 (FIT file reading and writing)
    - fitparse==1.2.0 (FIT file reading / verification)
    - garmin-fit-sdk==21.200.0 (official Garmin Python encoder, fallback)
    - pytest==9.0.3 (test framework)
  patterns:
    - Module stubs with NotImplementedError for TDD RED state
    - Project-local venv at .venv/ for dependency isolation
    - pytest fixtures in conftest.py for shared test setup

key-files:
  created:
    - requirements.txt
    - fit_parser.py
    - fit_generator.py
    - tests/__init__.py
    - tests/conftest.py
    - tests/test_fit_roundtrip.py
    - tests/test_fit_scratch.py
  modified: []

key-decisions:
  - "fit-tool is the primary FIT write library; garmin-fit-sdk is the fallback if Garmin Connect rejects fit-tool output"
  - "fitparse is NEVER used for writing — read-only verification only"
  - "fit-tool accepts Unix epoch milliseconds; FIT 1989 epoch conversion is handled internally"
  - "FIT weight fields are integers in grams (kg * 1000)"
  - "Module stubs (not throwaway scripts) — Phase 2 extends fit_parser.py, Phase 3 extends fit_generator.py"

patterns-established:
  - "Pattern 1: venv-based dependency isolation — all pip installs go to .venv/, never system Python"
  - "Pattern 2: TDD RED state — stubs raise NotImplementedError; test scaffold written before implementation"
  - "Pattern 3: FitFile import from fit_tool.fit_file, FitFileBuilder from fit_tool.fit_file_builder"

requirements-completed: [FIT-01, STRUCT-01]

# Metrics
duration: 6min
completed: 2026-04-20
---

# Phase 1 Plan 01: Environment Setup and Test Scaffold Summary

**Python 3.11.2 installed globally, project venv with fit-tool/fitparse/garmin-fit-sdk, module stubs and 5-test RED-state scaffold ready for Plans 02 and 03.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-20T11:33:19Z
- **Completed:** 2026-04-20T11:39:38Z
- **Tasks:** 2 completed
- **Files modified:** 7 created, 0 modified

## Accomplishments

- Python 3.11.2 installed globally via apt-get on Debian Bookworm; project venv at .venv/ with all Phase 1 libraries pinned in requirements.txt
- Module stubs created: fit_parser.py (read_fit_file) and fit_generator.py (write_roundtrip_fit, build_minimal_strength_fit) — real interfaces that Plans 02 and 03 extend
- pytest scaffold with 5 tests collected, zero import errors; 4 tests fail with NotImplementedError (correct RED state); 1 structural test passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Python globally and create project venv** - `6b0de25` (chore)
2. **Task 2: Create module stubs and test scaffold** - `9c965d4` (test)

**Plan metadata:** (committed with SUMMARY — see docs commit)

_Note: Task 2 is a TDD task. The RED phase commit (test stubs) is `9c965d4`. GREEN and REFACTOR phases are implemented in Plans 02 and 03 respectively._

## Files Created/Modified

- `requirements.txt` — Pinned pip freeze output: fit-tool==0.9.15, fitparse==1.2.0, garmin-fit-sdk==21.200.0, pytest==9.0.3
- `fit_parser.py` — FIT reader stub: read_fit_file(path) -> FitFile, raises NotImplementedError
- `fit_generator.py` — FIT writer stubs: write_roundtrip_fit and build_minimal_strength_fit, raise NotImplementedError
- `tests/__init__.py` — pytest package marker (empty)
- `tests/conftest.py` — Shared fixtures: sample_fit_path (SAMPLE_FIT=/workspace/GarminHevyMerge/original_garmin.fit) and output_dir (tmp_path)
- `tests/test_fit_roundtrip.py` — Round-trip test stub: test_roundtrip_reparses (RED), test_roundtrip_output_inside_project (passes)
- `tests/test_fit_scratch.py` — From-scratch FIT test stubs: test_minimal_fit_reparses, test_minimal_fit_has_required_messages, test_minimal_fit_has_set_message (all RED)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

The following intentional NotImplementedError stubs exist — this is the correct RED state per TDD plan:

| File | Function | Reason | Resolving Plan |
|------|----------|--------|----------------|
| `fit_parser.py` | `read_fit_file` | TDD RED — awaiting Plan 02 implementation | Plan 02 |
| `fit_generator.py` | `write_roundtrip_fit` | TDD RED — awaiting Plan 02 implementation | Plan 02 |
| `fit_generator.py` | `build_minimal_strength_fit` | TDD RED — awaiting Plan 03 implementation | Plan 03 |

These stubs do NOT prevent the plan's goal (environment + scaffold setup) from being achieved.

## Self-Check: PASSED

- `requirements.txt` exists: FOUND
- `fit_parser.py` exists: FOUND
- `fit_generator.py` exists: FOUND
- `tests/conftest.py` exists: FOUND
- `tests/test_fit_roundtrip.py` exists: FOUND
- `tests/test_fit_scratch.py` exists: FOUND
- Commit `6b0de25` exists: FOUND
- Commit `9c965d4` exists: FOUND
- pytest collects 5 tests, 0 import errors: VERIFIED
