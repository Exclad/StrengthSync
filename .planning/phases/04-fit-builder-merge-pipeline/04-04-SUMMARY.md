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
    - fit_generator._patch_active_sets_inplace
    - fit_generator.build_merged_fit
    - output/merged.fit (Garmin Connect gate: APPROVED)
  affects:
    - fit_generator.py
    - tests/test_fit_generator.py
    - output/merged.fit
tech_stack:
  added: []
  patterns:
    - path traversal guard: pathlib.Path.resolve() + startswith(_PROJECT_ROOT)
    - double validation: fit-tool FitFile.from_file() + fitparse FitFile (D-11)
    - in-place binary patching: overwrite active mesg 225 field values; REST records preserved
    - overflow append: encoder-based for Hevy sets beyond Garmin active slot count
key_files:
  created:
    - output/merged.fit
  modified:
    - fit_generator.py
    - tests/test_fit_generator.py
decisions:
  - "Non-set message count is 4808 (not 4835): fitparse counts 4844 total, research used binary walk count 4871. test_non_set_messages_preserved now compares against original dynamically."
  - "In-place patching replaces the walk+encode+splice pipeline to preserve REST mesg 225 records verbatim — critical for correct rest time display in Garmin Connect."
  - "Exercise names: mapper.suggest_mapping() used as fallback (score >= 70) when no confirmed DB mapping exists. Fixes 'Choose an Exercise' shown for all sets."
  - "Intensity minutes do not appear for manually-uploaded FIT files even with correct session bytes. Confirmed Garmin platform limitation — not a file bug. Noted for potential future Garmin issue report."
metrics:
  duration: "~60 minutes including post-checkpoint fixes"
  completed: "2026-04-23"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
  checkpoint_status: approved
---

# Phase 4 Plan 04: build_merged_fit and Validation Summary

Wave 4 complete. `build_merged_fit()`, `_validate_fit_output()`, `_check_out_path()`, and `_patch_active_sets_inplace()` implemented. All 58 tests pass. `output/merged.fit` generated, uploaded to Garmin Connect, and **approved**.

## Tasks Completed

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 | Implement _check_out_path, _validate_fit_output, build_merged_fit | 151f609 | fit_generator.py |
| 2 | Remove xfail markers, generate output/merged.fit | f18943d | tests/test_fit_generator.py, output/merged.fit |
| 3 | Garmin Connect upload gate | — | **APPROVED** 2026-04-23 |

## Post-Checkpoint Fixes (during manual gate)

Three issues found during Garmin Connect verification and fixed:

**1. Exercise names showed "Choose an Exercise"**
- Root cause: `mapper.get_confirmed_mapping()` returns None (no DB entries yet); GENERIC_FALLBACK (enum 65534 = unknown) used for all sets.
- Fix: Added `mapper.suggest_mapping()` fallback (score ≥ 70 threshold) in `_build_set_dicts` and `build_preview`. All exercises now resolve to named Garmin categories (Leg Press → squat, Leg Extension → leg_extension, etc.).
- Commits: 2c4f639

**2. Set duration showed combined set+rest time (~2:52 instead of ~0:54)**
- Root cause: duration computed as gap between consecutive Garmin timestamps (set time + rest time interval).
- Fix (initial): set duration_s=0. Fix (final): preserve Garmin set duration via in-place patching.
- Commits: 2c4f639, 152ae98, 0c429f6

**3. Rest times showed as 0:00**
- Root cause: original pipeline dropped ALL mesg 225 records (active + REST) and re-encoded only active sets with garmin-fit-sdk. REST mesg 225 records (which carry rest duration) were lost.
- Fix: replaced walk+encode+splice with `_patch_active_sets_inplace()` — patches only the active mesg 225 records in-place (fields: reps, weight, category, category_subtype) while leaving REST records byte-for-byte identical. Overflow Hevy sets (N_hevy > N_garmin) appended via encoder.
- Commits: 0c429f6

## Final Verification Results

- `build_merged_fit()` writes valid FIT file (51,847 bytes): PASS
- Double-validation (fit-tool + fitparse) passes: PASS
- Merged FIT: 19 active sets + 18 rest sets with correct Garmin timing: PASS
- Set 1 timing: set=54.1s, rest=118.2s (matches original Garmin exactly): PASS
- Exercise names resolve via fuzzy matching: PASS
- Weight scaling correct (22.5 kg → fitparse reads 22.5 kg): PASS
- Path traversal to /tmp/ blocked before any file write: PASS
- 4808 non-set messages preserved verbatim: PASS
- All 58 tests: PASSED
- Garmin Connect upload: **APPROVED** (set times, rest times, reps, weights all correct)

## Known Limitation

**Intensity minutes** do not appear for manually-uploaded FIT files on Garmin Connect even though the session record is byte-identical to the original. This is a Garmin platform limitation (not a file bug). Flagged for potential future issue report to Garmin.

## Self-Check: PASSED

- `fit_generator.build_merged_fit`: FOUND
- `fit_generator._validate_fit_output`: FOUND
- `fit_generator._patch_active_sets_inplace`: FOUND
- `output/merged.fit`: FOUND (51,847 bytes)
- All 58 tests: PASSED
- Garmin Connect gate: APPROVED
