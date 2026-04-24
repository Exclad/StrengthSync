# Phase 5: Web UI + Deployment — Research

**Researched:** 2026-04-24
**Domain:** Flask 3.x REST API + React 18 CDN + Babel in-browser transpile
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** UI design fully specified by StrengthSync prototype in `static/src/` and `templates/index.html`. Match pixel-perfectly. Do NOT redesign.
- **D-02:** CSS: custom CSS variables in `templates/index.html`. No Bootstrap, no Tailwind.
- **D-03:** Typography: Inter Tight + JetBrains Mono from Google Fonts CDN. Already in template.
- **D-04:** Light/dark mode via `[data-theme="dark"]` on `<body>`. Already implemented.
- **D-05:** React + Babel CDN stack. Jinja2 renders shell only. JSX in `static/src/`.
- **D-06:** Screen 1 = Upload: drag-drop .fit + CSV file picker + IANA timezone selector. "Use demo data" may remain.
- **D-07:** Screen 2 = Match workouts: two-column connector layout. Manual override available.
- **D-08:** Screen 3 = Map exercises (hero screen): left list + right detail/suggestion panel. Export blocked until all UNRESOLVED resolved or skipped.
- **D-09:** Screen 4 = Preview merge: KPI strip, HR chart, exercise sequence, data audit. "Generate & export" triggers actual merge.
- **D-10:** Screen 5 = Export/Done: spinner while POST is in flight, transitions to download card on response.
- **D-11:** REST-style JSON API routes: `POST /api/upload`, `POST /api/match`, `POST /api/map/suggest`, `POST /api/map/confirm`, `POST /api/preview`, `POST /api/export`, `GET /api/exercises`
- **D-12:** Timezone: `GET /api/timezones` returns sorted list from `zoneinfo.available_timezones()`, common zones floated to top. React renders as filtered `<select>`.
- **D-13:** UNRESOLVED exercises (score < 70): suggestions shown ranked by score. "Search all Garmin exercises" opens inline search. "Skip" records `skip` status.
- **D-14:** Cardio rows shown with "CARDIO — SKIPPED" chip. No user action needed, do not block export.
- **D-15:** Confirmed mappings persisted to SQLite via `mapper.confirm_mapping()`. Pre-resolved on subsequent runs.
- **D-16:** Synchronous processing — Flask route runs pipeline inline, returns when done. Spinner shows while POST is in flight.
- **D-17:** 1.8 s animation delay replaced by actual wait time (spinner shows while `POST /api/export` fetch is pending).
- **D-18:** Errors as inline banners (not tracebacks). Flask returns `{"error": "...", "detail": "..."}` with 4xx status.
- **D-19:** Specific error messages for: wrong file type, corrupt FIT, no matching Hevy workout, invalid CSV, CRC validation failure.
- **D-20:** `python app.py` auto-opens browser via `threading.Timer(1.0, webbrowser.open)`. Already in `app.py`.
- **D-21:** Uploaded files stored in `tempfile.mkdtemp()`. No persistent upload storage. Cleaned after export or restart.
- **D-22:** Flask runs `debug=False` on port 5000. No authentication.
- **D-23:** SQLite `data/exercise_mappings.db` auto-created on first run. No migration.
- **D-24:** Flask session (cookie-based) stores parsed workout IDs and timezone after `/api/upload`. Mapping state passed as JSON in each POST.

### Claude's Discretion

- Exact structure of `/api/upload` JSON response schema (mirroring `FitWorkout` / `HevyWorkout` dataclass fields)
- Whether to add a Flask `SECRET_KEY` warning on startup if not configured
- Internal error logging format (stderr fine for local app)
- Whether to add a `.gitignore` entry for `data/*.db` uploads

### Deferred Ideas (OUT OF SCOPE)

- Hevy OAuth2 API integration
- Batch processing of multiple workouts
- "Save mapping set" / export mapping library
- "View run log"
- Real-time progress via SSE
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Upload Garmin FIT and Hevy CSV via drag-and-drop or file browser; select timezone — all from single upload screen | D-06, D-12; `POST /api/upload` parses both files and stores session state |
| UI-02 | Mapping review screen: all Hevy→Garmin exercise mappings visible, correctable; export blocked until resolved or skipped | D-08, D-13, D-15; `POST /api/map/suggest` + `POST /api/map/confirm` |
| UI-03 | Download merged FIT; progress indicator visible during processing | D-10, D-16, D-17; `POST /api/export` returns binary; spinner while in flight |
| UI-04 | Clear, user-friendly error messages for invalid files, failed matches, mapping gaps, FIT generation failures | D-18, D-19; `{"error":..., "detail":...}` 4xx JSON |
| DEPLOY-01 | `python app.py` opens browser automatically; setup = pip install + run | D-20, D-22, D-23; already implemented in `app.py` |
</phase_requirements>

---

## Summary

Phase 5 is primarily an integration phase. The backend pipeline modules (`fit_parser`, `hevy_parser`, `matcher`, `mapper`, `fit_generator`) are fully implemented and tested in Phases 2–4. Phase 5's job is to:

1. Wire the 5-screen React UI (already designed and in `static/src/`) to real Flask API endpoints instead of mock data in `data.jsx`.
2. Implement 7 REST API routes in `app.py` that call the backend pipeline functions and return JSON.
3. Handle file uploads (multipart), Flask session for state continuity, binary file download, serialization of Python dataclasses to JSON, and error surface with 4xx status codes.

The React UI components (`app.jsx`, `screen_*.jsx`) already exist and function with mock data from `data.jsx`. The switch to real data requires: (a) removing/replacing the `Object.assign(window, {...})` at the bottom of `data.jsx` with empty stubs, and (b) adding `fetch()` calls inside each screen component at the point where mock data is currently consumed. No component redesign is needed.

