# Feature Landscape: Garmin FIT + Hevy Workout Data Merger

**Domain:** Local FIT file manipulation / workout data merger tool
**Researched:** 2026-04-20
**Confidence note:** Web search and WebFetch were unavailable in this research session. All findings are derived from training knowledge (cutoff August 2025) of the FIT file tooling ecosystem, Garmin Connect behavior, and similar open-source projects. Confidence is MEDIUM on tool patterns (well-established), LOW on HevyConnect-specific implementation details (could not fetch the repo directly).

---

## Table Stakes

Features users expect. Missing = product feels broken or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| File upload: Garmin .fit + Hevy .csv | It is the entire input surface. No upload = nothing works. | Low | Accept both files in a single step, not two separate screens |
| Downloadable merged .fit file | The entire output promise. No download = nothing to show for it. | Low | Filename should indicate it is merged, e.g. `merged_<date>.fit` |
| Timezone offset input | Garmin timestamps are UTC; Hevy timestamps reflect local time. Without alignment, workout matching is wrong by hours. Most users will not know this is a problem until they see wrong matches. | Medium | Must expose this clearly at upload time, not buried in settings. Default to UTC with a dropdown of named timezones (not raw offset). |
| Auto-matched workout pairing | Users expect the app to figure out which Garmin session matches which Hevy session. Manual selection as fallback only. | Medium | Match on overlapping time window (within ~60 min). Display confidence (exact match vs close match). |
| Exercise name mapping review screen | Hevy exercise names ("Barbell Back Squat") do not map 1:1 to Garmin exercise IDs. Users need to confirm or correct this mapping before export. | Medium | This is the most UX-critical screen. Unmapped exercises = incomplete FIT file or silent data loss. |
| Persistent exercise mapping storage | Users should not re-map "Barbell Bench Press → Bench Press" every session. Mappings must survive browser refresh and app restarts. | Low-Medium | SQLite is the right store. Key: Hevy name → Garmin exercise ID + category. |
| FIT file validity feedback | If the output FIT file is invalid, the user needs to know before uploading to Garmin Connect. Silent corruption is the worst outcome. | Medium-High | At minimum: CRC check. Better: parse the output file and verify required message types are present. |
| Error messages that are actionable | "An error occurred" is useless. Users need to know what went wrong and what to do next. | Low | Every raised exception should map to a user-facing string with next steps. |
| Preservation of Garmin biometrics | Heart rate, calories, rest periods, session duration — these must survive the merge. This is the reason users want the tool. | High | Treat the Garmin file as the biometric source of truth. Exercise records are replaced; everything else is preserved. |

---

## Differentiators

Features that distinguish this tool from a generic script. Not expected, but meaningfully increase trust and adoption.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Named timezone picker (not raw UTC offset) | "UTC+8" is technically correct but "Asia/Singapore" is what users think in. A dropdown with real city names reduces user error and eliminates DST confusion. | Low | Use Python `zoneinfo` (stdlib 3.9+) for timezone list. Display both city name and current offset. |
| Pre-export preview: side-by-side before/after | Shows user exactly what data is going into the merged file — Garmin biometrics on one side, Hevy sets/reps on the other. Builds confidence before download. | Medium | Can be deferred to Phase 2 per PROJECT.md but earns significant trust. |
| Match confidence indicator | "Exact match (0 min gap)" vs "Close match (47 min gap)" tells the user whether to trust the auto-match or investigate. | Low | Display time delta and direction (Hevy started X minutes before/after Garmin). |
| Manual workout match override | Auto-match will fail for edge cases: two workouts on same day, clocks that drifted, workout started before entering gym. User needs escape hatch. | Medium | Show a list of candidate Hevy workouts for the user to pick from when confidence is low. |
| Fuzzy / AI exercise name matching | "Incline DB Press" and "Incline Dumbbell Press" are the same exercise. Exact-string matching forces users to re-map slight variations. | Medium-High | Phase 2 per PROJECT.md. Even simple edit-distance (rapidfuzz) catches most variants. |
| Per-set data preservation | Hevy exports individual sets with weight/reps. Some FIT merger tools collapse sets to workout-level totals. Preserving per-set records is better data. | Medium | Garmin Connect displays per-set data if FIT messages are structured correctly. Requires understanding `WORKOUT_STEP` vs `SET` message types. |
| Unmapped exercise warning, not silent skip | If an exercise in Hevy has no confirmed mapping, warn the user explicitly rather than dropping the exercise silently. | Low | Show count: "3 exercises have no Garmin mapping — they will be excluded unless you map them now." |
| Source file validation on upload | Detect common problems immediately: corrupted FIT file, wrong CSV format (not Hevy export), empty file, truncated upload. | Low-Medium | Fast feedback prevents the user from waiting for processing only to get a late-stage error. |

---

## Anti-Features

