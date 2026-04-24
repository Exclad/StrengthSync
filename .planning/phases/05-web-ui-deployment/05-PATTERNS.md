# Phase 5: Web UI + Deployment — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 9 (7 modified, 1 new test file, 1 new conftest addition)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app.py` | controller | request-response | `app.py` (existing skeleton) + `tests/test_matcher.py` (error pattern) | exact — extend in place |
| `static/src/data.jsx` | utility | transform | `static/src/data.jsx` (self — keep helpers, remove mocks) | exact |
| `static/src/screen_upload.jsx` | component | request-response | `static/src/screen_match.jsx` (fetch + state pattern) | role-match |
| `static/src/screen_match.jsx` | component | request-response | `static/src/screen_upload.jsx` (state/update pattern) | role-match |
| `static/src/screen_map.jsx` | component | request-response | `static/src/screen_match.jsx` (fetch + state pattern) | role-match |
| `static/src/screen_preview.jsx` | component | request-response | `static/src/screen_map.jsx` (fetch + state pattern) | role-match |
| `static/src/screen_done.jsx` | component | request-response + file-I/O | `static/src/screen_done.jsx` (self — replace setTimeout with fetch) | exact |
| `tests/test_app_api.py` | test | request-response | `tests/test_matcher.py` + `tests/conftest.py` | role-match |
| `tests/conftest.py` | config | — | `tests/conftest.py` (self — add `app_client` fixture) | exact |

---

## Pattern Assignments

### `app.py` (controller, request-response)

**Analog:** `app.py` (existing skeleton, lines 1–19) extended with patterns from RESEARCH.md verified examples.

**Existing imports + app object** (lines 1–5 of current `app.py`):
```python
import threading
import webbrowser
from flask import Flask, render_template

app = Flask(__name__)
```

**Imports to add** (prepend to existing imports):
```python
import io
import os
import pathlib
import tempfile
import zoneinfo
from flask import Flask, jsonify, render_template, request, send_file, session
from werkzeug.utils import secure_filename
import database
import fit_parser
import fit_generator
import hevy_parser
import mapper
import matcher
from fitparse import FitParseError
```

**SECRET_KEY + project root pattern** (insert after `app = Flask(__name__)`):
```python
app.secret_key = os.environ.get("SECRET_KEY") or os.urandom(24)
_PROJECT_ROOT = pathlib.Path(__file__).parent.resolve()
```

**Route skeleton pattern** (all 7 routes follow this structure — try/except with `{"error": ..., "detail": ...}` 4xx):
```python
@app.route("/api/upload", methods=["POST"])
def api_upload():
    try:
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
        tmpdir = pathlib.Path(tempfile.mkdtemp())
        fit_path = tmpdir / secure_filename(fit_file.filename)
        csv_path = tmpdir / secure_filename(hevy_csv.filename or "hevy.csv")
        fit_file.save(str(fit_path))
        hevy_csv.save(str(csv_path))
        fw = fit_parser.parse_fit_file(str(fit_path))
        hevy_workouts = hevy_parser.parse_hevy_csv(str(csv_path))
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
    except FitParseError:
        return jsonify({"error": "FIT file failed to parse.", "detail": "Try re-exporting from Garmin Connect."}), 400
    except Exception as e:
        return jsonify({"error": "Upload failed", "detail": str(e)}), 500
```

**Binary export pattern** (use `download_name`, NOT `attachment_filename` — removed in Flask 2.0):
```python
@app.route("/api/export", methods=["POST"])
def api_export():
    try:
        fit_path = session.get("fit_path")
        if not fit_path:
            return jsonify({"error": "No session", "detail": "Please re-upload your files."}), 400
        body = request.get_json(force=True) or {}
        # reconstruct match from session paths + body...
        out_path = str(_PROJECT_ROOT / "output" / f"merged-{os.urandom(4).hex()}.fit")
        result_path = fit_generator.build_merged_fit(match, session["timezone"], fit_path, out_path)
        fit_bytes = pathlib.Path(result_path).read_bytes()
        return send_file(
            io.BytesIO(fit_bytes),
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name="merged-workout.fit",    # Flask 2.0+ — NOT attachment_filename
        )
    except ValueError as e:
        return jsonify({"error": "Merge failed", "detail": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Export error", "detail": str(e)}), 500
```

