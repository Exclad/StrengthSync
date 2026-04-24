# Phase 5: Web UI + Deployment - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a working Flask web app that lets a user upload a Garmin FIT file and Hevy CSV, pick their timezone, review and confirm exercise mappings, and download a merged FIT file — all from a browser, launched with `python app.py`. No CLI, no separate setup steps beyond `pip install -r requirements.txt`.

</domain>

<decisions>
## Implementation Decisions

### UI Design (LOCKED — design tool output)
- **D-01:** The UI design is fully specified by the StrengthSync prototype in `static/src/` and `templates/index.html`. The design is implemented and must be matched pixel-perfectly. Do NOT redesign or substitute another approach.
- **D-02:** CSS approach: custom CSS variables (design tokens) embedded in `templates/index.html`. No Bootstrap, no Tailwind. All design tokens are already defined (`--bg`, `--accent`, `--good`, etc.).
- **D-03:** Typography: Inter Tight (display) + JetBrains Mono (monospace), loaded from Google Fonts CDN. Already in template.
- **D-04:** Light/dark mode: CSS `[data-theme="dark"]` attribute on `<body>`, toggled via React state. Already implemented.
- **D-05:** The React + Babel CDN stack is the frontend framework. Jinja2 only renders the shell HTML; all interactivity is React. JSX files live in `static/src/`.

### 5-Screen Flow (from design)
- **D-06:** Screen 1 — Upload: Drag-and-drop zone for `.fit` files + Hevy CSV file picker (file mode only — no OAuth). IANA timezone selector lives on this screen (text input or simple select, see D-12). "Use demo data" seeding button can remain for dev convenience.
- **D-07:** Screen 2 — Match workouts: Show Garmin workouts from uploaded FIT files matched against Hevy workouts from the CSV by timestamp. Uses `match_workouts()` from `matcher.py`. Manual override (pick from list) available. The prototype's two-column connector layout is the target.
- **D-08:** Screen 3 — Map exercises (hero screen): Left list panel + right detail/suggestion panel. Fuzzy suggestions from `suggest_mapping()` in `mapper.py`. User confirms one suggestion or skips. Export blocked until all UNRESOLVED exercises are resolved or skipped. `get_exercises_by_category()` powers a "Search all Garmin exercises" fallback flow (can be a simple searchable list).
- **D-09:** Screen 4 — Preview merge: Shows `MergePreview` data from `build_preview()` — biometric summary KPIs, HR chart (procedurally generated or from real data), exercise sequence with set data. Data audit table (what was preserved / what changed). "Generate & export" button triggers the actual merge.
- **D-10:** Screen 5 — Export/Done: Animated spinner (1.8 s delay) transitions to download card. Download button triggers Flask endpoint returning the merged FIT binary. Checksum shown.

### Backend API Routes
- **D-11:** REST-style JSON API between Flask and the React frontend. Routes:
  - `POST /api/upload` — accepts `fit_file` (multipart) + `hevy_csv` (multipart) + `timezone` (form field); returns parsed workout summaries as JSON
  - `POST /api/match` — accepts garmin/hevy workout IDs + optional manual overrides; returns match results
  - `POST /api/map/suggest` — accepts hevy exercise name; returns fuzzy suggestions
  - `POST /api/map/confirm` — persists a confirmed mapping to SQLite
  - `POST /api/preview` — accepts confirmed match + mapping state; returns `MergePreview` as JSON
  - `POST /api/export` — triggers `build_merged_fit()`; returns the FIT file as a binary download
  - `GET /api/exercises` — returns full Garmin exercise list (for search-all picker)

### Timezone Picker
- **D-12:** Searchable `<select>` populated from Python's `zoneinfo.available_timezones()` sorted alphabetically. Served as a JSON list from a `GET /api/timezones` endpoint. The React upload screen renders it as a filtered `<select>` — user types to filter, common zones floated to top. No free-text input (avoids invalid timezone strings reaching the backend).

### Mapping Review UX (UNRESOLVED exercises)
- **D-13:** For exercises with fuzzy score < 70 (UNRESOLVED), the right panel shows AI suggestions ranked by score. User clicks a suggestion to accept it. A "Search all Garmin exercises" button opens an inline search of the full exercise list (`/api/exercises`). "Skip this exercise — keep Garmin's guess" records a `skip` status (exercise passes through with whatever Garmin recorded). Export button remains blocked until every exercise is either confirmed or explicitly skipped.
- **D-14:** Cardio rows (`skipped_cardio` from `HevyParser`) are shown in the exercise list with a "CARDIO — SKIPPED" chip. They require no user action and do not block export.
- **D-15:** Confirmed mappings are persisted to SQLite via `mapper.confirm_mapping()`. On subsequent runs, exercises with existing confirmed mappings are pre-resolved (no review needed).

