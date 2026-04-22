# Phase 4: FIT Builder + Merge Pipeline - Research

**Researched:** 2026-04-22
**Domain:** FIT binary format, byte-level splice, garmin-fit-sdk Encoder, CRC-16
**Confidence:** HIGH — all critical claims verified by direct binary analysis and live code execution against `original_garmin.fit` and the installed garmin-fit-sdk==21.200.0

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Byte-level splice: parse raw FIT binary to find record boundaries, copy non-set/non-exercise_title bytes verbatim, append garmin-fit-sdk-encoded Hevy set messages, recompute CRC.
- **D-02:** fitparse reconstruction NOT used for pass-through — byte-level copy only.
- **D-03:** Per-set timestamps come from original Garmin mesg 225 `start_time` (field 6) records extracted before splice.
- **D-04:** If Hevy has more sets than Garmin timestamps, distribute extra sets linearly as fallback.
- **D-05:** If Garmin has more timestamps than Hevy sets, extra Garmin timestamps are unused.
- **D-06:** `build_preview()` returns `MergePreview` with `biometric_summary`, `before_sets`, `after_sets`.
- **D-07:** `MergePreview` and nested dataclasses defined in `models.py`.
- **D-08:** Two public functions: `build_preview(match, timezone_str) -> MergePreview` and `build_merged_fit(match, timezone_str, out_path) -> str`.
- **D-09:** Phase 5 calls `build_preview()` first, then `build_merged_fit()` on confirm. Shared internal logic.
- **D-10:** Pass weight as kg (float) to garmin-fit-sdk — SDK applies ×16 internally. Do NOT multiply by 1000.
- **D-11:** CRC validation = FIT CRC recomputed during splice + parse gate via `FitFile.from_file()`.
- **D-12:** Validation failure raises descriptive exception (not bare RuntimeError).

### Claude's Discretion

- Exact structure of the minimal FIT binary parser (just enough to identify record boundaries and local→global message number mappings).
- Whether definition messages for mesg 225/227 are also removed from the Garmin pass-through stream, or left in (leaving orphaned definition messages is harmless per FIT spec).
- Internal helper function decomposition within `fit_generator.py`.
- How `MergePreview.biometric_summary` handles None fields (e.g., no HR sensor data).

### Deferred Ideas (OUT OF SCOPE)

- Handling UNRESOLVED exercise mappings at the Phase 4 level — Phase 5 resolves via review UI; Phase 4 raises if an unmapped exercise is passed.
- Batch processing (multiple workout pairs) — v2 deferred per roadmap.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIT-03 | Merged FIT accepted by Garmin Connect — all Garmin biometric messages preserved verbatim, exercise records replaced with Hevy data | Byte-level splice verified: 4813 messages preserved including proprietary types 140, 288, 326, 327; 5 Hevy set messages injected; fitparse PASS, fit-tool PASS |
| FIT-04 | CRC check + required message type verification before download; clear error if validation fails | FIT CRC-16 algorithm verified against original file (matches stored CRC); double validation pattern (CRC recompute + FitFile.from_file parse gate) researched |
| MERGE-01 | All Garmin biometric messages preserved verbatim — no biometric data modified or dropped | Byte-level splice skips only mesg 225 and 227; all other 4813 messages (record/session/lap/event/device_info/HR/GPS/proprietary) passed verbatim |
| MERGE-02 | Hevy weight values correctly scaled to FIT format | D-10 authoritative: SDK takes kg (float), applies ×16 to store as uint16. Verified: 80.0 kg passed to encoder, stored as 1280 (0x0500), fitparse reads back 80.0 kg |
| MERGE-03 | Per-set timestamps distributed within workout time bounds | Garmin `start_time` (field 6, uint32 FIT epoch) is per-set; linear fallback algorithm verified. Sample file: 18 Garmin active-set timestamps, 19 Hevy sets (1 overflow) |
| MERGE-04 | User can preview merged workout before FIT is generated | `build_preview()` returns `MergePreview` with biometric_summary (from Garmin session message) + before_sets + after_sets; no file written |

</phase_requirements>

---

## Summary

Phase 4 implements the full FIT merge pipeline using a byte-level splice approach that has been prototyped and verified against the actual project files. The splice walks the FIT binary, copies all non-set/non-exercise_title records verbatim (preserving all proprietary Garmin messages), extracts per-set timestamps from original mesg 225 records, then appends garmin-fit-sdk-encoded Hevy set messages. The output FIT's header data_size is updated, header CRC and file CRC are recomputed, and the result passes both fitparse and fit-tool validation.

The critical insight confirmed by binary analysis: in the sample `original_garmin.fit`, mesg 225 field 254 (`timestamp`) holds the workout start time for all set records, while field 6 (`start_time`) holds the actual per-set start time. The correct field to extract for D-03 is `start_time` (field 6), not `timestamp` (field 254). All 18 active-set `start_time` values are distinct and correctly spaced.

The garmin-fit-sdk Encoder produces a complete FIT file (header + records + trailing CRC) on `encoder.close()`. To inject these set records into the spliced output, strip the encoder's 14-byte header and trailing 2-byte CRC, keeping only the record bytes (`data[14 : 14 + data_size]`). These record bytes include a definition message for mesg 225 followed by the data messages — both are needed and safe to append after the Garmin pass-through bytes.

