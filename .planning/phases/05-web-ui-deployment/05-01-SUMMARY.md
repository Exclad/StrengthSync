---
phase: "05"
plan: "01"
subsystem: flask-api-routes
tags: [flask, api, rest, upload, export, mapping, tdd, wave-1]
dependency_graph:
  requires: [05-00]
  provides: [all_api_routes, upload_endpoint, export_endpoint, mapping_endpoints]
  affects: [05-02-PLAN.md]
tech_stack:
  added: [zoneinfo, werkzeug.secure_filename, flask-session]
  patterns: [manual-datetime-serialization, tempfile-upload-storage, flask-session-state]
key_files:
  created: []
  modified:
    - app.py
decisions:
  - "All 8 API routes implemented in a single file write (Tasks 1+2+3 merged into one commit due to atomic write)"
  - "No dataclasses.asdict() used anywhere — all datetime-bearing dataclasses serialized field-by-field"
  - "Flask session stores only 3 string keys: fit_path, hevy_csv_path, timezone"
  - "secure_filename() wraps both fit_file.filename and hevy_file.filename before writing to tmpdir"
  - "download_name= kwarg used in send_file() (Flask 3.x, not attachment_filename=)"
  - "database.init_db() called at module load (after imports, before route definitions)"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-24T04:39:13Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 1
---

# Phase 05 Plan 01: Flask API Routes Summary

**One-liner:** All 8 REST API routes implemented in app.py — upload, match, map/suggest, map/confirm, preview, export, timezones, exercises — with full error handling, session state, and Flask 3.x compatibility.

## What Was Built

Wave 1 implementation of all Flask backend API routes. The complete REST interface between the React frontend (Wave 2) and the Python pipeline modules (Phases 2-4) is now live.

### Task 1 — GET /api/timezones + GET /api/exercises + startup config

Extended app.py with:

- **SECRET_KEY setup:** reads `os.environ.get("SECRET_KEY")`, emits `stderr` warning if unset, falls back to `secrets.token_hex(32)` for dev sessions
- **`database.init_db()`** called at module load — idempotent, creates SQLite tables if missing
- **GET /api/timezones:** returns IANA timezone list with 11 common zones floated first (America/New_York first), rest sorted alphabetically. Total > 400 zones.
- **GET /api/exercises:** returns full `mapper._GARMIN_EXERCISES` list as JSON with exercise_name, exercise_category, exercise_enum_int, exercise_category_enum_int keys

### Task 2 — POST /api/upload

- Accepts multipart `fit_file` + `hevy_csv` + `timezone` form fields
- `secure_filename()` wraps both uploaded filenames before writing to `tempfile.mkdtemp()`
- FIT validation via `fit_parser.parse_fit_file()` — returns 400 with actionable error message on failure
- Hevy CSV validation via `hevy_parser.parse_hevy_csv()` — returns 400 for bad columns, bad timestamps, or empty result
- Timezone validation via `zoneinfo.ZoneInfo()` — returns 400 for invalid IANA strings
- On success: stores `fit_path`, `hevy_csv_path`, `timezone` in Flask session; returns `fitWorkout` + `hevyWorkouts` JSON (manually serialized, no asdict)

### Task 3 — POST /api/match, /api/map/suggest, /api/map/confirm, /api/preview, /api/export

- **POST /api/match:** re-parses session files; auto-matches via `matcher.match_workouts()` or force-matches by index; returns delta_minutes, is_forced, garmin/hevy workout summaries
- **POST /api/map/suggest:** calls `mapper.suggest_mapping()` with limit=5; returns suggestions with id/label/score fields
- **POST /api/map/confirm:** resolves GarminExercise from `_GARMIN_EXERCISES` by name; calls `mapper.confirm_mapping()`; returns `{"ok": true}`
- **POST /api/preview:** force-matches session files; calls `fit_generator.build_preview()`; downsamples HR to max 720 points; returns biometricSummary + heartRateSamples + beforeSets + afterSets
- **POST /api/export:** force-matches session files; calls `fit_generator.build_merged_fit()` with `output/merged-{hex8}.fit` path; returns binary via `send_file(..., download_name="merged.fit", mimetype="application/octet-stream")`

## Verification Results

```
tests/test_app_api.py: 9 passed
Full suite: 67 passed (0 failures, 0 errors)
```

All 9 API route tests GREEN. All 58 pre-existing tests still pass.

## Commits

| Task | Commit | Message |
|---|---|---|
| Tasks 1-3 (combined) | 4613c75 | feat(05-01): implement GET /api/timezones and GET /api/exercises |

Note: All 3 tasks were written atomically in a single file write operation. The commit contains all routes (timezones, exercises, upload, match, map/suggest, map/confirm, preview, export).

## Deviations from Plan

**1. [Rule — Combined Write] All 3 tasks committed in a single commit**
- **Found during:** Task 1 implementation
- **Issue:** The plan calls for separate per-task commits, but the entire app.py was written atomically in one pass since all routes were designed together and the file is coherent as a unit.
- **Impact:** No functional impact — all acceptance criteria verified per-task before final commit. Test gates for each task passed in sequence.
- **Commit:** 4613c75

No other deviations from plan.

## Known Stubs

None. All routes are fully wired to the real pipeline modules (fit_parser, hevy_parser, matcher, mapper, fit_generator, database). No placeholder responses or hardcoded data.

## Threat Flags

All threats in the plan's threat model are mitigated as required:

| Flag | File | Status |
|------|------|--------|
| T-05-01-01: Uploaded filename tampering | app.py line 94-95 | Mitigated — secure_filename() on both filenames |
| T-05-01-02: out_path path traversal | app.py line 348-349 | Mitigated — path constructed from project_root/output/merged-{hex}.fit, never from user input |
| T-05-01-03: Session cookie overflow | app.py lines 124-126 | Mitigated — only 3 string keys stored |
| T-05-01-04: debug=True RCE | app.py line 376 | Mitigated — debug=False enforced |

## Self-Check: PASSED

- app.py: FOUND at /workspace/GarminHevyMerge/app.py
- Commit 4613c75: FOUND
- test_timezones_endpoint: PASSED
- test_upload_valid_files: PASSED
- test_upload_invalid_fit: PASSED
- test_upload_corrupt_fit: PASSED
- test_upload_invalid_csv: PASSED
- test_map_suggest: PASSED
- test_map_confirm: PASSED
- test_export_returns_fit: PASSED
- test_index_serves_html: PASSED (pre-existing)
- Full suite (67 tests): PASSED
