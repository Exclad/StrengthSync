# Architecture Patterns

**Project:** Garmin-Hevy Workout Sync
**Dimension:** FIT parsing and merging pipeline
**Researched:** 2026-04-20
**Confidence:** MEDIUM-HIGH (FIT format from spec knowledge; library write-path validation is the confirmed unknown)

---

## FIT File Format — What You Are Working With

### What FIT Is

FIT (Flexible and Interoperable Data Transfer) is a binary protocol designed by Garmin. A FIT file is a sequence of **messages**, each typed by a **global message number (mesg_num)**. Messages have a **definition** (field layout declaration) followed by **data records**. The file starts with a 14-byte header (`header_size`, `protocol_version`, `profile_version`, `data_size`, `.FIT` ASCII magic, header CRC), ends with a 2-byte CRC.

### Relevant Message Types for Strength Workouts

| Message Type | mesg_num | What It Contains | Preserve or Replace? |
|---|---|---|---|
| `file_id` | 0 | Device, product, serial, time created | **Preserve** |
| `device_info` | 23 | Watch model, software version, sensors | **Preserve** |
| `user_profile` | 3 | Age, weight, gender (used for calorie calc) | **Preserve** |
| `sport` | 12 | Sport=training, sub_sport=strength_training | **Preserve** |
| `session` | 18 | Total duration, calories, avg/max HR, start/end time | **Preserve all fields** (edit start_time if needed) |
| `lap` | 19 | One per exercise or rest period; duration, HR stats | **Preserve biometric fields**; may re-order |
| `record` | 20 | Time-series: heart_rate, cadence, power, position — 1 Hz | **Preserve entirely** |
| `event` | 21 | Timer start/stop events, workout transitions | **Preserve** |
| `workout` | 26 | Workout name metadata | **Replace name with Hevy title** |
| `workout_step` | 27 | Each exercise step — exercise_name enum, category, weight, duration | **Replace entirely** with Hevy data |
| `set` | 225 | Strength set record: weight, reps, set_type, start_time, duration | **Replace** with Hevy set data |
| `exercise_title` | 227 | String lookup table mapping exercise_name codes to display names | **Replace** with Hevy exercise names |
| `length` | 101 | Pool swim lengths — not relevant for strength | Ignore |

**Critical insight:** Garmin strength FIT files use `set` (mesg_num 225) and `exercise_title` (mesg_num 227) for the exercise content. The `record` messages carry the continuous HR/biometric stream. The `lap` messages carry per-exercise HR aggregates. The strategy is:

1. Parse everything
2. Write all non-exercise messages verbatim
3. Reconstruct `set`, `exercise_title`, and `workout_step` messages from Hevy data
4. Re-compute `session` totals only if needed (duration, set count)

---

## Recommended Architecture

### Component Map

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Layer (Flask)                       │
│  POST /upload   GET /mappings   POST /merge   GET /download  │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
    ┌───────▼───────┐             ┌───────▼───────┐
    │  FIT Parser   │             │  Hevy Parser  │
    │  (fitparse)   │             │  (csv.DictRd) │
    └───────┬───────┘             └───────┬───────┘
            │                             │
            ▼                             ▼
    ┌───────────────┐             ┌───────────────┐
    │ FIT Workout   │             │ Hevy Workout  │
    │ Data Model    │             │ Data Model    │
    └───────┬───────┘             └───────┬───────┘
            │                             │
            └──────────┬──────────────────┘
                       ▼
              ┌────────────────┐
              │Workout Matcher │  ← timezone offset input
              │(time-window)   │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐      ┌──────────────────┐
              │Exercise Mapper │◄────►│  SQLite DB       │
              │(fuzzy + manual)│      │  (name mappings) │
              └────────┬───────┘      └──────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  FIT Builder   │  ← THE critical unknown
              │(fit-tool or    │
              │ garmin SDK)    │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │  Merged .fit   │
              │  (download)    │
              └────────────────┘
