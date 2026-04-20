# Garmin-Hevy Workout Sync

## What This Is

A local web application that merges Garmin FIT biometric data with Hevy strength training data to produce enhanced FIT files uploadable to Garmin Connect.

**The core problem:** Garmin watches capture excellent biometric data (heart rate, rest periods, calories, timing) but have poor strength exercise tracking. Hevy captures accurate exercise names, weights, reps, and sets but has no biometric integration. Users currently maintain two disconnected systems.

**The solution:** Parse both data sources, auto-match workouts by timestamp, map exercises between systems, preserve all Garmin biometrics while replacing exercise data with Hevy's accurate records, then output a valid FIT file that Garmin Connect accepts.

## Core Value

A merged FIT file — with Garmin's biometric accuracy and Hevy's exercise precision — that uploads to Garmin Connect without errors. If the output FIT file is rejected or corrupted, the entire project fails.

## Context

- **Stack**: Python 3.9+ backend (Flask or FastAPI), HTML/CSS/JS frontend, SQLite for mapping persistence
- **Deployment**: Local Python app (`python app.py`) + Docker container
- **FIT library**: `garmin-fit-sdk` (official) or `fitparse` — FIT write support is the critical unknown
- **Hevy integration**: CSV/JSON file upload for v1; Hevy API (OAuth2) in Phase 3
- **Timezone**: Garmin stores timestamps as UTC; app must let users specify their timezone (e.g., Singapore = UTC+8) for correct workout matching
- **Sample files**: `GarminHevyMerge/original_garmin.fit` and `GarminHevyMerge/original_hevy.csv` available for development
- **Reference**: HevyConnect (abandoned TypeScript project) — implementation patterns, FIT file handling

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Phase 1 — Core (MVP):**
- [ ] Parse Garmin FIT file: extract biometrics (heart rate, rest periods, duration, calories, GPS, sensor data) and exercise metadata
- [ ] Parse Hevy CSV/JSON export: extract exercises, sets, reps, weights, timestamps
- [ ] Time-based workout matching with timezone offset input (user specifies their timezone)
- [ ] Manual exercise mapping UI (review and correct Hevy→Garmin exercise name mappings)
- [ ] Generate valid FIT file: preserve all Garmin biometrics, replace exercise data with Hevy data
- [ ] Basic web UI: file upload (Garmin FIT + Hevy CSV), download merged FIT
- [ ] FIT file validation: output must be accepted by Garmin Connect

**Phase 2 — Enhanced Matching:**
- [ ] AI/fuzzy auto-mapping of exercises (Hevy names → Garmin equivalents)
- [ ] SQLite mapping database for persistence across sessions
- [ ] Preview screen: side-by-side before/after data view before export
- [ ] Manual workout matching override (when auto-match fails)

**Phase 3 — Hevy API:**
- [ ] Research Hevy API capabilities
- [ ] Hevy OAuth2 authentication flow
- [ ] Fetch workouts directly from Hevy API (no file download needed)
- [ ] Graceful fallback to file upload

**Phase 4 — Polish & Deployment:**
- [ ] Docker container + docker-compose setup
- [ ] Batch processing (multiple workouts)
- [ ] Comprehensive error handling and user-facing messages
- [ ] Setup documentation (README, user guide)

### Out of Scope

- Direct upload to Garmin Connect via API — Phase 4+ only
- Mobile app — not planned
- Cloud-hosted version with user accounts — local-only by design
- Integration with other fitness apps (Strong, Fitbod) — future
- Automatic sync scheduling — future
- Workout analytics — future

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local-only deployment | Privacy: no workout data leaves user's machine | — Pending |
| Python backend | User's preferred language; rich FIT/data ecosystem | — Pending |
| SQLite for mapping storage | Lightweight, no separate DB process, fits local deployment | — Pending |
| Timezone as user input | Garmin UTC + user's local offset fixes matching across regions | — Pending |
| FIT write library TBD | Official garmin-fit-sdk vs fitparse — write support needs validation against real Garmin Connect | — Pending |
| Phase 1 file-only (no Hevy API) | API capabilities unknown; file upload de-risks MVP | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-20 after initialization*
