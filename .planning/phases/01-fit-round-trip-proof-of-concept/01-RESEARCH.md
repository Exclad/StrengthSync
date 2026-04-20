# Phase 1: FIT Round-Trip Proof-of-Concept - Research

**Researched:** 2026-04-20
**Domain:** Python FIT file I/O, Garmin FIT protocol, WSL2/Debian Python installation
**Confidence:** MEDIUM — fit-tool write-to-Garmin-Connect acceptance is UNVERIFIED (unresolvable without live upload)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Install Python globally via `apt install python3` on WSL2 (Ubuntu). No pyenv, no deadsnakes PPA unless apt delivers an unsupported version. After global install, create a project-local venv for dependency isolation (`python3 -m venv .venv`).
- **D-02:** Functional equivalence is the bar — the output FIT file must re-parse without errors AND upload to Garmin Connect successfully. Byte-for-byte identical output is NOT required.
- **D-03:** Primary candidate is `fit-tool`. If it fails Garmin Connect upload, try `garmin-fit-sdk` (official Garmin SDK, requires no Java from Python — it is a native Python package). Raw binary FIT construction is last resort only.
- **D-04:** `fitparse` is read-only — must never be used for writing.
- **D-05:** Phase 1 code goes into real module scaffolding: `fit_parser.py` (read) and `fit_generator.py` (write). Entry point `poc_roundtrip.py`. No throwaway scripts — Phase 2 extends these modules.

### Claude's Discretion
- Exact Python version — whatever `apt` delivers on this Debian/Ubuntu is fine
- Minimal from-scratch FIT file content — must include `file_id + session + one set message (mesg 225)`
- venv location and activation instructions

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIT-01 | Developer can validate that the chosen FIT write library produces a file Garmin Connect accepts — proof-of-concept round-trip test gates all other work | fit-tool 0.9.15 API verified; message types confirmed; Garmin Connect acceptance unverifiable without live upload |
| STRUCT-01 | All project files — source code, `.planning/`, sample files, documentation — reside inside the `GarminHevyMerge/` folder | Working directory is `/workspace/GarminHevyMerge/`; all output paths must stay within this root |
</phase_requirements>

---

## Summary

Phase 1 has one real question: can Python write a FIT file that Garmin Connect accepts? Everything else (Python install, venv, module scaffolding) is deterministic setup. The answer to the real question can only be known by performing a live upload — research can only validate that the write path is structurally sound.

**fit-tool 0.9.15** (published 2026-02-02) is a community-maintained fork of the original library. It is confirmed to exist on PyPI, has a complete API for reading and writing FIT files, and includes `SetMessage` (mesg_num 225) with the correct field set for strength training. Its timestamp API works in Unix epoch milliseconds and converts to the FIT 1989 epoch internally. The round-trip pattern is `FitFile.from_file()` → iterate `fit_file.records` → `FitFile(header, records, crc).to_file()`. For the from-scratch test, `FitFileBuilder` with `auto_define=True` constructs the file and handles CRC automatically.

The fallback **garmin-fit-sdk 21.200.0** (official Garmin, released 2026-04-08) is confirmed on PyPI and supports encoding via an `Encoder` class. It requires **no Java** — it is a pure Python package. The original CONTEXT.md note about Java was incorrect; update the CONTEXT accordingly.

**Primary recommendation:** Use fit-tool for both the round-trip and from-scratch tests. If Garmin Connect rejects the output, pivot to garmin-fit-sdk as the next attempt.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FIT file reading | Python library (fitparse) | — | fitparse is the established read-only parser |
| FIT file writing | Python library (fit-tool) | garmin-fit-sdk fallback | Write path is the single binary risk being validated |
| CRC calculation | fit-tool internal | fitparse verification | Both libraries handle CRC; don't hand-roll |
| Python runtime | OS global install | Project venv for deps | D-01 locked |
| Module scaffolding | Project source files | — | fit_parser.py + fit_generator.py as real modules |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fit-tool | 0.9.15 | FIT file reading AND writing | Only active Python FIT write library on PyPI; community-maintained fork |
| fitparse | 1.3.3 (ASSUMED) | FIT file reading (verification/re-parse) | Established read-only parser; used for round-trip validation re-parse step |
| garmin-fit-sdk | 21.200.0 | FIT encoding fallback (official Garmin SDK) | Official Garmin Python encoder; fallback if fit-tool fails Garmin Connect |

