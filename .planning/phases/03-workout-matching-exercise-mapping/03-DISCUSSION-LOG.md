# Phase 3: Workout Matching + Exercise Mapping - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 03-workout-matching-exercise-mapping
**Areas discussed:** Matching tolerance, Garmin exercise enum, SQLite schema & lifecycle, Module interface

---

## Matching Tolerance

| Option | Description | Selected |
|--------|-------------|----------|
| 30 minutes | Tighter match, reduces false positives | ✓ |
| 1 hour | More forgiving for watch/app start drift | |
| Configurable constant | MATCH_TOLERANCE_MINUTES in matcher.py | |

**User's choice:** 30 minutes

---

| Option | Description | Selected |
|--------|-------------|----------|
| Closest match wins | Smallest UTC delta within tolerance | ✓ |
| Prompt user to pick | Surface both candidates for manual selection | |
| Error — require manual override | Return no auto-match if ambiguous | |

**User's choice:** Closest match wins (same-day multiple workouts)

---

## Garmin Exercise Enum

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded Python dict | GARMIN_EXERCISES dict in mapper.py | |
| Extract from sample FIT | Discover enums present in original_garmin.fit | |
| FIT SDK constants file | Official exercise name → enum mapping from Profile | ✓ |

**User's choice:** FIT SDK constants file

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled CSV in repo | data/garmin_exercises.csv, committed | ✓ |
| Download at runtime | Fetch from Garmin SDK release at startup | |
| Require user SDK install | Locate Profile.xlsx on disk | |

**User's choice:** Bundled CSV (data/garmin_exercises.csv)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Generic strength enum | MAP-04 fallback to uncategorized type | |
| Skip the set message | Omit FIT set for unmapped exercises | |
| Raise and block export | Treat unmapped as error | |
| Other (user input) | Fuzzy match → if no match, prompt user to pick by muscle group → exercise | ✓ |

**User's choice (free text):** "I was thinking something like, it will try to do fuzzy matching, and if it's not able to find, it will sort of prompt the user to choose the closest activity. They would be able to choose the muscle type first, which then filters the exercises for that main muscle group, which they can choose."

**Notes:** UI flow is Phase 5. Phase 3 data layer delivers: `exercise_category` column in CSV, `get_exercises_by_category()` function, `UNRESOLVED` status from `suggest_mapping()`.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Score < 70 = unresolved | rapidfuzz 0–100 scale; under 70 is poor match | ✓ |
| Score < 80 = unresolved | Stricter, more confirmations required | |
| You decide | Claude picks default, expose as constant | |

**User's choice:** Score < 70 = unresolved

---

## SQLite Schema & Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| GarminHevyMerge/data/ | data/exercise_mappings.db alongside exercise CSV | ✓ |
| Project root | exercise_mappings.db alongside app.py | |
| Configurable path | Via env var or config | |

**User's choice:** data/exercise_mappings.db

---

| Option | Description | Selected |
|--------|-------------|----------|
| Only confirmed mappings | Written on user confirmation only | ✓ |
| All mappings including auto-suggested | Store fuzzy suggestions immediately | |
| Separate confirmed/pending tables | Two-table approach | |

**User's choice:** Only user-confirmed mappings stored

---

## Module Interface

| Option | Description | Selected |
|--------|-------------|----------|
| Plain functions, pytest | Module-level functions, Phase 4 imports directly | ✓ |
| Class-based API | WorkoutMatcher and ExerciseMapper classes | |
| CLI entrypoint | python matcher.py dry-run mode | |

**User's choice:** Plain functions, tested via pytest

---

| Option | Description | Selected |
|--------|-------------|----------|
| force_match() function | Bypasses tolerance, called by Phase 5 | ✓ |
| Index-based parameter | match_workouts(..., force_hevy_index=2) | |
| Defer to Phase 5 | Only auto-match in Phase 3 | |

**User's choice:** force_match(fit_workout, hevy_workout) -> MatchResult

---

## Claude's Discretion

- `MatchResult` dataclass fields
- Whether matcher converts naive datetimes inline or expects pre-converted
- `database.py` initialization strategy (explicit `init_db()` preferred)
- Number of fuzzy candidates returned by default

## Deferred Ideas

- Muscle-group → exercise picker UI — Phase 5
- Surfacing `skipped_cardio` warnings — Phase 5
- Configurable tolerance window in UI — Phase 5 or later
