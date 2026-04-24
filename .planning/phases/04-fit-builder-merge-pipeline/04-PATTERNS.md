# Phase 4: FIT Builder + Merge Pipeline - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 4 (2 modified, 2 created)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `fit_generator.py` (modify) | service | file-I/O + transform | `fit_generator.py` itself (existing functions) | exact — extend same file |
| `models.py` (modify) | model | transform | `models.py` itself (existing dataclasses) | exact — extend same file |
| `tests/test_fit_generator.py` (create) | test | file-I/O | `tests/test_fit_scratch.py` + `tests/test_fit_roundtrip.py` | role-match |
| `tests/conftest.py` (modify) | test config | request-response | `tests/conftest.py` itself (existing fixtures) | exact — extend same file |

---

## Pattern Assignments

### `fit_generator.py` — add `build_preview()` and `build_merged_fit()`

**Analog:** `fit_generator.py` lines 1–145 (existing file, same module)

**Imports pattern** (lines 1–13):
```python
"""FIT file writer module.

fitparse is NEVER used for writing (read-only library).
Phase 1: minimal stubs proven against Garmin Connect.
Phase 4: full merge pipeline extends these functions.
"""
import datetime
import pathlib
import shutil
from fit_tool.fit_file import FitFile
from fit_tool.fit_file_builder import FitFileBuilder
from garmin_fit_sdk import Encoder, Profile as FitProfile
```

**Phase 4 adds these imports** (extend the existing block):
```python
import struct
from fitparse import FitFile as FitParseFile
from models import (
    FitWorkout, HevyWorkout, MatchResult,
    GarminExercise, MergePreview, BiometricSummary,
    GarminSetRecord, HevySetRecord,
)
import mapper
```

**FIT epoch constant** (line 15 — reuse, do not duplicate):
```python
# FIT epoch offset: seconds between Unix epoch and FIT epoch (1989-12-31 UTC)
_FIT_EPOCH_OFFSET = 631_065_600
```

**Core garmin-fit-sdk encoder pattern** (lines 91–99 from `build_minimal_strength_fit`):
```python
encoder = Encoder()
encoder.on_mesg(225, {
    'timestamp': now_fit + 60,
    'start_time': now_fit,
    'repetitions': 10,
    'weight': 60,      # kg — SDK applies scale=16 internally
    'set_type': 1,     # 1 = active set
    'duration': 60,    # seconds
})
data = encoder.close()
```

**Phase 4 set encoding pattern** (from RESEARCH.md Pattern 3, verified against garmin-fit-sdk 21.200.0):
```python
def _encode_hevy_sets(hevy_sets: list[dict]) -> bytes:
    """Encode Hevy set data as garmin-fit-sdk mesg 225 records.

    Returns raw FIT record bytes (no file header, no trailing CRC).
    Strip from encoder output: full_fit[hdr_sz : hdr_sz + rec_sz].

    Each set dict keys: timestamp_fit, start_time_fit, repetitions,
    weight_kg, duration_s, category_enum_int, exercise_enum_int, message_index.
    """
    encoder = Encoder()
    for s in hevy_sets:
        encoder.on_mesg(225, {
            'timestamp': s['timestamp_fit'],
            'start_time': s['start_time_fit'],
            'repetitions': s.get('repetitions'),    # int or None (bodyweight)
            'weight': s.get('weight_kg'),           # float kg or None; SDK applies x16
            'set_type': 1,
            'duration': s.get('duration_s', 0),    # seconds; SDK stores as milliseconds
            'category': [s['category_enum_int']],   # list[int] — array field, must be list
            'category_subtype': [s['exercise_enum_int']],
            'message_index': s['message_index'],
        })
    full_fit = encoder.close()
    hdr_sz = full_fit[0]
    rec_sz = struct.unpack_from('<I', full_fit, 4)[0]
    return bytes(full_fit[hdr_sz : hdr_sz + rec_sz])
```