**Version verification:**
- fit-tool 0.9.15: `[VERIFIED: https://pypi.org/project/fit-tool/]` — published 2026-02-02
- garmin-fit-sdk 21.200.0: `[VERIFIED: https://pypi.org/project/garmin-fit-sdk/]` — published 2026-04-08 (official Garmin)
- fitparse: `[ASSUMED]` — version not verified in this session; project already specifies it in stack

### Critical Correction: garmin-fit-sdk Does NOT Require Java

The CONTEXT.md and STATE.md note that garmin-fit-sdk "requires Java runtime." This is **incorrect**. `garmin-fit-sdk` is a native Python package (PyPI: `garmin-fit-sdk`) that provides both decoding and encoding in Python. No Java is needed. The Java-based Garmin FIT SDK is a separate product (`FitSDKRelease_*.zip` from developer.garmin.com). The Python SDK is a first-class citizen.
`[VERIFIED: https://pypi.org/project/garmin-fit-sdk/]`

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python3-venv | (system) | Virtual environment for dep isolation | Always — project venv per D-01 |
| python3-pip | (system) | Package installation | Always |

### Installation

```bash
# Step 1: Global Python (run as root or with sudo)
apt-get update
apt-get install -y python3 python3-pip python3-venv

# Step 2: Project venv
cd /workspace/GarminHevyMerge
python3 -m venv .venv
source .venv/bin/activate

# Step 3: Phase 1 dependencies
pip install fit-tool fitparse garmin-fit-sdk
pip freeze > requirements.txt
```

**Debian Bookworm ships Python 3.11.2** — this satisfies the project's Python 3.9+ requirement.
`[VERIFIED: https://packages.debian.org/bookworm/python3]`

---

## Architecture Patterns

### System Architecture Diagram

```
original_garmin.fit
       |
       v
[fitparse or fit-tool read]
       |
   FitFile.records (list of Record objects)
       |
       +--- round-trip path: rebuild FitFile → to_file() → output_roundtrip.fit
       |
       +--- from-scratch path: FitFileBuilder → add FileIdMessage
                                              → add SessionMessage
                                              → add SetMessage (mesg 225)
                                              → build() → to_file() → output_minimal.fit
                                              
output_roundtrip.fit  ──→  [fitparse re-parse: must parse without errors]
output_minimal.fit    ──→  [fitparse re-parse: must parse without errors]

Both output files ──→  [manual Garmin Connect upload — developer performs]
```

### Recommended Project Structure

```
GarminHevyMerge/
├── fit_parser.py           # Phase 1: FitFile reading wrapper (real module)
├── fit_generator.py        # Phase 1: FIT writing wrapper (real module)
├── poc_roundtrip.py        # Phase 1: CLI entry point for POC tests
├── requirements.txt        # Phase 1: fit-tool, fitparse, garmin-fit-sdk
├── .venv/                  # Project-local venv (not committed)
├── original_garmin.fit     # Sample input
└── output/                 # Output directory for generated FIT files
    ├── roundtrip.fit
    └── minimal.fit
```

### Pattern 1: Round-Trip Read → Write

**What:** Read all records from `original_garmin.fit` verbatim using fit-tool, reconstruct a FitFile, write to disk, re-parse to verify.

**When to use:** Phase 1 round-trip test. Phase 4 will use a more selective version (pass biometric records, replace set messages).