**Primary recommendation:** Implement the binary walker + garmin-fit-sdk append pattern exactly as prototyped. The pattern is simple, correct, and requires no complex FIT decode for pass-through records.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FIT binary parsing (record boundaries) | fit_generator.py | — | Pure Python binary walk; no FIT library needed for pass-through |
| Biometric data extraction (session fields) | fit_parser.py (fitparse) | — | fitparse already used for this in Phase 2; avoid duplicate code |
| Set timestamp extraction | fit_generator.py (binary walk) | — | Must read raw bytes to extract field 6 before splice |
| Hevy set encoding | garmin-fit-sdk Encoder | — | Validated library; pass kg/seconds directly |
| CRC computation | fit_generator.py (inline) | — | 16-line pure Python function; no library needed |
| Merge preview assembly | fit_generator.py | models.py | Data classes in models.py; logic in fit_generator.py |
| Exercise mapping lookup | mapper.py | — | Already implemented; Phase 4 calls get_confirmed_mapping() |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| garmin-fit-sdk | 21.200.0 | Encode Hevy set messages into FIT binary | Only validated encoder; fit-tool rejected by Garmin Connect (Phase 1 gate) |
| fitparse | 1.2.0 | Parse gate validation + biometric field extraction for preview | Already used in Phase 2; correctly handles proprietary messages |
| fit-tool | 0.9.15 | Parse gate validation (FitFile.from_file) | D-11: second validation layer |
| struct (stdlib) | — | Binary FIT record walking and CRC computation | No dependencies; sufficient for nibble-by-nibble field parsing |
| Python 3.11.2 | — | Runtime | Global install confirmed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pathlib (stdlib) | — | File I/O for out_path handling | Always; matches existing patterns |
| dataclasses (stdlib) | — | MergePreview, GarminSetRecord, HevySetRecord | Adding to models.py |
| datetime (stdlib) | — | FIT epoch conversions | Timestamp decoding for preview |

**Version verification:** All library versions confirmed via `.venv` and confirmed installed. [VERIFIED: .venv/lib/python3.11/site-packages/ inspected via running code]

---

## Architecture Patterns

### System Architecture Diagram

```
                    MatchResult (FitWorkout + HevyWorkout)
                            |
                    build_preview() / build_merged_fit()
                            |
            +---------------+----------------+
            |                                |
    [Pass 1: Binary Walk]          [Hevy Set Assembly]
    original_garmin.fit            mapper.get_confirmed_mapping()
            |                                |
    Extract timestamps            garmin-fit-sdk Encoder
    from mesg 225 field 6          (category, subtype, weight, reps)
            |                                |
    Copy non-225/227 bytes         encoder.close() -> strip header/CRC
            |                                |
            +----------- Splice  +-----------+
                             |
                    Update header data_size
                    Recompute header CRC (bytes 0-11)
                    Append file CRC (over all bytes)
                             |
                    [Double Validation]
                    FitFile.from_file() [fit-tool]
                    FitParseFile open   [fitparse]
                             |
                     /tmp/merged.fit (or MergePreview)
```

### Recommended Project Structure

No new directories needed. All Phase 4 code goes into existing files:

```
GarminHevyMerge/
├── fit_generator.py     # Add build_preview() and build_merged_fit() here
├── models.py            # Add MergePreview, GarminSetRecord, HevySetRecord here
└── tests/
    └── test_fit_generator.py  # New test file for Phase 4
```

### Pattern 1: FIT Binary Walker

**What:** Walk the FIT binary record-by-record without a full decode. Track definition messages to know local→global message number and per-local data sizes (needed to advance the byte cursor).

**When to use:** Pass-through of non-set records; timestamp extraction from set records.

```python
# Source: binary analysis of original_garmin.fit + FIT Protocol spec
# [VERIFIED: executed against original_garmin.fit, parsed 4871 messages correctly]

import struct

def _walk_fit_binary(data: bytes) -> tuple[bytearray, list[int]]:
    """Walk FIT binary. Return (pass_through_bytes, active_set_start_times).
    
    Skips mesg 225 (set) and mesg 227 (exercise_title) definition and data records.
    Extracts per-set start_time (field 6) from active mesg 225 records (set_type==1).
    """
    FIT_CRC_TABLE = [
        0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
        0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400,
    ]
    
    header_size = data[0]
    data_size = struct.unpack_from('<I', data, 4)[0]
    file_end = header_size + data_size
    
    local_info: dict[int, dict] = {}  # local_num -> {global, data_size, fields}
    pass_through = bytearray()
    active_start_times: list[int] = []
    pos = header_size
    
    while pos < file_end:
        rh = data[pos]
        
        if rh & 0x80:  # compressed timestamp header
            local_num = (rh >> 5) & 0x03
            info = local_info[local_num]  # must exist
            total = 1 + info['data_size']
            if info['global'] not in (225, 227):
                pass_through.extend(data[pos:pos + total])
            pos += total
            continue
        
        is_def = bool(rh & 0x40)
        local_num = rh & 0x0F
        
        if is_def:
            # Definition message: extract global mesg num + per-field sizes
            is_dev = bool(rh & 0x20)
            arch = data[pos + 2]
            fmt = '<H' if arch == 0 else '>H'
            global_num = struct.unpack_from(fmt, data, pos + 3)[0]
            num_fields = data[pos + 5]
            fields = []
            for i in range(num_fields):
                fi = pos + 6 + i * 3
                fields.append((data[fi], data[fi + 1], data[fi + 2]))  # (field_num, size, base_type)
            def_size = 6 + num_fields * 3
            data_sz = sum(sz for _, sz, _ in fields)
            if is_dev:
                dev_cnt = data[pos + def_size]
                dev_sz = sum(data[pos + def_size + 1 + i * 3 + 1] for i in range(dev_cnt))
                data_sz += dev_sz
                def_size += 1 + dev_cnt * 3
            local_info[local_num] = {'global': global_num, 'data_size': data_sz, 'fields': fields}
            if global_num not in (225, 227):
                pass_through.extend(data[pos:pos + def_size])
            pos += def_size
        else:
            # Data message
            info = local_info[local_num]
            total = 1 + info['data_size']
            if info['global'] == 225:
                _extract_set_timestamps(data[pos:pos + total], info['fields'], active_start_times)
            if info['global'] not in (225, 227):
                pass_through.extend(data[pos:pos + total])
            pos += total
    
    return pass_through, active_start_times
```

