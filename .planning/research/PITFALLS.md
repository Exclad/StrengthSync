# Domain Pitfalls: Garmin FIT + Hevy Workout Merger

**Domain:** FIT file generation, fitness data merging, local Python web app
**Researched:** 2026-04-20
**Confidence basis:** FIT protocol specification knowledge (HIGH), direct inspection of actual sample files (HIGH), Python FIT library ecosystem (MEDIUM — write-path less documented than read-path)

---

## Critical Pitfalls

Mistakes that cause Garmin Connect to reject the output file or silently corrupt data.

---

### Pitfall 1: fitparse Is Read-Only — Cannot Write FIT Files

**What goes wrong:** The project lists `fitparse` as a candidate FIT library. fitparse is a read-only parsing library. It has no write API. If the team starts Phase 1 assuming fitparse can write FIT files, the entire output pipeline is unimplemented at the end of the phase.

**Why it happens:** fitparse's README and PyPI description don't prominently label it as read-only. Developers assume symmetric read/write capability.

**Consequences:** Phase 1 blocked. Cannot produce output FIT file at all.

**Prevention:**
- Use `fit-tool` (by Garmin, Python, has write support) or the official `garmin-fit-sdk` Python package for write operations.
- Alternative: use `python-fitparse` for reading input, and `fit-tool` for writing output — they can coexist.
- Verify write capability by running a round-trip test (read original FIT → write identical FIT → diff binary output) before committing to any library.

**Detection:** Searching fitparse's API for a `FitFile.write()` or encoder method returns nothing. Check before writing any parser code.

**Phase:** Address in Phase 1, first task. Do not write any parsing code until library selection is confirmed to cover both read and write.

---

### Pitfall 2: FIT Timestamp Epoch Is Not Unix Epoch

**What goes wrong:** FIT protocol uses its own epoch: January 1, 1989 00:00:00 UTC (not Unix epoch of January 1, 1970). The offset is 631065600 seconds. Using Unix timestamps directly in FIT timestamp fields produces dates in 2025-2026 being stored as dates in 2044-2045, or vice versa.

**Why it happens:** Developers reach for `datetime.timestamp()` or `time.time()` and pass the result directly into FIT message fields.

**Consequences:** Garmin Connect accepts the file but displays the workout on the wrong date — 36 years off. The workout appears in the future. Matching with other activities breaks silently.

**Prevention:**
```python
FIT_EPOCH_OFFSET = 631065600  # seconds between 1970-01-01 and 1989-01-01
def to_fit_timestamp(unix_ts: float) -> int:
    return int(unix_ts) - FIT_EPOCH_OFFSET
def from_fit_timestamp(fit_ts: int) -> float:
    return fit_ts + FIT_EPOCH_OFFSET
```
Most FIT libraries handle this automatically if you use their timestamp types. The danger is writing raw integer values manually.

**Detection:** After writing a test FIT file, parse it back and check that the `start_time` field matches the expected datetime. A 36-year error is obvious.

**Phase:** Phase 1. Add a datetime round-trip test to the test suite immediately.

---

### Pitfall 3: Missing or Incorrect file_id Message Causes Silent Rejection

**What goes wrong:** Every valid FIT file must begin with a `file_id` message as the first data message after the file header. The `file_id` message must declare `type = activity` (value 4) for workout files. A file missing `file_id`, or with the wrong `type` value, may be rejected by Garmin Connect or imported as the wrong activity type.

**Why it happens:** Developers building the FIT structure focus on exercise data messages (sets, reps) and forget the required preamble messages.

**Consequences:** Garmin Connect returns a generic "file could not be processed" error with no specific reason. The file is silently discarded.

**Prevention:** Required message sequence for a strength activity FIT file:
1. FIT file header (14 bytes, protocol version, data size, `.FIT` magic bytes)
2. `file_id` message: `type=activity`, `manufacturer`, `product`, `serial_number`, `time_created`
3. `file_creator` message (optional but recommended)
4. `device_info` message (recommended — Garmin Connect uses this for display)
5. `event` message: `event=timer`, `event_type=start`
6. Per-exercise: `workout_step` or `set` messages
7. `event` message: `event=timer`, `event_type=stop`
8. `session` message: summarizes the activity
9. `activity` message: wraps the session(s)
10. CRC (2 bytes)

Copy this structure exactly from the original Garmin FIT file. Do not invent message order.