```python
# Source: fit-tool 0.9.15 API (verified via GitHub raw file)
from fit_tool.fit_file import FitFile

def roundtrip(in_path: str, out_path: str) -> FitFile:
    """Read a FIT file and write it back out. Returns the re-parsed result."""
    fit = FitFile.from_file(in_path)
    # fit.records is a list of Record objects (definition + data messages)
    # Reconstructing with same header/records preserves all messages verbatim
    out_fit = FitFile(header=fit.header, records=fit.records, crc=None)
    out_fit.to_file(out_path)
    # Re-parse to verify
    return FitFile.from_file(out_path)
```

### Pattern 2: From-Scratch FIT Activity (fit-tool FitFileBuilder)

**What:** Build a minimal valid activity FIT file from scratch using FitFileBuilder with `auto_define=True`. Includes the messages required by FIT protocol for a valid activity file accepted by Garmin Connect.

**When to use:** Phase 1 from-scratch test. Template for Phase 4 FIT generator.

```python
# Source: fit-tool 0.9.15 FitFileBuilder API + Garmin FIT activity file requirements
import datetime
from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.event_message import EventMessage
from fit_tool.profile.messages.session_message import SessionMessage
from fit_tool.profile.messages.lap_message import LapMessage
from fit_tool.profile.messages.activity_message import ActivityMessage
from fit_tool.profile.messages.set_message import SetMessage
from fit_tool.profile.profile_type import FileType, Manufacturer, Sport, SubSport, Event, EventType, Activity

def build_minimal_strength_fit(out_path: str) -> None:
    """
    Build a minimal strength training FIT activity file.
    Required message sequence per Garmin FIT protocol:
      file_id → event(start) → set(s) → event(stop) → lap → session → activity
    """
    builder = FitFileBuilder(auto_define=True, min_string_size=50)
    
    # Timestamps: fit-tool uses Unix epoch milliseconds at API level
    # (library handles FIT 1989 epoch conversion internally)
    now_ms = round(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    workout_duration_ms = 3600 * 1000  # 1 hour
    
    # 1. file_id (required first message)
    msg = FileIdMessage()
    msg.type = FileType.ACTIVITY
    msg.manufacturer = Manufacturer.DEVELOPMENT.value
    msg.product = 0
    msg.serial_number = 0x12345678
    msg.time_created = now_ms
    builder.add(msg)
    
    # 2. event: timer start
    msg = EventMessage()
    msg.event = Event.TIMER
    msg.event_type = EventType.START
    msg.timestamp = now_ms
    builder.add(msg)
    
    # 3. set message (mesg_num 225) — one strength set
    msg = SetMessage()
    msg.timestamp = now_ms + 60_000        # 1 min into workout
    msg.start_time = now_ms
    msg.repetitions = 10
    msg.weight = 60_000                    # 60 kg stored as grams (× 1000 per FIT spec)
    msg.set_type = 0                       # 0 = active set
    builder.add(msg)
    
    # 4. event: timer stop
    msg = EventMessage()
    msg.event = Event.TIMER
    msg.event_type = EventType.STOP_ALL
    msg.timestamp = now_ms + workout_duration_ms
    builder.add(msg)
    
    # 5. lap (required — at least one per activity)
    msg = LapMessage()
    msg.timestamp = now_ms + workout_duration_ms
    msg.start_time = now_ms
    msg.total_elapsed_time = workout_duration_ms
    msg.total_timer_time = workout_duration_ms
    builder.add(msg)
    
    # 6. session (required — at least one per activity)
    msg = SessionMessage()
    msg.timestamp = now_ms + workout_duration_ms
    msg.start_time = now_ms
    msg.sport = Sport.TRAINING
    msg.sub_sport = SubSport.STRENGTH_TRAINING
    msg.total_elapsed_time = workout_duration_ms
    msg.total_timer_time = workout_duration_ms
    builder.add(msg)
    
    # 7. activity (required — exactly one per file)
    msg = ActivityMessage()
    msg.timestamp = now_ms + workout_duration_ms
    msg.total_timer_time = workout_duration_ms
    msg.num_sessions = 1
    msg.type = Activity.MANUAL
    msg.event = Event.ACTIVITY
    msg.event_type = EventType.STOP
    builder.add(msg)
    
    fit_file = builder.build()
    fit_file.to_file(out_path)
```