**FIT CRC algorithm** (from RESEARCH.md Pattern 4, verified against `original_garmin.fit`):
```python
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

**Binary walker pattern** (from RESEARCH.md Pattern 1 — verified: 4,871 messages parsed from `original_garmin.fit`):
```python
def _walk_fit_binary(data: bytes) -> tuple[bytearray, list[int]]:
    """Walk FIT binary. Return (pass_through_bytes, active_set_start_times).

    Skips mesg 225 (set) and mesg 227 (exercise_title) definition and data records.
    Extracts per-set start_time (field 6) from active mesg 225 records (set_type==1).
    """
    header_size = data[0]
    data_size = struct.unpack_from('<I', data, 4)[0]
    file_end = header_size + data_size

    local_info: dict[int, dict] = {}   # local_num -> {global, data_size, fields}
    pass_through = bytearray()
    active_start_times: list[int] = []
    pos = header_size

    while pos < file_end:
        rh = data[pos]

        if rh & 0x80:  # compressed timestamp header (bit 7 set)
            local_num = (rh >> 5) & 0x03
            info = local_info[local_num]  # must already exist
            total = 1 + info['data_size']
            if info['global'] not in (225, 227):
                pass_through.extend(data[pos:pos + total])
            pos += total
            continue

        is_def = bool(rh & 0x40)
        local_num = rh & 0x0F

        if is_def:
            is_dev = bool(rh & 0x20)
            arch = data[pos + 2]
            fmt = '<H' if arch == 0 else '>H'
            global_num = struct.unpack_from(fmt, data, pos + 3)[0]
            num_fields = data[pos + 5]
            fields = []
            for i in range(num_fields):
                fi = pos + 6 + i * 3
                fields.append((data[fi], data[fi + 1], data[fi + 2]))
            def_size = 6 + num_fields * 3
            data_sz = sum(sz for _, sz, _ in fields)
            if is_dev:
                dev_cnt = data[pos + def_size]
                dev_sz = sum(data[pos + def_size + 1 + i * 3 + 1] for i in range(dev_cnt))
                data_sz += dev_sz
                def_size += 1 + dev_cnt * 3
            # ALWAYS update local_info even for skipped messages (Pitfall 5)
            local_info[local_num] = {'global': global_num, 'data_size': data_sz, 'fields': fields}
            if global_num not in (225, 227):
                pass_through.extend(data[pos:pos + def_size])
            pos += def_size
        else:
            info = local_info[local_num]
            total = 1 + info['data_size']
            if info['global'] == 225:
                _extract_set_timestamps(data[pos:pos + total], info['fields'], active_start_times)
            if info['global'] not in (225, 227):
                pass_through.extend(data[pos:pos + total])
            pos += total

    return pass_through, active_start_times
```

**Set timestamp extraction** (from RESEARCH.md Pattern 2 — field 6 is per-set start_time, NOT field 254):
```python
def _extract_set_timestamps(raw: bytes, fields: list[tuple], out: list[int]) -> None:
    """Append active set start_time values (field 6) to out list.

    Field 254 (timestamp) = workout-level start for all sets (same value, useless).
    Field 6 (start_time) = actual per-set time (distinct for each set). Use field 6.
    """
    fpos = 1  # skip record header byte
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
    if start_time and start_time != 0xFFFFFFFF and set_type == 1:  # active sets only
        out.append(start_time)