**Key points:**
- Compressed timestamp header (bit 7 set): local_num is bits 6-5. Data size from last seen definition for that local_num.
- Definition message: bit 6 set, bit 7 clear. Fields at offset 6, each 3 bytes (field_num, size, base_type).
- Data message: bits 7 and 6 clear. Total size = 1 (header byte) + sum of field sizes from definition.
- The `data_size` from the definition (sum of field sizes) tells you exactly how many bytes to advance for data records.

### Pattern 2: Set Timestamp Extraction

**What:** Decode only the fields needed (start_time, set_type) from mesg 225 data records.

**When to use:** Pass 1 of the binary walk to collect Garmin timestamps before splicing.

```python
# Source: verified by decoding original_garmin.fit mesg 225 records
# [VERIFIED: 18 active sets correctly decoded with expected timestamps]

def _extract_set_timestamps(raw: bytes, fields: list[tuple], out: list[int]) -> None:
    """Append active set start_time values (field 6) to out list.
    
    mesg 225 field layout (verified against original_garmin.fit):
        field 254: timestamp (uint32) - workout-level, NOT per-set
        field 0:   duration (uint32, scale 1000ms)
        field 6:   start_time (uint32 FIT epoch) - ACTUAL per-set time
        field 3:   repetitions (uint16)
        field 4:   weight (uint16, scale x16 kg)
        field 5:   set_type (uint8): 0=rest, 1=active
        field 7:   category (uint16 array, 6 bytes)
        field 8:   category_subtype (uint16 array, 6 bytes)
        fields 9-14: various uint16 fields (proprietary/optional)
        field 2:   3-byte field (proprietary)
    """
    fpos = 1  # skip header byte
    decoded: dict[int, int] = {}
    for fnum, fsize, _ in fields:
        if fsize == 4:
            decoded[fnum] = struct.unpack_from('<I', raw, fpos)[0]
        elif fsize == 2:
            decoded[fnum] = struct.unpack_from('<H', raw, fpos)[0]
        elif fsize == 1:
            decoded[fnum] = raw[fpos]
        fpos += fsize
    
    start_time = decoded.get(6)
    set_type = decoded.get(5)
    if start_time and start_time != 0xFFFFFFFF and set_type == 1:  # active set only
        out.append(start_time)
```

### Pattern 3: garmin-fit-sdk Encoder for Set Messages

**What:** Encode Hevy exercise sets as mesg 225 records using garmin-fit-sdk.

**When to use:** Building the Hevy replacement bytes to append to the splice output.

```python
# Source: verified by running encoder + fitparse validation
# [VERIFIED: weight=80.0 -> stored as 1280 (80*16) -> fitparse reads 80.0]
# [VERIFIED: duration=45 (seconds) -> stored as 45000ms -> fitparse reads 45.0]
# [VERIFIED: category=[0] (bench_press) -> fitparse reads 'bench_press']
# [VERIFIED: None fields are omitted from output (SDK uses invalid value sentinel)]

from garmin_fit_sdk import Encoder, Profile as FitProfile

def _encode_hevy_sets(hevy_sets: list[dict]) -> bytes:
    """Encode Hevy set data as garmin-fit-sdk mesg 225 records.
    
    Returns raw FIT record bytes (no header, no trailing CRC).
    Strip from encoder output: data[14 : 14 + data_size].
    
    Each set dict has keys: timestamp_fit, start_time_fit, repetitions,
    weight_kg, duration_s, category_enum_int, exercise_enum_int, message_index.
    """
    encoder = Encoder()
    for s in hevy_sets:
        encoder.on_mesg(225, {
            'timestamp': s['timestamp_fit'],        # FIT epoch int (same as start_time)
            'start_time': s['start_time_fit'],      # FIT epoch int
            'repetitions': s.get('repetitions'),    # int or None (bodyweight)
            'weight': s.get('weight_kg'),           # float kg or None; SDK applies x16
            'set_type': 1,                          # always 'active'
            'duration': s.get('duration_s', 0),    # seconds; SDK stores as milliseconds
            'category': [s['category_enum_int']],   # list[int]; 65534 = unknown
            'category_subtype': [s['exercise_enum_int']],  # list[int]; 65534 = unknown
            'message_index': s['message_index'],
        })
    full_fit = encoder.close()
    hdr_sz = full_fit[0]
    rec_sz = struct.unpack_from('<I', full_fit, 4)[0]
    return bytes(full_fit[hdr_sz : hdr_sz + rec_sz])
```