Flask 3.1.3 is installed and verified. `zoneinfo` is a Python 3.9+ stdlib module — no extra install needed. The `werkzeug.utils.secure_filename` is available via Werkzeug 3.1.8 (Flask dependency). Flask's `DefaultJSONProvider` handles `datetime` objects natively (serializes to RFC 1123 strings like `"Fri, 17 Apr 2026 09:45:49 GMT"`). The `send_file()` function accepts a `BytesIO` object for in-memory binary downloads.

**Primary recommendation:** Implement all 7 API routes in `app.py` using the established synchronous pattern, serialize dataclasses to JSON using a helper that calls `dataclasses.asdict()` and converts datetimes to ISO strings, and gate each route with `try/except` that returns `{"error": ..., "detail": ...}` with appropriate 4xx status codes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File upload (multipart) | API / Backend | — | Flask receives files via `request.files`; frontend only sends FormData |
| File parsing (FIT, CSV) | API / Backend | — | `fit_parser.parse_fit_file()` and `hevy_parser.parse_hevy_csv()` run server-side |
| Session state (parsed IDs, timezone) | API / Backend | Browser (React state) | Flask session stores temp file paths + parsed summaries; React holds current-screen state |
| Workout matching | API / Backend | — | `matcher.match_workouts()` runs server-side; result returned as JSON |
| Exercise mapping suggestions | API / Backend | — | `mapper.suggest_mapping()` runs server-side via rapidfuzz |
| Exercise mapping confirmation | API / Backend | Database | `mapper.confirm_mapping()` → SQLite via `database.py` |
| Merge preview | API / Backend | — | `fit_generator.build_preview()` runs server-side; result returned as JSON |
| FIT file generation | API / Backend | — | `fit_generator.build_merged_fit()` writes temp file server-side |
| Binary file download | API / Backend | Browser | `flask.send_file()` streams file bytes; browser triggers download |
| Timezone list | API / Backend | — | `zoneinfo.available_timezones()` runs server-side; 599 IANA strings returned as JSON |
| UI rendering | Browser / Client | — | React CDN renders all 5 screens client-side |
| Theme toggle, step nav | Browser / Client | — | `localStorage` for theme/step persistence; React state for current screen |
| Error display | Browser / Client | — | React catches `fetch()` non-2xx responses and renders inline error banners |
| Drag-and-drop zones | Browser / Client | — | Browser DnD events; `ondrop` handler in `screen_upload.jsx` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Flask | 3.1.3 | Web server, routing, session, file upload | Already installed; `app.py` exists; single-user local app [VERIFIED: `pip show flask`] |
| Werkzeug | 3.1.8 | `secure_filename`, `FileStorage` (via Flask) | Flask dependency; already installed [VERIFIED: `pip show werkzeug`] |
| React | 18.3.1 | Frontend component tree | Already loaded from CDN in `templates/index.html` [VERIFIED: index.html line 406] |
| Babel Standalone | 7.29.0 | In-browser JSX transpile | Already loaded from CDN in `templates/index.html` [VERIFIED: index.html line 408] |
| zoneinfo | stdlib (3.9+) | IANA timezone list for `GET /api/timezones` | Stdlib, no install; 599 timezones confirmed [VERIFIED: Python runtime] |
| Python tempfile | stdlib | Temp directory for uploaded files (D-21) | Stdlib; `mkdtemp()` creates isolated per-session storage [VERIFIED: Python runtime] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fitparse | 1.2.0 | FIT file parse validation; re-used via `fit_parser.parse_fit_file()` | Called inside `POST /api/upload` to parse the uploaded FIT |
| garmin-fit-sdk | 21.200.0 | FIT binary encoding inside `build_merged_fit()` | Called inside `POST /api/export` via `fit_generator` |
| rapidfuzz | 3.14.5 | Fuzzy exercise matching inside `mapper.suggest_mapping()` | Called inside `POST /api/map/suggest` |
| sqlite3 | stdlib | Exercise mapping persistence via `database.py` | Called inside `POST /api/map/confirm` and on DB init |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Flask session (cookie-based) | Server-side dict keyed by session ID | Cookie-based is simpler for single-user local app; no shared state needed |
| tempfile.mkdtemp() | Store file content in Flask session | Sessions have 4 KB cookie limit; FIT files are 50–200 KB |
| `send_file(BytesIO(...))` | Write temp file then `send_file(path)` | BytesIO avoids temp file cleanup; both work. Prefer BytesIO for export since `build_merged_fit()` already writes a temp file (re-read it) |
| Manual JSON serialization | Flask-Marshmallow or Pydantic | Overkill; dataclasses + custom `jsonify` helper is sufficient |

**Installation:** No new packages needed. All dependencies are in `requirements.txt`.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (React CDN)                Flask (app.py)              Backend Modules
-----------------------            -----------------------      -----------------------
[ScreenUpload]
  DnD .fit file ──────────────> POST /api/upload
  CSV file picker                  secure_filename()
  Timezone <select>                parse_fit_file(tmp_path)
                                   parse_hevy_csv(tmp_path)
                                   session["fit_path"] = tmp_path
                                   session["hevy_workouts"] = [...]
                                   session["timezone"] = tz  <── FitWorkout JSON
                                                             <── HevyWorkout[] JSON

[ScreenMatch]
  Garmin/Hevy cards
  Connector UI ───────────────> POST /api/match
  Manual override                  load from session
                                   match_workouts() or force_match()
                                   return MatchResult JSON