**Timezone endpoint** (simple GET, no try/except needed — `zoneinfo` stdlib never throws):
```python
_COMMON_TIMEZONES = [
    "UTC", "America/New_York", "America/Chicago", "America/Denver",
    "America/Los_Angeles", "America/Sao_Paulo", "Europe/London",
    "Europe/Paris", "Europe/Berlin", "Asia/Kolkata",
    "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney",
]

@app.route("/api/timezones")
def api_timezones():
    all_tz = sorted(zoneinfo.available_timezones())
    ordered = _COMMON_TIMEZONES + [z for z in all_tz if z not in _COMMON_TIMEZONES]
    return jsonify(ordered)
```

**DB init at startup** (insert before `if __name__ == "__main__":` block):
```python
database.init_db()   # idempotent — safe to call on every startup (see test_init_db_idempotent)
```

**Existing `__main__` block** — keep exactly as-is (lines 17–19 of current `app.py`):
```python
if __name__ == "__main__":
    threading.Timer(1.0, _open_browser).start()
    app.run(debug=False, port=5000)
```

**Session size constraint** (critical — do NOT store full FitWorkout or HevyWorkout lists in session):
- Store only: `session["fit_path"]`, `session["hevy_csv_path"]`, `session["timezone"]`
- `FitWorkout.heart_rate_samples` can be 700+ entries with datetime objects — storing it would exceed Flask's 4 KB cookie limit silently
- Heavy objects are re-parsed from temp files per-request (fast: < 200 ms for sample files)

**Output path constraint** (critical — `fit_generator._check_out_path()` rejects paths outside project root):
```python
# CORRECT: use project output/ dir
out_path = str(_PROJECT_ROOT / "output" / f"merged-{os.urandom(4).hex()}.fit")
# WRONG: tempfile.mkdtemp() path will fail _check_out_path() guard
```

---

### `static/src/data.jsx` (utility, transform)

**Analog:** `static/src/data.jsx` (self — lines 180–197 are the only lines that change)

**Keep unchanged** (lines 171–197 helpers + mulberry32 function):
```javascript
function mulberry32(a) { ... }   // lines 171–178 — keep for any procedural data still needed
function fmtTime(iso) { ... }    // line 180–183 — keep
function fmtDate(iso) { ... }    // line 184–187 — keep
function fmtDuration(sec) { ... } // line 188–192 — keep
```

**Replace mock constant definitions** (lines 1–169 — replace with empty stubs):
```javascript
// Replace the large mock constant blocks with empty stubs.
// Screen components will drive state from API responses, not these globals.
const GARMIN_WORKOUTS = [];
const HEVY_WORKOUTS = [];
const HEVY_EXERCISES = [];
const HR_SAMPLES = [];
const SET_TIMELINE = [];
```

**Keep `Object.assign` export** (line 194–197 — keep, since helpers are still needed as globals):
```javascript
Object.assign(window, {
  GARMIN_WORKOUTS, HEVY_WORKOUTS, HEVY_EXERCISES, HR_SAMPLES, SET_TIMELINE,
  fmtTime, fmtDate, fmtDuration,
});
```

**Anti-pattern to avoid:** Do NOT use ES module `import/export` syntax. The CDN+Babel setup has no bundler. All sharing is via `window` globals (already established — see `window.ScreenUpload = ScreenUpload` at line 229 of `screen_upload.jsx`).

---

### `static/src/screen_upload.jsx` (component, request-response)

**Analog:** `static/src/screen_match.jsx` (state/update pattern); `static/src/screen_upload.jsx` (self — existing DnD structure preserved)

