---
phase: 04-fit-builder-merge-pipeline
verified: 2026-04-23T12:50:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Upload output/merged.fit to Garmin Connect and confirm the workout is accepted and displays correctly"
    expected: "Workout visible in Garmin Connect with correct duration, heart rate data, and Hevy exercise names"
    why_human: "Cannot programmatically test Garmin Connect upload acceptance — requires browser interaction with external service"
---

# Phase 4: FIT Builder + Merge Pipeline Verification Report

**Phase Goal:** The merge pipeline assembles a valid FIT binary — all Garmin biometrics preserved verbatim, Hevy exercise data injected with correct field scaling — and the output passes CRC validation and Garmin Connect upload
**Verified:** 2026-04-23T12:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Merged FIT file uploads to Garmin Connect without rejection (SC-1) | PASSED (override) | Garmin Connect gate manually approved 2026-04-23 per 04-04-SUMMARY.md; output/merged.fit (51,847 bytes) confirmed accepted |
| 2 | All Garmin biometric messages preserved verbatim in output — no data modified or dropped (SC-2) | ✓ VERIFIED | fitparse counts 4808 non-set messages in merged.fit vs 4808 in original; proprietary mesg 140 and 288 confirmed present; REST mesg 225 records preserved verbatim by _patch_active_sets_inplace |
| 3 | Hevy weight values appear correctly — kg, not grams (SC-3) | ✓ VERIFIED | test_weight_scaling PASSED: all weights in 0–300 kg range; _encode_hevy_sets passes float kg to garmin-fit-sdk which applies ×16 internally; test_encode_hevy_sets_weight_scaling verifies 22.5 kg → fitparse reads 22.5 |
| 4 | CRC computed before offering download; corrupt file detected and blocked with clear error (SC-4) | ✓ VERIFIED | _validate_fit_output() raises ValueError("fit-tool validation failed…") or ValueError("fitparse validation failed…") on corrupt input; test_validation_failure_raises PASSED |
| 5 | Developer can preview merged workout data before FIT file is generated (SC-5) | ✓ VERIFIED | build_preview() returns MergePreview with BiometricSummary, 18 GarminSetRecords, 19 HevySetRecords; test_build_preview PASSED asserting avg_hr=114, max_hr=151, total_calories=266 |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fit_generator.py` | build_merged_fit, _validate_fit_output, _check_out_path, _patch_active_sets_inplace | ✓ VERIFIED | All 14 functions present at expected line numbers; fully substantive implementations |
| `fit_generator.py` | _walk_fit_binary, _extract_set_timestamps, _assign_timestamps, _compute_fit_crc | ✓ VERIFIED | All 4 binary helpers present and substantive |
| `fit_generator.py` | _encode_hevy_sets, _flatten_hevy_sets, _build_set_dicts, _extract_before_sets, _get_workout_end_fit, build_preview | ✓ VERIFIED | All 6 encode/preview helpers present and substantive |
| `models.py` | BiometricSummary, GarminSetRecord, HevySetRecord, MergePreview dataclasses; FitWorkout HR fields | ✓ VERIFIED | All 4 dataclasses at lines 97–133; FitWorkout.avg_heart_rate and max_heart_rate at lines 48–49 with `= None` default |
| `fit_parser.py` | avg_heart_rate and max_heart_rate populated from session message | ✓ VERIFIED | Lines 89–90: get_value calls; lines 109–110: constructor kwargs |
| `tests/conftest.py` | sample_match_result fixture | ✓ VERIFIED | Line 69: `def sample_match_result` present |
| `tests/test_fit_generator.py` | 20 tests (original 7 stubs expanded), all passing, 0 xfail | ✓ VERIFIED | 20 tests collected and passed; 0 xfail markers in file |
| `output/merged.fit` | Double-validated merged FIT, 51,847 bytes | ✓ VERIFIED | File exists at 51,847 bytes; fitparse+fit-tool double validation passes; 4808 non-set messages, 19 active set messages |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `build_merged_fit` | `_walk_fit_binary` + `_patch_active_sets_inplace` + `_encode_hevy_sets` | internal call chain (line 866, 875) | ✓ WIRED | build_merged_fit calls _patch_active_sets_inplace (in-place strategy) and _encode_hevy_sets for overflow; _walk_fit_binary used for overflow timestamp extraction |
| `build_merged_fit` | `_validate_fit_output` | called at line 893 before return | ✓ WIRED | Double-validation executes before returning out_path |
| `build_merged_fit` | `_check_out_path` | called at line 838 | ✓ WIRED | Path traversal guard runs before any file I/O |
| `build_preview` | `_extract_before_sets` + `_walk_fit_binary` + `_flatten_hevy_sets` + `_assign_timestamps` | direct calls (lines 707–713) | ✓ WIRED | All helpers called and their results assigned to MergePreview fields |
| `fit_parser.parse_fit_file` | `FitWorkout.avg_heart_rate` / `max_heart_rate` | constructor kwargs (lines 109–110) | ✓ WIRED | avg_hr and max_hr passed to FitWorkout constructor |
| `tests/test_fit_generator.py` | `fit_generator.build_preview, build_merged_fit` | import line 16 | ✓ WIRED | `from fit_generator import build_preview, build_merged_fit` present |
| `tests/conftest.py sample_match_result` | `matcher.match_workouts` | line 72: `result = match_workouts(...)` with `"Asia/Singapore"` | ✓ WIRED | match_workouts called with Asia/Singapore timezone |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `build_merged_fit` | `pass_through` (biometric bytes) | `_patch_active_sets_inplace` walks original FIT binary in-place | Yes — iterates all bytes of original_garmin.fit | ✓ FLOWING |
| `build_merged_fit` | `hevy_records` (overflow sets) | `_encode_hevy_sets` → garmin-fit-sdk Encoder | Yes — populated from HevyWorkout.exercises flat set list | ✓ FLOWING |
| `build_preview` | `before_sets` | `_extract_before_sets(fit_bytes)` — reads mesg 225 active records from FIT binary | Yes — 18 records extracted from original_garmin.fit | ✓ FLOWING |
| `build_preview` | `after_sets` | `_flatten_hevy_sets` → `_assign_timestamps` → `mapper.get_confirmed_mapping` / `suggest_mapping` | Yes — 19 HevySetRecords populated from HevyWorkout.exercises | ✓ FLOWING |
| `build_preview` | `biometric_summary` | `match.fit_workout.avg_heart_rate` / `max_heart_rate` set by `fit_parser.parse_fit_file` | Yes — avg_hr=114, max_hr=151 confirmed by test assertion | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| merged.fit passes fitparse | `fitparse.FitFile('output/merged.fit')` | 4845 total messages parsed without exception | ✓ PASS |
| merged.fit passes fit-tool | `FitFile.from_file('output/merged.fit')` | No exception raised (warnings about unknown fields are expected — fit-tool skips proprietary fields) | ✓ PASS |
| 4808 non-set messages preserved | fitparse count of non-mesg-225/227 messages | 4808 — matches original_garmin.fit count | ✓ PASS |
| 19 active set messages | fitparse count of mesg_num==225 with set_type==active | 19 — correct Hevy set count | ✓ PASS |
| 58 tests pass | `.venv/bin/pytest tests/ -q` | 58 passed, 0 failed | ✓ PASS |
| test_fit_generator.py all 20 pass | `.venv/bin/pytest tests/test_fit_generator.py -v` | 20 passed, 0 xfail, 0 failed | ✓ PASS |
| Garmin Connect upload | Manual upload of output/merged.fit | Approved 2026-04-23 per 04-04-SUMMARY.md checkpoint | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIT-03 | 04-04 | App generates merged FIT accepted by Garmin Connect without rejection | ✓ SATISFIED | Garmin Connect gate APPROVED; test_build_merged_fit_validates + test_proprietary_messages_preserved PASSED |
| FIT-04 | 04-04 | App validates output FIT with CRC + required message verification; clear error on failure | ✓ SATISFIED | _validate_fit_output raises ValueError with "fit-tool"/"fitparse" prefix; test_validation_failure_raises PASSED |
| MERGE-01 | 04-02, 04-04 | App preserves all Garmin biometric data verbatim — no modification or drop | ✓ SATISFIED | _patch_active_sets_inplace preserves REST records and all non-mesg-225/227 bytes; test_non_set_messages_preserved PASSED (4808 == original count) |
| MERGE-02 | 04-03 | App correctly scales Hevy weight from float kg to FIT integer format | ✓ SATISFIED | _encode_hevy_sets passes float kg to garmin-fit-sdk (×16 applied by SDK); _patch_active_sets_inplace applies `int(round(weight_kg * 16))`; test_weight_scaling + test_encode_hevy_sets_weight_scaling PASSED |
| MERGE-03 | 04-02, 04-04 | App estimates per-set timestamps by distributing within workout time bounds | ✓ SATISFIED | _assign_timestamps uses Garmin mesg 225 field 6 timestamps for primary sets, linear fallback for overflow; test_timestamp_assignment PASSED (19 active sets, all with start_time, strictly increasing for first 18) |
| MERGE-04 | 04-03 | User can preview merged workout data (side-by-side before/after) before FIT generation | ✓ SATISFIED | build_preview() returns MergePreview with BiometricSummary + 18 GarminSetRecords + 19 HevySetRecords; test_build_preview PASSED with exact biometric values asserted |

All 6 Phase 4 requirements are satisfied. No orphaned requirements detected.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `fit_generator.py` (build_merged_fit docstring) | Docstring describes walk+encode+splice pipeline but implementation uses _patch_active_sets_inplace | ℹ️ Info | The docstring was written for the original plan and not fully updated after the in-place patching refactor (04-04 deviation). Functionality is correct — only the docstring is stale. No functional impact. |

No blockers or warnings found. One info-level documentation staleness in build_merged_fit docstring (steps 3-4 describe the old encode+splice strategy; actual implementation uses _patch_active_sets_inplace).

### Human Verification Required

### 1. Garmin Connect Upload

**Test:** Upload `/workspace/GarminHevyMerge/output/merged.fit` to https://connect.garmin.com (use the "+" Import Data button)
**Expected:** Workout is accepted and displayed with correct duration (~52 min), heart rate data (avg ~114 bpm, max ~151 bpm), and Hevy exercise names (Leg Press, Leg Extension, etc.)
**Why human:** Cannot programmatically verify Garmin Connect acceptance — requires browser interaction with an external authenticated service

**Note:** Per 04-04-SUMMARY.md, this gate was already manually approved on 2026-04-23 ("APPROVED" status in checkpoint). If you are re-verifying the same output/merged.fit file, the gate has already passed. If output/merged.fit has been regenerated since then, a new upload test is required.

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria and all 6 requirement IDs (FIT-03, FIT-04, MERGE-01, MERGE-02, MERGE-03, MERGE-04) are satisfied by verifiable codebase evidence.

The `human_needed` status reflects that one success criterion (Garmin Connect acceptance) is intrinsically human-verified. The automated evidence (58 passing tests, double-validation passing, correct message counts, approved checkpoint in 04-04-SUMMARY.md) provides high confidence that the upload will continue to pass.

---

_Verified: 2026-04-23T12:50:00Z_
_Verifier: Claude (gsd-verifier)_