Features to deliberately NOT build in v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Direct Garmin Connect upload via API | Requires OAuth2 with Garmin's API (approval process, fragile, terms-of-service risk). Adds weeks of work for zero core-value gain. | Download the merged file; user uploads manually. Document the two-click upload process. |
| Hevy API / OAuth2 flow | Hevy's API capabilities are unverified per PROJECT.md. OAuth2 adds auth surface area and failure modes. | CSV file upload is sufficient for MVP and works without any Hevy account dependency. |
| Batch processing (multiple workouts in one run) | Single-workout processing is complex enough to validate first. Batch adds significant matching-ambiguity edge cases. | Phase 4 per PROJECT.md. After core merge is validated, batch is additive. |
| Workout analytics / charts | Users already have Garmin Connect for analytics. Duplicating this creates scope creep with no unique value. | Keep the tool's value proposition narrow: merge and export. |
| User accounts / multi-user support | This is a local tool. Authentication adds complexity with zero benefit. | Local-only, single-user. All data stays on the user's machine. |
| Garmin exercise ID lookup / search | Garmin's exercise ID list is large. Building a search UI for it adds frontend complexity. | Provide a curated dropdown of the most common strength exercises. Power users can inspect the FIT spec for edge cases. |
| Auto-sync scheduling / watch for new files | Background daemons and file watchers add OS-level complexity and complicate Docker deployment. | Manual trigger only. User runs a merge when they want one. |
| Mobile app | Out of scope per PROJECT.md. Local web app is accessible from mobile browser on same network if needed. | — |

---

## Feature Dependencies

```
File upload (Garmin + Hevy)
  → Source file validation (fast feedback on bad inputs)
      → Timezone offset input
          → Auto-matched workout pairing
              → Exercise name mapping review
                  → Pre-export preview [Phase 2]
                      → FIT file generation
                          → FIT file validity check
                              → Download merged file

Exercise mapping review
  → Persistent mapping storage (SQLite)
      → Fuzzy matching suggestions [Phase 2]

Auto-matched workout pairing
  → Match confidence indicator
      → Manual workout match override [Phase 2]
```

---

## Timezone Handling — Deep Dive

This is the highest-risk UX surface for silent wrong behavior.

**The problem in detail:**
- Garmin FIT files store all timestamps as seconds since 1989-12-31 00:00:00 UTC (the Garmin epoch). There is no timezone field.
- Hevy CSV exports store timestamps in the user's local time (the export shows the time displayed in the Hevy app). The exact format in Hevy's CSV is `YYYY-MM-DD HH:MM:SS` without timezone annotation.
- A user in Singapore (UTC+8) who finishes a workout at 7:00 PM local will have:
  - Garmin: `1989-12-31 + seconds` decoding to `11:00:00 UTC`
  - Hevy CSV: `19:00:00` (local, no annotation)
- Without timezone correction, the app sees an 8-hour gap and fails to match.

**Required behavior:**
1. Expose timezone selection at the top of the workflow, before matching occurs.
2. Use named timezones (IANA tz database via Python `zoneinfo`), not raw UTC offset numbers. Users think "I'm in Singapore" not "I'm in UTC+8".
3. Apply the offset when parsing Hevy timestamps: convert `19:00:00 local` to `11:00:00 UTC` using the selected timezone.
4. Show the resolved UTC times in the matching UI so the user can verify the conversion is correct.
5. Persist the last-used timezone in SQLite so repeat users don't re-enter it.
6. Handle DST: named timezones handle DST automatically; raw offsets do not. This matters for users in DST-observing regions (US, EU, Australia).

**Confidence:** HIGH — this is a well-understood property of the Garmin FIT format and general timezone handling best practice.

---

## Exercise Mapping UX — Deep Dive

This is the highest-friction step in the user workflow.

**The problem in detail:**
- Hevy uses free-text exercise names entered by the user. These vary: "Bench Press (Barbell)", "Barbell Bench Press", "Flat Bench", "bench press" are all the same exercise.
- Garmin exercise IDs are numeric enum values from the FIT SDK spec (e.g., `bench_press = 0` under `EXERCISE_CATEGORY_BENCH_PRESS`). The full list has hundreds of entries.
- There is no standard crosswalk between Hevy names and Garmin IDs.

**Required UX behavior:**
1. On first run with a new Hevy exercise name, present the user with a mapping screen showing the Hevy name and a dropdown/search of candidate Garmin exercises.
2. Group the Garmin exercise list by category (Bench Press, Squat, Deadlift, etc.) — the flat list is too long to scan.
3. After user confirms a mapping, persist it keyed on exact Hevy exercise name string.
4. On subsequent runs, apply persisted mappings silently. Only surface the mapping screen for net-new exercises.
5. Allow the user to edit existing mappings (e.g., they mapped wrong and want to fix it).
6. Before export, show a summary: "X exercises mapped, Y unmapped (will be excluded)." Unmapped exercises should require an explicit "skip anyway" confirmation, not silent drop.