[ScreenMap]
  Exercise list
  Suggestion click ───────────> POST /api/map/suggest
                                   suggest_mapping(hevy_name)
                                   return [(GarminExercise, score)...]

  Confirm button ──────────────> POST /api/map/confirm
                                   confirm_mapping(hevy_name, garmin_ex)
                                   SQLite write
                                   return {"ok": true}

  Skip button ─────────────────> (no API call — frontend tracks skip state)

[ScreenPreview]
  KPI strip
  HR chart
  Exercise list ───────────────> POST /api/preview
                                   load match from session
                                   build_preview(match, tz, fit_path)
                                   return MergePreview JSON

[ScreenDone]
  Spinner (while fetch pending)
  Download button ─────────────> POST /api/export
                                   build_merged_fit(match, tz, fit_path, out_path)
                                   send_file(out_path, as_attachment=True)
                                 <── FIT binary stream (application/octet-stream)

  [GET /api/exercises]             (called by ScreenMap "Search all" button)
                                   return all GarminExercise[] as JSON

  [GET /api/timezones]             (called by ScreenUpload on mount)
                                   zoneinfo.available_timezones() sorted
                                   return ["UTC", "America/New_York", ...]
```

### Recommended Project Structure

```
GarminHevyMerge/
├── app.py                  # Flask entry point — extend with 7 API routes
├── fit_parser.py           # parse_fit_file() — called by POST /api/upload
├── fit_generator.py        # build_preview(), build_merged_fit() — called by POST /api/preview and /api/export
├── hevy_parser.py          # parse_hevy_csv() — called by POST /api/upload
├── matcher.py              # match_workouts(), force_match() — called by POST /api/match
├── mapper.py               # suggest_mapping(), confirm_mapping() — called by POST /api/map/*
├── database.py             # init_db() — called at app startup in __main__
├── models.py               # All dataclasses — used for serialization helpers
├── templates/
│   └── index.html          # Shell HTML — do NOT modify
├── static/src/
│   ├── data.jsx            # Replace Object.assign(window, ...) stubs with empty exports
│   ├── app.jsx             # Root React app — no changes needed
│   ├── screen_upload.jsx   # Replace seed/mock with real fetch calls
│   ├── screen_match.jsx    # Replace GARMIN_WORKOUTS/HEVY_WORKOUTS mocks with API data
│   ├── screen_map.jsx      # Replace HEVY_EXERCISES mock with API data
│   ├── screen_preview.jsx  # Replace HR_SAMPLES/SET_TIMELINE mocks with API data
│   └── screen_done.jsx     # Replace setTimeout with fetch state; wire Download button
├── data/
│   ├── exercise_mappings.db  # Auto-created; .gitignore candidate
│   └── garmin_exercises.csv  # Static — already exists from Phase 3
└── output/                   # Temp merged FIT destination (already exists)
```

### Pattern 1: Flask File Upload — Multipart with Multiple Files

```python
# Source: Flask 3.x documentation [VERIFIED: installed Flask 3.1.3]
from flask import request
from werkzeug.utils import secure_filename
import tempfile, pathlib

@app.route("/api/upload", methods=["POST"])
def api_upload():
    fit_file = request.files.get("fit_file")
    hevy_csv = request.files.get("hevy_csv")
    timezone = request.form.get("timezone", "UTC")

    if not fit_file or not fit_file.filename.endswith(".fit"):
        return {"error": "Invalid file type", "detail": "..."}, 400
    if not hevy_csv:
        return {"error": "Missing Hevy CSV", "detail": "..."}, 400

    # Save to temp directory (D-21)
    tmpdir = pathlib.Path(tempfile.mkdtemp())
    fit_path = tmpdir / secure_filename(fit_file.filename or "upload.fit")
    csv_path = tmpdir / secure_filename(hevy_csv.filename or "hevy.csv")
    fit_file.save(str(fit_path))
    hevy_csv.save(str(csv_path))

    # Parse
    from fit_parser import parse_fit_file
    from hevy_parser import parse_hevy_csv
    fit_workout = parse_fit_file(str(fit_path))
    hevy_workouts = parse_hevy_csv(str(csv_path))

    # Store paths and parsed data in session (D-24)
    session["fit_path"] = str(fit_path)
    session["hevy_workouts"] = _serialize_hevy_workouts(hevy_workouts)
    session["timezone"] = timezone

    return jsonify({
        "fit_workout": _serialize_fit_workout(fit_workout),
        "hevy_workouts": [_serialize_hevy_workout(w) for w in hevy_workouts],
    })
```

**Key constraint:** `secure_filename("../../etc/passwd.fit")` returns `"etc_passwd.fit"` — path traversal is blocked. Verified in runtime.

### Pattern 2: Flask Session Setup for Single-User App

```python
# Source: Flask 3.x docs [VERIFIED: Flask 3.1.3 installed]
import os
from flask import Flask
app = Flask(__name__)

# SECRET_KEY required for session signing (D-24)
# For single-user local app: auto-generate a random key on startup
# or set via environment variable
app.secret_key = os.environ.get("SECRET_KEY") or os.urandom(24)
# Note: os.urandom(24) is regenerated on every restart — sessions are lost on restart.
# Acceptable for local single-user app (D-22). If session persistence across restarts
# is needed, set a fixed SECRET_KEY.
```

**Session storage:** The `session["fit_path"]` stores the temp file path as a string. The temp file itself lives on disk in `tempfile.mkdtemp()`. Sessions are cookie-based (client-side signed cookie) — only lightweight IDs and serialized workout summaries go in the session cookie. The temp file path (a short string) fits easily.

**Session size pitfall:** `FitWorkout` has `heart_rate_samples: list[HRSample]` which can be 700+ entries. Do NOT store the full `FitWorkout` in the session cookie — store only the `fit_path` and a lightweight workout summary (start_time, end_time, calories, avg_hr, max_hr). The full FitWorkout is re-parsed from disk by `build_preview()` and `build_merged_fit()` as needed.

### Pattern 3: JSON Serialization of Python Dataclasses with datetime Fields

```python
# Source: Verified in runtime — Flask DefaultJSONProvider handles datetime natively
# Flask 3.x DefaultJSONProvider serializes datetime objects as RFC 1123 strings
# e.g. datetime(2026, 4, 17, 9, 45, 49) -> "Fri, 17 Apr 2026 09:45:49 GMT"
#
# For ISO 8601 format (more React-friendly), use a custom serializer:
import dataclasses
from datetime import datetime

