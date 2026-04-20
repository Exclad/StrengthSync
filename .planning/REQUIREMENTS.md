# Requirements — Garmin-Hevy Workout Sync

## v1 Requirements

### FIT File I/O

- [ ] **FIT-01**: Developer can validate that the chosen FIT write library produces a file Garmin Connect accepts — proof-of-concept round-trip test gates all other work
- [ ] **FIT-02**: User can upload a Garmin `.fit` file and the app correctly extracts all biometric records (heart rate samples, rest periods, calories, GPS, cadence, power, device info) and exercise metadata
- [ ] **FIT-03**: App generates a merged `.fit` file that Garmin Connect accepts without rejection — all Garmin biometric messages preserved verbatim, exercise records replaced with Hevy data
- [ ] **FIT-04**: App validates output FIT file (CRC check + required message type verification) before offering download, and shows a clear error if validation fails

### Hevy Data Import

- [ ] **HEVY-01**: User can upload a Hevy CSV export and the app correctly parses exercises, sets, reps, weights, and timestamps (format: `"Apr 17, 2026, 5:46 PM"`, local time)
- [ ] **HEVY-02**: App detects and handles mixed cardio rows (e.g. Treadmill, Stair Machine) in the Hevy CSV — skips or flags them with a clear message rather than crashing

### Workout Matching

- [ ] **MATCH-01**: User can select their IANA timezone (e.g. `Asia/Singapore`) so the app correctly converts Hevy local timestamps to UTC for matching against Garmin FIT timestamps
- [ ] **MATCH-02**: App auto-matches Garmin and Hevy workouts by timestamp proximity (within 1-hour window) and surfaces confidence level of each match
- [ ] **MATCH-03**: User can manually select which Garmin and Hevy workouts to pair when auto-match fails or produces a wrong result

### Exercise Mapping

- [ ] **MAP-01**: App persists confirmed Hevy→Garmin exercise mappings in SQLite so they are reused across sessions without re-entry
- [ ] **MAP-02**: App suggests Garmin exercise matches for Hevy names using fuzzy string matching (rapidfuzz), with confidence scores
- [ ] **MAP-03**: User can review all exercise mappings before export, correct any wrong suggestions, and the app blocks export if any exercise is unmapped without explicit user acknowledgment
- [ ] **MAP-04**: App maps unrecognized exercises (e.g. machine-specific movements) to a generic strength fallback type rather than failing

### Data Merge

- [ ] **MERGE-01**: App preserves all Garmin biometric data verbatim (heart rate, rest periods, calories, GPS, cadence, power, session metadata, device info) — no biometric data is modified or dropped
- [ ] **MERGE-02**: App correctly scales Hevy weight values from float kg to FIT integer format (multiply by 1000, store as grams) — incorrect scaling silently corrupts all weight data
- [ ] **MERGE-03**: App estimates per-set timestamps by distributing Hevy sets linearly within the workout time bounds (Hevy provides no per-set timestamps)
- [ ] **MERGE-04**: User can preview merged workout data (side-by-side before/after comparison) before the FIT file is generated and offered for download

### Web UI

- [ ] **UI-01**: User can upload Garmin FIT file and Hevy CSV via drag-and-drop or file browser, and select their timezone — all from a single upload screen
- [ ] **UI-02**: App presents a mapping review screen where user can see all Hevy→Garmin exercise mappings, correct them, and confirm before proceeding
- [ ] **UI-03**: User can download the merged FIT file; app shows processing progress indicators for long-running operations
- [ ] **UI-04**: App shows clear, user-friendly error messages for invalid files, failed matches, mapping gaps, and FIT generation failures

### Deployment

- [ ] **DEPLOY-01**: User can run the app locally with `python app.py` and the browser opens automatically to localhost; setup requires only Python (installed globally) and `pip install -r requirements.txt`

### Project Structure

- [ ] **STRUCT-01**: All project files — source code, `.planning/`, sample files, documentation — reside inside the `GarminHevyMerge/` folder

---

## v2 Requirements (Deferred)

- Docker container + docker-compose for self-hosted deployment
- Batch processing (multiple Garmin/Hevy workout pairs in one session)
- Hevy API OAuth2 connection (fetch workouts directly without CSV export)
- Configurable matching tolerance window (default 1 hour)
- Mapping import/export (share mapping databases between users)

---

## Out of Scope

- Direct upload to Garmin Connect via API — requires Garmin OAuth, significant complexity
- Mobile app — local web app covers the use case
- Cloud-hosted version with user accounts — local-only by design (privacy)
- Integration with other fitness apps (Strong, Fitbod) — future milestone
- Automatic sync scheduling — future
- Workout analytics and insights — future
- Export to formats other than FIT — future

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| FIT-01 | — | Pending roadmap |
| FIT-02 | — | Pending roadmap |
| FIT-03 | — | Pending roadmap |
| FIT-04 | — | Pending roadmap |
| HEVY-01 | — | Pending roadmap |
| HEVY-02 | — | Pending roadmap |
| MATCH-01 | — | Pending roadmap |
| MATCH-02 | — | Pending roadmap |
| MATCH-03 | — | Pending roadmap |
| MAP-01 | — | Pending roadmap |
| MAP-02 | — | Pending roadmap |
| MAP-03 | — | Pending roadmap |
| MAP-04 | — | Pending roadmap |
| MERGE-01 | — | Pending roadmap |
| MERGE-02 | — | Pending roadmap |
| MERGE-03 | — | Pending roadmap |
| MERGE-04 | — | Pending roadmap |
| UI-01 | — | Pending roadmap |
| UI-02 | — | Pending roadmap |
| UI-03 | — | Pending roadmap |
| UI-04 | — | Pending roadmap |
| DEPLOY-01 | — | Pending roadmap |
| STRUCT-01 | — | Pending roadmap |
