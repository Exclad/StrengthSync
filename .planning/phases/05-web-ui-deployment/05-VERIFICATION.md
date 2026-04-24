---
phase: 05-web-ui-deployment
verified: 2026-04-24T00:00:00Z
status: human_needed
score: 17/18 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run `python app.py`, confirm browser opens automatically to http://localhost:5000, then complete the full 5-screen flow: upload original_garmin.fit + original_hevy.csv with Asia/Singapore → auto-match fires on ScreenMatch → exercises populate with MAPPED/LOW CONFIDENCE chips on ScreenMap → confirm/skip until 0 UNRESOLVED → Preview merge shows real KPIs and HR chart → Generate & export .fit fires → spinner appears → download card shows → click Download .fit file and confirm browser download dialog triggers."
    expected: "Browser opens automatically. Each screen advances on correct user action. ScreenPreview shows non-zero duration/calories from real Garmin data. The merged .fit binary downloads successfully."
    why_human: "Visual flow, browser auto-open, and end-to-end download cannot be verified programmatically without a running server and real browser interaction. The automated test suite covers API correctness but not the full UI flow through a real browser."
---

# Phase 5: Web UI + Deployment Verification Report

**Phase Goal:** Deliver a working single-user local web UI — Flask backend serving a React frontend — so the user can upload FIT + Hevy CSV, match workouts, map exercises, preview the merge, and download the merged FIT file via a browser (no CLI required). Deploy via `python app.py` opening the browser automatically.
**Verified:** 2026-04-24
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 8 API routes exist in app.py | ✓ VERIFIED | `GET /api/timezones`, `GET /api/exercises`, `POST /api/upload`, `POST /api/match`, `POST /api/map/suggest`, `POST /api/map/confirm`, `POST /api/preview`, `POST /api/export` — all present at lines 53-362 of app.py |
| 2 | POST /api/upload validates FIT and CSV and returns 400 with error key on bad input | ✓ VERIFIED | Three 400 code paths: non-FIT exception → "That doesn't look like a FIT file…"; corrupt/truncated FIT → "FIT file failed to parse…"; non-Hevy CSV → "This doesn't look like a Hevy export…"; tests `test_upload_invalid_fit`, `test_upload_corrupt_fit`, `test_upload_invalid_csv` all pass |
| 3 | POST /api/export returns application/octet-stream FIT binary | ✓ VERIFIED | `send_file(result_path, mimetype="application/octet-stream", as_attachment=True, download_name="merged.fit")` at app.py line 357; `test_export_returns_fit` passes; 11 real merged FIT files present in `/output/` from prior test runs |
| 4 | ScreenUpload fetches timezones and POSTs to /api/upload | ✓ VERIFIED | `fetch('/api/timezones')` in `useEffect` on mount (screen_upload.jsx:14); `fetch('/api/upload', { method: 'POST', body: formData })` in `handleContinue` (line 64) |
| 5 | ScreenMatch POSTs to /api/match on mount | ✓ VERIFIED | `fetch('/api/match', ...)` in `useEffect` (screen_match.jsx:11); `handleManualMatch` sends `hevy_workout_id` index for manual override (line 29) |
| 6 | ScreenMap POSTs to /api/map/suggest and /api/map/confirm | ✓ VERIFIED | Per-exercise `fetch('/api/map/suggest', ...)` on mount (screen_map.jsx:48); `fetch('/api/map/confirm', ...)` in `handleConfirm` (line 75) |
| 7 | ScreenPreview POSTs to /api/preview and renders KPIs | ✓ VERIFIED | `fetch('/api/preview', ...)` in `useEffect` (screen_preview.jsx:9); 6-column KPI strip renders from `preview.biometricSummary` (line 46); HR chart renders from `heartRateSamples` or shows "No HR data" empty state (lines 72-99) |
| 8 | ScreenDone POSTs to /api/export and triggers blob download | ✓ VERIFIED | Auto-starts `fetch('/api/export', ...)` on mount (screen_done.jsx:20); `URL.createObjectURL(fitBlob)` + anchor click in `handleDownload` (lines 44-52) |
| 9 | app.jsx wires all 5 screens with step guards | ✓ VERIFIED | `appState` contains `uploadResult`, `matchResult`, `exercises`, `previewResult`; each screen `onNext` updates appState and advances step; `handleRestart` clears state to step 0 (app.jsx lines 35-137) |
| 10 | All 67 tests pass | ✓ VERIFIED | `67 passed in 15.93s` — all 9 test_app_api.py tests GREEN, all 58 pre-existing tests GREEN |
| 11 | Export gate blocks Preview button until all exercises resolved or skipped | ✓ VERIFIED | `unresolvedCount = exercises.filter(e => e.status === 'needs-review' \|\| e.status === 'unmapped').length`; `canExport = unresolvedCount === 0`; button `disabled={!canExport}` (screen_map.jsx lines 107-108, 255) |
| 12 | No dataclasses.asdict() used anywhere in app.py | ✓ VERIFIED | All datetime-bearing dataclasses serialized field-by-field with `dt_iso()` helper; `grep "dataclasses.asdict" app.py` returns no match |
| 13 | debug=False enforced in app.run() | ✓ VERIFIED | `app.run(debug=False, port=5000)` at line 375 |
| 14 | secure_filename() wraps uploaded filenames | ✓ VERIFIED | `secure_filename(fit_file.filename or "upload.fit")` and `secure_filename(hevy_file.filename or "upload.csv")` at lines 94-95 |
| 15 | download_name= kwarg used in send_file() (Flask 3.x) | ✓ VERIFIED | `download_name="merged.fit"` at line 361, not deprecated `attachment_filename=` |
| 16 | Mock data removed from data.jsx; helpers preserved | ✓ VERIFIED | data.jsx is 26 lines: empty stubs for all 5 mock globals; `fmtTime`, `fmtDate`, `fmtDuration` helpers preserved; `Object.assign(window, ...)` still present |
| 17 | No artificial 1800ms delay in ScreenDone | ✓ VERIFIED | `grep "1800"` returns no match in screen_done.jsx; log lines use staggered 400ms timeouts for UX only; fetch fires immediately on mount |
| 18 | `python app.py` opens browser automatically | ? HUMAN NEEDED | `webbrowser.open("http://localhost:5000")` scheduled via `threading.Timer(1.0, _open_browser)` at app.py lines 369-374; code is present and correct but actual browser-open behavior requires live execution to confirm |