```

### Component Boundaries

| Component | Inputs | Outputs | Owns |
|---|---|---|---|
| `FitParser` | `.fit` binary file path | `FitWorkout` dataclass | Reading FIT binary; extracting all messages; separating biometric from exercise messages |
| `HevyParser` | `.csv` file path | `HevyWorkout` dataclass | Parsing CSV; grouping rows by workout title + start_time; constructing `HevyExercise` and `HevySet` objects |
| `WorkoutMatcher` | `FitWorkout[]`, `HevyWorkout[]`, timezone offset string | `MatchResult[]` | UTC timestamp comparison; timezone normalization; overlap window (e.g., ±30 min) |
| `ExerciseMapper` | Hevy exercise name string | Garmin `exercise_name` enum value + `exercise_category` | SQLite lookup; fuzzy fallback; returning UNMAPPED sentinel when no match |
| `MappingStore` (SQLite) | name pair tuples | persisted rows | All DB operations; schema ownership |
| `FitBuilder` | `FitWorkout` (biometrics), `HevyWorkout` (exercises), mapping dict | `.fit` binary bytes | Writing valid FIT binary; message ordering; CRC calculation |
| `Flask App` | HTTP requests | HTTP responses + file streams | Session state; file temp storage; UI routing |

---

## Data Flow — The Merge Operation in Detail

### Step 1: Parse Garmin FIT

```
original_garmin.fit
  → FitParser.parse()
  → iterate all messages via fitparse.FitFile
  → bucket into:
       biometric_messages  = [file_id, device_info, user_profile, sport,
                               session, lap, record, event, workout]
       exercise_messages   = [set, exercise_title, workout_step]
       raw_message_bytes   = ordered list of (mesg_type, fields_dict)
                             for ALL messages (needed for pass-through write)
```

**Important:** fitparse gives you decoded field values but NOT the raw binary. For faithful pass-through of biometric messages, you need either:
- (a) `fit-tool` or `garmin-fit-sdk` which expose raw message bytes, OR
- (b) Re-encode each biometric message from its decoded fields using your writer library

Option (b) is safer because it avoids depending on byte-perfect round-tripping, but requires complete field coverage. This is the first architectural decision to validate.

### Step 2: Parse Hevy CSV

```
original_hevy.csv columns:
  title, start_time, end_time, description,
  exercise_title, superset_id, exercise_notes,
  set_index, set_type, weight_kg, reps,
  distance_km, duration_seconds, rpe

  → HevyParser.parse()
  → group rows by (title, start_time)  ← one workout per unique pair
  → within each workout, group by exercise_title → ordered list of sets
  → parse timestamps: "Apr 17, 2026, 5:46 PM" format
     strptime format: "%b %d, %Y, %I:%M %p"
  → store as naive datetime (local time — timezone not in CSV)
```

**Timezone note:** Hevy timestamps are local time (no tz info). Garmin `session.start_time` is UTC seconds since 1989-12-31 00:00:00 (Garmin epoch, NOT Unix epoch). Matching requires: Hevy local → UTC via user-supplied offset → compare to Garmin UTC.

### Step 3: Match Workouts

```
WorkoutMatcher.match(garmin_workouts, hevy_workouts, tz_offset_hours)

For each Hevy workout:
  hevy_utc = hevy_start_naive - timedelta(hours=tz_offset_hours)
  For each Garmin workout:
    garmin_utc = garmin_session.start_time  (already UTC)
    delta = abs(hevy_utc - garmin_utc)
    if delta < MATCH_WINDOW (default: 30 min):
      → candidate match
  → Return best match (smallest delta) or UNMATCHED
```

Garmin epoch conversion: `datetime(1989, 12, 31) + timedelta(seconds=fit_timestamp)`.

The tz_offset_hours is a signed float (e.g., +8.0 for Singapore, -5.0 for EST). Store it as a user input in the Flask session; persist last-used value in SQLite preferences table.

### Step 4: Map Exercises

```
ExerciseMapper.map(hevy_exercise_title) → (garmin_exercise_name_id, garmin_category_id)

Lookup order:
  1. SQLite exact match (hevy_name → garmin_name pair, previously confirmed by user)
  2. Fuzzy match: rapidfuzz.fuzz.token_sort_ratio against known Garmin exercise list
     threshold: 80 (configurable)
  3. Return UNMAPPED sentinel → UI presents for manual resolution before merge proceeds

Garmin exercise_name is a FIT Profile enum (numeric ID from the official FIT SDK profile).
The mapping table stores: hevy_name TEXT, garmin_exercise_name_id INT, garmin_category_id INT,
                          confirmed BOOL, created_at TIMESTAMP
```

Exercise mapping must be complete (no UNMAPPEDs) before FitBuilder is called.

### Step 5: Build Merged FIT

```
FitBuilder.build(biometric_messages, hevy_exercises, mapping_dict) → bytes

Message ordering in output FIT (Garmin Connect expects this order):
  1. file_id
  2. device_info (one or more)
  3. user_profile (optional but safe to include)
  4. sport
  5. workout (name from Hevy workout title)
  6. workout_step × N  (one per exercise, from Hevy)
  7. event (timer_start)
  8. record × T  (full biometric time-series — VERBATIM)
  9. [lap × N]  (preserve if present; represent exercise boundaries)
  10. set × S  (one per Hevy set, with weight/reps from Hevy, timing estimated)
  11. exercise_title × E  (one per unique exercise, mapped Garmin IDs)
  12. event (timer_stop)
  13. session  (preserve all biometric fields; update num_sets if needed)
  14. activity