**Detection:** Parse the original `original_garmin.fit` file and log every message type in order before writing any output. Mirror that structure.

**Phase:** Phase 1. Parse message order from original file first, before writing a single output byte.

---

### Pitfall 4: CRC Must Be Recalculated After Every Write

**What goes wrong:** FIT files end with a 2-byte CRC calculated over the entire file content (header + data records). If any byte in the file changes — including a timestamp, a rep count, or a single set — the CRC must be fully recomputed. Writing a modified file without recomputing CRC causes immediate rejection.

**Why it happens:** Developers manually edit fields in a parsed FIT structure and forget that the CRC covers the entire file. Also happens when concatenating byte strings without running CRC at the end.

**Consequences:** Garmin Connect rejects the file with a checksum error. The error is often reported as "corrupt file" with no further detail.

**Prevention:** Never manually construct the CRC. Use the FIT library's built-in encode/write method, which handles CRC automatically. If using `fit-tool`, the `FitFile.to_bytes()` method computes CRC. Do not manually slice and splice raw bytes from the original file — use the library's object model.

**Detection:** Use `fitparse` to re-parse the output file before upload. fitparse raises `FitCRCError` on invalid CRC. This should be in the validation step.

**Phase:** Phase 1. Include CRC validation in the output validation function.

---

### Pitfall 5: Strength Activity Requires sport=training, sub_sport=strength_training

**What goes wrong:** The `session` and `sport` messages in a FIT file must specify the correct sport type. For strength workouts: `sport = training` (value 4) and `sub_sport = strength_training` (value 20). Using the wrong values causes the workout to appear as a different activity type in Garmin Connect (e.g., a generic "Other" or cardio activity), and exercise data may not render correctly.

**Why it happens:** The original Garmin FIT file might record the session differently (e.g., if the watch was set to a generic workout mode). Developers copy the original values without checking whether they're correct for strength training.

**Consequences:** Garmin Connect shows the activity in the wrong category. Exercise sets/reps may not appear in the strength training panel. Heart rate is still recorded but not displayed in context.

**Prevention:** Read the `sport` and `sub_sport` values from the original FIT file. Verify they are `training` / `strength_training`. If the original file uses different values, decide whether to override them during merge (likely yes — this is a strength workout by definition).

**Detection:** After import to Garmin Connect, check that the activity appears under "Strength Training" in the activity history, not under "Cardio" or "Other."

**Phase:** Phase 1.

---

### Pitfall 6: exercise_name Field Uses Garmin's Integer Enum, Not Free Text

**What goes wrong:** In FIT `set` messages, the `exercise_name` field is not a string — it is an integer referencing Garmin's internal exercise enumeration. For example, `exercise_name = bench_press` maps to a numeric value in the `bench_press_exercise_name` enum. The FIT spec defines separate enum types per exercise category (bench press, squat, deadlift, etc.), each with their own numeric values.