```

**Linear timestamp fallback** (from RESEARCH.md Pattern 5 — D-04):
```python
def _assign_timestamps(
    garmin_timestamps: list[int],
    n_hevy_sets: int,
    workout_end_fit: int,
) -> list[int]:
    """Return n_hevy_sets FIT epoch timestamps.

    Garmin timestamps assigned by position (D-03). Overflow distributed linearly (D-04).
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

**File write pattern** (lines 142–145 from `build_minimal_strength_fit`):
```python
out_path_obj = pathlib.Path(out_path)
out_path_obj.parent.mkdir(parents=True, exist_ok=True)
out_path_obj.write_bytes(data)
```

**Error handling pattern** (lines 42–44 from `write_roundtrip_fit`):
```python
try:
    FitFile.from_file(in_path)
except Exception as exc:
    raise ValueError(f"fit-tool could not parse {in_path!r}: {exc}") from exc
```

**Phase 4 validation pattern** (D-11 + D-12 — two layers, descriptive exception):
```python
def _validate_fit_output(path: str) -> None:
    """Double-validate merged FIT: fit-tool parse gate + fitparse parse gate (D-11).

    Raises descriptive exception (not bare RuntimeError) on failure (D-12).
    """
    try:
        FitFile.from_file(path)
    except Exception as exc:
        raise ValueError(
            f"Merged FIT failed fit-tool validation: {exc}\nPath: {path}"
        ) from exc
    try:
        with FitParseFile(path) as ff:
            list(ff.get_messages())
    except Exception as exc:
        raise ValueError(
            f"Merged FIT failed fitparse validation: {exc}\nPath: {path}"
        ) from exc
```

**Public function signatures** (D-08):
```python
def build_preview(match: MatchResult, timezone_str: str, fit_path: str) -> MergePreview:
    """Build before/after comparison without writing any file (D-06, D-08).

    Safe to call multiple times. Phase 5 calls this first, then shows MergePreview
    to the user before calling build_merged_fit() on confirm (D-09).

    Args:
        match: Paired Garmin + Hevy workout from matcher.py.
        timezone_str: IANA timezone string for Hevy timestamp conversion.
        fit_path: Absolute path to the original Garmin FIT binary file.

    Returns:
        MergePreview with biometric_summary, before_sets, after_sets.
    """
    ...


def build_merged_fit(
    match: MatchResult,
    timezone_str: str,
    fit_path: str,
    out_path: str,
) -> str:
    """Write merged FIT file and return out_path (D-08).

    Byte-level splice: preserves all Garmin biometric messages verbatim (D-01, D-02),
    replaces mesg 225/227 with garmin-fit-sdk-encoded Hevy sets.
    CRC recomputed during splice; double-validated on completion (D-11).

    Args:
        match: Paired Garmin + Hevy workout from matcher.py.
        timezone_str: IANA timezone string for Hevy timestamp conversion.
        fit_path: Absolute path to the original Garmin FIT binary file.
        out_path: Destination path for the merged .fit file.

    Returns:
        out_path (same as input) after successful write and validation.

    Raises:
        ValueError: If CRC or parse validation fails (D-12).
        KeyError: If a Hevy exercise has no confirmed mapping (deferred to Phase 5).
    """
    ...
```

---

### `models.py` — add `BiometricSummary`, `GarminSetRecord`, `HevySetRecord`, `MergePreview`

**Analog:** `models.py` lines 1–92 (existing file, same module)

**Imports pattern** (lines 1–9 — reuse exactly, `from __future__ import annotations` is already present):
```python
"""Shared dataclasses for FitWorkout and HevyWorkout.

Imported by fit_parser.py, hevy_parser.py, and Phase 3+ merge modules.
All FIT timestamps are naive UTC-equivalent datetimes (fitparse output).
All Hevy timestamps are naive local datetimes (Phase 3 applies timezone).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
```

**Existing dataclass pattern** (lines 26–47, `FitWorkout` — copy style exactly):
```python
@dataclass
class FitWorkout:
    start_time: datetime | None
    end_time: datetime | None
    total_calories: int | None
    total_elapsed_time: float | None
    device_serial: int | None
    heart_rate_samples: list[HRSample] = field(default_factory=list)
    gps_track: list[GPSPoint] = field(default_factory=list)
    cadence_samples: list[CadenceSample] = field(default_factory=list)
    power_samples: list[PowerSample] = field(default_factory=list)
```

**Phase 4 new dataclasses** (append after line 92, following exact same style):
```python
@dataclass
class BiometricSummary:
    """Garmin session-level biometric fields for MergePreview display."""
    total_elapsed_time: float | None    # seconds, from session message
    total_calories: int | None          # from session message
    avg_heart_rate: int | None          # from session message; None if no HR sensor
    max_heart_rate: int | None          # from session message; None if no HR sensor


@dataclass
class GarminSetRecord:
    """Original set data extracted from Garmin FIT mesg 225 (before_sets in MergePreview)."""
    start_time: datetime               # from field 6, converted to naive UTC datetime
    reps: int | None                   # field 3; None if 0xFFFF
    weight_kg: float | None            # field 4 / 16; None if 0xFFFF
    duration_s: float | None           # field 0 / 1000; None if 0
    category_enum_int: int             # field 7[0]; 65534 = unknown
    exercise_enum_int: int             # field 8[0]; 65534 = unknown


@dataclass
class HevySetRecord:
    """Hevy replacement set for after_sets in MergePreview."""
    start_time: datetime               # assigned from D-03/D-04 timestamp
    hevy_exercise_name: str            # raw exercise name from HevyExercise.title
    garmin_exercise: GarminExercise    # confirmed mapping (or GENERIC_FALLBACK)
    reps: int | None                   # from HevySet.reps
    weight_kg: float | None            # from HevySet.weight_kg