```

**Critical FIT writing constraint:** The FIT format requires that definition messages precede their corresponding data messages within each local message type block. Message ordering within the file affects how Garmin Connect validates and displays the data. Garmin Connect is documented to reject files with invalid CRC, missing required fields in `session` or `file_id`, or messages appearing before their definitions.

---

## Library Selection — The Critical Unknown

### fitparse (read-only, mature)
- **Status:** Production-stable, widely used; read-only — cannot write FIT
- **Use for:** Parsing `original_garmin.fit` in development/exploration
- **Limitation:** Cannot write; not suitable for production pipeline output

### fit-tool (Python, read+write)
- **Status:** Third-party Python library with both read and write support
- **Confidence:** MEDIUM — community library, not Garmin-official
- **Risk:** May not support all mesg_num types (particularly mesg_num 225=set, 227=exercise_title which are newer profile additions)
- **Validation required:** Write a round-trip test: parse original_garmin.fit → write identical output → upload to Garmin Connect

### garmin-fit-sdk (official Python bindings)
- **Status:** Official Garmin SDK; Python bindings exist as of FIT SDK 21.x
- **Confidence:** HIGH for correctness; MEDIUM for Python ergonomics
- **Advantage:** Full profile coverage including newest message types; CRC handling is correct by definition
- **Risk:** SDK may be verbose/low-level; documentation quality varies

### Recommendation
Use **fitparse for reading** (proven, ergonomic), **garmin-fit-sdk for writing** (official correctness). If garmin-fit-sdk Python bindings prove too cumbersome, fall back to **fit-tool** with a round-trip validation gate before Phase 1 ships.

The first thing built (Milestone 0 / proof-of-concept) must be: read `original_garmin.fit` → write identical content → verify Garmin Connect accepts it. Everything else depends on this.

---

## Suggested Build Order

### Why This Order

FIT write validity is the single project-killing risk. If the output file is rejected by Garmin Connect, the project has no value. All other components (web UI, fuzzy matching, SQLite) are standard Python work with well-understood risks. Build order front-loads the only real unknown.

### Build Sequence

**Milestone 1 — FIT Round-Trip Proof (de-risk first)**
1. Install fitparse + chosen write library
2. Write `scripts/roundtrip_test.py`: read `original_garmin.fit`, write identical output, diff byte counts
3. Upload output to Garmin Connect — confirm acceptance
4. If rejected: debug message ordering, CRC, required fields
5. Gate: do not proceed to Milestone 2 until round-trip passes Garmin Connect upload

**Milestone 2 — Parsers (both data sources)**
1. `fit_parser.py`: `FitParser.parse(path)` → `FitWorkout` dataclass
   - Separate biometric vs exercise messages
   - Extract session start_time (Garmin epoch → UTC datetime)
2. `hevy_parser.py`: `HevyParser.parse(path)` → `HevyWorkout[]`
   - Group by workout, group sets by exercise
   - Parse Hevy timestamp strings → naive datetime

**Milestone 3 — Matcher + Mapper**
1. `workout_matcher.py`: `WorkoutMatcher.match()` with timezone offset
2. `exercise_mapper.py`: SQLite schema + exact lookup + rapidfuzz fuzzy
3. `mapping_store.py`: SQLite CRUD for mapping persistence

**Milestone 4 — FIT Builder**
1. `fit_builder.py`: `FitBuilder.build()` producing merged output
2. Unit test: build from known inputs, verify output field values via fitparse re-parse
3. Integration test: upload merged output to Garmin Connect

**Milestone 5 — Flask Web App**
1. File upload endpoints (FIT + CSV)
2. Mapping review UI (show UNMAPPED exercises, accept user corrections)
3. Merge trigger + file download
4. Timezone offset input (persist in session)

**Milestone 6 — Hardening**
1. Error handling: corrupt FIT, malformed CSV, no match found
2. SQLite preferences (last timezone, default match window)
3. Docker packaging

---

## Component Boundaries — What Talks to What

```
Flask App
  ├── calls FitParser.parse(upload_path) → FitWorkout
  ├── calls HevyParser.parse(upload_path) → HevyWorkout[]
  ├── calls WorkoutMatcher.match(fit, hevy_list, tz) → MatchResult
  ├── calls ExerciseMapper.map(name) → (id, category) or UNMAPPED
  ├── calls MappingStore.save(hevy_name, garmin_id, category)
  ├── calls FitBuilder.build(fit_workout, hevy_workout, mappings) → bytes
  └── serves bytes as file download

ExerciseMapper
  └── reads/writes MappingStore (SQLite)

FitBuilder
  ├── reads from FitWorkout (biometric messages)
  └── reads from HevyWorkout + mapping dict (exercise content)

No component is allowed to write to the filesystem directly except:
  - Flask App (temp upload/download files)
  - MappingStore (SQLite file path from config)