**State additions** (add to existing component — these parallel the `useState` pattern in `screen_match.jsx` lines 3–8):
```javascript
function ScreenUpload({ onNext, state, update }) {
  const fitInput = useRef(null);
  const hevyCsvInput = useRef(null);   // new: ref for CSV file input
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timezones, setTimezones] = useState([]);
  const [tzFilter, setTzFilter] = useState("");
  const [timezone, setTimezone] = useState("UTC");
```

**Timezone fetch on mount** (copy `useEffect` pattern from `app.jsx` lines 45–48; adapt for `/api/timezones`):
```javascript
useEffect(() => {
    fetch('/api/timezones')
        .then(r => r.json())
        .then(list => setTimezones(list))
        .catch(() => setTimezones(["UTC"]));   // graceful fallback
}, []);
```

**Continue button handler** (replaces the existing `onNext` call; follows error-surface pattern from D-18/D-19):
```javascript
async function handleContinue() {
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append('fit_file', state.fitFileObj);    // real File object stored in state
    form.append('hevy_csv', state.hevyCsvObj);    // real File object stored in state
    form.append('timezone', timezone);
    try {
        const resp = await fetch('/api/upload', { method: 'POST', body: form });
        if (!resp.ok) {
            const err = await resp.json();
            setError(err.error + (err.detail ? ' ' + err.detail : ''));
            return;
        }
        const data = await resp.json();
        update({ uploadResult: data, timezone });
        onNext();
    } catch (e) {
        setError('Upload failed. Check your connection and try again.');
    } finally {
        setLoading(false);
    }
}
```

**Error banner pattern** (D-18 — inline banner using existing chip + icon classes; see `screen_map.jsx` lines 218–220 for `chip bad` usage):
```javascript
{error && (
    <div className="row" style={{ padding: "12px 16px", background: "color-mix(in oklab, var(--bad) 10%, transparent)", border: "1px solid var(--bad)", borderRadius: 10, marginTop: 12 }}>
        <IconWarn size={14} style={{ color: "var(--bad)", flexShrink: 0 }}/>
        <span style={{ fontSize: 13, color: "var(--ink)" }}>{error}</span>
        <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => setError(null)}><IconX size={12}/></button>
    </div>
)}
```

**`canContinue` gate** — update to require real File objects AND timezone:
```javascript
const canContinue = state.fitFileObj && state.hevyCsvObj && timezone && !loading;
```

**`addFiles` update** — store the actual `File` object for upload (current code only stores metadata):
```javascript
const addFiles = (files) => {
    const f = Array.from(files).find(f => f.name.toLowerCase().endsWith('.fit'));
    if (!f) return;
    update({
        fitFileObj: f,        // real File object needed for FormData
        fitFiles: [{ id: Math.random().toString(36).slice(2), name: f.name, size: f.size, date: new Date(f.lastModified).toLocaleString() }]
    });
};
```

**`window` export** — unchanged (keep line 229: `window.ScreenUpload = ScreenUpload`).

---

### `static/src/screen_match.jsx` (component, request-response)

**Analog:** `static/src/screen_match.jsx` (self) + `screen_upload.jsx` handleContinue pattern

**Current mock references to replace:**
- Line 3: `state.matches || GARMIN_WORKOUTS.map(...)` → `state.matches || []`
- Line 15: `const findHevy = (id) => HEVY_WORKOUTS.find(...)` → find from `state.uploadResult.hevy_workouts`
- Line 16: `const findGarmin = (id) => GARMIN_WORKOUTS.find(...)` → find from `state.uploadResult.fit_workout`
- Line 38: `HEVY_WORKOUTS.length` → `(state.uploadResult?.hevy_workouts || []).length`
- Line 40: `GARMIN_WORKOUTS.map(g => {...})` → `[state.uploadResult?.fit_workout].filter(Boolean).map(...)`

