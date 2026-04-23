---
phase: 04-fit-builder-merge-pipeline
plan: "04"
subsystem: fit-builder-validation
tags: [fit-generator, build-merged-fit, validation, path-traversal, garmin-connect-gate, wave4]
dependency_graph:
  requires:
    - fit_generator._walk_fit_binary (04-02)
    - fit_generator._assign_timestamps (04-02)
    - fit_generator._compute_fit_crc (04-02)
    - fit_generator._encode_hevy_sets (04-03)
    - fit_generator._flatten_hevy_sets (04-03)
    - fit_generator._get_workout_end_fit (04-03)
    - fit_generator._build_set_dicts (04-03)
    - fit_generator.build_preview (04-03)
  provides:
    - fit_generator._check_out_path
    - fit_generator._validate_fit_output
    - fit_generator.build_merged_fit
    - output/merged.fit (manual upload gate artifact)
  affects:
    - fit_generator.py (3 new functions replacing stubs)
    - tests/test_fit_generator.py (6 xfail markers removed; output_dir fixture overridden)
    - output/merged.fit (generated for manual Garmin Connect upload gate)
tech_stack:
  added: []
  patterns:
    - path traversal guard: pathlib.Path.resolve() + startswith(_PROJECT_ROOT)
    - double validation: fit-tool FitFile.from_file() + fitparse FitFile (D-11)
    - full byte-level splice: walk -> assign timestamps -> encode -> assemble -> CRC -> validate
    - project-local output_dir fixture override for path-restricted functions
key_files:
  created:
    - output/merged.fit
  modified:
    - fit_generator.py
    - tests/test_fit_generator.py
decisions:
  - "Non-set message count is 4808 (not 4835 as stated in research doc): fitparse counts 4844 total messages, research used binary walk count of 4871. Both methods count differently; 4808 is the verified fitparse count for both original and merged output."
  - "output_dir fixture overridden in test_fit_generator.py to use output/pytest_tmp/ inside project root — required because build_merged_fit path traversal guard rejects system /tmp paths"
  - "test_non_set_messages_preserved now compares merged count against original file count (dynamic) rather than hardcoding 4835 — deterministic and correct"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-23"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 3
  checkpoint_pending: true
---

# Phase 4 Plan 04: build_merged_fit and Validation Summary (Partial — Checkpoint Pending)

Wave 4 complete through Task 2: `build_merged_fit()`, `_validate_fit_output()`, and `_check_out_path()` implemented in fit_generator.py. All 6 xfail stubs promoted to passing tests. Full suite: 58 passed, 0 failed. `output/merged.fit` generated (50,608 bytes) from `original_garmin.fit` + `original_hevy.csv` with Asia/Singapore timezone — ready for manual Garmin Connect upload gate (Task 3, pending).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement _check_out_path, _validate_fit_output, build_merged_fit | 151f609 | fit_generator.py |
| 2 | Remove xfail markers, fix non-set count assertion, generate output/merged.fit | f18943d | tests/test_fit_generator.py, output/merged.fit |

## Task 3: Pending (Checkpoint)

**Type:** checkpoint:human-verify (blocking gate)

The Garmin Connect upload gate requires manual verification. The developer must:

1. Go to https://connect.garmin.com
2. Click the "+" button (top right) → "Import Data"
3. Upload: `/workspace/GarminHevyMerge/output/merged.fit`
4. Verify: workout shows ~52 minute duration, heart rate data (avg ~114 bpm, max ~151 bpm), exercises listed from Hevy data (legs workout exercises)
5. Signal: type "approved" if accepted, or describe rejection error

## Verification Results (Tasks 1–2)

- `build_merged_fit()` writes 50,608-byte FIT file to output path: PASS
- Double-validation (fit-tool + fitparse) passes on merged output: PASS
- Merged FIT contains 19 set messages (Hevy count, replacing 36 Garmin sets): PASS
- Merged FIT contains 4808 non-set messages (all biometric messages preserved verbatim): PASS
- Path traversal to /tmp/ blocked before any file write: PASS
- `_validate_fit_output()` raises ValueError with "fit-tool" on corrupt input: PASS
- All 20 tests in test_fit_generator.py: PASSED (0 xfail, 0 failed)
- Full suite (58 tests): PASSED
- `output/merged.fit` fitparse-valid: PASS
- `output/merged.fit` size > 40,000 bytes: PASS (50,608 bytes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Non-set message count was 4808, not 4835 as specified in plan**
- **Found during:** Task 2 — `test_non_set_messages_preserved` would fail with the hardcoded 4835 assertion
- **Issue:** The research doc calculated 4835 as (4871 binary-walk total − 36 sets). However, fitparse reports 4844 total messages for `original_garmin.fit` (4844 − 36 = 4808). The binary walker and fitparse count messages differently (fitparse may exclude certain message types).
- **Fix:** Updated `test_non_set_messages_preserved` to compare merged output count against original file count dynamically, plus a floor check (>= 4000). Both original and merged show 4808 non-set messages — MERGE-01 requirement is satisfied.
- **Files modified:** tests/test_fit_generator.py
- **Commit:** f18943d

**2. [Rule 1 - Bug] output_dir fixture produces /tmp paths rejected by _check_out_path**
- **Found during:** Task 2 — all 6 newly un-xfailed tests would fail immediately because the conftest `output_dir` fixture returns `str(tmp_path)` (a system /tmp path), and `build_merged_fit` enforces that `out_path` must be inside the project root
- **Issue:** The path traversal guard (_check_out_path) is a security requirement added in Task 1. It correctly rejects /tmp paths. The tests need to write to a project-local temp directory.
- **Fix:** Added a local `output_dir` fixture override in `test_fit_generator.py` that creates `output/pytest_tmp/<unique>/` inside the project root. Fixture cleans up after each test via `shutil.rmtree`.
- **Files modified:** tests/test_fit_generator.py
- **Commit:** f18943d

## Known Stubs

None — all stubs from Plans 04-01 through 04-03 are now fully implemented and passing.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. `build_merged_fit` adds local file I/O with an explicit path traversal guard (T-04-04-01 mitigation applied as designed). `_validate_fit_output` reads back its own output — no external input path. All threats in the plan's threat model are addressed:

- T-04-04-01 (Tampering, out_path): MITIGATED — `_check_out_path()` applied before any write
- T-04-04-02 (DoS, large file): ACCEPTED — local dev tool, FIT files bounded in practice
- T-04-04-03 (Tampering, fit_path): ACCEPTED — `_validate_fit_output()` catches corruption
- T-04-04-04 (Info Disclosure): ACCEPTED — content equivalent to what user would upload
- T-04-04-05 (Spoofing, corrupt passing both validators): ACCEPTED — residual risk acceptable

## Self-Check: PASSED

- `fit_generator.build_merged_fit`: FOUND (line 692)
- `fit_generator._validate_fit_output`: FOUND (line 660)
- `fit_generator._check_out_path`: FOUND (line 645)
- `fit_generator._PROJECT_ROOT`: FOUND (3 occurrences)
- `output/merged.fit`: FOUND (50,608 bytes)
- `grep -c xfail tests/test_fit_generator.py`: 0
- Commit 151f609: FOUND
- Commit f18943d: FOUND
