# Garmin-Hevy Workout Sync — Project Guide

## Project

Merge Garmin FIT biometric data with Hevy strength training data (CSV export) into enhanced FIT files uploadable to Garmin Connect. All files live inside `GarminHevyMerge/`.

## Critical Constraint

**Output FIT files must be accepted by Garmin Connect.** One invalid FIT file = user abandonment. Phase 1 is a hard gate — no application code until the FIT write library is validated against a real Garmin Connect upload.

## Known Technical Facts (from research)

- **fitparse** is read-only — never use it for writing FIT files
- **FIT epoch** is 1989-12-31 00:00:00 UTC (not Unix epoch) — offset is 631,065,600 seconds
- **FIT weight fields** are integers in grams × 1000 — Hevy floats (kg) must be multiplied by 1000
- **Hevy timestamps** are local time, format `"Apr 17, 2026, 5:46 PM"` — requires IANA timezone conversion
- **Hevy sets have no per-set timestamps** — distribute linearly within workout bounds
- **Hevy CSV contains cardio rows** (Treadmill, Stair Machine) mixed with strength rows — handle explicitly
- **FIT merge strategy**: pass `record`/`session`/`lap`/`event`/`device_info` messages verbatim; replace `set` (mesg 225) and `exercise_title` (mesg 227) messages with Hevy data

## Stack

- **Python 3.9+** — install globally (`python app.py` must work without virtualenv activation for end users)
- **Flask** — web server (single-user local app, no async needed)
- **fitparse** — FIT file reading
- **fit-tool** — FIT file writing (validate against Garmin Connect in Phase 1 before using)
- **pandas + python-dateutil** — Hevy CSV parsing
- **rapidfuzz** — exercise name fuzzy matching
- **SQLite** — exercise mapping persistence

## Project Structure

```
GarminHevyMerge/
├── app.py                  # Flask entry point
├── fit_parser.py           # FIT file reader
├── fit_generator.py        # FIT file writer
├── hevy_parser.py          # Hevy CSV parser
├── matcher.py              # Workout matching (timezone-aware)
├── mapper.py               # Exercise mapping (fuzzy + SQLite)
├── database.py             # SQLite schema and queries
├── templates/              # HTML templates
├── requirements.txt
├── CLAUDE.md               # This file
├── original_garmin.fit     # Sample Garmin file (dev only)
├── original_hevy.csv       # Sample Hevy CSV (dev only)
└── .planning/              # GSD planning artifacts
```

## GSD Workflow

This project uses GSD for planning and execution.

- **Phase 1 gate**: FIT round-trip proof-of-concept — must pass before Phases 2-5
- Run `/gsd-discuss-phase N` before planning any phase
- Run `/gsd-plan-phase N` to create the execution plan
- Run `/gsd-execute-phase N` to execute

## Python Installation Note

Python is not yet installed on this machine. Phase 1 includes global Python installation so future projects can also use it. Do NOT install Python into a project-local virtualenv only — install globally first, then create a venv for dependency isolation.