**`useEffect` fetch on mount** (trigger auto-match when screen is entered):
```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
    if (!state.uploadResult || state.matchResult) return;
    setLoading(true);
    fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: state.timezone }),
    })
        .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
        .then(data => update({ matchResult: data }))
        .catch(e => setError(e.error || 'Match failed'))
        .finally(() => setLoading(false));
}, [state.uploadResult]);
```

**`window` export** — unchanged (keep line 219: `window.ScreenMatch = ScreenMatch`).

---

### `static/src/screen_map.jsx` (component, request-response)

**Analog:** `static/src/screen_map.jsx` (self) + `screen_match.jsx` fetch pattern

**Current mock reference to replace:**
- Line 3: `state.exercises || HEVY_EXERCISES` → `state.exercises || []`

**`useEffect` fetch on mount** (load exercises with pre-applied confirmed mappings):
```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
    if (state.exercises || !state.matchResult) return;
    setLoading(true);
    fetch('/api/map/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match: state.matchResult }),
    })
        .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
        .then(data => update({ exercises: data.exercises }))
        .catch(e => setError(e.error || 'Failed to load exercises'))
        .finally(() => setLoading(false));
}, [state.matchResult]);
```

**`accept` handler — wire to `/api/map/confirm`** (in addition to updating local state):
```javascript
const accept = (exId, garminKey, label, garminEnumInt) => {
    // Persist to SQLite — fire and forget (no need to await for UI flow)
    fetch('/api/map/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hevy_name: exercises.find(e => e.id === exId)?.hevy, garmin_key: garminKey }),
    }).catch(err => console.warn('confirm_mapping failed:', err));
    // Update local state immediately (optimistic)
    setExercises(exercises.map(e => e.id === exId ? { ...e, garmin: garminKey, garminLabel: label, status: "mapped", confidence: 1 } : e));
    const idx = exercises.findIndex(e => e.id === exId);
    const next = exercises.slice(idx + 1).find(e => e.status !== "mapped") || exercises.find(e => e.status !== "mapped" && e.id !== exId);
    if (next) setSelectedId(next.id);
};
```

**Suggestion fetch** (wires the "AI suggestions" panel to `/api/map/suggest` — called when user views an UNRESOLVED exercise):
```javascript
const [suggestions, setSuggestions] = useState(null);

useEffect(() => {
    if (!selected || selected.status === "mapped") return;
    fetch('/api/map/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hevy_name: selected.hevy }),
    })
        .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
        .then(data => setSuggestions(data.suggestions))
        .catch(() => setSuggestions([]));
}, [selected?.id]);
```

**"Search all Garmin exercises" — wire to `GET /api/exercises`** (lazy load on button click):
```javascript
const [allExercises, setAllExercises] = useState(null);

const loadAllExercises = () => {
    if (allExercises) return;
    fetch('/api/exercises')
        .then(r => r.json())
        .then(data => setAllExercises(data.exercises));
};
```

**`window` export** — unchanged (keep line 340: `window.ScreenMap = ScreenMap`).

---

### `static/src/screen_preview.jsx` (component, request-response)

**Analog:** `static/src/screen_preview.jsx` (self) + fetch pattern from `screen_match.jsx`

**Current mock references to replace:**
- `HR_SAMPLES` in `HRChart()` component (line 170) → `props.hrSamples || []`
- `SET_TIMELINE` in `HRChart()` (line 188) and exercise breakdown (line 59) → from API response
- `HEVY_EXERCISES` in exercise breakdown (line 60) → from API response

**`useEffect` fetch on mount** (load preview data from `/api/preview`):
```javascript
function ScreenPreview({ onNext, onBack, state, update }) {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (previewData || !state.matchResult) return;
    setLoading(true);
    fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            match: state.matchResult,
            exercises: state.exercises,
        }),
    })
        .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
        .then(data => setPreviewData(data))
        .catch(e => setError(e.error || 'Preview failed'))
        .finally(() => setLoading(false));
  }, [state.matchResult]);
```