### Pattern 3: garmin-fit-sdk Encoder (fallback)

**What:** Official Garmin Python SDK encoder. Use only if fit-tool output is rejected by Garmin Connect.

```python
# Source: garmin-fit-sdk README (https://github.com/garmin/fit-python-sdk)
from datetime import datetime, timezone
from garmin_fit_sdk import Encoder, Profile

def build_minimal_fit_official_sdk(out_path: str) -> None:
    encoder = Encoder()
    encoder.on_mesg(Profile['mesg_num']['FILE_ID'], {
        'manufacturer': 'development',
        'product': 1,
        'time_created': datetime.now(tz=timezone.utc),
        'type': 'activity',
    })
    # Add session, lap, activity messages similarly using Profile mesg_num lookups
    uint8_array = encoder.close()
    with open(out_path, 'wb') as f:
        f.write(uint8_array)
```

### Anti-Patterns to Avoid

- **Using fitparse for writing:** fitparse is read-only; calling any write/serialize method will fail or produce invalid output. Use fit-tool or garmin-fit-sdk for all writes.
- **Hand-rolling CRC:** fit-tool's `FitFileBuilder.build()` and `FitFile.to_file()` calculate CRC automatically. Never manually compute FIT CRC16 — the algorithm is complex and library handles it correctly.
- **Passing raw FIT epoch timestamps:** fit-tool accepts Unix epoch milliseconds at its Python API boundary and converts internally to FIT 1989 epoch. Passing FIT epoch values directly will produce timestamps 20 years in the past.
- **Setting weight in kg float:** FIT weight fields are integers in grams × 1000. `60 kg → 60_000`. Passing a float like `60.0` will either fail or silently corrupt.
- **Omitting required activity messages:** Garmin Connect rejects files missing `file_id`, `session`, `lap`, or `activity` messages. All four are required even for a minimal test file.
- **Writing outside GarminHevyMerge/:** All output files must stay inside the project root per STRUCT-01.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FIT binary serialization | Custom struct packing | fit-tool FitFileBuilder | FIT protocol has definition messages, field encoding, CRC — dozens of edge cases |
| FIT CRC calculation | CRC16 implementation | fit-tool / garmin-fit-sdk | CRC is computed across header + data; both libraries handle it correctly |
| FIT timestamp conversion | Epoch offset arithmetic | fit-tool internal conversion | Library accepts Unix ms and converts; hand-rolling risks off-by-one on DST |
| FIT definition messages | Manual local/global message IDs | FitFileBuilder(auto_define=True) | auto_define creates definition records automatically before each data record |

**Key insight:** The FIT binary format is non-trivial — every data message must be preceded by a matching definition message. Libraries exist precisely to handle this. Use them.

---

## Common Pitfalls

### Pitfall 1: fit-tool Timestamp API vs FIT Protocol Epoch

**What goes wrong:** Developer passes FIT epoch seconds (seconds since 1989-12-31) directly to fit-tool fields, producing timestamps 20 years in the past or nonsensical dates in Garmin Connect.

**Why it happens:** FIT protocol stores timestamps as seconds from 1989 epoch. fit-tool's Python API accepts Unix epoch **milliseconds** (ms since 1970) and converts internally.

**How to avoid:** Always use `round(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)` or equivalent to produce Unix ms. Let fit-tool handle the epoch shift.

**Warning signs:** Garmin Connect shows workout date as 2006 or earlier; re-parsed timestamp doesn't match expected datetime.

### Pitfall 2: Missing Required Activity Messages

