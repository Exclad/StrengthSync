---
phase: 04-fit-builder-merge-pipeline
plan: "03"
subsystem: encoder-preview
tags: [fit-generator, encoder, build-preview, garmin-fit-sdk, wave3]
dependency_graph:
  requires:
    - fit_generator._walk_fit_binary (04-02)
    - fit_generator._assign_timestamps (04-02)
    - fit_generator._compute_fit_crc (04-02)
    - models.MergePreview (04-01)
    - models.BiometricSummary (04-01)
    - models.GarminSetRecord (04-01)
    - models.HevySetRecord (04-01)
    - models.FitWorkout.avg_heart_rate (04-01)
    - models.FitWorkout.max_heart_rate (04-01)
    - mapper.get_confirmed_mapping
    - mapper.GENERIC_FALLBACK
  provides:
    - fit_generator._flatten_hevy_sets
    - fit_generator._get_workout_end_fit
    - fit_generator._build_set_dicts
    - fit_generator._encode_hevy_sets
    - fit_generator._extract_before_sets
    - fit_generator.build_preview
  affects:
    - fit_generator.py (6 new functions replacing build_preview stub)
    - tests/test_fit_generator.py (4 new unit tests + xfail removed from test_build_preview)
tech_stack:
  added: []
  patterns:
    - garmin-fit-sdk Encoder: on_mesg(225, ...) with weight as float kg (SDK applies x16)
    - category/category_subtype passed as list[int] (Pitfall 6 guard)
    - FIT binary walk for mesg 225 active-set extraction (set_type==1 filter)
    - MergePreview: no file I/O; safe idempotent preview before write
    - GENERIC_FALLBACK for unmapped exercises (T-04-03-04 mitigation)
key_files:
  created: []
  modified:
    - fit_generator.py
    - tests/test_fit_generator.py
decisions:
  - "build_preview takes fit_path as explicit parameter (D-08 / Option 1 from RESEARCH.md)"
  - "weight passed as float kg to garmin-fit-sdk; SDK applies x16 — do NOT pre-multiply (D-10)"
  - "category/category_subtype wrapped in list[int] per Pitfall 6"
  - "_extract_before_sets uses same binary walk pattern as _walk_fit_binary; set_type==1 filter excludes rest sets"
  - "GENERIC_FALLBACK used for unmapped exercises with note that Phase 5 must pre-validate (T-04-03-04)"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-23"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 4 Plan 03: Encoder and build_preview Summary

Wave 3 encoder + preview: `_encode_hevy_sets` encodes Hevy sets via garmin-fit-sdk mesg 225 (weight=22.5 kg verified as 22.5 via fitparse round-trip; category/subtype as list[int]); `build_preview` returns MergePreview with 18 before_sets and 19 after_sets from sample workout without writing any file; `test_build_preview` promoted from XFAIL to PASSED.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement _encode_hevy_sets and helper functions | baf6580 | fit_generator.py, tests/test_fit_generator.py |
| 2 | Implement build_preview() and _extract_before_sets() | 57ca3f3 | fit_generator.py, tests/test_fit_generator.py |

## Verification Results

- `_encode_hevy_sets(dicts)` weight=22.5 kg → fitparse reads 22.5 kg (SDK x16 applied internally): PASS
- `_flatten_hevy_sets` excludes cardio exercises from skipped_cardio list: PASS
- `_get_workout_end_fit` computes FIT epoch int from start_time + elapsed: PASS
- `build_preview(sample_match_result, "Asia/Singapore", sample_fit_path)` returns MergePreview: PASS
- `preview.biometric_summary.avg_heart_rate == 114`: PASS
- `preview.biometric_summary.max_heart_rate == 151`: PASS
- `preview.biometric_summary.total_calories == 266`: PASS
- `len(preview.before_sets) == 18` (Garmin active sets): PASS
- `len(preview.after_sets) == 19` (Hevy sets): PASS
- `test_build_preview` PASSED (not XFAIL): PASS
- 6 remaining xfail stubs still XFAIL (not accidentally passing): PASS
- Full test suite: 52 passed, 6 xfailed, 0 failed: PASS

## Deviations from Plan

None — plan executed exactly as written. Both tasks implemented using the exact code patterns from RESEARCH.md and PATTERNS.md. The garmin-fit-sdk weight scaling (D-10), category list requirement (Pitfall 6), and GENERIC_FALLBACK mitigation (T-04-03-04) are all present as specified.

The database `init_db()` was needed before mapper queries could succeed in test run — called once to initialize the schema. This is not a deviation; the DB file existed but the table needed creation on the worktree's environment.

## Known Stubs

The 5 remaining xfail stubs (`test_build_merged_fit_validates`, `test_proprietary_messages_preserved`, `test_validation_failure_raises`, `test_non_set_messages_preserved`, `test_weight_scaling`, `test_timestamp_assignment`) all depend on `build_merged_fit` and `_validate_fit_output` — both intentionally deferred to Plan 04-04.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. `build_preview` reads a local FIT file (trusted local input per T-04-03-01). GENERIC_FALLBACK is documented in the function docstring as requiring Phase 5 pre-validation (T-04-03-04 mitigation in place).

## Self-Check: PASSED

- `fit_generator._flatten_hevy_sets`: FOUND (line 201)
- `fit_generator._get_workout_end_fit`: FOUND (line 219)
- `fit_generator._build_set_dicts`: FOUND (line 237)
- `fit_generator._encode_hevy_sets`: FOUND (line 282)
- `fit_generator._extract_before_sets`: FOUND (line 457)
- `fit_generator.build_preview`: FOUND (line 558)
- `[s['category_enum_int']]` list pattern: FOUND (line 314)
- Commit baf6580: FOUND
- Commit 57ca3f3: FOUND