**KPI strip** — replace hardcoded values with `previewData.biometric_summary` fields:
```javascript
// previewData.biometric_summary fields:
// total_elapsed_time (seconds), total_calories, avg_heart_rate, max_heart_rate
// exercise_count (count of after_sets unique exercises), total_volume_kg
<KPI label="Duration"  value={fmtDuration(previewData?.biometric_summary?.total_elapsed_time || 0)} .../>
<KPI label="Avg HR"    value={previewData?.biometric_summary?.avg_heart_rate || "—"} .../>
```

**HR chart** — pass `previewData.hr_samples` to `HRChart` component (downsample on server to ~720 pts per RESEARCH.md recommendation; show "No HR data" empty state when `null`):
```javascript
{previewData?.hr_samples
    ? <HRChart samples={previewData.hr_samples} setTimeline={previewData.set_timeline}/>
    : <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>No HR data from this workout.</div>
}
```

**"Generate & export .fit" button** — triggers `POST /api/export` (NOT just `onNext`):
```javascript
async function handleExport() {
    setLoading(true);
    setError(null);
    onNext();   // advance to ScreenDone (shows spinner) before fetch completes
    try {
        const resp = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ match: state.matchResult, exercises: state.exercises }),
        });
        if (!resp.ok) {
            const err = await resp.json();
            update({ exportError: err.error });
            return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        update({ exportUrl: url, exportFilename: "merged-workout.fit" });
    } catch (e) {
        update({ exportError: 'Export failed. Try again.' });
    } finally {
        setLoading(false);
    }
}
```

**`window` export** — unchanged (keep line 239: `window.ScreenPreview = ScreenPreview`).

---

### `static/src/screen_done.jsx` (component, request-response + file-I/O)

**Analog:** `static/src/screen_done.jsx` (self — replace `setTimeout` with export fetch state)

**Current mock to replace** (lines 4–8 — `setTimeout 1800` replaced by actual fetch state):
```javascript
// BEFORE (mock):
const [phase, setPhase] = useState("generating");
useEffect(() => {
    const t = setTimeout(() => setPhase("ready"), 1800);
    return () => clearTimeout(t);
}, []);

// AFTER (real): phase is driven by state.exportUrl from ScreenPreview fetch
// ScreenDone receives the URL once POST /api/export completes
function ScreenDone({ onRestart, state }) {
  const phase = state.exportUrl ? "ready" : (state.exportError ? "error" : "generating");
```

**Download button** — trigger browser download via `URL.createObjectURL` (no second fetch needed):
```javascript
// In the "ready" phase, wire the Download button:
<button
    className="btn btn-primary btn-xl"
    onClick={() => {
        const a = document.createElement('a');
        a.href = state.exportUrl;
        a.download = state.exportFilename || 'merged-workout.fit';
        a.click();
    }}
>
    <IconDownload size={18}/> Download
</button>
```

**Error state** (new phase = "error" — use same inline banner pattern as other screens):
```javascript
{phase === "error" && (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <span className="chip bad"><IconWarn size={11}/> EXPORT FAILED</span>
        <h1 className="h-display" style={{ fontSize: 40 }}>Something went wrong.</h1>
        <p className="h-sub">{state.exportError}</p>
        <button className="btn btn-ghost" onClick={onRestart}>
            <IconRefresh size={14}/> Start over
        </button>
    </div>
)}
```

**File metadata** — replace hardcoded filename/size/checksum with values from API response when available:
```javascript
// state.exportFilename — from Content-Disposition header or default "merged-workout.fit"
// state.exportSize — from blob.size (bytes)
```

**`window` export** — unchanged (keep line 115: `window.ScreenDone = ScreenDone`).

---

### `tests/test_app_api.py` (test, request-response)

**Analog:** `tests/test_matcher.py` (test structure, fixtures, assert style) + `tests/conftest.py` (fixture pattern)