```

### Data Models (Python dataclasses)

```python
@dataclass
class FitSet:
    start_time: datetime       # UTC
    duration_s: float
    weight_kg: float
    reps: int
    set_type: str              # "active" | "rest" | "warmup"
    exercise_name_id: int      # Garmin enum
    exercise_category_id: int  # Garmin enum

@dataclass
class FitExercise:
    name: str                  # Hevy display name (pre-mapping)
    sets: List[FitSet]

@dataclass
class FitWorkout:
    source_path: str
    session_start_utc: datetime
    session_end_utc: datetime
    biometric_messages: List[dict]   # ordered list of (mesg_type, fields)
    exercise_messages: List[dict]    # to be replaced
    session_fields: dict             # all session message fields verbatim

@dataclass
class HevySet:
    set_index: int
    set_type: str              # "normal" | "warmup" | "failure"
    weight_kg: float
    reps: int
    rpe: Optional[float]
    duration_s: Optional[float]

@dataclass
class HevyExercise:
    title: str                 # e.g. "Leg Press Horizontal (Machine)"
    sets: List[HevySet]

@dataclass
class HevyWorkout:
    title: str                 # e.g. "Legs"
    start_time_local: datetime # naive, from CSV
    end_time_local: datetime   # naive, from CSV
    exercises: List[HevyExercise]

@dataclass
class MatchResult:
    fit_workout: FitWorkout
    hevy_workout: HevyWorkout
    delta_minutes: float
    confidence: str            # "auto" | "manual"
```

---

## Timezone Integration Point

The timezone offset is a single signed float (hours). It touches exactly one place:

```python
# WorkoutMatcher.match()
hevy_utc = hevy_workout.start_time_local - timedelta(hours=tz_offset_hours)
# Compare to: fit_workout.session_start_utc  (already UTC)
```

The offset is:
- Collected once in the Flask UI (text input or dropdown: common timezones)
- Stored in Flask session + SQLite preferences table for persistence
- Passed explicitly to `WorkoutMatcher.match()` — not a global
- Not baked into data models (data stays timezone-naive/UTC as parsed)

**Common mistake to avoid:** Using Python `pytz` or `zoneinfo` timezone names when the user just needs a numeric offset. For v1, a signed float like `+8.0` (Singapore) or `-5.0` (US Eastern) is sufficient and avoids DST complexity entirely. Phase 2 can add IANA timezone name support.

---

## Pitfalls in the Pipeline

### FIT Message Ordering
Garmin Connect validates message ordering. Definition records must precede data records for each local message type. Within the file, activity-type files expect `session` to appear after all `record` and `lap` messages.

### Garmin Epoch vs Unix Epoch
All FIT timestamps are seconds since **1989-12-31 00:00:00 UTC** (not Unix epoch 1970-01-01). Off-by-631065600 errors will cause timestamps to show as 1990s dates in Garmin Connect.

```python
GARMIN_EPOCH = datetime(1989, 12, 31, tzinfo=timezone.utc)
def fit_timestamp_to_utc(fit_ts: int) -> datetime:
    return GARMIN_EPOCH + timedelta(seconds=fit_ts)
```

### exercise_title vs exercise_name
FIT has two overlapping concepts:
- `exercise_name` (field in `set` and `workout_step`): a numeric enum from the FIT Profile
- `exercise_title` (mesg_num 227): a string lookup that overrides the enum display name in Garmin Connect

For Hevy exercises that have no Garmin enum equivalent, write `exercise_name = 0` (unspecified) and use `exercise_title` to carry the display string. This is how custom exercises work in Garmin.

### CRC Requirement
The 2-byte CRC at the end of the file is mandatory. CRC16/CCITT-FALSE over the data section. Most write libraries handle this automatically; verify by checking the last 2 bytes of the original file against the computed CRC.

### set.start_time Estimation
Hevy CSV does not include per-set timestamps — only workout start/end. For the `set` messages, start_time must be estimated. Safe approach: distribute sets linearly between workout start and end time, using `lap` timing from the original FIT if available to anchor individual exercise windows.

---

## Sources

- Garmin FIT Protocol Specification (training knowledge, HIGH confidence for core message types)
- FIT SDK profile.xlsx mesg_num definitions (training knowledge, HIGH confidence)
- fitparse library API (training knowledge, MEDIUM confidence — verify current version)
- Hevy CSV sample: `GarminHevyMerge/original_hevy.csv` (direct inspection, HIGH confidence)
- Garmin FIT profile for mesg_num 225 (set) and 227 (exercise_title): MEDIUM confidence — these are newer profile additions; verify against actual FIT SDK profile version used by target watch firmware
- HevyConnect reference project: not inspectable (WebFetch denied) — patterns inferred from project description