**Why it happens:** Developers assume `exercise_name` accepts arbitrary strings (like Hevy's "Chest Press (Machine)"). Passing a string to an integer enum field either errors or writes garbage data.

**Consequences:** Garmin Connect shows the exercise as "Unknown" or does not display it at all. Strength training history is broken.

**Prevention:**
- The FIT SDK ships a `profile.xlsx` or similar file listing all exercise enums. Map each Hevy exercise name to its Garmin enum value.
- Exercises with no Garmin equivalent (e.g., Hevy-specific machine names) must use `exercise_name = custom_exercise` and supply the `custom_exercise_name` string field.
- Build a mapping table in Phase 1. Accept that ~30-50% of machine-specific exercise names from this dataset ("Leg Press Horizontal (Machine)", "Iso-Lateral Row (Machine)") will have no direct Garmin enum and will fall back to custom.

**Detection:** After writing a test FIT file with one exercise, import to Garmin Connect and verify the exercise name appears correctly (not "Unknown").

**Phase:** Phase 1 must include the mapping table for the exercises present in the sample file. Phase 2 extends it with fuzzy matching for new exercises.

---

### Pitfall 7: Hevy Timestamps Are Local Time, Not UTC — And Garmin FIT Requires UTC

**What goes wrong:** Hevy CSV timestamps are in local time with no timezone marker. The actual sample file confirms this: `"Apr 17, 2026, 5:46 PM"` — this is Singapore local time (UTC+8), not UTC. Garmin FIT timestamps must be UTC (FIT epoch). If Hevy timestamps are treated as UTC when matching against Garmin FIT times, workouts will be mismatched by 8 hours.

**Concrete example from the sample data:** The Hevy CSV shows a workout starting `Apr 17, 2026, 5:46 PM` (local). This is `Apr 17, 2026, 09:46 UTC`. The matching Garmin FIT file will record `start_time` as the UTC equivalent. If the app compares `5:46 PM` directly against the FIT timestamp (which decodes to `9:46 AM UTC`), the difference is 8 hours — they will not match with any reasonable tolerance window.

**Why it happens:** Timestamps look like they could be either UTC or local. The CSV format gives no hint. There is no timezone suffix in Hevy's export format.

**Consequences:** Workout matching fails completely for all users not in UTC. Singapore (UTC+8) is a known use case here — 100% of workouts will fail to match if this is not handled.

**Prevention:**
- Treat all Hevy timestamps as the user's local time (user-specified timezone, e.g., `Asia/Singapore`).
- Convert Hevy timestamps to UTC before comparing with Garmin FIT timestamps.
- Use `pytz` or `zoneinfo` (Python 3.9+ stdlib) for timezone conversion, not manual offset arithmetic.
- Input: user selects timezone from a list in the UI (not a raw UTC offset — a named timezone handles DST automatically).

```python
from zoneinfo import ZoneInfo
from datetime import datetime

tz = ZoneInfo("Asia/Singapore")
hevy_dt = datetime.strptime("Apr 17, 2026, 5:46 PM", "%b %d, %Y, %I:%M %p")
hevy_utc = hevy_dt.replace(tzinfo=tz).astimezone(ZoneInfo("UTC"))
```

**Detection:** Matching unit test: parse a known Hevy timestamp + Singapore timezone → verify UTC output equals expected UTC time.

**Phase:** Phase 1. Must be correct before any workout matching is attempted.

---

### Pitfall 8: Hevy Timestamp Format Is Locale-Dependent and Non-Standard

**What goes wrong:** Hevy CSV timestamps use the format `"Apr 17, 2026, 5:46 PM"` — a US-locale, 12-hour format with month abbreviation, comma-separated. This is not ISO 8601. `datetime.fromisoformat()` will fail. `pandas.to_datetime()` may succeed but silently mis-parse ambiguous dates (e.g., is `Mar 2` month=March or day=2 if locale differs).

**Confirmed from sample file:** The actual timestamps are: `"Apr 17, 2026, 5:46 PM"`, `"Apr 13, 2026, 5:11 PM"`, `"Mar 9, 2026, 10:58 AM"`. The format string is `"%b %d, %Y, %I:%M %p"` in Python strptime notation. The comma between date and time and the trailing `AM`/`PM` are format traps.

**Why it happens:** Developers try `datetime.fromisoformat()` or assume pandas can infer the format.

**Consequences:** Timestamp parsing raises an exception and crashes, or silently produces wrong dates. All workout matching fails.

**Prevention:**
```python
from datetime import datetime
def parse_hevy_timestamp(s: str) -> datetime:
    # Strips surrounding quotes if present (CSV values are quoted)
    return datetime.strptime(s.strip('"'), "%b %d, %Y, %I:%M %p")
```
Write a unit test against the known sample values before integrating into the parser.

**Detection:** Parser unit tests with the exact format strings from the sample file.

**Phase:** Phase 1, first task in Hevy parsing.

---

### Pitfall 9: Hevy CSV Has Empty Cells for Non-Applicable Fields — Not Zero

**What goes wrong:** Hevy uses empty CSV cells (not `0`, not `null`, not `"N/A"`) for fields that don't apply to a given set type. Confirmed from sample data:
- Cardio exercises (Treadmill, Stair Machine): `weight_kg` and `reps` columns are empty, `distance_km` and `duration_seconds` are populated.
- Strength exercises: `distance_km` and `duration_seconds` columns are empty.
- `rpe` column is sometimes empty (e.g., line 121 in the sample, line 180).
- `superset_id` column is empty for most rows.

**Why it happens:** Developers reading the CSV with `int(row['reps'])` crash on empty string. Or they check `if row['weight_kg']:` and get `False` for `0.0` weight (which is a valid weight for bodyweight exercises).

**Consequences:** `ValueError` on parsing, or incorrect filtering of 0-weight bodyweight exercises.

**Prevention:**
```python
def parse_optional_float(val: str) -> float | None:
    val = val.strip()
    return float(val) if val else None

def parse_optional_int(val: str) -> int | None:
    val = val.strip()
    return int(val) if val else None
```
Distinguish `None` (not applicable) from `0` (bodyweight). Use `None` for non-applicable fields and handle accordingly.

**Detection:** Parse the full sample CSV file and assert that cardio rows have `weight_kg=None` and `reps=None`, while bodyweight rows may have `weight_kg=0.0`.

**Phase:** Phase 1.

---

### Pitfall 10: Hevy Contains Mixed Activity Types in One CSV Export — Cardio Is Not Strength

**What goes wrong:** Hevy CSV exports include all workouts regardless of type. The sample file contains cardio sets ("Treadmill", "Stair Machine (Floors)") within otherwise strength-training sessions. These rows have no `weight_kg` or `reps` and instead use `distance_km` and `duration_seconds`.

**Why it happens:** Developers assume all rows are strength sets (weight + reps). The merge logic tries to create FIT `set` messages for cardio rows, which requires different FIT message types and fields.

**Consequences:** FIT file generation crashes or produces malformed messages when encountering cardio rows. Or cardio rows are silently skipped, with no indication to the user that data was dropped.

**Prevention:**
- Detect row type during parsing: if `weight_kg` and `reps` are both empty → treat as cardio set.
- For Phase 1 MVP, explicitly skip cardio rows with a logged warning (acceptable for a strength-focused merge).
- For Phase 2, map cardio exercises to FIT lap or length messages if needed.

**Detection:** Parser test against the sample file: assert that rows with `exercise_title = "Treadmill"` are classified as `set_type = "cardio"`.

**Phase:** Phase 1.

---

### Pitfall 11: FIT Message Definition Records Must Precede Data Records

**What goes wrong:** FIT protocol requires that every data message type be preceded by a "definition message" that declares the field layout for that message type. Writing a `set` data message before its definition message causes immediate parse failure. Some FIT writing libraries emit definitions automatically; others require explicit calls.

**Why it happens:** Library documentation examples may show shortcuts or the library may silently handle definitions in simple cases but fail for custom message types.

**Consequences:** Garmin Connect rejects the file; `fitparse` reports "unexpected message type" when validating.

**Prevention:** Use a FIT library that manages definition messages automatically (e.g., `fit-tool`). If using lower-level libraries, follow the pattern: emit definition → emit data → repeat for each new message type encountered. Never emit a data message of a type not yet defined in the current file.

**Phase:** Phase 1.

---

### Pitfall 12: FIT weight Field Is in Kilograms × 1000 (Integer, Not Float)

**What goes wrong:** FIT `set` messages store weight as an integer in units of `1/1000 kg` (i.e., grams × 0.001). For example, 60.0 kg is stored as `60000`. Passing `60.0` (a float) directly into the FIT weight field stores it as `60` (60 grams), destroying all weight data.

**Why it happens:** Hevy weight is stored as `float` (e.g., `22.5`, `48.75`, `52.5`). The scaling factor is not obvious from field names.

**Consequences:** All weight data in Garmin Connect shows as near-zero. The entire value proposition of the merge (accurate weight tracking) is broken silently.

**Prevention:**
```python
fit_weight = int(hevy_weight_kg * 1000)  # e.g., 22.5 kg → 22500
```
Verify against the original Garmin FIT file: read the `weight` field from a known set and confirm the scale matches.

**Detection:** After writing a test FIT file, parse it back and assert that `weight / 1000` equals the original Hevy weight in kg.

**Phase:** Phase 1.

---

### Pitfall 13: Workout Matching Window Must Tolerate Clock Drift and Watch Lag

**What goes wrong:** Garmin watch start time is recorded when the user presses "start" on the watch. Hevy start time is recorded when the user starts the workout in the app. These two actions rarely happen at the same moment. In practice, they can differ by several minutes. A strict equality match will fail.

**Additionally:** The user may forget to start one app, start the watch mid-workout, or have a phone clock slightly different from the watch clock.

**Confirmed timezone note:** Hevy timestamps in the sample data (`Apr 17, 2026, 5:46 PM` Singapore) must be compared against Garmin FIT UTC times. After timezone conversion, the remaining difference is the clock/behavior offset.

**Why it happens:** Developers implement `if hevy_start == garmin_start` (or within 1 minute) and find matches fail in practice.

**Consequences:** Auto-matching fails. User must manually match every workout, defeating the core automation.

**Prevention:**
- Use a tolerance window of ±30 minutes for matching (find Garmin sessions whose time range overlaps the Hevy workout time range).
- Prefer "duration overlap" matching over "start time proximity": check if the Hevy workout time range `[start, end]` overlaps the Garmin session time range.
- Expose the matching confidence score in the UI so users can confirm or override.

**Detection:** Test with the actual sample files: does the matching algorithm correctly pair the Hevy workout on `Apr 17, 2026 5:46 PM (SGT)` with the right Garmin session?

**Phase:** Phase 1 (basic tolerance matching). Phase 2 (confidence scoring and manual override).

---

### Pitfall 14: Garmin Connect Rejects Duplicate Activity Upload

**What goes wrong:** Garmin Connect detects duplicate activities by comparing `start_time`, `sport`, and duration. If the user uploads the original Garmin FIT file and then the merged FIT file, Garmin Connect may reject the second as a duplicate or prompt for replacement.

**Why it happens:** The merged FIT file preserves the same start time and sport as the original.

**Consequences:** User cannot see the merged activity because it was rejected as a duplicate of the unmerged original. They must manually delete the original first.

**Prevention:**
- Document this workflow clearly in the UI: "Before uploading the merged file, delete the original activity from Garmin Connect."
- Add a visible warning in the download step of the UI.
- Do not attempt to work around by altering the start time (this breaks data integrity).

**Phase:** Phase 1 (add UI warning). Phase 4 (document in README).

---

## Moderate Pitfalls

---

### Pitfall 15: RPE Field Has No FIT Equivalent

**What goes wrong:** Hevy records RPE (Rate of Perceived Exertion) per set. The FIT `set` message has no standard RPE field. Attempting to write RPE into a non-existent FIT field causes a library error or silent data loss.

**Prevention:** For Phase 1, drop RPE during FIT generation (it has no home in the FIT spec). For Phase 2, store RPE in a developer-field (FIT allows custom developer fields). Flag this as a known data loss point in the UI ("Note: RPE data is not included in the exported FIT file").

**Phase:** Phase 1 (drop gracefully). Phase 2+ (developer fields if desired).

---

### Pitfall 16: set_index in Hevy Is 0-Based; FIT Expects 1-Based set_order

**What goes wrong:** Hevy's `set_index` starts at 0 for the first set. FIT's `set` message typically expects a 1-based `message_index` or `set_order`. Passing Hevy's `set_index=0` directly may cause the first set to be recorded as index 0, which some validators reject.

**Prevention:**
```python
fit_set_order = hevy_set_index + 1
```

**Phase:** Phase 1.

---

### Pitfall 17: Hevy's "Warm-Up" and "Drop Set" Set Types Have No Direct FIT Equivalent

**What goes wrong:** The Hevy `set_type` column includes values: `"normal"`, `"warmup"`, `"drop_set"`, `"failure"` (the sample file only shows `"normal"` but the Hevy app supports all). FIT `set` messages have a `set_type` field with values `active` and `rest`. There is no FIT equivalent for warmup, drop set, or failure.

**Prevention:**
- Map `normal` → `active`.
- Map `warmup` → `active` with a note (or skip from totals).
- Map `drop_set` → `active`.
- Document the mapping in the exercise mapping UI.
- Do not crash on unexpected `set_type` values — use a safe default of `active`.

**Phase:** Phase 1.

---

### Pitfall 18: FIT File Header Data Size Field Must Be Exact

**What goes wrong:** The FIT file header contains a `data_size` field (4 bytes) that must equal the exact number of data bytes following the header (excluding the final 2-byte CRC). If a FIT library writes the data and then the caller truncates or appends bytes, the header's declared size no longer matches, and parsers reject the file.

**Prevention:** Always use the library's complete serialization method (e.g., `write()` or `to_bytes()`). Never manually patch bytes into a partially-written FIT file. If modifying an existing FIT (not building from scratch), use the library's object model, not byte-level manipulation.

**Phase:** Phase 1.

---

### Pitfall 19: Hevy Exercise Names Change Over App Versions

**What goes wrong:** Hevy periodically renames exercises (e.g., "Seated Bicep Curl" may become "Preacher Curl (Machine)" in a future version). A static mapping table built on today's exercise names will silently fail to map renamed exercises in future exports.

**Prevention:**
- Store mappings by normalized lowercase name with punctuation stripped.
- Log "unmapped exercise" warnings prominently in the UI on every merge, even for exercises that were previously mapped.
- Phase 2's SQLite mapping DB should store the original Hevy name as the key (not a normalized version) so the user can see exactly what failed.

**Phase:** Phase 2 (persistent mapping DB). Phase 1 must at minimum log unmapped exercises.

---

## Minor Pitfalls

---

### Pitfall 20: Hevy CSV `description` and `exercise_notes` Fields May Contain Commas or Newlines

**What goes wrong:** The sample file shows `exercise_notes` values like `"Seat: 3"` (confirmed at line 188-191). If notes contain commas or newlines not properly quoted, naive CSV parsing with `str.split(',')` breaks. Python's `csv.DictReader` handles RFC 4180 quoting correctly; custom splitting does not.

**Prevention:** Always use `csv.DictReader` or `pandas.read_csv`. Never split on comma manually.

**Phase:** Phase 1.

---

### Pitfall 21: FIT Files Use Little-Endian Byte Order by Default

**What goes wrong:** FIT protocol supports both little-endian and big-endian records, declared per-message in the definition record. The default for Garmin devices is little-endian. If a developer manually packs multi-byte integers (e.g., using `struct.pack('>I', ...)` big-endian), timestamps and weights will be misread.

**Prevention:** Use the FIT library's field-level setters, not raw struct packing. Verify endianness from the original file's definition records.

**Phase:** Phase 1.

---

### Pitfall 22: Garmin Connect Has an Undocumented File Size Limit

**What goes wrong:** Very long workouts with many exercises (30+ exercises, 200+ sets) may produce FIT files exceeding Garmin Connect's undocumented upload limit. The error returned is typically generic ("upload failed").

**Prevention:** For Phase 1, test with the actual sample data (which is within normal bounds). For Phase 4 batch mode, test with extreme workout lengths.

**Phase:** Phase 4.

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|----------------|------------|
| Phase 1 | Library selection | fitparse is read-only | Confirm write support before any code |
| Phase 1 | FIT timestamp writing | FIT epoch vs Unix epoch | Unit test timestamp round-trip immediately |
| Phase 1 | FIT file structure | Missing file_id / wrong message order | Parse original file to extract structure first |
| Phase 1 | Exercise name mapping | Garmin uses integer enums, not strings | Build enum mapping table from FIT SDK profile |
| Phase 1 | Hevy CSV parsing | Timestamps are local time, non-ISO format | Use explicit strptime + zoneinfo conversion |
| Phase 1 | Weight field scaling | kg × 1000 in FIT, float in Hevy | Unit test weight round-trip |
| Phase 1 | Mixed set types | Cardio rows mixed in with strength rows | Detect and skip cardio rows explicitly |
| Phase 1 | CRC | Must recompute after any change | Use library write method; validate output with fitparse |
| Phase 2 | Exercise mapping DB | Hevy names can change across versions | Store original string as key; log all misses |
| Phase 3 | Hevy API | Unknown timezone behavior of API responses | Confirm whether API returns UTC or local time |
| Phase 4 | Duplicate upload | Garmin Connect rejects duplicate start times | Document delete-original workflow in README |

---

## Sources

- Direct inspection of `GarminHevyMerge/original_hevy.csv` (confirmed timestamp format, column names, empty cell behavior, cardio mixed rows, RPE format) — HIGH confidence
- FIT Protocol Specification v21.x (Garmin Developer) — epoch definition, message structure, CRC requirements, field types — HIGH confidence (training data)
- FIT Activity SDK Profile (exercise_name enums, set message fields, weight field scale) — HIGH confidence (training data)
- fitparse PyPI / GitHub (read-only limitation) — HIGH confidence (well-documented ecosystem fact)
- `fit-tool` PyPI (Garmin's Python write library) — MEDIUM confidence (verify write support against a real Garmin Connect upload before committing)
- Community reports of Garmin Connect duplicate-upload behavior — MEDIUM confidence (consistent pattern across fitness dev forums)