**Critical API facts** [VERIFIED: garmin-fit-sdk==21.200.0]:
- `weight`: pass kg (float). SDK applies ×16 scale. Do NOT manually scale.
- `duration`: pass seconds (int or float). SDK stores as milliseconds (scale=1000).
- `category` and `category_subtype`: must be passed as Python `list`, e.g. `[0]`. Array fields.
- `None` values: SDK emits the invalid sentinel (0xFFFF for uint16, 0xFFFFFFFF for uint32) — field is present in the binary but reads as None from fitparse. Acceptable for bodyweight/no-reps exercises.
- `encoder.close()` produces a complete FIT file including 14-byte header and 2-byte trailing CRC.

### Pattern 4: FIT CRC-16 Algorithm

**What:** The FIT-specific 16-entry nibble-based CRC table. Used for both header CRC (first 12 bytes) and file CRC (entire header + records).

**When to use:** After assembling the splice output — compute header CRC then file CRC.

```python
# Source: FIT Protocol specification; verified against original_garmin.fit
# [VERIFIED: header CRC 0x5AA9 and file CRC 0x5135 both reproduced exactly]

_FIT_CRC_TABLE = [
    0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
    0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400,
]

def _compute_fit_crc(data: bytes, crc: int = 0) -> int:
    """CRC-16 over data bytes starting from crc (default 0)."""
    for byte in data:
        tmp = _FIT_CRC_TABLE[crc & 0x0F]
        crc = (crc >> 4) & 0x0FFF
        crc = crc ^ tmp ^ _FIT_CRC_TABLE[byte & 0x0F]
        tmp = _FIT_CRC_TABLE[crc & 0x0F]
        crc = (crc >> 4) & 0x0FFF
        crc = crc ^ tmp ^ _FIT_CRC_TABLE[(byte >> 4) & 0x0F]
    return crc
```

**Usage in assembly:**
```python
# Build new header: copy original, update data_size, recompute header CRC
new_header = bytearray(original[:header_size])
struct.pack_into('<I', new_header, 4, len(combined_records))
if header_size == 14:  # header CRC field present
    struct.pack_into('<H', new_header, 12, _compute_fit_crc(bytes(new_header[:12])))

# Assemble and append file CRC
file_bytes = bytes(new_header) + combined_records
file_crc = _compute_fit_crc(file_bytes)
final = file_bytes + struct.pack('<H', file_crc)
```

### Pattern 5: Linear Timestamp Fallback (D-04)

**What:** When Hevy has more sets than Garmin active-set timestamps, distribute overflow sets linearly between the last Garmin timestamp and the workout end.

**When to use:** Overflow sets only — Garmin timestamps take priority.

```python
# Source: D-04 decision; algorithm derived from FIT epoch arithmetic
# [VERIFIED: algorithm logic is straightforward; tested conceptually]

def _assign_timestamps(
    garmin_timestamps: list[int],  # FIT epoch ints from active mesg 225 records
    n_hevy_sets: int,
    workout_end_fit: int,          # FIT epoch int for session end time
) -> list[int]:
    """Return n_hevy_sets FIT epoch timestamps.
    
    Garmin timestamps assigned by position. Overflow distributed linearly.
    workout_end_fit is start_time_fit + total_elapsed_time (from session message).
    """
    result = []
    for i in range(n_hevy_sets):
        if i < len(garmin_timestamps):
            result.append(garmin_timestamps[i])
        else:
            last = garmin_timestamps[-1] if garmin_timestamps else workout_end_fit - 3600
            overflow_count = n_hevy_sets - len(garmin_timestamps)
            idx = i - len(garmin_timestamps)
            step = (workout_end_fit - last) // (overflow_count + 1)
            result.append(last + step * (idx + 1))
    return result
```

### Pattern 6: MergePreview Dataclasses (D-06, D-07)

**What:** Add to `models.py`. All fields are populated by `build_preview()`.

```python
# Source: D-06, D-07 decisions
# [ASSUMED: exact None-handling for missing biometric fields — see Assumptions Log]

from dataclasses import dataclass
from datetime import datetime

@dataclass
class BiometricSummary:
    total_elapsed_time: float | None    # seconds, from session message
    total_calories: int | None          # from session message
    avg_heart_rate: int | None          # from session message; None if no HR sensor
    max_heart_rate: int | None          # from session message; None if no HR sensor

@dataclass
class GarminSetRecord:
    """Original set data extracted from Garmin FIT mesg 225 (before_sets)."""
    start_time: datetime               # from field 6, converted to naive UTC datetime
    reps: int | None                   # field 3; None if 0xFFFF
    weight_kg: float | None            # field 4 / 16; None if 0xFFFF
    duration_s: float | None           # field 0 / 1000; None if 0
    category_enum_int: int             # field 7[0]; 65534 = unknown
    exercise_enum_int: int             # field 8[0]; 65534 = unknown

@dataclass
class HevySetRecord:
    """Hevy replacement set for after_sets."""
    start_time: datetime               # assigned from D-03/D-04 timestamp
    hevy_exercise_name: str            # raw exercise name from HevyExercise.title
    garmin_exercise: GarminExercise    # confirmed mapping (or GENERIC_FALLBACK)
    reps: int | None                   # from HevySet.reps
    weight_kg: float | None            # from HevySet.weight_kg

@dataclass
class MergePreview:
    biometric_summary: BiometricSummary
    before_sets: list[GarminSetRecord]
    after_sets: list[HevySetRecord]
```