@dataclass
class MergePreview:
    """Before/after comparison for Phase 5 confirmation UI (D-06)."""
    biometric_summary: BiometricSummary
    before_sets: list[GarminSetRecord]
    after_sets: list[HevySetRecord]
```

**Note on `FitWorkout` extension** (RESEARCH.md Open Question 2): `fit_parser.parse_fit_file()` does not currently extract `avg_heart_rate` or `max_heart_rate`. Add these two fields to `FitWorkout` and update `parse_fit_file()` to read them from the `session` message:
```python
# In FitWorkout dataclass, add after existing fields:
avg_heart_rate: int | None = None
max_heart_rate: int | None = None

# In fit_parser.parse_fit_file(), inside the sessions block:
avg_hr = s.get_value("avg_heart_rate")   # int bpm or None (no HR sensor)
max_hr = s.get_value("max_heart_rate")   # int bpm or None
# Pass to FitWorkout(..., avg_heart_rate=avg_hr, max_heart_rate=max_hr)
```

---

### `tests/test_fit_generator.py` (create new)

**Analogs:**
- `tests/test_fit_scratch.py` — structure for file-output tests using `output_dir` fixture
- `tests/test_fit_roundtrip.py` — structure for integration tests against `original_garmin.fit`
- `tests/test_matcher.py` — structure for unit tests with helper factory functions

**Module docstring pattern** (from `test_fit_scratch.py` lines 1–7):
```python
"""Tests for build_preview() and build_merged_fit(): FIT splice, CRC, weight scaling.

FIT-03: Merged FIT accepted by Garmin Connect — proprietary messages preserved
FIT-04: CRC validation + descriptive error on failure
MERGE-01: Non-set messages preserved verbatim
MERGE-02: Weight scaling correct (kg * 16 in wire format)
MERGE-03: Set timestamps assigned from Garmin mesg 225 field 6
MERGE-04: build_preview returns MergePreview with before/after sets
"""
```

**Import pattern** (from `test_fit_scratch.py` lines 1–5 + `test_matcher.py` lines 1–3):
```python
import pytest
import os
import struct
import fitparse
from fit_tool.fit_file import FitFile
from fit_generator import build_preview, build_merged_fit
from models import MergePreview, GarminSetRecord, HevySetRecord, BiometricSummary
```

**Helper factory pattern** (from `test_matcher.py` lines 13–33 — minimal objects with named factory functions):
```python
def _make_fit(start: datetime) -> FitWorkout:
    """Minimal FitWorkout with only start_time populated."""
    return FitWorkout(
        start_time=start,
        end_time=None,
        total_calories=None,
        total_elapsed_time=None,
        device_serial=None,
    )
```

**File output test pattern** (from `test_fit_scratch.py` lines 13–22 — uses `output_dir` fixture, asserts file exists):
```python
def test_minimal_fit_reparses(output_dir):
    """From-scratch FIT file must re-parse with fitparse without errors."""
    out_path = output_dir + "/minimal.fit"
    build_minimal_strength_fit(out_path)
    assert os.path.exists(out_path), "Output file must exist after build"
    with fitparse.FitFile(out_path) as ff:
        messages = list(ff.get_messages())
    assert len(messages) > 0, "Re-parsed FIT file must contain at least one message"
```

**Integration test using real files pattern** (from `test_fit_roundtrip.py` lines 13–22 — uses `sample_fit_path` fixture):
```python
def test_roundtrip_reparses(sample_fit_path, output_dir):
    """Round-trip: read original_garmin.fit, write to output, re-parse with fitparse."""
    out_path = output_dir + "/roundtrip.fit"
    write_roundtrip_fit(sample_fit_path, out_path)
    with fitparse.FitFile(out_path) as ff:
        messages = list(ff.get_messages())
    assert len(messages) > 0, "Re-parsed FIT file must contain at least one message"
```

**Wave 0 stub test pattern** (tests that must exist before implementation — fail with ImportError or xfail):
```python
# Pattern: define all test function names from RESEARCH.md Validation Architecture
# so the wave structure is visible. Use pytest.importorskip or xfail for stubs.