**What goes wrong:** Garmin Connect rejects the FIT file on upload with an error or silently discards it.

**Why it happens:** A valid activity FIT file requires: `file_id` + `event(start)` + `event(stop)` + `lap` + `session` + `activity`. Omitting any of these causes rejection.

**How to avoid:** Always include all 6 required message types. The from-scratch test in poc_roundtrip.py must include all of them.

**Warning signs:** Upload to Garmin Connect fails with no specific error, or file is accepted but not visible in activity feed.

### Pitfall 3: Garmin Connect Rejects fit-tool Output (Primary Risk)

**What goes wrong:** fit-tool successfully writes a FIT file that re-parses without errors, but Garmin Connect rejects it on upload.

**Why it happens:** Garmin Connect's validator may enforce constraints not documented in the FIT SDK (e.g., specific manufacturer ID, required device_info message, specific field values in activity/session messages). fit-tool is a community library with unconfirmed Garmin Connect acceptance.

**How to avoid:** If fit-tool output is rejected, immediately attempt the same test with garmin-fit-sdk (official Garmin encoder). If that also fails, examine the structure of original_garmin.fit and mirror its message structure more closely.

**Warning signs:** Upload fails; Garmin Connect shows "invalid file" error; activity appears but immediately disappears.

### Pitfall 4: Weight Field Scaling

**What goes wrong:** Weight values appear as 1000x too small in Garmin Connect (60 kg shows as 0.06 kg), or field type error during write.

**Why it happens:** FIT weight fields store integers in units of grams, not kg. 60 kg = 60,000 grams. SetMessage.weight must be an integer.

**How to avoid:** Always multiply kg by 1000 before setting weight field. `msg.weight = round(weight_kg * 1000)`.

**Warning signs:** Weight values in Garmin Connect are 1/1000 of expected values.

### Pitfall 5: Debian Bookworm pip Isolation Requirement

**What goes wrong:** `pip install fit-tool` after global Python install fails with "externally-managed-environment" error on Debian 12.

**Why it happens:** Debian 12 (Bookworm) enforces PEP 668 — pip refuses to install packages system-wide to protect system Python. Applies to both WSL2 Ubuntu-based and Debian environments.

**How to avoid:** Always install into a venv: `python3 -m venv .venv && source .venv/bin/activate && pip install fit-tool`. Never use `pip install --break-system-packages` (it bypasses the protection but is fragile).

**Warning signs:** `pip install` outputs "error: externally-managed-environment".

---

## Code Examples

### Reading a FIT file with fit-tool

```python
# Source: fit-tool 0.9.15 README / FitFile API
from fit_tool.fit_file import FitFile

fit = FitFile.from_file('/workspace/GarminHevyMerge/original_garmin.fit')
for record in fit.records:
    msg = record.message
    print(type(msg).__name__, getattr(msg, 'timestamp', None))
```

### Reading a FIT file with fitparse (read-only, for verification)

```python
# Source: fitparse library (read-only)
import fitparse

with fitparse.FitFile('/workspace/GarminHevyMerge/output/roundtrip.fit') as ff:
    for msg in ff.get_messages():
        print(msg.name, {f.name: f.value for f in msg.fields})
```

### Iterating messages by type with fit-tool