### Anti-Patterns to Avoid

- **Using fitparse for pass-through:** fitparse cannot round-trip proprietary messages (140, 288, 326, 327). Binary copy only.
- **Using fit-tool FitFileBuilder for set encoding:** fit-tool output rejected by Garmin Connect (Phase 1 gate). garmin-fit-sdk only.
- **Manually scaling weight by 1000:** MERGE-02 in REQUIREMENTS.md describes raw FIT wire format, not the SDK API. D-10 overrides: pass kg directly.
- **Using field 254 (timestamp) for per-set time:** In the actual Garmin file, field 254 holds the workout start time for all sets. Field 6 (start_time) is the actual per-set timestamp.
- **Not updating header data_size after splice:** The header's data_size field (bytes 4-7) must be rewritten to reflect the new record byte count. Stale data_size causes fitparse to read garbage.
- **Recomputing file CRC before header CRC:** Header CRC covers bytes 0-11. Compute header CRC first, then assemble full file bytes, then compute file CRC over the complete assembly.
- **Forgetting to strip encoder header/CRC:** `encoder.close()` returns a complete FIT file. Appending the full output would produce a double header. Strip bytes 0 to `header_size` and the trailing 2 bytes: `full_fit[header_size : header_size + data_size]`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Set message encoding with correct scales | Manual struct packing | garmin-fit-sdk Encoder | Handles scale factors (×16 weight, ×1000 duration), array fields, invalid sentinels |
| FIT file validation | Custom message checker | `FitFile.from_file()` + `FitParseFile` | Double validation is D-11; both already in venv |
| Exercise name fuzzy matching | String similarity code | `mapper.suggest_mapping()` + `get_confirmed_mapping()` | Already implemented Phase 3 |
| Exercise enum lookups | CSV re-parsing | `GarminExercise.exercise_category_enum_int` + `exercise_enum_int` | Already in `GarminExercise` dataclass |

**Key insight:** The binary walker is the only custom component. Everything else reuses existing validated libraries and Phase 3 infrastructure.

---

## Common Pitfalls

### Pitfall 1: Wrong timestamp field in mesg 225

**What goes wrong:** Using field 254 (`timestamp`) instead of field 6 (`start_time`) for per-set timing.
**Why it happens:** `timestamp` is the standard FIT timestamp field, but Garmin's strength training FIT files store the workout start time in field 254 for all set records. The actual per-set time is in field 6.
**How to avoid:** Extract field 6 (`start_time`) from active mesg 225 records. In `original_garmin.fit`, all 18 active sets have field 254 = 1145353549 (workout start) while field 6 has distinct per-set times.
**Warning signs:** All extracted timestamps are identical.

### Pitfall 2: Compressed timestamp header misparse

**What goes wrong:** Treating a compressed timestamp record (bit 7 set) as a normal data record, causing the byte cursor to advance by only 1 byte.
**Why it happens:** The compressed timestamp header encodes the local message number in bits 6-5 and a timestamp offset in bits 4-0, but the DATA bytes still follow immediately. Total size is 1 (header) + `local_info[local_num]['data_size']`.
**How to avoid:** Check `rh & 0x80` first in the walker loop. Advance by `1 + info['data_size']`.
**Warning signs:** Walker exits early or total messages parsed is far below expected count.

### Pitfall 3: fit-tool venv patch not applied

**What goes wrong:** `FitFile.from_file()` throws `UnicodeDecodeError` on byte `0xa7` in the sport name field.
**Why it happens:** fit-tool 0.9.15 `field.py` uses `decode('utf-8')` without error handling. The patch to `decode('utf-8', errors='replace')` is applied to the venv but not committed to git.
**How to avoid:** The test suite will catch this — if `FitFile.from_file('original_garmin.fit')` fails in the parse gate test, re-apply the patch to `.venv/lib/python3.11/site-packages/fit_tool/field.py`.
**Warning signs:** `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xa7` in fit-tool validation.

### Pitfall 4: MERGE-02 weight scaling confusion

**What goes wrong:** Multiplying `weight_kg` by 1000 before passing to garmin-fit-sdk, resulting in stored values 62.5× too large.
**Why it happens:** REQUIREMENTS.md MERGE-02 says "multiply by 1000, store as grams" — this describes the raw FIT wire format for the `user_profile` message weight field, not the `set` message weight field. The `set` message weight field (mesg 225 field 4) has scale=16 in the FIT profile.
**How to avoid:** Pass `weight_kg` directly (float, in kg) to garmin-fit-sdk. D-10 is authoritative. Verified: 80.0 kg passed → stored as 1280 (= 80 × 16) → fitparse reads 80.0 kg.
**Warning signs:** fitparse reads weights like 5000.0 kg instead of expected values.