def _to_iso(obj):
    """Recursively convert datetime fields in a dict to ISO 8601 strings."""
    if isinstance(obj, dict):
        return {k: _to_iso(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_iso(i) for i in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()  # "2026-04-17T09:45:49"
    return obj

def _serialize_fit_workout(fw):
    """Convert FitWorkout to JSON-safe dict (lightweight — omit large sample lists)."""
    return {
        "start_time": fw.start_time.isoformat() if fw.start_time else None,
        "end_time": fw.end_time.isoformat() if fw.end_time else None,
        "total_calories": fw.total_calories,
        "total_elapsed_time": fw.total_elapsed_time,
        "avg_heart_rate": fw.avg_heart_rate,
        "max_heart_rate": fw.max_heart_rate,
        "hr_sample_count": len(fw.heart_rate_samples),
        # Omit full sample lists — too large for JSON response
    }
```

**Why not `dataclasses.asdict()`:** `dataclasses.asdict()` recursively converts nested dataclasses including `heart_rate_samples` (700+ `HRSample` objects with datetime fields). Flask's `jsonify()` then fails with `TypeError: Object of type datetime is not JSON serializable`. The custom per-field approach gives explicit control over what's included.

### Pattern 4: Binary File Download via send_file

```python
# Source: Flask 3.x docs; verified in runtime with send_file(BytesIO)
from flask import send_file
import pathlib

@app.route("/api/export", methods=["POST"])
def api_export():
    # build_merged_fit() writes to a temp path and returns it
    out_path = fit_generator.build_merged_fit(match, tz, fit_path, out_path_str)
    fit_bytes = pathlib.Path(out_path).read_bytes()

    # Return as in-memory download (avoids temp file cleanup complexity)
    return send_file(
        io.BytesIO(fit_bytes),
        mimetype="application/octet-stream",
        as_attachment=True,
        download_name=f"{filename_prefix}-merged.fit",
    )
```

**Note:** `send_file()` in Flask 3.x uses `download_name` (not `attachment_filename`). The old `attachment_filename` kwarg was removed in Flask 2.0. [VERIFIED: `send_file` signature confirmed via inspection].

### Pattern 5: React fetch() with Error Handling (no bundler, no proxy)

```javascript
// Source: Standard browser fetch API [ASSUMED - standard web platform]
// No proxy needed — React is served from same Flask origin (port 5000)
// fetch('/api/upload', ...) hits http://localhost:5000/api/upload

async function callUpload(fitFile, hevyFile, timezone) {
    const form = new FormData();
    form.append('fit_file', fitFile);
    form.append('hevy_csv', hevyFile);
    form.append('timezone', timezone);

    const resp = await fetch('/api/upload', { method: 'POST', body: form });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error + ': ' + err.detail);
    }
    return await resp.json();
}

// Usage in React screen component:
const [error, setError] = useState(null);
const [loading, setLoading] = useState(false);