**Test file structure** (copy from `tests/test_matcher.py` lines 1–12):
```python
"""Flask test client tests for Phase 5 API routes.

UI-01: /api/upload and /api/timezones
UI-02: /api/map/suggest and /api/map/confirm
UI-03: /api/export returns binary FIT
UI-04: Error responses for invalid inputs
DEPLOY-01: / returns 200 HTML
"""
import pytest
import io
import pathlib
```

**`app_client` fixture** (add to `tests/conftest.py` alongside existing fixtures, following the same `@pytest.fixture` pattern from lines 15–19 of `conftest.py`):
```python
@pytest.fixture
def app_client():
    """Flask test client with testing mode enabled and isolated session."""
    import app as flask_app
    flask_app.app.config["TESTING"] = True
    flask_app.app.config["SECRET_KEY"] = "test-secret-key"
    with flask_app.app.test_client() as client:
        yield client
```

**Upload test pattern** (follows `test_match_singapore_timezone` style from `test_matcher.py` lines 36–44 — arrange/act/assert):
```python
def test_upload_valid_files(app_client, sample_fit_path, sample_hevy_path):
    """UI-01: POST /api/upload with valid files returns 200 with workout summaries."""
    with open(sample_fit_path, "rb") as f_fit, open(sample_hevy_path, "rb") as f_hevy:
        resp = app_client.post("/api/upload", data={
            "fit_file": (f_fit, "test.fit"),
            "hevy_csv": (f_hevy, "hevy.csv"),
            "timezone": "Asia/Singapore",
        }, content_type="multipart/form-data")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "fit_workout" in data
    assert "hevy_workouts" in data
    assert data["fit_workout"]["start_time"] is not None


def test_upload_invalid_fit(app_client, sample_hevy_path):
    """UI-04: POST /api/upload with wrong file type returns 400 with actionable message."""
    with open(sample_hevy_path, "rb") as f_hevy:
        resp = app_client.post("/api/upload", data={
            "fit_file": (io.BytesIO(b"not a fit file"), "workout.txt"),
            "hevy_csv": (f_hevy, "hevy.csv"),
            "timezone": "UTC",
        }, content_type="multipart/form-data")
    assert resp.status_code == 400
    data = resp.get_json()
    assert "error" in data
    assert "detail" in data


def test_timezones_endpoint(app_client):
    """UI-01: GET /api/timezones returns list with UTC first."""
    resp = app_client.get("/api/timezones")
    assert resp.status_code == 200
    zones = resp.get_json()
    assert isinstance(zones, list)
    assert zones[0] == "UTC"
    assert "America/New_York" in zones


def test_map_suggest(app_client):
    """UI-02: POST /api/map/suggest returns ranked suggestions."""
    resp = app_client.post("/api/map/suggest",
        json={"hevy_name": "Bench Press (Barbell)"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert "suggestions" in data
    assert len(data["suggestions"]) > 0
    assert "label" in data["suggestions"][0]
    assert "score" in data["suggestions"][0]


def test_index_serves_html(app_client):
    """DEPLOY-01: GET / returns 200 with HTML content."""
    resp = app_client.get("/")
    assert resp.status_code == 200
    assert b"html" in resp.data.lower()
```

**Import pattern** (copy from `test_mapper.py` lines 7–17 — explicit named imports, no wildcard):
```python
from mapper import suggest_mapping, UNRESOLVED_THRESHOLD
from database import init_db
```

---

## Shared Patterns

### Error Response Format
**Source:** RESEARCH.md Pattern 6 (verified against Flask 3.1.3)
**Apply to:** All 7 API routes in `app.py`
```python
return jsonify({"error": "Human-readable message.", "detail": "Actionable instruction."}), 400
```
The `error` key is the display string shown in the React inline banner. The `detail` key is the actionable guidance. Both keys must always be present — React expects them on any non-2xx response.