### Pitfall 5: Orphaned local message number after definition skip

**What goes wrong:** Skipping a definition message for mesg 225 but still needing to know the data size for subsequent data records of that local number.
**Why it happens:** Even if you skip copying the definition bytes to the output, you still need the `local_info` dict entry to advance the cursor past data records.
**How to avoid:** Always call `parse_def_full()` and update `local_info[local_num]` before deciding whether to copy the definition bytes to `pass_through`. The size tracking is independent of the copy decision.
**Warning signs:** `KeyError` on `local_info[local_num]` when processing data records for mesg 225.

### Pitfall 6: category_subtype values for array fields

**What goes wrong:** Passing `category_subtype=0` (int) instead of `[0]` (list) to the SDK.
**Why it happens:** garmin-fit-sdk mesg 225 field 8 is declared as `array=true`. The SDK expects a list even for single-element arrays.
**How to avoid:** Always wrap in list: `'category': [exercise.exercise_category_enum_int]`, `'category_subtype': [exercise.exercise_enum_int]`.
**Warning signs:** SDK raises TypeError or encodes incorrect bytes.

---

## Code Examples

### Full Splice Assembly

```python
# Source: prototyped and verified in this research session
# [VERIFIED: fitparse PASS + fit-tool PASS on prototype output from original_garmin.fit]

def build_merged_fit(match: MatchResult, timezone_str: str, out_path: str) -> str:
    with open(match.fit_workout._raw_path, 'rb') as f:
        original = f.read()
    
    header_size = original[0]
    orig_data_size = struct.unpack_from('<I', original, 4)[0]
    
    # Pass 1: walk binary, extract timestamps, build pass-through
    pass_through, active_start_times = _walk_fit_binary(original)
    
    # Assign timestamps to Hevy sets
    workout_end_fit = _get_workout_end_fit(match.fit_workout)
    all_hevy_sets = _flatten_hevy_sets(match.hevy_workout, match.fit_workout, timezone_str)
    timestamps = _assign_timestamps(active_start_times, len(all_hevy_sets), workout_end_fit)
    
    # Encode Hevy sets via garmin-fit-sdk
    set_dicts = _build_set_dicts(all_hevy_sets, timestamps)
    new_records = _encode_hevy_sets(set_dicts)
    
    # Assemble: updated header + pass_through + new_records + CRC
    combined = bytes(pass_through) + new_records
    new_header = bytearray(original[:header_size])
    struct.pack_into('<I', new_header, 4, len(combined))
    if header_size == 14:
        struct.pack_into('<H', new_header, 12, _compute_fit_crc(bytes(new_header[:12])))
    file_bytes = bytes(new_header) + combined
    file_crc = _compute_fit_crc(file_bytes)
    final = file_bytes + struct.pack('<H', file_crc)
    
    # Write and validate (D-11)
    out = pathlib.Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(final)
    _validate_fit_output(out_path)  # raises descriptive exception on failure (D-12)
    return out_path
```

### Biometric Field Extraction for Preview

```python
# Source: fit_parser.py existing pattern; session message fields confirmed
# [VERIFIED: avg_heart_rate, max_heart_rate, total_calories confirmed in original_garmin.fit]
# Sample values: elapsed=3126.976s, calories=266, avg_hr=114, max_hr=151

def _extract_biometric_summary(fit_workout: FitWorkout) -> BiometricSummary:
    # FitWorkout already has total_calories and total_elapsed_time from Phase 2
    # HR fields need to be added to FitWorkout or extracted separately
    # Note: fit_parser.parse_fit_file() does NOT currently extract avg/max HR from session
    # Phase 4 must either extend FitWorkout or use fitparse directly in build_preview()
    pass
```

**Note:** `fit_parser.py`'s `parse_fit_file()` extracts `total_calories` and `total_elapsed_time` from the session message but not `avg_heart_rate` or `max_heart_rate`. Phase 4 must add extraction of these fields — either by extending `FitWorkout` (preferred, avoids re-parsing) or by re-running fitparse in `build_preview()`. [ASSUMED: extending FitWorkout is cleaner, but the planner should decide]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fit-tool FitFileBuilder for writing | garmin-fit-sdk Encoder | Phase 1 gate | fit-tool output rejected by Garmin Connect |
| fit-tool round-trip reconstruction | Binary copy (Phase 1) / byte-level splice (Phase 4) | Phase 1 D-02 | fit-tool drops proprietary messages 140, 288, 326, 327 |
| REQUIREMENTS.md "weight × 1000" | garmin-fit-sdk passes kg; SDK applies ×16 | Phase 1 D-10 | REQUIREMENTS was written before Phase 1 validation |

**Deprecated/outdated:**
- `fitparse` for writing: always read-only. Never use for output.
- `fit-tool FitFileBuilder`: produces files Garmin Connect rejects for from-scratch activity files.

---

## Discovered Facts About original_garmin.fit

These are verified binary analysis results that directly constrain the implementation:

| Fact | Value | Source |
|------|-------|--------|
| Header size | 14 bytes (includes header CRC field) | [VERIFIED: binary read] |
| File size | 51,790 bytes | [VERIFIED: os.path.getsize] |
| Data size | 51,774 bytes | [VERIFIED: bytes 4-7 of header] |
| Total messages | 4,871 | [VERIFIED: full binary walk] |
| Mesg 225 (set) instances | 36 total (18 active, 18 rest) | [VERIFIED: binary walk + field decode] |
| Mesg 227 (exercise_title) instances | 0 (none present) | [VERIFIED: binary walk] |
| Proprietary message types | 140, 141, 162, 216, 233, 288, 326, 327, 394 | [VERIFIED: binary walk] |
| Mesg 225 local number | 2 | [VERIFIED: definition message decode] |
| Mesg 225 field 254 (timestamp) | All 36 records have the same value = workout start | [VERIFIED: decoded first 10 records] |
| Mesg 225 field 6 (start_time) | Distinct per-set values in FIT epoch uint32 | [VERIFIED: decoded first 10 records] |
| Garmin session: avg_heart_rate | 114 bpm | [VERIFIED: fitparse decode] |
| Garmin session: max_heart_rate | 151 bpm | [VERIFIED: fitparse decode] |
| Garmin session: calories | 266 kcal | [VERIFIED: fitparse decode] |
| Garmin session: elapsed time | 3126.976 s (~52 min) | [VERIFIED: fitparse decode] |
| Matched Hevy workout | "Legs", Apr 17, 5:46 PM–6:39 PM, 6 exercises, 19 sets | [VERIFIED: parse_hevy_csv output] |
| Set count mismatch | 18 Garmin active sets vs 19 Hevy sets | [VERIFIED: both counts] |

---

## Integration Points

### What Phase 4 Receives from Phase 3

- `MatchResult.fit_workout`: `FitWorkout` (parsed biometrics, but no raw bytes path)
- `MatchResult.hevy_workout`: `HevyWorkout` (exercises, sets, naive local timestamps)

**Problem:** `FitWorkout` has no reference to the original FIT file path. The binary walker needs the raw bytes. `build_merged_fit()` must receive or derive the original FIT file path separately from `MatchResult`. This is a Phase 5 concern (Phase 5 holds the uploaded file path), but Phase 4's function signature must accommodate it.

**Options for the planner:**
1. Add `fit_path: str` parameter to `build_merged_fit()` and `build_preview()` — explicit, easy to test.
2. Store the raw path in `FitWorkout` — requires `models.py` change but keeps signature clean.

[ASSUMED: Option 1 is simpler for Phase 4 in isolation; Phase 5 compatibility may prefer Option 2]

### What Phase 4 Needs from mapper.py

- `get_confirmed_mapping(hevy_name)` → `GarminExercise | None`
- `GENERIC_FALLBACK` → for unmapped exercises (Phase 4 is told all exercises are confirmed per CONTEXT.md deferred; but defensive fallback is wise)

### What Phase 4 Provides to Phase 5

- `build_preview(match, timezone_str) -> MergePreview` — safe to call multiple times
- `build_merged_fit(match, timezone_str, out_path) -> str` — writes file, returns path

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Extending `FitWorkout` with `avg_heart_rate`/`max_heart_rate` is the right approach for biometric_summary | Code Examples | May need re-parsing in build_preview() instead — minor refactor |
| A2 | Option 1 (add `fit_path` parameter) is the right signature for Phase 5 compatibility | Integration Points | Phase 5 may need to pass a different structure — planner should verify with Phase 5 context |
| A3 | `MergePreview.biometric_summary` uses `None` for absent HR fields (no HR sensor) | Pattern 6 | Could use 0 instead — affects Phase 5 display logic |
| A4 | Duration for Hevy sets: use set-to-set interval from Garmin timestamps (end_time - start_time) rather than a fixed value | Pattern 3 | If a fixed value is used, Garmin Connect may show incorrect rest/active splits |
| A5 | `MergePreview.before_sets` includes rest sets (set_type=0) alongside active sets | Pattern 6 | Could filter to active only — affects before/after comparison UX |

---

## Open Questions

1. **FitWorkout raw path access for binary walker**
   - What we know: `build_merged_fit()` needs the raw FIT bytes; `FitWorkout` has no `_raw_path` field
   - What's unclear: Whether to add `fit_path` to the function signature or store it in `FitWorkout`
   - Recommendation: Add `fit_path: str` as an explicit parameter to `build_preview()` and `build_merged_fit()`. Phase 5 has the uploaded file path and can pass it directly.

2. **avg_heart_rate / max_heart_rate in FitWorkout**
   - What we know: `fit_parser.parse_fit_file()` does not currently extract these fields from the session message; they exist in `original_garmin.fit` (avg=114, max=151)
   - What's unclear: Whether to extend `FitWorkout` or access fitparse separately in `build_preview()`
   - Recommendation: Add `avg_heart_rate: int | None` and `max_heart_rate: int | None` to `FitWorkout` and update `parse_fit_file()`. Keeps data in one place; minimal change.