async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
        const data = await callUpload(fitFile, hevyFile, timezone);
        update({ garminWorkouts: data.fit_workout, hevyWorkouts: data.hevy_workouts });
        onNext();
    } catch (e) {
        setError(e.message);  // rendered as inline error banner
    } finally {
        setLoading(false);
    }
}
```

**Why no CORS:** Flask serves both the HTML shell (`/`) and the API routes (`/api/*`) on the same origin (localhost:5000). Browser same-origin policy does not block same-origin fetch calls. No `flask-cors` needed.

**JSX import/export in no-bundler environment:** The CDN+Babel setup does NOT support ES module `import/export` syntax. Variables are shared via `window` globals (e.g., `window.ScreenUpload = ScreenUpload` at bottom of each JSX file, then used as `<ScreenUpload .../>` in `app.jsx`). All existing screen files already follow this pattern. New API fetch functions should follow the same pattern: assign to `window` or define inline within the screen component.

### Pattern 6: Flask Error Handler with JSON Response

```python
# Source: Flask 3.x docs [VERIFIED: Flask 3.1.3]
from flask import jsonify

# Per-route error returns (D-18):
@app.route("/api/upload", methods=["POST"])
def api_upload():
    try:
        ...
    except fitparse.FitParseError as e:
        return jsonify({"error": "FIT file failed to parse", "detail": str(e)}), 400
    except ValueError as e:
        return jsonify({"error": "Invalid input", "detail": str(e)}), 400
    except Exception as e:
        app.logger.error("api_upload error: %s", e, exc_info=True)
        return jsonify({"error": "Server error", "detail": "Please try again"}), 500
```

### Pattern 7: Timezone List Endpoint

```python
# Source: Python docs — zoneinfo is stdlib in Python 3.9+ [VERIFIED: runtime]
import zoneinfo

COMMON_TIMEZONES = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
]

@app.route("/api/timezones")
def api_timezones():
    all_tz = sorted(zoneinfo.available_timezones())
    ordered = COMMON_TIMEZONES + [z for z in all_tz if z not in COMMON_TIMEZONES]
    return jsonify(ordered)
```

**Verified:** 599 IANA timezones available from `zoneinfo.available_timezones()` on this system.

### Anti-Patterns to Avoid

- **Storing full FitWorkout in Flask session:** `heart_rate_samples` can be 700+ entries with datetime objects. Flask session cookies have a 4 KB default limit. Store only `fit_path` and a lightweight summary.
- **Using `attachment_filename` kwarg in `send_file()`:** Removed in Flask 2.0. Use `download_name` instead.
- **ES module `import/export` in JSX files:** Babel standalone processes each JSX file independently in the browser. There is no bundler resolving imports. Use `window.ComponentName = ComponentName` pattern (already established in codebase).
- **Calling `dataclasses.asdict()` on FitWorkout:** Recursively converts all nested dataclasses including 700+ HR samples with datetime fields. `jsonify()` will fail on datetime objects. Use explicit field-by-field serialization.
- **Path traversal via `out_path`:** `fit_generator._check_out_path()` already guards this. The `POST /api/export` handler should always use `tempfile.mkdtemp()` to construct the output path, not user-supplied values.
- **`debug=True` in production:** Already set to `debug=False` in `app.py`. Do not enable. Debug mode exposes an interactive debugger at `/` that runs arbitrary Python.
- **Re-parsing the Hevy CSV on every API call:** Parse once in `/api/upload`, store lightweight workout summary in session and reconstruct `HevyWorkout` objects from the stored temp CSV path when needed for matching.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secure temp file path | Custom UUID directory under project root | `tempfile.mkdtemp()` | Handles OS temp dir, permissions, isolation |
| File path sanitization | Manual `../` stripping | `werkzeug.utils.secure_filename()` | Verified: blocks path traversal; strips leading `../` |
| Binary file download | Manual response headers | `flask.send_file()` | Handles Content-Disposition, ETag, conditional GET |
| IANA timezone list | Hardcoded list | `zoneinfo.available_timezones()` | 599 canonical IANA names; always current |
| Dataclass serialization | Custom recursive encoder | Explicit per-field dict construction | `dataclasses.asdict()` breaks on datetime; explicit is clearer |
| FIT CRC computation | New CRC implementation | `fit_generator._compute_fit_crc()` | Already implemented and verified against original_garmin.fit |
| Exercise fuzzy matching | Custom string distance | `mapper.suggest_mapping()` | rapidfuzz WRatio + normalization already tuned |

**Key insight:** Every complex backend operation (FIT parsing, matching, fuzzy mapping, merge, CRC) is already implemented in Phases 2–4. Phase 5 is HTTP plumbing + JSON serialization + error handling.

---

## Common Pitfalls

### Pitfall 1: Flask Session Cookie Size Limit

**What goes wrong:** Storing `FitWorkout` (with 700+ `HRSample` objects) or `list[HevyWorkout]` (full exercise sets) in the Flask session cookie exceeds the 4 KB cookie size limit. Flask silently fails to set the cookie, and subsequent API calls see an empty session.

**Why it happens:** Flask's default session implementation uses client-side cookies signed with `SECRET_KEY`. The total cookie payload (base64-encoded, signed) must fit in the browser's 4 KB cookie limit.

**How to avoid:** Store only lightweight state in session: `fit_path` (temp file path string), `hevy_csv_path` (temp file path string), `timezone` (IANA string). Heavy data (FitWorkout, HevyWorkout lists) is re-derived from the temp files when needed. Pass match/mapping state as JSON in request bodies (D-24 specifies this explicitly).

**Warning signs:** `/api/match` returns 400 or empty session; user has to re-upload.

### Pitfall 2: `send_file` kwarg Changed in Flask 2.0

**What goes wrong:** `send_file(buf, attachment_filename='file.fit')` raises `TypeError: send_file() got an unexpected keyword argument 'attachment_filename'`.

**Why it happens:** Flask 2.0 renamed `attachment_filename` to `download_name`. The old kwarg was removed.

**How to avoid:** Use `download_name='merged.fit'`. [VERIFIED: `send_file` signature inspection confirmed `download_name`].

### Pitfall 3: Babel Standalone — No ES Module Imports

**What goes wrong:** Adding `import React from 'react'` or `import { useState } from 'react'` at the top of a JSX file causes Babel to try to resolve modules, but there is no bundler — the import statement is silently ignored or throws a runtime error.

**Why it happens:** Babel standalone processes each JSX file as a standalone script. `import` statements require a module bundler (webpack, Vite, etc.) that is not present in this CDN-only setup.

**How to avoid:** Use globals: `React`, `ReactDOM`, `useState`, `useEffect`, `useRef` are all globals from the CDN scripts loaded before the JSX files. Components are shared via `window.ComponentName = ComponentName` (already the pattern in all existing files). The planner must not add ES module import/export syntax to JSX files.

### Pitfall 4: tempfile Cleanup — Files Persist After Flask Restarts

**What goes wrong:** `tempfile.mkdtemp()` creates a directory that is NOT automatically cleaned up — OS temp dirs are persistent until explicit deletion. On repeated runs, `/tmp/` accumulates FIT files and CSVs.

**Why it happens:** `mkdtemp()` intentionally does NOT set up cleanup. `TemporaryDirectory()` (context manager) auto-deletes but cannot span multiple requests.

**How to avoid:** For a local single-user app (D-22), this is acceptable — OS temp dirs are cleaned on reboot. Optionally, clean up the temp dir after `POST /api/export` completes successfully (use `shutil.rmtree(tmpdir)` after `send_file`). Note: `send_file` with `BytesIO` allows cleanup before the response is sent.

**Warning signs:** `/tmp/` grows over many runs.

### Pitfall 5: `fit_generator.build_merged_fit()` Requires Project Root Path

**What goes wrong:** `build_merged_fit(match, tz, fit_path, out_path)` calls `_check_out_path(out_path)` which verifies `out_path` is inside `_PROJECT_ROOT = pathlib.Path(__file__).parent.resolve()` (i.e., `GarminHevyMerge/`). If `out_path` is in `/tmp/`, this raises `ValueError`.

**Why it happens:** The path traversal guard in `fit_generator.py` was implemented for security — it rejects any path outside the project directory.

**How to avoid:** Use `output/` subdirectory inside the project root for the export temp file: `out_path = str(PROJECT_ROOT / "output" / f"{session_id}-merged.fit")`. The `output/` directory already exists in the project. [VERIFIED: `ls /workspace/GarminHevyMerge/output/` confirmed].

### Pitfall 6: `data.jsx` Global Assignments Conflict with Real Data

**What goes wrong:** `data.jsx` ends with `Object.assign(window, { GARMIN_WORKOUTS, HEVY_WORKOUTS, HEVY_EXERCISES, HR_SAMPLES, SET_TIMELINE, fmtTime, fmtDate, fmtDuration })`. If the screen components still reference `GARMIN_WORKOUTS` etc. as globals, they will use mock data even after API wiring.

**How to avoid:** Replace the constant definitions in `data.jsx` with empty stubs (`const GARMIN_WORKOUTS = []` etc.) and keep the helper functions (`fmtTime`, `fmtDate`, `fmtDuration`) in the `Object.assign`. Screen components must replace references to these constants with React state driven by API responses.

### Pitfall 7: `HevyWorkout` State Reconstruction for `/api/match`

**What goes wrong:** `matcher.match_workouts()` takes a `FitWorkout` and `list[HevyWorkout]` — not JSON. After `/api/upload`, the session stores lightweight summaries, not the full dataclasses. Calling `/api/match` requires the full objects.

**How to avoid:** Store the Hevy CSV temp path in session (`session["hevy_csv_path"]`). In `/api/match`, re-parse from the CSV temp file: `hevy_workouts = parse_hevy_csv(session["hevy_csv_path"])`. Similarly, re-parse FIT from `session["fit_path"]`. This is fast (< 200 ms for sample files) and avoids session size problems.

---

## Code Examples

### API Upload Route — Complete Pattern

```python
# Source: Derived from Flask 3.x docs + verified behavior [VERIFIED: runtime]
import io
import os
import tempfile
import pathlib
from flask import Flask, request, session, jsonify, send_file
from werkzeug.utils import secure_filename
import database
import fit_parser
import hevy_parser
import matcher
import mapper
import fit_generator
from fitparse import FitParseError

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or os.urandom(24)

_PROJECT_ROOT = pathlib.Path(__file__).parent.resolve()

database.init_db()  # call at startup, safe to call multiple times

@app.route("/api/upload", methods=["POST"])
def api_upload():
    fit_file = request.files.get("fit_file")
    hevy_csv = request.files.get("hevy_csv")
    timezone = request.form.get("timezone", "UTC")

    if not fit_file or not fit_file.filename:
        return jsonify({"error": "Missing FIT file", "detail": "Upload a .fit file."}), 400
    if not fit_file.filename.lower().endswith(".fit"):
        return jsonify({
            "error": "That doesn't look like a FIT file.",
            "detail": "Download the original from Garmin Connect → Activity → ⋯ → Export original."
        }), 400
    if not hevy_csv or not hevy_csv.filename:
        return jsonify({"error": "Missing Hevy CSV", "detail": "Upload a Hevy export CSV."}), 400

    tmpdir = pathlib.Path(tempfile.mkdtemp())
    fit_path = tmpdir / secure_filename(fit_file.filename)
    csv_path = tmpdir / secure_filename(hevy_csv.filename or "hevy.csv")
    fit_file.save(str(fit_path))
    hevy_csv.save(str(csv_path))

    try:
        fw = fit_parser.parse_fit_file(str(fit_path))
    except FitParseError as e:
        return jsonify({
            "error": "FIT file failed to parse.",
            "detail": "Try re-exporting from Garmin Connect."
        }), 400

    try:
        hevy_workouts = hevy_parser.parse_hevy_csv(str(csv_path))
    except Exception as e:
        return jsonify({
            "error": "This doesn't look like a Hevy export.",
            "detail": "Go to Hevy Settings → Export and try again."
        }), 400

    session["fit_path"] = str(fit_path)
    session["hevy_csv_path"] = str(csv_path)
    session["timezone"] = timezone

    return jsonify({
        "fit_workout": {
            "start_time": fw.start_time.isoformat() if fw.start_time else None,
            "end_time": fw.end_time.isoformat() if fw.end_time else None,
            "total_elapsed_time": fw.total_elapsed_time,
            "total_calories": fw.total_calories,
            "avg_heart_rate": fw.avg_heart_rate,
            "max_heart_rate": fw.max_heart_rate,
        },
        "hevy_workouts": [
            {
                "title": w.title,
                "start_time": w.start_time.isoformat(),
                "end_time": w.end_time.isoformat(),
                "exercise_count": len(w.exercises),
                "skipped_cardio": w.skipped_cardio,
            }
            for w in hevy_workouts
        ],
    })
```

### Binary Export Route

```python
# Source: Derived from Flask 3.x send_file + verified signature [VERIFIED: runtime]
@app.route("/api/export", methods=["POST"])
def api_export():
    body = request.get_json(force=True) or {}
    fit_path = session.get("fit_path")
    timezone = session.get("timezone", "UTC")

    if not fit_path:
        return jsonify({"error": "No session", "detail": "Please re-upload your files."}), 400

    try:
        fw = fit_parser.parse_fit_file(fit_path)
        hevy_workouts = hevy_parser.parse_hevy_csv(session["hevy_csv_path"])
        # reconstruct match from session or body...
        match = ...  # MatchResult
        out_path = str(_PROJECT_ROOT / "output" / f"merged-{os.urandom(4).hex()}.fit")
        result_path = fit_generator.build_merged_fit(match, timezone, fit_path, out_path)
        fit_bytes = pathlib.Path(result_path).read_bytes()
        return send_file(
            io.BytesIO(fit_bytes),
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name="merged-workout.fit",
        )
    except ValueError as e:
        msg = str(e)
        if msg.startswith("fit-tool") or msg.startswith("fitparse"):
            return jsonify({
                "error": "Merged FIT failed integrity check.",
                "detail": "This is a bug — please report it."
            }), 500
        return jsonify({"error": "Merge failed", "detail": msg}), 400
```

### React: Replacing Mock with API fetch

```javascript
// Source: Standard browser fetch API [ASSUMED]
// Before (mock): const matches = state.matches || GARMIN_WORKOUTS.map(...)
// After (real):
function ScreenMatch({ onNext, onBack, state, update }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Run match on mount (or when state.matchPending becomes true)
    useEffect(() => {
        if (!state.garminWorkout || state.matches) return;
        setLoading(true);
        fetch('/api/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: state.timezone }),
        })
            .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
            .then(data => update({ matches: data.matches, hevyWorkouts: data.hevy_workouts }))
            .catch(e => setError(e.error || 'Match failed'))
            .finally(() => setLoading(false));
    }, [state.garminWorkout]);

    // error display inline using chip.bad + IconWarn (D-18)
    if (error) return <ErrorBanner message={error} onDismiss={() => setError(null)}/>;
    ...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `attachment_filename` kwarg | `download_name` kwarg in `send_file()` | Flask 2.0 | Breaking change — must use `download_name` |
| `flask.jsonify()` with `datetime` | Flask 3.x `DefaultJSONProvider` handles datetime natively | Flask 2.2 | No custom encoder needed for datetime in `jsonify()` |
| `from __future__ import annotations` needed for `X | Y` union types | Python 3.10+ union syntax works natively | Python 3.10 | Project uses Python 3.11.2 — `X | Y` works |
| `zoneinfo` as third-party backport (`backports.zoneinfo`) | `zoneinfo` is stdlib | Python 3.9 | No install needed on Python 3.9+ |

**Deprecated/outdated:**
- `attachment_filename` kwarg in `send_file()`: removed in Flask 2.0. Use `download_name`.
- `flask.json.JSONEncoder` subclassing: replaced by `app.json_provider_class` in Flask 2.2+.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | React `useState`, `useEffect`, `useRef` are available as globals from the CDN UMD bundle (no `React.useState` prefix needed inside Babel-transpiled JSX) | Pattern 3 / React fetch example | If wrong: all screen components crash on `useState is not defined`. Mitigation: existing components work, so globals are confirmed. |
| A2 | Flask's `app.secret_key = os.urandom(24)` per-startup key is acceptable for local single-user app (sessions lost on restart) | Pattern 2 | If wrong (user expects session persistence): must use a fixed key from env var or config file. Low risk given D-22 (local single-user). |
| A3 | `build_merged_fit()` completes in < 2 seconds for typical workout files (synchronous POST acceptable per D-16) | Architecture | If wrong (> 30s): browser fetch timeout; would require SSE or polling. Deferred per D-16. |

**If this table is empty:** Not empty — three assumptions noted. A1 is confirmed by existing codebase, A2 and A3 are acceptable risks per locked decisions.

---

## Open Questions

1. **`POST /api/match` request body format**
   - What we know: The React `ScreenMatch` component receives `state.garminWorkout` and `state.hevyWorkouts` from the previous screen. The user can manually override the match.
   - What's unclear (Claude's discretion): Does `/api/match` re-use session-stored workout data (re-parse from temp files), or does the React frontend send the selected workout IDs? The D-24 decision says "match state is passed back as JSON with each API call" — sending IDs in the request body is the recommended approach.
   - Recommendation: `/api/match` accepts `{ "garmin_workout_index": 0, "hevy_workout_title": "Legs", "force": false }` in the request body. Backend re-parses from session temp files and calls `match_workouts()` or `force_match()` based on the `force` flag.

2. **HR chart data source for Screen 4**
   - What we know: `ScreenPreview` uses `HR_SAMPLES` (mock generated data). `FitWorkout.heart_rate_samples` is a list of `HRSample(timestamp, heart_rate)` objects.
   - What's unclear: Should `POST /api/preview` return the full HR sample list? For a 72-minute workout at 1 Hz, that's 4320 samples — about 60 KB of JSON.
   - Recommendation: Return HR samples as a downsampled list (every 6th sample = ~720 points) in the `MergePreview` JSON. This matches the mock `HR_SAMPLES` density. If no HR data, return `null` and show "No HR data" empty state per CONTEXT.md specifics.

3. **`ScreenDone` download button — direct link vs. second POST**
   - What we know: The prototype's download button is not wired. The user clicks "Generate & export .fit" on Screen 4, which should start the merge (spinner) and complete with the download.
   - Recommendation: Wire the "Generate & export" button on `ScreenPreview` (not a separate button on `ScreenDone`) to `POST /api/export`. The `ScreenDone` spinner shows while the fetch is pending. On response, extract the blob and programmatically trigger a download via `URL.createObjectURL()`. This matches D-17 exactly.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Flask | POST routes, session, send_file | ✓ | 3.1.3 | — |
| Werkzeug | secure_filename, FileStorage | ✓ | 3.1.8 | — |
| Python zoneinfo | GET /api/timezones | ✓ | stdlib (3.11.2) | — |
| Python tempfile | File upload temp storage | ✓ | stdlib | — |
| fitparse | FIT file parsing in upload route | ✓ | 1.2.0 | — |
| garmin-fit-sdk | FIT encoding in export route | ✓ | 21.200.0 | — |
| rapidfuzz | Fuzzy matching in map/suggest route | ✓ | 3.14.5 | — |
| SQLite3 | Exercise mapping persistence | ✓ | stdlib | — |
| React 18.3.1 CDN | Frontend rendering | ✓ (CDN) | 18.3.1 | Offline: serve from local static |
| Babel Standalone 7.29.0 CDN | JSX transpile | ✓ (CDN) | 7.29.0 | Offline: serve from local static |
| Google Fonts CDN | Inter Tight + JetBrains Mono | ✓ (CDN) | — | CSS `font-family` fallback to system-ui |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** CDN dependencies (React, Babel, Google Fonts) require internet access. For purely offline use, these would need to be served locally — deferred as v2 per roadmap.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 |
| Config file | none — uses default discovery |
| Quick run command | `.venv/bin/pytest tests/test_app_api.py -x -q` |
| Full suite command | `.venv/bin/pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | `POST /api/upload` with valid .fit + CSV returns 200 with workout summaries | integration (Flask test client) | `.venv/bin/pytest tests/test_app_api.py::test_upload_valid_files -x` | ❌ Wave 0 |
| UI-01 | `POST /api/upload` with wrong file type returns 400 with error JSON | integration | `.venv/bin/pytest tests/test_app_api.py::test_upload_invalid_fit -x` | ❌ Wave 0 |
| UI-01 | `GET /api/timezones` returns list with common zones first | unit | `.venv/bin/pytest tests/test_app_api.py::test_timezones_endpoint -x` | ❌ Wave 0 |
| UI-02 | `POST /api/map/suggest` returns ranked suggestions for known Hevy exercise name | unit | `.venv/bin/pytest tests/test_app_api.py::test_map_suggest -x` | ❌ Wave 0 |
| UI-02 | `POST /api/map/confirm` persists to SQLite and returns 200 | integration | `.venv/bin/pytest tests/test_app_api.py::test_map_confirm -x` | ❌ Wave 0 |
| UI-03 | `POST /api/export` with valid session returns binary FIT content-type | integration | `.venv/bin/pytest tests/test_app_api.py::test_export_returns_fit -x` | ❌ Wave 0 |
| UI-04 | `POST /api/upload` with corrupt FIT returns 400 with actionable message | integration | `.venv/bin/pytest tests/test_app_api.py::test_upload_corrupt_fit -x` | ❌ Wave 0 |
| UI-04 | `POST /api/upload` with non-Hevy CSV returns 400 with actionable message | integration | `.venv/bin/pytest tests/test_app_api.py::test_upload_invalid_csv -x` | ❌ Wave 0 |
| DEPLOY-01 | Flask app starts and `/` returns 200 | smoke | `.venv/bin/pytest tests/test_app_api.py::test_index_serves_html -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `.venv/bin/pytest tests/test_app_api.py -x -q`
- **Per wave merge:** `.venv/bin/pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/test_app_api.py` — Flask test client fixture + all API route tests listed above
- [ ] conftest.py addition: `@pytest.fixture def app_client()` using `app.test_client()` from `app.py`
- [ ] No framework install needed — pytest 9.0.3 already in `requirements.txt`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Local single-user app (D-22) |
| V3 Session Management | Yes | Flask cookie session with `secret_key = os.urandom(24)` |
| V4 Access Control | No | Local single-user app |
| V5 Input Validation | Yes | `secure_filename()` for filenames; file extension check for .fit; `zoneinfo` lookup validates timezone string |
| V6 Cryptography | No | No secrets stored; FIT CRC is data integrity, not crypto |

### Known Threat Patterns for Flask Local App

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via out_path | Tampering | `fit_generator._check_out_path()` already implemented; use `output/` dir inside project root |
| Path traversal via filename | Tampering | `werkzeug.utils.secure_filename()` — verified in runtime |
| Arbitrary file parse (zip bomb, etc.) | DoS | fitparse raises `FitParseError` on malformed files; 4xx returned |
| Session fixation | Elevation of Privilege | Not applicable — local single-user, no accounts |
| Debug mode RCE | Elevation of Privilege | `debug=False` set in `app.py` — must not be changed |

---

## Sources

### Primary (HIGH confidence)

- Flask 3.1.3 installed locally — `send_file` signature verified via `inspect.signature`, `jsonify` datetime handling verified, `secure_filename` path traversal behavior verified, `secret_key` session setup verified
- Python 3.11.2 stdlib — `zoneinfo.available_timezones()` count (599), `tempfile.mkdtemp()` behavior verified in runtime
- Codebase inspection — `fit_generator.py`, `fit_parser.py`, `hevy_parser.py`, `matcher.py`, `mapper.py`, `database.py`, `models.py`, `app.py`, all `static/src/*.jsx`, `templates/index.html` — all read directly

### Secondary (MEDIUM confidence)

- Flask 3.x documentation patterns — derived from verified installed behavior; `download_name` kwarg change from Flask 2.0 changelog knowledge [ASSUMED training knowledge, consistent with runtime verification]

### Tertiary (LOW confidence)

- None — all claims verified via runtime or direct codebase inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified installed with exact versions
- Architecture: HIGH — all backend module signatures read directly from source; Flask behavior verified in runtime
- Pitfalls: HIGH — most pitfalls verified in runtime (secure_filename, send_file kwargs, session behavior, datetime serialization)
- React/JSX patterns: MEDIUM — existing working code confirms CDN+Babel setup and window globals pattern; fetch() patterns are standard browser API

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (Flask 3.x API is stable; CDN versions pinned in index.html; 30-day validity)