**Score:** 17/18 truths verified (18th requires human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app.py` | All 8 API routes + 1 index route; SECRET_KEY warning; database init call | ✓ VERIFIED | 376 lines; all 9 routes present; SECRET_KEY logic lines 14-22; `database.init_db()` at line 31 |
| `static/src/screen_upload.jsx` | Wired to /api/timezones + /api/upload; error banners; timezone select | ✓ VERIFIED | 263 lines; both fetch calls present; `IconWarn` error banner; timezone select with filter |
| `static/src/screen_match.jsx` | Wired to /api/match; auto-match + manual override | ✓ VERIFIED | 268 lines; useEffect auto-match + `handleManualMatch`; error banner with `IconWarn` |
| `static/src/screen_map.jsx` | Wired to /api/map/suggest + /api/map/confirm; export gate | ✓ VERIFIED | 531 lines; per-exercise suggest on mount; confirm POSTs to API; `unresolvedCount` gate |
| `static/src/screen_preview.jsx` | Wired to /api/preview; KPIs; HR chart | ✓ VERIFIED | 177 lines; `fetch('/api/preview')` on mount; 6-column KPI strip; HR chart or "No HR data" |
| `static/src/screen_done.jsx` | Wired to /api/export; spinner; blob download | ✓ VERIFIED | 168 lines; auto-starts export on mount; `URL.createObjectURL`; "Sync another workout" |
| `static/src/app.jsx` | appState with real fields; step guards; handleRestart | ✓ VERIFIED | 200 lines; appState contains all required fields; all 5 onNext handlers wire real state |
| `static/src/data.jsx` | Empty stubs; helpers preserved | ✓ VERIFIED | 26 lines; all mock data removed; helpers present |
| `tests/test_app_api.py` | 9 tests covering all Phase 5 API routes | ✓ VERIFIED | 175 lines; 9 test functions; all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `POST /api/upload` | `fit_parser.parse_fit_file()` | temp file from `tempfile.mkdtemp()` | ✓ WIRED | app.py line 103 |
| `POST /api/upload` | `hevy_parser.parse_hevy_csv()` | temp file from `tempfile.mkdtemp()` | ✓ WIRED | app.py line 114 |
| `POST /api/match` | `matcher.match_workouts()` / `matcher.force_match()` | session fit_path + hevy_csv_path re-parse | ✓ WIRED | app.py lines 188-196 |
| `POST /api/export` | `fit_generator.build_merged_fit()` | `output/merged-{hex}.fit` | ✓ WIRED | app.py lines 349, 346 |
| `POST /api/export` | `flask.send_file()` | `download_name="merged.fit"` | ✓ WIRED | app.py line 357 |
| `screen_upload.jsx` | `/api/timezones` | `fetch()` in `useEffect` on mount | ✓ WIRED | screen_upload.jsx line 14 |
| `screen_upload.jsx` | `/api/upload` | `fetch()` with `FormData` on continue click | ✓ WIRED | screen_upload.jsx line 64 |
| `screen_match.jsx` | `/api/match` | `fetch()` on mount + `handleManualMatch` | ✓ WIRED | screen_match.jsx lines 11, 29 |
| `screen_map.jsx` | `/api/map/suggest` | `fetch()` on mount per exercise | ✓ WIRED | screen_map.jsx line 48 |
| `screen_map.jsx` | `/api/map/confirm` | `fetch()` on suggestion click | ✓ WIRED | screen_map.jsx line 75 |
| `screen_preview.jsx` | `/api/preview` | `fetch()` on mount | ✓ WIRED | screen_preview.jsx line 9 |
| `screen_done.jsx` | `/api/export` | `fetch()` on mount; `URL.createObjectURL(blob)` | ✓ WIRED | screen_done.jsx lines 20, 44 |
| `app.jsx` | `appState.uploadResult` | step guard: ScreenUpload onNext stores result | ✓ WIRED | app.jsx lines 41, 116 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `screen_upload.jsx` | `timezones` | `GET /api/timezones` → `zoneinfo.available_timezones()` | Yes — live IANA zones from Python runtime | ✓ FLOWING |
| `screen_match.jsx` | `matchResult` | `POST /api/match` → `matcher.match_workouts()` or `force_match()` | Yes — real parsed FIT + Hevy data from session | ✓ FLOWING |
| `screen_map.jsx` | `exercises[*].suggestions` | `POST /api/map/suggest` → `mapper.suggest_mapping()` | Yes — rapidfuzz against `_GARMIN_EXERCISES` list | ✓ FLOWING |
| `screen_preview.jsx` | `preview` | `POST /api/preview` → `fit_generator.build_preview()` | Yes — parses real session FIT file | ✓ FLOWING |
| `screen_done.jsx` | `fitBlob` | `POST /api/export` → `fit_generator.build_merged_fit()` → `send_file()` | Yes — actual merged FIT binary (11 real files confirmed in output/) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 67 tests pass | `.venv/bin/pytest tests/ -q` | `67 passed in 15.93s` | ✓ PASS |
| GET /api/timezones returns America/New_York first | Via `test_timezones_endpoint` | 200, list > 400 items, body[0] == "America/New_York" | ✓ PASS |
| POST /api/upload returns 400 for invalid FIT | Via `test_upload_invalid_fit` | 400, error key present | ✓ PASS |
| POST /api/export returns octet-stream binary | Via `test_export_returns_fit` | 200, content-type contains octet-stream, len > 100 bytes | ✓ PASS |
| Full browser flow | Requires running server | Cannot test without live server + browser | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UI-01 | 05-00, 05-01, 05-02, 05-03, 05-04 | Upload FIT + Hevy CSV via file browser; select timezone | ✓ SATISFIED | ScreenUpload: drag-drop zone, file browser button, timezone select with filter, POSTs to /api/upload |
| UI-02 | 05-00, 05-01, 05-03, 05-04 | Mapping review screen; correct mappings; confirm before proceeding | ✓ SATISFIED | ScreenMap: per-exercise suggest/confirm/skip; export gate blocks until unresolvedCount === 0; confirmed mappings persisted to SQLite |
| UI-03 | 05-00, 05-01, 05-04 | Download merged FIT; processing progress indicators | ✓ SATISFIED | ScreenDone: spinner with animated SVG + 4 staggered log lines during export; Download .fit file button triggers blob download |
| UI-04 | 05-00, 05-01, 05-03, 05-04 | Clear error messages for invalid files, failed matches, mapping gaps, FIT failures | ✓ SATISFIED | All screens use chip.bad + IconWarn error banners; app.py returns structured {error, detail} JSON for all failure paths |
| DEPLOY-01 | 05-00, 05-01, 05-04 | `python app.py` opens browser automatically; setup requires only Python + pip | ? NEEDS HUMAN | Browser open code present (webbrowser + threading.Timer at app.py:369-374); actual browser-open requires live test |

**Note on REQUIREMENTS.md traceability column:** UI-01 through UI-04 and DEPLOY-01 are marked "Pending" in REQUIREMENTS.md (status column not updated). This is a documentation tracking issue, not an implementation gap — all five requirements have substantial implementation evidence above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `static/src/screen_upload.jsx` | 179 | `{true && (...)}` — Hevy section always renders (api mode never triggers) | ℹ️ Info | The `hevyMode === "api"` branch is intentionally stubbed per context; the file mode is fully functional |

No blocker or warning anti-patterns found. The `{true && ...}` on line 179 is a deliberate hardcoding noted in the 05-02-SUMMARY.md: the Hevy OAuth API path is a v2 deferred item; the file mode branch is complete and functional.

### Human Verification Required

#### 1. Full 5-Screen Browser Flow + Browser Auto-Open

**Test:** Run `cd /workspace/GarminHevyMerge && .venv/bin/python app.py`. Observe whether the browser opens automatically to http://localhost:5000. Then complete the following flow:
1. Upload screen: verify timezone picker loads with "America/New_York" first; drag `original_garmin.fit` to drop zone; pick `original_hevy.csv` via Browse; select "Asia/Singapore"; click "Continue to matching"
2. Match screen: confirm Garmin and Hevy cards render with real workout data (not "Loading…" placeholder); connector shows match confidence percentage
3. Map screen: exercises populate with MAPPED/LOW CONFIDENCE/NO MATCH chips from real fuzzy suggestions; confirm any UNRESOLVED exercises; "Preview merge" button enables when UNRESOLVED count reaches 0
4. Preview screen: KPI strip shows real duration, calories, HR values; HR chart renders (or "No HR data — this workout was recorded without a heart rate sensor." if no sensor)
5. Generate: spinner appears immediately (no multi-second delay before spinner shows); staggered log lines appear; download card appears on completion; click "Download .fit file" — browser download dialog triggers

**Expected:** All 5 steps complete without JS console errors. Browser auto-opens on `python app.py`. The downloaded `.fit` file is a non-trivial binary (> 1 KB).

**Why human:** Visual rendering, browser auto-open, drag-and-drop interaction, and end-to-end download dialog cannot be verified programmatically. The automated test suite (67 tests) covers API correctness but not UI flow through a real browser.

### Gaps Summary

No blocking gaps. All API routes are implemented, wired to backend modules, and verified by the automated test suite. All 5 frontend screens are wired to real API endpoints with correct error handling. The export pipeline is confirmed end-to-end by real merged FIT files present in the output/ directory.

The only pending item is human confirmation of the live browser flow (DEPLOY-01 auto-open and visual rendering).

---

_Verified: 2026-04-24_
_Verifier: Claude (gsd-verifier)_