### Session Keys (Lightweight Only)
**Source:** RESEARCH.md Pitfall 1 (session cookie 4 KB limit)
**Apply to:** `api_upload`, `api_match`, `api_preview`, `api_export`
```python
# STORE (lightweight strings only):
session["fit_path"]      = str(fit_path)       # temp file path
session["hevy_csv_path"] = str(csv_path)       # temp file path
session["timezone"]      = timezone            # IANA string

# NEVER store: FitWorkout, HevyWorkout[], MergePreview (all have datetime fields + large lists)
# RE-PARSE per request: fw = fit_parser.parse_fit_file(session["fit_path"])
```

### React State Propagation via `update()`
**Source:** `static/src/app.jsx` lines 35–42 (established pattern in ALL screen components)
**Apply to:** All screen component fetch handlers
```javascript
// app.jsx defines:
const [appState, setAppState] = useState({ fitFiles: [], hevyMode: null, ... });
const update = (patch) => setAppState(s => ({ ...s, ...patch }));

// Screen components call update() to add API results to shared state:
update({ uploadResult: data, timezone });       // after /api/upload
update({ matchResult: data });                  // after /api/match
update({ exercises: data.exercises });          // after /api/map/exercises
update({ exportUrl: url, exportFilename });     // after /api/export
```
New state keys added to `appState` in `app.jsx` initial state: `uploadResult`, `timezone`, `matchResult`, `exportUrl`, `exportFilename`, `exportError`.

### `window` Global Export (Babel CDN — No Module Bundler)
**Source:** All existing `static/src/*.jsx` files (established project convention)
**Apply to:** All JSX files — existing exports must not be removed; new helper functions go inline
```javascript
// Each JSX file ends with one line — keep exactly as-is:
window.ScreenUpload = ScreenUpload;   // screen_upload.jsx line 229
window.ScreenMatch = ScreenMatch;     // screen_match.jsx line 219
window.ScreenMap = ScreenMap;         // screen_map.jsx line 340
window.ScreenPreview = ScreenPreview; // screen_preview.jsx line 239
window.ScreenDone = ScreenDone;       // screen_done.jsx line 115
```
Anti-pattern: `import React from 'react'` — will fail silently. Use `React`, `useState`, `useEffect`, `useRef` as globals.

### JSON Serialization for datetime Fields
**Source:** RESEARCH.md Pattern 3 (verified — `dataclasses.asdict()` breaks on datetime)
**Apply to:** All `jsonify()` calls in `app.py` that touch `FitWorkout`, `HevyWorkout`, `MergePreview`
```python
# CORRECT — explicit per-field dict (never dataclasses.asdict() on FitWorkout):
{
    "start_time": fw.start_time.isoformat() if fw.start_time else None,
    "end_time": fw.end_time.isoformat() if fw.end_time else None,
    "total_elapsed_time": fw.total_elapsed_time,
    "total_calories": fw.total_calories,
    "avg_heart_rate": fw.avg_heart_rate,
    "max_heart_rate": fw.max_heart_rate,
}
# WRONG — dataclasses.asdict(fw) includes 700+ HRSample objects with datetime — jsonify() fails
```

### Output Path for `build_merged_fit()`
**Source:** RESEARCH.md Pitfall 5 (verified — `_check_out_path()` rejects `/tmp/` paths)
**Apply to:** `api_export` route only
```python
# CORRECT — inside project root:
out_path = str(_PROJECT_ROOT / "output" / f"merged-{os.urandom(4).hex()}.fit")
# WRONG — /tmp/ path raises ValueError from fit_generator._check_out_path():
out_path = str(pathlib.Path(tempfile.mkdtemp()) / "merged.fit")
```

---

## No Analog Found

All files have close matches in the codebase or research docs. No files in this phase require novel patterns beyond what is covered above.

---

## Metadata

**Analog search scope:** `/workspace/GarminHevyMerge/` — all `.py` and `.jsx` files
**Files scanned:** 19 (app.py, models.py, fit_parser.py, hevy_parser.py, matcher.py, mapper.py, fit_generator.py, database.py, all 7 static/src/*.jsx, conftest.py, test_matcher.py, test_mapper.py)
**Pattern extraction date:** 2026-04-24