### Processing Feedback
- **D-16:** Synchronous processing — the Flask route runs the merge pipeline inline and returns when done. The frontend shows a full-screen spinner (the animated SVG circle already in `screen_done.jsx`) while the POST is in flight. No polling, no SSE, no background threads. The merge typically completes in < 2 s on local hardware; synchronous is sufficient.
- **D-17:** The 1.8 s animation delay in the prototype (`setTimeout 1800`) is replaced by actual wait time — the spinner shows while the `POST /api/export` fetch is pending, then transitions to the ready state on response.

### Error Handling (UI-04)
- **D-18:** Errors surface as inline banners within the current screen (not Python tracebacks, not full-page redirects). Flask returns `{ "error": "...", "detail": "..." }` JSON with 4xx status. React catches fetch errors and renders a styled error card using the existing `chip.bad` + `IconWarn` design elements.
- **D-19:** Specific error cases to handle with actionable messages:
  - Wrong file type (non-FIT uploaded) → "That doesn't look like a FIT file. Download the original from Garmin Connect → Activity → ⋯ → Export original."
  - Corrupt FIT → "FIT file failed to parse. Try re-exporting from Garmin Connect."
  - No matching Hevy workout found → "No Hevy workout found within 30 minutes of [Garmin workout time]. Check your timezone selection or use manual match."
  - Invalid CSV → "This doesn't look like a Hevy export. Go to Hevy Settings → Export and try again."
  - CRC validation failure → "Merged FIT failed integrity check. This is a bug — please report it."

### Deployment / Startup
- **D-20:** `python app.py` auto-opens the browser via `threading.Timer(1.0, webbrowser.open)`. Already implemented in `app.py`.
- **D-21:** Uploaded files are stored as temp files in Python's `tempfile.mkdtemp()` for the session duration. No persistent upload storage. Files are cleaned up after the export is served (or on process restart).
- **D-22:** Flask runs in non-debug mode (`debug=False`) on port 5000. No authentication — local single-user app.
- **D-23:** SQLite database (`data/exercise_mappings.db`) is created automatically on first run by `database.py`. No migration step needed.

### State Passing Between Screens
- **D-24:** Server-side session using Flask's built-in session (cookie-based). After `/api/upload`, parsed workout IDs and timezone are stored in session. Match and mapping state is passed back as JSON with each API call — the frontend holds the current state in React and sends it with each POST. No client-side localStorage for real data (only theme/step persistence for UX).

### Claude's Discretion
- Exact structure of the `/api/upload` JSON response schema (mirroring `FitWorkout` / `HevyWorkout` dataclass fields)
- Whether to add a Flask `SECRET_KEY` warning on startup if not configured (for session cookie signing)
- Internal error logging format (stderr is fine for a local app)
- Whether to add a `.gitignore` entry for `data/*.db` uploads

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design (MANDATORY — implement pixel-perfectly)
- `static/src/app.jsx` — Root React app, step routing, theme state, tweaks panel
- `static/src/shell.jsx` — TopBar (brand, nav-pill, theme toggle, avatar) + progress rail
- `static/src/screen_upload.jsx` — Upload screen: FIT drag-drop, Hevy file picker, continue gate
- `static/src/screen_match.jsx` — Match screen: two-column Garmin↔Hevy connector layout
- `static/src/screen_map.jsx` — Map screen: exercise list, mapping detail, suggestions, set data
- `static/src/screen_preview.jsx` — Preview: KPI strip, HR chart (SVG), exercise sequence, data audit
- `static/src/screen_done.jsx` — Export: animated spinner → download card, next-steps cards
- `static/src/data.jsx` — Mock data + helpers (`fmtTime`, `fmtDate`, `fmtDuration`) — replace mocks with real API calls
- `static/src/icons.jsx` — Full icon set (do not add new icon libraries)
- `templates/index.html` — Flask template: CSS variables, font imports, React CDN, script tags

### Project Constraints
- `CLAUDE.md` — FIT epoch, weight encoding, fitparse read-only, merge strategy
- `.planning/REQUIREMENTS.md` — UI-01, UI-02, UI-03, UI-04, DEPLOY-01 are the requirements for this phase
- `.planning/ROADMAP.md` §Phase 5 — Five success criteria define what must be true for Phase 5 to pass