def test_build_merged_fit_validates(sample_match_result, sample_fit_path, output_dir):
    """FIT-03: Merged FIT passes fitparse + fit-tool double validation."""
    out_path = output_dir + "/merged.fit"
    result_path = build_merged_fit(sample_match_result, "Asia/Singapore", sample_fit_path, out_path)
    assert os.path.exists(result_path)
    # Validate via fitparse
    with fitparse.FitFile(result_path) as ff:
        list(ff.get_messages())
    # Validate via fit-tool
    FitFile.from_file(result_path)


def test_proprietary_messages_preserved(sample_match_result, sample_fit_path, output_dir):
    """FIT-03: Proprietary message types 140, 288, 326, 327 must survive the splice."""
    out_path = output_dir + "/merged_prop.fit"
    build_merged_fit(sample_match_result, "Asia/Singapore", sample_fit_path, out_path)
    # Walk the output binary and collect all global message numbers
    with open(out_path, 'rb') as f:
        data = f.read()
    # ... walk binary to collect global nums and assert {140, 288} are present


def test_weight_scaling(sample_match_result, sample_fit_path, output_dir):
    """MERGE-02: 22.5 kg must be stored as 360 in wire format (22.5 * 16)."""
    ...


def test_timestamp_assignment(sample_match_result, sample_fit_path, output_dir):
    """MERGE-03: 18 Garmin timestamps assigned to first 18 Hevy sets; linear for overflow."""
    ...


def test_build_preview(sample_match_result, sample_fit_path):
    """MERGE-04: build_preview returns MergePreview; no file written."""
    preview = build_preview(sample_match_result, "Asia/Singapore", sample_fit_path)
    assert isinstance(preview, MergePreview)
    assert isinstance(preview.biometric_summary, BiometricSummary)
    assert len(preview.before_sets) > 0
    assert len(preview.after_sets) > 0
    assert all(isinstance(s, GarminSetRecord) for s in preview.before_sets)
    assert all(isinstance(s, HevySetRecord) for s in preview.after_sets)
```

---

### `tests/conftest.py` — add `sample_match_result` fixture

**Analog:** `tests/conftest.py` lines 41–63 (existing Phase 3 fixtures)

**Existing Phase 3 fixture pattern** (lines 41–63):
```python
@pytest.fixture
def sample_fit_workout(sample_fit_path):
    """Return a parsed FitWorkout from the sample Garmin FIT file."""
    from fit_parser import parse_fit_file
    return parse_fit_file(sample_fit_path)


@pytest.fixture
def sample_hevy_workouts(sample_hevy_path):
    """Return parsed list[HevyWorkout] from the sample Hevy CSV."""
    from hevy_parser import parse_hevy_csv
    return parse_hevy_csv(sample_hevy_path)
```

**Phase 4 new fixture** (append after line 63, same pattern):
```python
# --- Phase 4 fixtures ---

@pytest.fixture
def sample_match_result(sample_fit_workout, sample_hevy_workouts):
    """Return a MatchResult pairing original_garmin.fit with the Apr 17 Hevy 'Legs' workout.

    Uses Asia/Singapore timezone (UTC+8). Garmin workout starts 2026-04-17 09:45:49 UTC;
    Hevy 'Legs' workout starts 2026-04-17 17:46 local (= 09:46 UTC). Delta ~0.18 min.
    """
    from matcher import match_workouts
    result = match_workouts(sample_fit_workout, sample_hevy_workouts, "Asia/Singapore")
    assert result is not None, (
        "sample_match_result fixture: no match found for original_garmin.fit + original_hevy.csv. "
        "Verify that original_hevy.csv contains the Apr 17, 2026 Legs workout."
    )
    return result
```

---

## Shared Patterns

### FIT Epoch Constant
**Source:** `fit_generator.py` line 15
**Apply to:** `fit_generator.py` (reuse, do not redeclare)
```python
_FIT_EPOCH_OFFSET = 631_065_600
```
Convert FIT epoch int to naive UTC datetime: `datetime.datetime(1989, 12, 31, tzinfo=datetime.timezone.utc) + datetime.timedelta(seconds=fit_epoch_int)` then `.replace(tzinfo=None)`.

### Error Handling Style
**Source:** `fit_generator.py` lines 42–44
**Apply to:** `_validate_fit_output()`, any mapper call that may return None
```python
try:
    FitFile.from_file(in_path)
