# Phase 3: Workout Matching + Exercise Mapping - Research

**Researched:** 2026-04-21
**Domain:** Python datetime/timezone, rapidfuzz fuzzy matching, sqlite3, garmin-fit-sdk exercise enums
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Tolerance window is 30 minutes (ROADMAP value wins over REQUIREMENTS.md's 1-hour window). REQUIREMENTS.md must be updated during planning.
- **D-02:** When multiple Hevy workouts fall within tolerance, closest match wins (smallest UTC delta). Deterministic, no ambiguity prompting in Phase 3.
- **D-03:** Exercise name → FIT enum mapping loaded from bundled `data/garmin_exercises.csv`. Columns: `exercise_name`, `exercise_enum_int`, `exercise_category`. Extracted from FIT SDK Profile once; no runtime SDK dependency.
- **D-04:** `mapper.py` exposes `get_exercises_by_category(category: str) -> list[GarminExercise]` for Phase 5 UI.
- **D-05:** rapidfuzz returns ranked candidates (list of `(GarminExercise, float)` tuples), not top-1. Score threshold for auto-accept: >= 70.
- **D-06:** "Unresolved" exercises returned with status `UNRESOLVED`. No silent fallback enum.
- **D-07:** Database at `data/exercise_mappings.db`. `database.py` handles schema init and queries.
- **D-08:** Only user-confirmed mappings written to DB. Fuzzy suggestions are ephemeral.
- **D-09:** Module-level functions, no classes. Locked signatures:
  - `match_workouts(fit: FitWorkout, hevy_list: list[HevyWorkout], timezone_str: str) -> MatchResult`
  - `suggest_mapping(hevy_name: str) -> list[tuple[GarminExercise, float]]`
  - `confirm_mapping(hevy_name: str, garmin_exercise: GarminExercise) -> None`
  - `get_confirmed_mapping(hevy_name: str) -> GarminExercise | None`
  - `get_exercises_by_category(category: str) -> list[GarminExercise]`
- **D-10:** Manual pairing: `force_match(fit: FitWorkout, hevy: HevyWorkout) -> MatchResult` bypasses tolerance check entirely.

### Claude's Discretion

- `MatchResult` dataclass fields — include at minimum: `fit_workout`, `hevy_workout`, `delta_minutes: float`, `is_forced: bool`
- Whether `matcher.py` converts Hevy naive datetimes to UTC inline or expects pre-converted inputs
- How `database.py` is initialized — explicit `init_db()` preferred for testability
- How many fuzzy candidates `suggest_mapping()` returns by default — top 5 is reasonable

### Deferred Ideas (OUT OF SCOPE)

- Muscle-group → exercise picker UI — Phase 5
- Surfacing `skipped_cardio` warnings to the user — Phase 5
- Configurable tolerance window exposed in UI — Phase 5 or later

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MATCH-01 | User selects IANA timezone; app converts Hevy local timestamps to UTC for matching | dateutil.tz.gettz() + replace(tzinfo=...) + astimezone(UTC) pattern — verified working |
| MATCH-02 | Auto-match by timestamp proximity within 30 min; surface confidence (delta) | datetime subtraction gives delta_minutes; tolerance constant in matcher.py |
| MATCH-03 | Manual workout pairing via force_match() | force_match() returns MatchResult(is_forced=True, delta_minutes=0.0) |
| MAP-01 | Persist confirmed mappings in SQLite for reuse across sessions | sqlite3 INSERT OR REPLACE; init_db() creates table with IF NOT EXISTS |
| MAP-02 | Fuzzy matching via rapidfuzz with confidence scores | process.extract() with fuzz.WRatio scorer; normalize() strips parentheses for better hits |
| MAP-03 | Review before export; block if unmapped | UNRESOLVED_THRESHOLD=70 exported from mapper.py; Phase 5 enforces the block |
| MAP-04 | Unrecognized exercises get generic strength fallback | GENERIC_FALLBACK GarminExercise with exercise_category_enum_int=65534 (unknown) |

</phase_requirements>

---

## Summary

Phase 3 delivers three pure Python modules — `matcher.py`, `mapper.py`, `database.py` — plus a bundled `data/garmin_exercises.csv`. No Flask, no UI. The logic layer is consumed by Phase 4 (FIT assembly) and Phase 5 (web UI).

**Workout matching** converts Hevy naive local datetimes to UTC using `python-dateutil`'s `tz.gettz()` + `replace(tzinfo=...)` + `astimezone(UTC)` pattern. FIT timestamps from fitparse are also naive UTC. Both sides are stripped of tzinfo before comparison, yielding a clean `abs(delta).total_seconds() / 60` calculation. The sample data (Singapore, UTC+8) has been verified: Hevy `Apr 17, 2026, 5:46 PM` localtime → UTC `09:46:00` vs Garmin `09:45:49` = 0.18 minute delta, well within 30-minute tolerance.

**Exercise mapping** uses `rapidfuzz.process.extract()` with `fuzz.WRatio` scorer against 1,846 Garmin exercises extracted from `garmin_fit_sdk` Profile. A `normalize()` function strips parenthetical equipment qualifiers (e.g. `(Machine)`, `(Barbell)`) and underscores before matching — this raises match quality dramatically (e.g. `Bench Press (Dumbbell)` → score 90 vs 67 without normalization). Confirmed mappings are persisted in SQLite via `INSERT OR REPLACE` (upsert). Only confirmed mappings are written.

**Primary recommendation:** Inline timezone conversion in `match_workouts()`. Keep `normalize()` as a private function in `mapper.py`. Add `exercise_category_enum_int` as a 4th field in `GarminExercise` dataclass and CSV column (Phase 4 needs the integer to write FIT set message `category` field).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Timezone conversion | Backend (Pure Python) | — | Stateless function; no I/O; called from matcher |
| Workout timestamp matching | Backend (Pure Python) | — | Pure arithmetic on UTC datetimes; no DB |
| Exercise fuzzy matching | Backend (Pure Python) | — | In-memory over loaded CSV; no I/O per call |
| Mapping persistence | SQLite | Backend (Pure Python) | DB owns confirmed state; Python is thin wrapper |
| Exercise enum lookup | CSV file | Backend (Pure Python) | CSV loaded once at module load; no runtime SDK needed |
| Generic fallback | Backend (Pure Python) | — | Hardcoded constant; no lookup needed |

---

## Standard Stack

### Core (already installed in .venv)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| python-dateutil | 2.9.0.post0 | IANA timezone localization and UTC conversion | Standard Python complement for stdlib datetime; handles DST correctly; tz.gettz() returns None for invalid zones — safe validation |
| rapidfuzz | 3.14.5 | Fuzzy string matching for exercise names | Active successor to fuzzywuzzy (same API, C++ core, 10-100x faster); process.extract supports custom objects with processor= |
| sqlite3 | stdlib (SQLite 3.40.1) | Confirmed mapping persistence | No external dep; single-user local app; sufficient for 46 unique exercises |
| garmin-fit-sdk | 21.200.0 | Source of truth for exercise enums | Profile['types'] contains all 1,846 exercise name→enum mappings organized by category |

[VERIFIED: .venv/bin/pip list — all packages installed and version-confirmed]

### Not Needed (contrary to CLAUDE.md stack list)

| Library | Status | Reason |
|---------|--------|--------|
| pandas | Installed (3.0.2) but NOT used | hevy_parser.py uses stdlib csv.DictReader; Phase 3 modules use no tabular data |
| Flask | Not in Phase 3 scope | Pure logic modules only |

**Installation (packages not yet in requirements.txt):**
```bash
.venv/bin/pip install rapidfuzz==3.14.5 python-dateutil==2.9.0.post0
```

Note: pandas is already installed but not used by any Phase 3 module. Phase 3 plan should add `rapidfuzz` and `python-dateutil` to `requirements.txt`. Pandas should also be added for completeness but is not required for Phase 3 execution.

[VERIFIED: .venv/bin/pip list]

---

## Architecture Patterns

### System Architecture Diagram

```
User provides: FIT file, Hevy CSV, timezone_str (e.g. "Asia/Singapore")
                          |
              ┌───────────┴────────────┐
              v                        v
     fit_parser.parse_fit_file()   hevy_parser.parse_hevy_csv()
              |                        |
       FitWorkout                 list[HevyWorkout]
       (naive UTC)                (naive local dt)
              |                        |
              └──────────┬─────────────┘
                         v
            matcher.match_workouts(fit, hevy_list, timezone_str)
                         |
              ┌──────────┴──────────────────┐
              v                             v
     dateutil.tz.gettz(tz_str)    hevy.start_time.replace(tzinfo=tz)
              |                             |
              └──────────┬─────────────────┘
                         v
            hevy_utc = aware_dt.astimezone(UTC).replace(tzinfo=None)
                         |
              delta = abs(fit.start_time - hevy_utc) in minutes
                         |
              if delta <= 30: closest candidate → MatchResult
              if no match:    return None
                         |
                    MatchResult
           ┌──────────────────────────────┐
           │ fit_workout: FitWorkout       │
           │ hevy_workout: HevyWorkout     │
           │ delta_minutes: float          │
           │ is_forced: bool               │
           └──────────────────────────────┘

Exercise Mapping Flow:
                         |
              [for each HevyExercise in HevyWorkout]
                         |
              mapper.get_confirmed_mapping(hevy_name)
                         |
           ┌─────────────┴──────────────────┐
           v (found)                         v (not found)
      GarminExercise                 mapper.suggest_mapping(hevy_name)
      (from SQLite)                          |
                                   normalize(hevy_name)
                                            |
                                   process.extract(normalized, garmin_db, WRatio, limit=5)
                                            |
                            list[(GarminExercise, score)]
                                            |
                              max score >= 70?
                           ┌────────────────┴───────────────┐
                           v (yes)                           v (no)
                     AUTO_ACCEPTED                       UNRESOLVED
                     (Phase 5 confirms)            (Phase 5 prompts user)
```

### Recommended Project Structure (additions only)

```
GarminHevyMerge/
├── matcher.py               # match_workouts(), force_match(), MatchResult dataclass
├── mapper.py                # suggest_mapping(), confirm_mapping(), get_confirmed_mapping(),
│                            #   get_exercises_by_category(), GarminExercise dataclass,
│                            #   UNRESOLVED_THRESHOLD=70, GENERIC_FALLBACK, normalize()
├── database.py              # init_db(), _get_conn() — sqlite3 wrapper
├── data/
│   ├── garmin_exercises.csv  # Generated by scripts/extract_garmin_exercises.py
│   └── exercise_mappings.db  # Created by init_db() at runtime (gitignored)
├── scripts/
│   └── extract_garmin_exercises.py  # One-time extraction from garmin_fit_sdk Profile
└── tests/
    ├── test_matcher.py       # Phase 3 matcher tests
    └── test_mapper.py        # Phase 3 mapper + database tests
```

### Pattern 1: Inline Timezone Conversion in match_workouts()

**What:** Convert Hevy naive local datetime to naive UTC inside matcher.py; caller only passes timezone_str.
**When to use:** Keeps the public API clean — callers don't need to pre-convert. Matches D-09 locked signature.

```python
# Source: verified against python-dateutil 2.9.0.post0
from dateutil import tz

def match_workouts(
    fit: FitWorkout,
    hevy_list: list[HevyWorkout],
    timezone_str: str,
) -> MatchResult | None:
    user_tz = tz.gettz(timezone_str)
    if user_tz is None:
        raise ValueError(f"Unknown IANA timezone: {timezone_str!r}")

    best: MatchResult | None = None
    for hevy in hevy_list:
        aware = hevy.start_time.replace(tzinfo=user_tz)
        hevy_utc = aware.astimezone(tz.UTC).replace(tzinfo=None)
        delta_minutes = abs((fit.start_time - hevy_utc).total_seconds()) / 60
        if delta_minutes <= MATCH_TOLERANCE_MINUTES:
            if best is None or delta_minutes < best.delta_minutes:
                best = MatchResult(
                    fit_workout=fit,
                    hevy_workout=hevy,
                    delta_minutes=delta_minutes,
                    is_forced=False,
                )
    return best
```

[VERIFIED: datetime arithmetic tested against original_garmin.fit and original_hevy.csv — 0.18 min delta confirmed]

### Pattern 2: rapidfuzz process.extract with GarminExercise objects

**What:** Pass GarminExercise objects directly to process.extract with a processor function. Avoids building a parallel list of name strings.
**When to use:** Whenever suggest_mapping() is called.

```python
# Source: verified against rapidfuzz 3.14.5
import re
from rapidfuzz import process, fuzz

def normalize(name: str) -> str:
    """Strip parenthetical qualifiers; lowercase; underscores/hyphens → spaces."""
    name = re.sub(r'\s*\(.*?\)\s*', ' ', name)
    return re.sub(r'\s+', ' ', name.lower().replace('_', ' ').replace('-', ' ')).strip()

def suggest_mapping(
    hevy_name: str,
    limit: int = 5,
) -> list[tuple[GarminExercise, float]]:
    normalized_query = normalize(hevy_name)
    results = process.extract(
        normalized_query,
        _GARMIN_EXERCISES,          # module-level list[GarminExercise]
        scorer=fuzz.WRatio,
        processor=lambda x: normalize(x.exercise_name) if isinstance(x, GarminExercise) else x,
        limit=limit,
    )
    return [(exercise, score) for exercise, score, _idx in results]
```

Normalization effect on real data (verified):
- `'Bench Press (Dumbbell)'` → `'bench press'` → WRatio 90 vs `dumbbell_bench_press` → `dumbbell bench press` (90 vs 67 without normalization)
- `'Hip Abduction (Machine)'` → `'hip abduction'` → top hit `standing_hip_abduction` score 90 (vs 60 without normalization)

[VERIFIED: executed against garmin_fit_sdk Profile + sample Hevy CSV]

### Pattern 3: sqlite3 init_db() + upsert

**What:** Explicit init call creates table IF NOT EXISTS. Upsert uses INSERT OR REPLACE (simpler than ON CONFLICT for single-column PK).
**When to use:** database.py; init_db() called once at app startup (or test setUp).

```python
# Source: verified against sqlite3 stdlib (SQLite 3.40.1)
import sqlite3

DB_PATH = "data/exercise_mappings.db"

def init_db(db_path: str = DB_PATH) -> None:
    """Create confirmed_mappings table if it does not exist. Safe to call multiple times."""
    with sqlite3.connect(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS confirmed_mappings (
                hevy_exercise_name   TEXT PRIMARY KEY,
                garmin_exercise_enum_int  INTEGER NOT NULL,
                garmin_exercise_name TEXT NOT NULL,
                confirmed_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

def confirm_mapping_db(db_path: str, hevy_name: str, enum_int: int, garmin_name: str) -> None:
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO confirmed_mappings VALUES (?,?,?,CURRENT_TIMESTAMP)",
            (hevy_name, enum_int, garmin_name),
        )

def get_confirmed_mapping_db(db_path: str, hevy_name: str) -> tuple | None:
    with sqlite3.connect(db_path) as conn:
        return conn.execute(
            "SELECT garmin_exercise_enum_int, garmin_exercise_name FROM confirmed_mappings WHERE hevy_exercise_name=?",
            (hevy_name,),
        ).fetchone()
```

[VERIFIED: init_db idempotency and round-trip confirmed in live Python session]

### Pattern 4: garmin_exercises.csv extraction script

**What:** One-time script to generate `data/garmin_exercises.csv` from `garmin_fit_sdk` Profile.
**When to use:** Wave 0 — run once, commit CSV, never run again at runtime.

```python
# Source: verified against garmin-fit-sdk 21.200.0
import csv, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / ".venv" / "lib" / "python3.11" / "site-packages"))
from garmin_fit_sdk.profile import Profile

types = Profile["types"]
cat_map = types["exercise_category"]  # {'0': 'bench_press', ...}
cat_by_name = {v: int(k) for k, v in cat_map.items() if k.isdigit()}

rows = []
for category_name, cat_enum in cat_by_name.items():
    ex_key = f"{category_name}_exercise_name"
    if ex_key in types:
        for k, v in types[ex_key].items():
            if k.isdigit():
                rows.append((v, int(k), category_name, cat_enum))

out = pathlib.Path("data/garmin_exercises.csv")
out.parent.mkdir(exist_ok=True)
with open(out, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["exercise_name", "exercise_enum_int", "exercise_category", "exercise_category_enum_int"])
    writer.writerows(rows)

print(f"Wrote {len(rows)} exercises to {out}")
```

Output: 1,846 rows across 51 exercise categories.

[VERIFIED: executed successfully, 1,846 rows confirmed]

### Anti-Patterns to Avoid

- **Using `tz.tzlocal()` for Hevy timestamps:** HevyWorkout times are local to the USER's timezone, not the machine's timezone. Always use `tz.gettz(user_timezone_str)`.
- **Comparing naive datetimes across timezones:** FitWorkout times are naive UTC, Hevy times are naive local. Must convert Hevy to UTC before delta calculation. The 8-hour gap test confirms this matters.
- **Building Garmin exercise candidates at query time from SDK:** Load `garmin_exercises.csv` once at module import into a module-level `_GARMIN_EXERCISES: list[GarminExercise]`. Do not re-read file on every `suggest_mapping()` call.
- **Writing unconfirmed fuzzy suggestions to SQLite:** D-08 is explicit — only user-confirmed mappings enter the DB. `suggest_mapping()` never writes.
- **Auto-import sqlite3 in mapper.py:** `mapper.py` imports `database.py` functions. `database.py` owns all sqlite3 calls.
- **Relying on `tz.gettz()` truthy check alone:** `tz.gettz()` returns `None` for invalid timezone strings (not an exception). Always check `if user_tz is None: raise ValueError(...)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Levenshtein distance loop | rapidfuzz.process.extract + fuzz.WRatio | WRatio handles token reordering, partial matches, varying lengths; C++ core = microseconds per call for 1,846 exercises |
| Timezone conversion | Manual UTC offset arithmetic | python-dateutil tz.gettz() + astimezone() | Handles DST transitions, historical UTC offsets; tz.gettz returns None for invalid zones |
| Exercise enum source | Hardcoded lookup table | data/garmin_exercises.csv from garmin-fit-sdk | SDK Profile is authoritative — 1,846 entries across 51 categories; hardcoding invites staleness |
| SQLite upsert | Manual SELECT+INSERT/UPDATE | INSERT OR REPLACE | Atomic upsert without race conditions |

**Key insight:** The 1,846 Garmin exercises span 51 categories. Any hand-rolled matching approach will miss the token-reordering subtleties that WRatio handles (e.g. "Leg Press Horizontal" → `leg_press` at 90 score without requiring exact word order).

---

## GarminExercise Dataclass (Discretion: Field Design)

Research finding: the FIT `set` message (mesg 225) has a `category` field of type `exercise_category` (integer) and `category_subtype` field (also integer). Phase 4 needs BOTH to write a valid set message. Adding `exercise_category_enum_int` to GarminExercise now avoids Phase 4 requiring a lookup step.

**Recommended GarminExercise fields:**

```python
@dataclass
class GarminExercise:
    exercise_name: str             # e.g. 'barbell_bench_press' (human-readable, underscored)
    exercise_enum_int: int         # e.g. 1 — category_subtype for FIT set message field 8
    exercise_category: str         # e.g. 'bench_press' — grouping key for Phase 5 picker
    exercise_category_enum_int: int  # e.g. 0 — category int for FIT set message field 7
```

CSV columns: `exercise_name, exercise_enum_int, exercise_category, exercise_category_enum_int`

**Generic fallback (MAP-04):**
```python
GENERIC_FALLBACK = GarminExercise(
    exercise_name="unknown",
    exercise_enum_int=65534,         # 0xFFFE = FIT unknown sentinel
    exercise_category="unknown",
    exercise_category_enum_int=65534,
)
```

[VERIFIED: exercise_category 65534 = 'unknown' in garmin_fit_sdk Profile; used for unrecognized machine-specific exercises per MAP-04]

---

## MatchResult Dataclass (Discretion)

**Recommended fields:**

```python
@dataclass
class MatchResult:
    fit_workout: FitWorkout
    hevy_workout: HevyWorkout
    delta_minutes: float   # 0.0 for forced matches; time delta for auto-matches (confidence)
    is_forced: bool        # True when set via force_match(); False for auto-match
```

The D-09 signature `match_workouts(...) -> MatchResult` does not specify Optional. Research shows the function MUST return `None` when no Hevy workout falls within 30 minutes — the planner should update the signature to `-> MatchResult | None`. Phase 5 handles the None case by surfacing the no-match UI and prompting `force_match()`.

---

## Common Pitfalls

### Pitfall 1: Naive Datetime Comparison Without Timezone Conversion
**What goes wrong:** Comparing FitWorkout.start_time (naive UTC) directly to HevyWorkout.start_time (naive local time) produces an 8-hour delta for Asia/Singapore users — no match is found even when the workouts are the same session.
**Why it happens:** Both datetimes are "naive" (no tzinfo), so Python arithmetic treats them as equivalent — but they represent different wall-clock bases.
**How to avoid:** Always call `hevy.start_time.replace(tzinfo=user_tz).astimezone(tz.UTC).replace(tzinfo=None)` before delta calculation.
**Warning signs:** Test with Singapore timezone against real sample files — 0.18 min delta if correct, 480 min delta if wrong.

### Pitfall 2: Exercise Name Matching Without Normalization
**What goes wrong:** Matching `'Bench Press (Dumbbell)'` against `'dumbbell_bench_press'` with WRatio scores only 67 (below the 70 threshold) — the exercise is flagged UNRESOLVED when it has a clear match.
**Why it happens:** Parenthetical equipment qualifiers and underscore formatting confuse character-level metrics.
**How to avoid:** Apply `normalize()` to both query and candidate before passing to rapidfuzz. Verified: normalized matching raises Bench Press score from 67 to 90.
**Warning signs:** Nearly all 46 sample Hevy exercises would be UNRESOLVED without normalization.

### Pitfall 3: DB Path Hardcoded as Relative String
**What goes wrong:** `sqlite3.connect("data/exercise_mappings.db")` resolves relative to cwd. Tests running from different directories get different DB files (or fail to find the file).
**Why it happens:** Python resolves relative paths against `os.getcwd()`, not the module file's location.
**How to avoid:** Define `DB_PATH` in `database.py` as `pathlib.Path(__file__).parent.parent / "data" / "exercise_mappings.db"`. Tests can override with a `tmp_path` fixture.
**Warning signs:** Tests pass when run from project root but fail from `tests/` directory.

### Pitfall 4: rapidfuzz processor= Applies to Query Too
**What goes wrong:** The `processor=` argument normalizes BOTH query and candidates. If you call `process.extract(raw_query, ...)` with a processor that normalizes underscores, the query is also normalized. This is desirable — but surprising if you pre-normalize the query manually AND pass processor=.
**Why it happens:** rapidfuzz processor applies symmetrically.
**How to avoid:** Either pre-normalize query + pass `processor=None`, or pass raw query + pass `processor=normalize_fn`. Don't do both. Recommended: pass raw query + processor= for consistency.

### Pitfall 5: init_db() Not Called Before First mapper.py Call
**What goes wrong:** If `database.py` uses auto-create (connecting and creating table in a module-level statement), import order and test isolation become fragile. If `init_db()` is never called, sqlite3 will create the DB file but the table won't exist — first INSERT fails.
**Why it happens:** Module-level side effects run at import time, which interacts badly with pytest's tmp_path isolation.
**How to avoid:** Use explicit `init_db(db_path)` with a path parameter. Tests pass `tmp_path / "test_mappings.db"`. App startup calls `init_db()` once with the production path.

---

## Code Examples

### Verified: timezone conversion round-trip
```python
# Source: verified in live session against Python 3.11.2 + dateutil 2.9.0.post0
from datetime import datetime
from dateutil import tz

naive_local = datetime(2026, 4, 17, 17, 46, 0)          # Hevy: Apr 17 5:46 PM
singapore_tz = tz.gettz("Asia/Singapore")
hevy_utc = naive_local.replace(tzinfo=singapore_tz).astimezone(tz.UTC).replace(tzinfo=None)
# hevy_utc == datetime(2026, 4, 17, 9, 46, 0)  ✓

fit_start = datetime(2026, 4, 17, 9, 45, 49)             # From original_garmin.fit
delta_minutes = abs((fit_start - hevy_utc).total_seconds()) / 60
# delta_minutes == 0.183  ✓  (within 30-min tolerance)
```

### Verified: rapidfuzz extract with objects
```python
# Source: verified against rapidfuzz 3.14.5
from rapidfuzz import process, fuzz

results = process.extract(
    "bench press",                  # normalized query
    garmin_exercises,               # list[GarminExercise]
    scorer=fuzz.WRatio,
    processor=lambda x: normalize(x.exercise_name) if isinstance(x, GarminExercise) else x,
    limit=5,
)
# Returns: list of (GarminExercise, float_score, int_index)
candidates = [(ex, score) for ex, score, _ in results]
```

### Verified: sqlite3 upsert
```python
# Source: verified against sqlite3 stdlib
with sqlite3.connect(db_path) as conn:
    conn.execute(
        "INSERT OR REPLACE INTO confirmed_mappings VALUES (?,?,?,CURRENT_TIMESTAMP)",
        (hevy_name, garmin_exercise.exercise_enum_int, garmin_exercise.exercise_name),
    )
# Idempotent: re-running with same hevy_name overwrites the row.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fuzzywuzzy | rapidfuzz | 2021 | Same API, C++ backend, no GPL dependency, 10-100x faster |
| pytz for timezone | python-dateutil tz | ~2018 | dateutil handles IANA zones natively; pytz requires explicit `localize()` which is easy to misuse |

**Deprecated/outdated:**
- `pytz.timezone("Asia/Singapore").localize(naive_dt)`: Use `naive_dt.replace(tzinfo=dateutil.tz.gettz("Asia/Singapore"))` instead. pytz `localize()` API is error-prone and pytz itself is deprecated in Python 3.9+ in favor of zoneinfo/dateutil.
- `fuzz.token_set_ratio` as primary scorer: WRatio is the recommended default — it delegates to the best sub-scorer per pair. token_sort_ratio is equivalent to WRatio for most exercise name pairs but WRatio is more robust for short vs long name comparisons.

---

## Runtime State Inventory

Not applicable — Phase 3 is a greenfield module build (no rename/refactor/migration). The `data/` directory does not yet exist; all state created fresh.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| python-dateutil | matcher.py IANA tz | ✓ | 2.9.0.post0 | — |
| rapidfuzz | mapper.py fuzzy match | ✓ | 3.14.5 | — |
| sqlite3 | database.py | ✓ (stdlib) | SQLite 3.40.1 | — |
| garmin-fit-sdk | extract_garmin_exercises.py (Wave 0 only) | ✓ | 21.200.0 | — |
| /usr/share/zoneinfo | dateutil IANA tz files | ✓ | system (Linux WSL2) | — |

[VERIFIED: all via .venv/bin/pip list and live Python session; zoneinfo confirmed via tz.gettz("Asia/Singapore") returning tzfile('/usr/share/zoneinfo/Asia/Singapore')]

**Missing dependencies:** None. All Phase 3 dependencies are installed.

**requirements.txt gap:** `rapidfuzz==3.14.5` and `python-dateutil==2.9.0.post0` are NOT in requirements.txt. Wave 0 must add them.

---

## Validation Architecture

nyquist_validation = true in config.json.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 |
| Config file | none (pytest auto-discovers tests/) |
| Quick run command | `.venv/bin/python -m pytest tests/test_matcher.py tests/test_mapper.py -x -q` |
| Full suite command | `.venv/bin/python -m pytest tests/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MATCH-01 | Hevy local dt + Singapore tz → correct UTC → 0.18 min delta | unit | `pytest tests/test_matcher.py::test_match_singapore_timezone -x` | ❌ Wave 0 |
| MATCH-01 | Invalid timezone string raises ValueError | unit | `pytest tests/test_matcher.py::test_invalid_timezone -x` | ❌ Wave 0 |
| MATCH-02 | Auto-match returns MatchResult with delta_minutes ≤ 30 | unit | `pytest tests/test_matcher.py::test_auto_match_within_tolerance -x` | ❌ Wave 0 |
| MATCH-02 | No Hevy within 30 min returns None | unit | `pytest tests/test_matcher.py::test_no_match_returns_none -x` | ❌ Wave 0 |
| MATCH-02 | Multiple candidates → closest wins | unit | `pytest tests/test_matcher.py::test_closest_candidate_wins -x` | ❌ Wave 0 |
| MATCH-03 | force_match() returns MatchResult(is_forced=True, delta=0.0) | unit | `pytest tests/test_matcher.py::test_force_match -x` | ❌ Wave 0 |
| MAP-01 | confirm_mapping + get_confirmed_mapping round-trip | unit | `pytest tests/test_mapper.py::test_confirm_and_retrieve -x` | ❌ Wave 0 |
| MAP-01 | init_db() idempotent (safe to call twice) | unit | `pytest tests/test_mapper.py::test_init_db_idempotent -x` | ❌ Wave 0 |
| MAP-02 | suggest_mapping returns ≥1 candidate for known exercise | unit | `pytest tests/test_mapper.py::test_suggest_mapping_bench_press -x` | ❌ Wave 0 |
| MAP-02 | Normalization improves match score (bench press > 70) | unit | `pytest tests/test_mapper.py::test_normalize_improves_score -x` | ❌ Wave 0 |
| MAP-03 | UNRESOLVED_THRESHOLD exported from mapper.py | unit | `pytest tests/test_mapper.py::test_unresolved_threshold_exported -x` | ❌ Wave 0 |
| MAP-04 | GENERIC_FALLBACK exported from mapper.py with enum_int=65534 | unit | `pytest tests/test_mapper.py::test_generic_fallback -x` | ❌ Wave 0 |
| MAP-04 | get_exercises_by_category('bench_press') returns non-empty list | unit | `pytest tests/test_mapper.py::test_get_exercises_by_category -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `.venv/bin/python -m pytest tests/test_matcher.py tests/test_mapper.py -x -q`
- **Per wave merge:** `.venv/bin/python -m pytest tests/ -q`
- **Phase gate:** Full suite green (all 13 existing + Phase 3 new tests) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_matcher.py` — covers MATCH-01, MATCH-02, MATCH-03
- [ ] `tests/test_mapper.py` — covers MAP-01, MAP-02, MAP-03, MAP-04
- [ ] `data/garmin_exercises.csv` — generated by `scripts/extract_garmin_exercises.py`
- [ ] `data/` directory created (add to .gitignore: `data/exercise_mappings.db`)
- [ ] `requirements.txt` updated with rapidfuzz and python-dateutil

---

## Security Domain

Phase 3 involves SQLite (local file), user-supplied timezone strings, and exercise name strings. All inputs are local-only (no network, no auth, no cryptography). ASVS categories that apply:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single-user local app |
| V3 Session Management | No | No sessions in Phase 3 |
| V4 Access Control | No | Local file system only |
| V5 Input Validation | Yes (minimal) | Validate timezone_str with `tz.gettz()` is not None; sqlite3 parameterized queries prevent SQL injection |
| V6 Cryptography | No | No secrets, no encryption |

**Parameterized queries:** All sqlite3 calls use `?` placeholders — SQL injection is not possible. No string formatting in SQL statements.

**Timezone validation:** `tz.gettz(timezone_str)` returns None for invalid IANA strings — raise ValueError immediately. Do not attempt datetime arithmetic with a None timezone.

---

## Open Questions (RESOLVED)

1. **match_workouts() return type when no match found** — RESOLVED: Plans use `-> MatchResult | None`. Phase 5 handles the None case by offering the manual force_match() flow.

2. **`data/exercise_mappings.db` in .gitignore** — RESOLVED: Plan 01 Task 3 adds `data/exercise_mappings.db` to .gitignore (user-specific). `data/garmin_exercises.csv` is committed (shared reference data).

3. **pandas in requirements.txt** — RESOLVED: Plan 01 Task 3 adds pandas to requirements.txt as a declared dependency (CLAUDE.md lists it in stack). No Phase 3 code uses it directly.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/usr/share/zoneinfo` is available on all target machines | Environment Availability | On Windows (non-WSL), zoneinfo may be absent; dateutil would need `tzdata` package. Current machine is WSL2 Linux — zoneinfo present. | 
| A2 | Garmin Connect accepts FIT set messages with exercise_category_enum_int=65534 (unknown) for unrecognized exercises | GarminExercise Dataclass | If Garmin Connect rejects unknown category, MAP-04 fallback fails. The real sample file uses (8, 65534, 7) in its category tuple (multiple categories per set), so 65534 appears in production data. |

[ASSUMED]: A1 — not tested on Windows without WSL. If target includes Windows, Phase 5 plan should add `tzdata` to requirements as a conditional dep.
[VERIFIED]: A2 — `original_garmin.fit` contains category tuple `(8, 65534, 7)` with `65534` at index 1; fitparse correctly parses it. Garmin accepted this file.

---

## Sources

### Primary (HIGH confidence)
- Live Python session against `.venv/lib/python3.11/site-packages/garmin_fit_sdk/profile.py` — exercise category and name enums, total count (1,846), category enum values
- `original_garmin.fit` parsed via fitparse 1.2.0 — confirmed naive UTC datetimes, set message category tuple format
- `original_hevy.csv` parsed via csv.DictReader — 95 workouts, 46 unique exercises, confirmed "Apr 17, 2026, 5:46 PM" timestamp format
- Live datetime arithmetic (Python 3.11.2 + dateutil 2.9.0.post0) — Singapore UTC+8 conversion, 0.18 min delta confirmed
- Live rapidfuzz 3.14.5 session — process.extract API, WRatio scorer behavior, processor= argument, score results with/without normalization
- Live sqlite3 session — init_db idempotency, INSERT OR REPLACE upsert, parameterized queries

### Secondary (MEDIUM confidence)
- garmin_fit_sdk profile.py comments and type definitions — exercise category structure and field numbers for mesg 225

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed and tested in live session
- Architecture: HIGH — matched against real sample files with verified delta calculation
- Pitfalls: HIGH — verified each pitfall claim against live execution (8-hour gap test, normalization score test)

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable libraries; garmin_fit_sdk Profile format unlikely to change)