**Fuzzy matching (Phase 2 enhancement):**
- Pre-populate the Garmin dropdown selection using edit-distance or embedding similarity.
- Show confidence: "Best guess: Bench Press (Barbell)" with a score.
- User confirms or overrides — the confirmation step is mandatory regardless of match confidence.

**Confidence:** HIGH on the UX pattern. MEDIUM on the exact Garmin exercise ID structure (based on FIT SDK knowledge from training data; should be verified against the actual SDK during Phase 1).

---

## FIT File Validation Feedback — Deep Dive

**Why this is table stakes:**
- Garmin Connect silently rejects invalid FIT files with a generic error. The user sees "Upload failed" with no detail.
- If the app produces an invalid FIT file, the user has no way to know whether the problem is the tool or Garmin Connect.
- Trust in the tool collapses after the first failed upload.

**Minimum viable validation:**
1. CRC check on the output FIT file (FIT files have a 2-byte CRC at the end; the spec defines the check algorithm).
2. Verify required message types are present: `FILE_ID`, `ACTIVITY`, `SESSION`, at minimum.
3. Verify timestamp sequence is monotonically increasing (out-of-order timestamps are a common merge bug).
4. Verify all exercise records reference valid Garmin exercise category + exercise ID enum values.

**Better validation (Phase 2):**
- Parse the output file with `fitparse` or the Garmin SDK and compare record counts to expected values from input.
- Confirm session duration in output matches Garmin source.
- Surface specific error: "SET record at timestamp X references unknown exercise ID 9999."

**Confidence:** HIGH on CRC and message type requirements (well-documented in the FIT SDK). MEDIUM on Garmin Connect's specific rejection criteria (behavior observed in community reports, not from official documentation).

---

## Error Recovery

**The failure modes that need explicit handling:**

| Failure Mode | User-Facing Message | Recovery Path |
|--------------|--------------------|--------------------|
| Uploaded wrong file type (e.g., GPX instead of FIT) | "This doesn't look like a Garmin FIT file. Please upload the .fit file from your watch." | Re-upload |
| Hevy CSV is not a Hevy export (e.g., generic CSV) | "This CSV doesn't match the Hevy export format. Export from Hevy: Profile → Export Data." | Re-upload with instructions |
| No matching workout found (time gap too large) | "No Hevy workout found within 2 hours of this Garmin session. Check your timezone setting or use manual matching." | Timezone correction or manual match |
| Exercise unmapped before export | "3 exercises have no Garmin mapping. They will be excluded from the FIT file unless you map them now." | Block export or explicit skip |
| FIT output fails CRC check | "The merged file has a data integrity error and may be rejected by Garmin Connect. Try again or report this as a bug." | Retry; show debug info |
| Garmin FIT file is from a non-strength activity | "This FIT file appears to be a run/ride, not a strength session. The merger works best with strength/gym activity files." | Warn but allow — do not block |

---

## MVP Recommendation

Prioritize for Phase 1 (exact match to PROJECT.md Phase 1 requirements):

1. File upload: Garmin .fit + Hevy .csv (with source validation on upload)
2. Timezone selection (named IANA timezones, persisted in SQLite)
3. Auto-matched workout pairing with confidence indicator
4. Exercise name mapping review screen (with persistent SQLite storage)
5. Unmapped exercise warning before export (block with explicit override)
6. FIT file generation preserving all Garmin biometrics
7. Output FIT CRC validation + basic message type check
8. Download merged .fit file
9. Actionable error messages for all failure modes above

Defer to Phase 2:
- Pre-export side-by-side preview
- Manual workout match override
- Fuzzy/AI exercise name matching
- Extended FIT validation (record count comparison, deep parse)

Defer to Phase 4:
- Batch processing
- Direct Garmin Connect upload

---

## Sources

- FIT Protocol Specification (Flexible and Interoperable Data Transfer): well-documented public standard from Garmin. Timestamp epoch, message type requirements, and CRC algorithm are stable and unlikely to have changed.
- Python `zoneinfo` module (stdlib since 3.9): IANA timezone database. Confidence HIGH.
- `fitparse` library: widely used open-source FIT parser for Python. Confidence HIGH on read capabilities; write support is limited (critical risk flagged in PROJECT.md).
- `garmin-fit-sdk` (official Python SDK): Garmin's official Python library. Confidence MEDIUM on write capabilities — needs validation against actual Garmin Connect during Phase 1.
- HevyConnect (TonyTromp/GitHub): Could not fetch directly. Based on project description it is a TypeScript implementation that handles FIT generation and exercise mapping — useful as implementation reference but the project is reportedly abandoned.
- General knowledge of Hevy CSV export format, Garmin exercise ID enum structure, and FIT file merger tools from training data (August 2025). LOW confidence on HevyConnect specifics; MEDIUM confidence on broader patterns.