### Prior Phase Interfaces (what Phase 5 calls)
- `.planning/phases/02-core-parsers/02-CONTEXT.md` — D-06: `HevyWorkout.skipped_cardio` list; D-05: naive datetime from HevyParser
- `.planning/phases/03-workout-matching-exercise-mapping/03-CONTEXT.md` — D-01: 30-min tolerance window; D-04: `get_exercises_by_category()`; D-05: fuzzy score ≥ 70 = auto-accept, < 70 = UNRESOLVED; D-06: UNRESOLVED status from `suggest_mapping()`; D-07: DB at `data/exercise_mappings.db`; D-08: only user-confirmed mappings written to DB; D-09: plain module-level functions
- `.planning/phases/04-fit-builder-merge-pipeline/04-CONTEXT.md` — D-08: `build_preview()` and `build_merged_fit()` are the two public functions; D-09: call `build_preview()` first → show to user → on confirm, call `build_merged_fit()`; D-10: garmin-fit-sdk takes kg (float), not grams; D-11/D-12: CRC validation + parse gate before download

### Existing Code
- `app.py` — Flask entry point already created (route `/` renders template, auto-opens browser). Extend with API routes.
- `fit_parser.py` — `parse_fit_file(path) -> FitWorkout`
- `hevy_parser.py` — `HevyParser` class, returns `list[HevyWorkout]` with `skipped_cardio`
- `matcher.py` — `match_workouts()`, `force_match()`
- `mapper.py` — `suggest_mapping()`, `confirm_mapping()`, `get_exercises_by_category()`, `get_confirmed_mapping()`
- `fit_generator.py` — `build_preview()`, `build_merged_fit()`
- `database.py` — SQLite schema init and queries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app.py`: Flask app object, `/` route, `webbrowser.open` startup — extend in place, do NOT replace
- `templates/index.html`: Complete CSS + React CDN shell — do NOT rewrite; add any new styles as `<style>` blocks if needed
- `static/src/*.jsx`: Complete React component tree — replace mock data with real API calls; do NOT redesign components

### Established Patterns
- All backend modules expose plain module-level functions (no classes except HevyParser) — Phase 5 imports and calls them directly
- FIT file reading uses `fitparse` (never `fit-tool` for reading)
- Exercise mappings persist to `data/exercise_mappings.db` via `database.py`
- garmin-fit-sdk weight encoding: pass kg float (SDK handles ×16 scale internally)

### Integration Points
- `ScreenUpload` → `POST /api/upload` → `fit_parser.parse_fit_file()` + `HevyParser().parse()`
- `ScreenMatch` → `POST /api/match` → `matcher.match_workouts()`
- `ScreenMap` → `POST /api/map/suggest` → `mapper.suggest_mapping()`, `POST /api/map/confirm` → `mapper.confirm_mapping()`
- `ScreenPreview` → `POST /api/preview` → `fit_generator.build_preview()`
- `ScreenDone` → `POST /api/export` → `fit_generator.build_merged_fit()` → `flask.send_file()`

</code_context>

<specifics>
## Specific Ideas

- The StrengthSync name and athletic/energetic aesthetic (electric lime accent, burn orange secondary, Inter Tight + JetBrains Mono) must be preserved exactly — this is the user's intentional design choice from the design tool session.
- "Use demo data" button on the upload screen can remain for development convenience but should be clearly labeled as demo-only.
- The mapping library count (247 in the prototype) should eventually pull from `SELECT COUNT(*) FROM confirmed_mappings` — wire this to `/api/exercises` or a dedicated stats endpoint.
- HR chart in the preview screen: if real HR data is available from `FitWorkout.heart_rate_samples`, replace `HR_SAMPLES` in `data.jsx` with a dynamic fetch. If not available (no HR sensor), show a "No HR data" empty state using the existing card structure.

</specifics>

<deferred>
## Deferred Ideas

- Hevy OAuth2 API integration (the "Connect Hevy account" option in the Upload screen) — v2 item per roadmap
- Batch processing of multiple workouts in one run — v2 item per roadmap
- "Save mapping set" / export mapping library as backup — noted from design screen_done.jsx
- "View run log" — noted from design screen_done.jsx
- Real-time progress via SSE (currently D-16 uses synchronous POST) — only needed if merge takes > 3s

</deferred>

---

*Phase: 05-web-ui-deployment*
*Context gathered: 2026-04-24*