except Exception as exc:
    raise ValueError(f"fit-tool could not parse {in_path!r}: {exc}") from exc
```
Phase 4 rule: always raise `ValueError` (not bare `RuntimeError`) with enough detail for Phase 5 to show the user a clear message (D-12).

### mapper.py Integration
**Source:** `mapper.py` lines 141–171
**Apply to:** `build_preview()` and `build_merged_fit()` when looking up Hevy exercise names
```python
from mapper import get_confirmed_mapping, GENERIC_FALLBACK

garmin_ex = get_confirmed_mapping(hevy_name)
if garmin_ex is None:
    # Per CONTEXT.md deferred: Phase 4 may raise or fall back to GENERIC_FALLBACK
    garmin_ex = GENERIC_FALLBACK
```

### pytest Fixture Chain
**Source:** `tests/conftest.py` lines 41–55
**Apply to:** `sample_match_result` fixture — build on `sample_fit_workout` + `sample_hevy_workouts`, which in turn use `sample_fit_path` and `sample_hevy_path`
```python
@pytest.fixture
def sample_match_result(sample_fit_workout, sample_hevy_workouts):
    from matcher import match_workouts
    result = match_workouts(sample_fit_workout, sample_hevy_workouts, "Asia/Singapore")
    assert result is not None, "..."
    return result
```

### Test Isolation
**Source:** `tests/conftest.py` lines 22–27 (`output_dir` fixture)
**Apply to:** All `test_fit_generator.py` tests that write files
```python
@pytest.fixture
def output_dir(tmp_path):
    """Use pytest's tmp_path, not the production output/ directory."""
    return str(tmp_path)
```
Tests must never write to `/workspace/GarminHevyMerge/output/` during test runs.

---

## No Analog Found

All four files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively — however, the binary walker logic has no codebase analog (it is genuinely new) and must be implemented from the RESEARCH.md Pattern 1 code, which was verified by live execution against `original_garmin.fit`.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `fit_generator._walk_fit_binary` (internal) | utility | file-I/O | No existing binary walker in codebase; use RESEARCH.md Pattern 1 exactly |
| `fit_generator._compute_fit_crc` (internal) | utility | transform | No existing CRC in codebase; use RESEARCH.md Pattern 4 exactly |

---

## Critical Implementation Notes

### D-10: Weight Scaling (Pitfall 4)
Pass `weight_kg` (float, in kg) directly to garmin-fit-sdk. The SDK applies ×16 scale internally. Do NOT multiply by 1000 or 16 manually. Verified: `80.0 kg → stored as 1280 → fitparse reads 80.0 kg`.

### D-03 / Pitfall 1: Correct Timestamp Field
In `original_garmin.fit`, mesg 225 field 254 (`timestamp`) holds the same workout start time for ALL 36 set records. Field 6 (`start_time`) holds the distinct per-set times. Extract field 6 only.

### Pitfall 5: Orphaned local_info
Even when skipping mesg 225/227 definition bytes from `pass_through`, always update `local_info[local_num]` before deciding whether to copy. The size tracking is independent of the copy decision.

### fit-tool UnicodeDecodeError Patch
`FitFile.from_file()` on `original_garmin.fit` may fail with `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xa7`. If this occurs, re-apply the patch to `.venv/lib/python3.11/site-packages/fit_tool/field.py`: change `.decode('utf-8')` to `.decode('utf-8', errors='replace')` in the `_decode_string` method.

### Encoder Output Stripping
`encoder.close()` returns a complete FIT file (header + records + trailing CRC). To extract only the record bytes for appending to the splice: `full_fit[hdr_sz : hdr_sz + rec_sz]` where `hdr_sz = full_fit[0]` and `rec_sz = struct.unpack_from('<I', full_fit, 4)[0]`.

---

## Metadata

**Analog search scope:** `/workspace/GarminHevyMerge/` (all Python files + tests/)
**Files read:** `fit_generator.py`, `models.py`, `fit_parser.py`, `mapper.py`, `matcher.py`, `tests/conftest.py`, `tests/test_fit_parser.py`, `tests/test_fit_roundtrip.py`, `tests/test_fit_scratch.py`, `tests/test_matcher.py`
**Pattern extraction date:** 2026-04-22