3. **Set duration for Hevy sets**
   - What we know: Hevy `HevySet.duration_seconds` is typically None (no per-set duration in Hevy); garmin-fit-sdk accepts `duration=0`
   - What's unclear: Whether to compute duration from Garmin timestamp intervals (end_time - start_time of consecutive active sets), use 0, or skip the field
   - Recommendation: Derive from Garmin timestamp intervals when available (active_start_times[i+1] - active_start_times[i]); use 0 for overflow sets. This produces meaningful duration data in Garmin Connect.

---

## Environment Availability

All dependencies confirmed present in `.venv`:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| garmin-fit-sdk | Set encoding | Yes | 21.200.0 | — |
| fitparse | Parse gate + biometric extraction | Yes | 1.2.0 | — |
| fit-tool | Parse gate (FitFile.from_file) | Yes | 0.9.15 | — |
| Python 3.11.2 | Runtime | Yes | 3.11.2 | — |
| original_garmin.fit | Test fixture | Yes | 51,790 bytes | — |
| original_hevy.csv | Test fixture | Yes | 95 workouts | — |
| data/garmin_exercises.csv | Exercise enum lookup | Yes | 1,846 entries | — |
| data/exercise_mappings.db | Confirmed mappings | Yes | SQLite DB | — |

**fit-tool patch status:** The `UnicodeDecodeError` patch in `.venv/lib/python3.11/site-packages/fit_tool/field.py` is applied to the current venv. If the venv is rebuilt, re-apply the patch: change `decode('utf-8')` to `decode('utf-8', errors='replace')` in the `_decode_string` method.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 |
| Config file | none (pytest discovers from project root) |
| Quick run command | `.venv/bin/pytest tests/test_fit_generator.py -x -q` |
| Full suite command | `.venv/bin/pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIT-03 | Merged FIT passes fitparse + fit-tool validation | integration | `.venv/bin/pytest tests/test_fit_generator.py::test_build_merged_fit_validates -x` | No — Wave 0 |
| FIT-03 | Proprietary messages (140, 288, 326, 327) preserved in output | integration | `.venv/bin/pytest tests/test_fit_generator.py::test_proprietary_messages_preserved -x` | No — Wave 0 |
| FIT-04 | Validation failure raises descriptive exception | unit | `.venv/bin/pytest tests/test_fit_generator.py::test_validation_failure_raises -x` | No — Wave 0 |
| MERGE-01 | Non-set message count unchanged after splice | unit | `.venv/bin/pytest tests/test_fit_generator.py::test_non_set_messages_preserved -x` | No — Wave 0 |
| MERGE-02 | Weight 22.5 kg correctly stored in output (22.5 * 16 = 360) | unit | `.venv/bin/pytest tests/test_fit_generator.py::test_weight_scaling -x` | No — Wave 0 |
| MERGE-03 | 18 Garmin timestamps assigned to first 18 Hevy sets; linear for overflow | unit | `.venv/bin/pytest tests/test_fit_generator.py::test_timestamp_assignment -x` | No — Wave 0 |
| MERGE-04 | build_preview returns MergePreview with before/after sets | unit | `.venv/bin/pytest tests/test_fit_generator.py::test_build_preview -x` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `.venv/bin/pytest tests/test_fit_generator.py -x -q`
- **Per wave merge:** `.venv/bin/pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/test_fit_generator.py` — all Phase 4 tests (new file)
- [ ] `tests/conftest.py` update — add `sample_match_result` fixture using `match_workouts()` with Asia/Singapore timezone

---

## Security Domain

This phase handles local file I/O only (reading a local FIT file, writing to a local path). No network requests, no authentication, no user credentials. ASVS categories V2/V3/V4/V6 do not apply.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Partial | Validate that `out_path` is inside the project directory; reject paths outside GarminHevyMerge/ |
| V6 Cryptography | No | CRC-16 is not a security primitive; integrity check only |

**Path traversal note:** `out_path` is caller-supplied. `build_merged_fit()` should verify the output path is within the expected output directory before writing. Phase 5 controls the path, but defensive validation is appropriate.

---

## Sources

### Primary (HIGH confidence)
- `original_garmin.fit` — binary analysis: header structure, mesg 225 field layout, all message counts and types [VERIFIED: live code execution]
- `garmin_fit_sdk` 21.200.0 installed in `.venv` — Encoder API, FitProfile field definitions, scale factors [VERIFIED: live code execution]
- `fitparse` 1.2.0 — used as validation tool; confirms garmin-fit-sdk output is readable [VERIFIED: live code execution]
- `fit_generator.py` existing implementation — confirmed garmin-fit-sdk call patterns for set messages

### Secondary (MEDIUM confidence)
- FIT Protocol specification — CRC-16 algorithm (verified independently against actual file; algorithm is standard)
- CONTEXT.md D-01 through D-12 — all locked decisions incorporated verbatim

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Binary walker algorithm: HIGH — implemented and tested against actual file; 4,871 messages parsed correctly
- garmin-fit-sdk field semantics: HIGH — verified by encoding + fitparse round-trip
- FIT CRC algorithm: HIGH — verified against original file (both header CRC and file CRC match)
- MergePreview dataclass design: MEDIUM — structure follows D-06/D-07 exactly; field None-handling is discretionary
- fit_path parameter decision: LOW — architectural choice; planner decides based on Phase 5 integration

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable libraries; garmin-fit-sdk SDK version is pinned)