```python
# Source: fit-tool README example
from fit_tool.fit_file import FitFile
from fit_tool.profile.messages.session_message import SessionMessage
from fit_tool.profile.messages.set_message import SetMessage

fit = FitFile.from_file('input.fit')
for record in fit.records:
    if isinstance(record.message, SessionMessage):
        print('Session sport:', record.message.sport)
    if isinstance(record.message, SetMessage):
        print('Set reps:', record.message.repetitions, 'weight:', record.message.weight)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fitparse for writing | fit-tool (community fork) | 2023 | fitparse was always read-only; the original fit-tool was removed from PyPI and replaced by this fork |
| Java-only official Garmin SDK | garmin-fit-sdk Python package on PyPI | ~2023 | No Java required; official Garmin Python encoder now available |
| Byte-for-byte round-trip requirement | Functional equivalence (re-parse + upload) | Phase 1 CONTEXT D-02 | Eliminates impossible requirement; libraries legitimately rewrite CRC/padding |

**Deprecated/outdated:**
- The original `fit-tool` by Matt Tucker: removed from PyPI; the `shaonianche/python_fit_tool` fork is the active successor under the same package name.
- "garmin-fit-sdk requires Java": The Python SDK (`garmin-fit-sdk` on PyPI) is pure Python. The Java requirement refers to the separate Java SDK distribution, not the Python one.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | fitparse version is ~1.3.3 | Standard Stack | Low — only used for read verification; exact version not critical |
| A2 | fit-tool produces FIT files Garmin Connect accepts | Common Pitfalls / entire Phase 1 | HIGH — this is the single binary risk; Phase 1 exists to answer this question |
| A3 | `SubSport.STRENGTH_TRAINING` is the correct enum value for strength workouts | Pattern 2 code | Medium — if wrong, activity appears in Garmin Connect as wrong sport type; fixable |
| A4 | `Sport.TRAINING` is the correct sport for strength workouts | Pattern 2 code | Medium — same as A3 |
| A5 | SetMessage.weight field units are grams (integer) in fit-tool | Code Examples | Low — derived from CLAUDE.md known facts; consistent with FIT protocol spec |

---

## Open Questions

1. **Does fit-tool write files that Garmin Connect accepts?**
   - What we know: The library writes structurally valid FIT files that re-parse without errors. fit-tool is used in the Fit-File-Faker project which is documented as uploading to Garmin Connect.
   - What's unclear: Whether the specific activity/session message structure required by Garmin Connect's validator is produced correctly.
   - Recommendation: Execute the test. If rejected, switch to garmin-fit-sdk.

2. **Does the round-trip path need to reconstruct via FitFileBuilder or can it reuse the existing FitFile directly?**
   - What we know: `FitFile(header=fit.header, records=fit.records).to_file(path)` should work since FitFile is a plain data container.
   - What's unclear: Whether definition records are preserved correctly when reusing records list directly.
   - Recommendation: Try direct reconstruction first; fall back to adding records via FitFileBuilder if CRC or definition messages are corrupted.

3. **What is the correct Sport/SubSport enum combination for strength training?**
   - What we know: `Sport.TRAINING` and `SubSport.STRENGTH_TRAINING` are referenced in Garmin forums as the correct values. Activity may still show as "uncategorized" in Garmin Connect web UI (known issue per forum reports).
   - What's unclear: Whether "uncategorized" appearance constitutes Phase 1 failure.
   - Recommendation: Phase 1 success criteria say "upload without rejection" — appearing as uncategorized is not rejection. Proceed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| python3 | All Phase 1 tasks | ✗ | — | Install via `apt-get install python3` |
| python3-venv | venv creation | ✗ | — | Install via `apt-get install python3-venv` |
| python3-pip | pip in venv | ✗ | — | Venv creates pip; or `apt-get install python3-pip` |
| fit-tool | FIT writing | ✗ | — | Install via pip after venv |
| fitparse | FIT reading/verify | ✗ | — | Install via pip after venv |
| garmin-fit-sdk | Fallback encoder | ✗ | — | Install via pip after venv |
| apt-get | Python install | ✓ | Debian 12 (Bookworm) | — |

**Missing dependencies with no fallback:**
- Python 3 is not installed. This is the first task of Phase 1 — expected and planned.

**Missing dependencies with fallback:**
- None — all library deps install from pip once Python is available.

**Expected Python version after install:** 3.11.2 (Debian Bookworm default)
`[VERIFIED: https://packages.debian.org/bookworm/python3]`

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (install in venv as dev dependency) |
| Config file | None yet — Wave 0 creates pytest.ini or pyproject.toml test section |
| Quick run command | `pytest poc_roundtrip.py -x -v` |
| Full suite command | `pytest /workspace/GarminHevyMerge/ -v` |

**Note:** Phase 1 has one automated validation (re-parse without errors) and one manual validation (Garmin Connect upload). The automated test is runnable; the manual step is gated on developer action.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIT-01 | fit-tool writes a FIT file that re-parses without errors | automated | `pytest tests/test_roundtrip.py -x` | ❌ Wave 0 |
| FIT-01 | Round-trip output uploads to Garmin Connect | manual | N/A — developer uploads and confirms | ❌ Manual |
| FIT-01 | From-scratch minimal FIT re-parses without errors | automated | `pytest tests/test_minimal_fit.py -x` | ❌ Wave 0 |
| FIT-01 | From-scratch minimal FIT uploads to Garmin Connect | manual | N/A — developer uploads and confirms | ❌ Manual |
| STRUCT-01 | No output files written outside GarminHevyMerge/ | automated | `pytest tests/test_structure.py -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest tests/ -x -v`
- **Per wave merge:** `pytest /workspace/GarminHevyMerge/ -v`
- **Phase gate:** Automated tests green + developer confirms both Garmin Connect uploads pass before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/test_roundtrip.py` — covers FIT-01 automated (round-trip re-parse)
- [ ] `tests/test_minimal_fit.py` — covers FIT-01 automated (from-scratch re-parse)
- [ ] `tests/test_structure.py` — covers STRUCT-01 (no files outside project root)
- [ ] `tests/__init__.py` — package marker
- [ ] Framework install: `pip install pytest` in venv

---

## Security Domain

This phase involves local file I/O only — no network requests, no user input, no authentication. No ASVS categories apply to Phase 1.

- V5 Input Validation: N/A — input is a developer-supplied sample FIT file, not user input
- All other ASVS categories: N/A — no web server, no auth, no crypto in Phase 1

---

## Sources

### Primary (HIGH confidence)
- `https://pypi.org/project/fit-tool/` — fit-tool 0.9.15 confirmed, published 2026-02-02
- `https://pypi.org/project/garmin-fit-sdk/` — garmin-fit-sdk 21.200.0 confirmed, published 2026-04-08 (official Garmin)
- `https://github.com/shaonianche/python_fit_tool` — SetMessage (mesg_num 225) fields verified, FitFileBuilder API, FitFile API, timestamp handling
- `https://packages.debian.org/bookworm/python3` — Python 3.11.2 confirmed for Debian Bookworm

### Secondary (MEDIUM confidence)
- `https://forums.garmin.com/developer/fit-sdk/f/discussion/270009/` — Strength training FIT file structure, rest period encoding, known Garmin Connect issues
- `https://forums.garmin.com/developer/fit-sdk/f/discussion/253462/` — Required FIT activity file message sequence for Garmin Connect
- `https://forums.garmin.com/developer/fit-sdk/b/news-announcements/posts/important-fit-activity-file-message-change` — Summary First/Last ordering requirement (October 2023)
- `https://github.com/garmin/fit-python-sdk` — Official Garmin Encoder API confirmed

### Tertiary (LOW confidence)
- WebSearch results re: fit-tool round-trip Garmin Connect acceptance — no confirmed community reports of successful activity upload using fit-tool specifically

---

## Metadata

**Confidence breakdown:**
- Python installation: HIGH — Debian Bookworm Python 3.11.2 via apt is confirmed
- fit-tool API: HIGH — verified directly from GitHub source files
- garmin-fit-sdk API: HIGH — verified from official README
- FIT message sequence: MEDIUM — derived from Garmin forums (no official spec page accessible)
- fit-tool Garmin Connect acceptance: LOW — unverifiable without live upload; this is the Phase 1 risk

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — fit-tool and Garmin FIT SDK are stable, not fast-moving)
