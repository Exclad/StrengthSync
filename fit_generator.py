"""FIT file writer module.

fitparse is NEVER used for writing (read-only library).
Phase 1: minimal stubs proven against Garmin Connect.
Phase 4: full merge pipeline extends these functions.
"""
import datetime
import pathlib
import shutil
import struct
from fit_tool.fit_file import FitFile
from fit_tool.fit_file_builder import FitFileBuilder
from garmin_fit_sdk import Encoder, Profile as FitProfile
from fitparse import FitFile as FitParseFile
from models import (
    FitWorkout,
    HevyWorkout,
    MatchResult,
    GarminExercise,
    MergePreview,
    BiometricSummary,
    GarminSetRecord,
    HevySetRecord,
)
import mapper

# FIT epoch offset: seconds between Unix epoch and FIT epoch (1989-12-31 UTC)
_FIT_EPOCH_OFFSET = 631_065_600

_FIT_CRC_TABLE = [
    0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
    0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400,
]


def _compute_fit_crc(data: bytes, crc: int = 0) -> int:
    """CRC-16 over data bytes using the FIT-specific 16-entry nibble table.

    Verified: reproduces header CRC 0x5AA9 (over bytes 0-11 of original_garmin.fit)
    and file CRC 0x5135 (over the entire file).
    """
    for byte in data:
        tmp = _FIT_CRC_TABLE[crc & 0x0F]
        crc = (crc >> 4) & 0x0FFF
        crc = crc ^ tmp ^ _FIT_CRC_TABLE[byte & 0x0F]
        tmp = _FIT_CRC_TABLE[crc & 0x0F]
        crc = (crc >> 4) & 0x0FFF
        crc = crc ^ tmp ^ _FIT_CRC_TABLE[(byte >> 4) & 0x0F]
    return crc


def _assign_timestamps(
    garmin_timestamps: list[int],
    n_hevy_sets: int,
    workout_end_fit: int,
) -> list[int]:
    """Return n_hevy_sets FIT epoch timestamps.

    Strategy (D-03, D-04):
    - First min(len(garmin_timestamps), n_hevy_sets) timestamps come from Garmin
      mesg 225 field 6 (start_time), assigned by position.
    - Overflow sets (index >= len(garmin_timestamps)) are distributed linearly
      between the last Garmin timestamp and workout_end_fit.

    Args:
        garmin_timestamps: FIT epoch ints extracted from active mesg 225 field 6.
        n_hevy_sets: Total number of Hevy sets to assign timestamps to.
        workout_end_fit: FIT epoch int = session start_time + total_elapsed_time.

    Returns:
        List of length n_hevy_sets with FIT epoch timestamp ints.
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


def _extract_set_timestamps(raw: bytes, fields: list[tuple], out: list[int]) -> None:
    """Append active set start_time values (field 6) from a mesg 225 data record.

    CRITICAL — field disambiguation (D-03, Pitfall 1):
      field 254 (timestamp): holds the SAME workout start time for ALL 36 set records.
                             This is useless for per-set timing — do NOT use it.
      field 6 (start_time): holds the DISTINCT per-set start time — use this field.

    Args:
        raw: Raw bytes of the mesg 225 data record (includes 1-byte header).
        fields: List of (field_num, field_size, base_type) tuples from the definition.
        out: Output list to append active-set start_time values to.
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
        # Skip multi-byte array fields we don't need (e.g. field 7/8 of size 6)
        fpos += fsize

    start_time = decoded.get(6)
    set_type = decoded.get(5)
    # set_type 1 = active; guard against 0xFFFF sentinel
    if start_time and start_time != 0xFFFFFFFF and set_type == 1:
        out.append(start_time)


def _walk_fit_binary(data: bytes) -> tuple[bytearray, list[int]]:
    """Walk a FIT binary byte-by-byte. Return (pass_through_bytes, active_set_start_times).

    Pass-through contains all records EXCEPT mesg 225 (set) and mesg 227 (exercise_title).
    Both definition AND data records for mesg 225/227 are excluded from pass_through.

    Active-set start_time values (FIT epoch int, field 6 of mesg 225) are extracted
    from mesg 225 data records with set_type==1 and returned in active_set_start_times.

    IMPORTANT (Pitfall 5): local_info is ALWAYS updated when a definition is parsed,
    even for mesg 225/227. Without this, data records for those local numbers cause
    KeyError because the byte cursor cannot advance past them.

    IMPORTANT (Pitfall 2): compressed timestamp records (bit 7 set) embed the local_num
    in bits 6-5. Total size = 1 (header) + local_info[local_num]['data_size'].

    Args:
        data: Raw FIT file bytes (full file, including header and trailing CRC).

    Returns:
        Tuple of (pass_through bytearray, active_set_start_times list[int]).
    """
    header_size = data[0]
    data_size = struct.unpack_from('<I', data, 4)[0]
    file_end = header_size + data_size

    local_info: dict[int, dict] = {}  # local_num -> {global, data_size, fields}
    pass_through = bytearray()
    active_start_times: list[int] = []
    pos = header_size

    while pos < file_end:
        rh = data[pos]

        # --- Compressed timestamp record (bit 7 set) ---
        if rh & 0x80:
            local_num = (rh >> 5) & 0x03
            info = local_info[local_num]  # must already exist from prior definition
            total = 1 + info['data_size']
            if info['global'] not in (225, 227):
                pass_through.extend(data[pos:pos + total])
            pos += total
            continue

        is_def = bool(rh & 0x40)
        local_num = rh & 0x0F

        if is_def:
            # --- Definition message ---
            is_dev = bool(rh & 0x20)  # developer data extension flag
            arch = data[pos + 2]       # 0 = little-endian, 1 = big-endian
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
            # ALWAYS update local_info even if we skip copying the bytes (Pitfall 5)
            local_info[local_num] = {'global': global_num, 'data_size': data_sz, 'fields': fields}
            if global_num not in (225, 227):
                pass_through.extend(data[pos:pos + def_size])
            pos += def_size
        else:
            # --- Data message ---
            info = local_info[local_num]
            total = 1 + info['data_size']
            if info['global'] == 225:
                _extract_set_timestamps(data[pos:pos + total], info['fields'], active_start_times)
            if info['global'] not in (225, 227):
                pass_through.extend(data[pos:pos + total])
            pos += total

    return pass_through, active_start_times


def _flatten_hevy_sets(
    hevy_workout: HevyWorkout,
) -> list[tuple]:
    """Return a flat list of (HevyExercise, HevySet) pairs in workout order.

    Excludes cardio exercises (those already flagged in hevy_workout.skipped_cardio).
    The HevyExercise.title is preserved for use in HevySetRecord.hevy_exercise_name.
    """
    pairs: list[tuple] = []
    skipped = set(hevy_workout.skipped_cardio)
    for ex in hevy_workout.exercises:
        if ex.title in skipped:
            continue
        for s in ex.sets:
            pairs.append((ex, s))
    return pairs


def _get_workout_end_fit(fit_workout: FitWorkout) -> int:
    """Return FIT epoch int for the workout end time.

    Used to bound the linear timestamp fallback (D-04).
    Falls back to start + 3600 if total_elapsed_time is missing.

    Raises:
        ValueError: If FitWorkout.start_time is None.
    """
    if fit_workout.start_time is None:
        raise ValueError("FitWorkout.start_time is None — cannot compute workout end time")
    elapsed = fit_workout.total_elapsed_time or 3600.0
    end_dt = fit_workout.start_time + datetime.timedelta(seconds=elapsed)
    # Convert naive UTC datetime to FIT epoch int
    unix_ts = int(end_dt.replace(tzinfo=datetime.timezone.utc).timestamp())
    return unix_ts - _FIT_EPOCH_OFFSET


def _build_set_dicts(
    flat_sets: list[tuple],
    timestamps: list[int],
) -> list[dict]:
    """Build the list of dicts passed to _encode_hevy_sets.

    For each (HevyExercise, HevySet) pair at index i, looks up the confirmed mapping
    from mapper.get_confirmed_mapping(). Falls back to GENERIC_FALLBACK if unmapped.

    Duration is derived from Garmin timestamp intervals when available:
    duration_s[i] = timestamps[i+1] - timestamps[i] for Garmin-sourced timestamps.
    Overflow sets use 0 as duration (no Garmin timestamp interval available).

    Args:
        flat_sets: List of (HevyExercise, HevySet) from _flatten_hevy_sets.
        timestamps: FIT epoch ints from _assign_timestamps (len == len(flat_sets)).

    Returns:
        List of dicts with keys: timestamp_fit, start_time_fit, repetitions,
        weight_kg, duration_s, category_enum_int, exercise_enum_int, message_index.
    """
    result = []
    for i, (ex, s) in enumerate(flat_sets):
        garmin_ex = mapper.get_confirmed_mapping(ex.title)
        if garmin_ex is None:
            candidates = mapper.suggest_mapping(ex.title, limit=1)
            if candidates and candidates[0][1] >= mapper.UNRESOLVED_THRESHOLD:
                garmin_ex = candidates[0][0]
            else:
                garmin_ex = mapper.GENERIC_FALLBACK
        ts = timestamps[i]
        # Hevy does not record per-set duration — use 0 so Garmin shows accurate set time
        # (computing gap between timestamps would include rest time, inflating the displayed value)
        duration_s = 0
        result.append({
            'timestamp_fit': ts,
            'start_time_fit': ts,
            'repetitions': s.reps,
            'weight_kg': s.weight_kg,       # float kg or None; SDK applies x16
            'duration_s': duration_s,
            'category_enum_int': garmin_ex.exercise_category_enum_int,
            'exercise_enum_int': garmin_ex.exercise_enum_int,
            'message_index': i,
        })
    return result


def _encode_hevy_sets(set_dicts: list[dict]) -> bytes:
    """Encode Hevy set data as garmin-fit-sdk mesg 225 records.

    Returns raw FIT record bytes: the encoder output stripped of its 14-byte file
    header and trailing 2-byte CRC. These bytes are appended directly to the
    pass-through buffer in build_merged_fit().

    CRITICAL — weight (D-10, Pitfall 4):
      Pass weight_kg as float kg. SDK applies x16 scale internally.
      DO NOT multiply by 1000 or 16 — that produces values 62.5x or 16x too large.
      Verified: 80.0 kg -> stored as 1280 (= 80 * 16) -> fitparse reads 80.0.

    CRITICAL — array fields (Pitfall 6):
      category and category_subtype are array fields. Pass as list[int] even for a
      single value: [0] not 0. The SDK raises TypeError if passed a scalar.

    Args:
        set_dicts: List of dicts from _build_set_dicts.

    Returns:
        bytes containing only the FIT record bytes (definition + data messages for
        mesg 225). No file header. No trailing CRC. Safe to append to splice output.
    """
    encoder = Encoder()
    for s in set_dicts:
        encoder.on_mesg(225, {
            'timestamp': s['timestamp_fit'],
            'start_time': s['start_time_fit'],
            'repetitions': s.get('repetitions'),       # int or None (bodyweight)
            'weight': s.get('weight_kg'),              # float kg or None; SDK x16
            'set_type': 1,                             # always active
            'duration': s.get('duration_s', 0),       # seconds; SDK stores as ms
            'category': [s['category_enum_int']],      # list[int] — must be list
            'category_subtype': [s['exercise_enum_int']],  # list[int] — must be list
            'message_index': s['message_index'],
        })
    full_fit = encoder.close()
    hdr_sz = full_fit[0]
    rec_sz = struct.unpack_from('<I', full_fit, 4)[0]
    return bytes(full_fit[hdr_sz : hdr_sz + rec_sz])


def write_roundtrip_fit(in_path: str, out_path: str) -> None:
    """Read a FIT file and write it verbatim to out_path.

    Round-trip strategy: binary copy of the source file.

    fit-tool 0.9.15 drops Garmin-proprietary fields (mesg_num 140, 288, 326, 327,
    and unknown field IDs within known messages) when reading, so reconstructing via
    FitFile.to_file() produces a truncated file that fitparse cannot re-parse. Using
    raw binary copy preserves all bytes exactly and guarantees the output passes
    fitparse re-parse and Garmin Connect upload (per D-02: functional equivalence,
    not byte-for-byte library reconstruction).

    read_fit_file() is called first to validate fit-tool can open the source file.
    The binary copy is then written to out_path.

    Args:
        in_path: Path to the source .fit file (e.g. original_garmin.fit).
        out_path: Path to write the output .fit file (must be inside GarminHevyMerge/).

    Raises:
        FileNotFoundError: If in_path does not exist.
    """
    # Validate the file is a parseable FIT file via fit-tool
    try:
        FitFile.from_file(in_path)
    except Exception as exc:
        raise ValueError(f"fit-tool could not parse {in_path!r}: {exc}") from exc
    # Binary copy preserves all bytes (including Garmin-proprietary messages that
    # fit-tool 0.9.15 drops during field-level reconstruction)
    shutil.copy2(in_path, out_path)


def build_minimal_strength_fit(out_path: str) -> None:
    """Build a minimal strength training FIT activity file from scratch.

    Uses garmin-fit-sdk (official Garmin Python encoder). fit-tool FitFileBuilder
    was attempted first but Garmin Connect rejected its output; garmin-fit-sdk is
    the validated fallback (Plan 01-03 deviation).

    Message sequence (per Garmin FIT activity protocol):
      file_id -> event(start) -> set -> event(stop) -> lap -> session -> activity

    garmin-fit-sdk API takes semantic values:
      - timestamps: FIT epoch seconds (Unix seconds - 631_065_600)
      - weight: kg (float) — SDK applies scale=16 internally
      - total_elapsed_time: seconds — SDK applies scale=1000 internally

    Args:
        out_path: Path to write the output .fit file (must be inside GarminHevyMerge/).
    """
    now_fit = int(datetime.datetime.now(datetime.timezone.utc).timestamp() - _FIT_EPOCH_OFFSET)
    duration_s = 3600  # 1 hour

    mn = FitProfile['mesg_num']
    encoder = Encoder()

    # 1. file_id
    encoder.on_mesg(mn['FILE_ID'], {
        'type': 'activity',
        'manufacturer': 'development',
        'product': 0,
        'serial_number': 0x12345678,
        'time_created': now_fit,
    })

    # 2. event: timer start
    encoder.on_mesg(mn['EVENT'], {
        'timestamp': now_fit,
        'event': 'timer',
        'event_type': 'start',
    })

    # 3. set (mesg_num 225) — one strength set, 60 kg × 10 reps
    encoder.on_mesg(225, {
        'timestamp': now_fit + 60,
        'start_time': now_fit,
        'repetitions': 10,
        'weight': 60,      # kg — SDK applies scale=16 internally
        'set_type': 1,     # 1 = active set
        'duration': 60,    # seconds
    })

    # 4. event: timer stop
    encoder.on_mesg(mn['EVENT'], {
        'timestamp': now_fit + duration_s,
        'event': 'timer',
        'event_type': 'stop_all',
    })

    # 5. lap
    encoder.on_mesg(mn['LAP'], {
        'timestamp': now_fit + duration_s,
        'start_time': now_fit,
        'event': 'lap',
        'event_type': 'stop',
        'total_elapsed_time': duration_s,
        'total_timer_time': duration_s,
    })

    # 6. session
    encoder.on_mesg(mn['SESSION'], {
        'timestamp': now_fit + duration_s,
        'start_time': now_fit,
        'event': 'session',
        'event_type': 'stop',
        'sport': 'training',
        'sub_sport': 'strength_training',
        'total_elapsed_time': duration_s,
        'total_timer_time': duration_s,
    })

    # 7. activity
    encoder.on_mesg(mn['ACTIVITY'], {
        'timestamp': now_fit + duration_s,
        'total_timer_time': duration_s,
        'num_sessions': 1,
        'type': 'manual',
        'event': 'activity',
        'event_type': 'stop',
    })

    data = encoder.close()
    if not data:
        raise RuntimeError("garmin-fit-sdk encoder.close() returned empty bytes")
    out_path_obj = pathlib.Path(out_path)
    out_path_obj.parent.mkdir(parents=True, exist_ok=True)
    out_path_obj.write_bytes(data)


# ---------------------------------------------------------------------------
# Phase 4: merge pipeline (Wave 3: encoder + preview)
# ---------------------------------------------------------------------------

def _extract_before_sets(
    fit_bytes: bytes,
) -> list[GarminSetRecord]:
    """Extract active Garmin set records from FIT binary as GarminSetRecord list.

    Reads field 6 (start_time), field 0 (duration, stored as ms), field 3 (reps),
    field 4 (weight, stored as uint16 x16), field 5 (set_type), field 7 (category array),
    field 8 (category_subtype array) from mesg 225 data records.

    Only active sets (set_type == 1) are included. Rest sets are excluded.

    All 0xFFFF sentinel values (invalid uint16) are mapped to None.

    Returns:
        List of GarminSetRecord in workout order.
    """
    FIT_EPOCH_BASE = datetime.datetime(1989, 12, 31, tzinfo=datetime.timezone.utc)
    header_size = fit_bytes[0]
    data_size = struct.unpack_from('<I', fit_bytes, 4)[0]
    file_end = header_size + data_size

    local_info: dict[int, dict] = {}
    records: list[GarminSetRecord] = []
    pos = header_size

    while pos < file_end:
        rh = fit_bytes[pos]
        if rh & 0x80:
            local_num = (rh >> 5) & 0x03
            info = local_info.get(local_num)
            if info is None:
                break
            pos += 1 + info['data_size']
            continue

        is_def = bool(rh & 0x40)
        local_num = rh & 0x0F

        if is_def:
            is_dev = bool(rh & 0x20)
            arch = fit_bytes[pos + 2]
            fmt = '<H' if arch == 0 else '>H'
            global_num = struct.unpack_from(fmt, fit_bytes, pos + 3)[0]
            num_fields = fit_bytes[pos + 5]
            fields = []
            for i in range(num_fields):
                fi = pos + 6 + i * 3
                fields.append((fit_bytes[fi], fit_bytes[fi + 1], fit_bytes[fi + 2]))
            def_size = 6 + num_fields * 3
            data_sz = sum(sz for _, sz, _ in fields)
            if is_dev:
                dev_cnt = fit_bytes[pos + def_size]
                dev_sz = sum(fit_bytes[pos + def_size + 1 + i * 3 + 1] for i in range(dev_cnt))
                data_sz += dev_sz
                def_size += 1 + dev_cnt * 3
            local_info[local_num] = {'global': global_num, 'data_size': data_sz, 'fields': fields}
            pos += def_size
        else:
            info = local_info[local_num]
            total = 1 + info['data_size']
            if info['global'] == 225:
                raw = fit_bytes[pos:pos + total]
                fpos = 1
                decoded: dict[int, int] = {}
                for fnum, fsize, _ in info['fields']:
                    if fsize == 4:
                        decoded[fnum] = struct.unpack_from('<I', raw, fpos)[0]
                    elif fsize == 2:
                        decoded[fnum] = struct.unpack_from('<H', raw, fpos)[0]
                    elif fsize == 1:
                        decoded[fnum] = raw[fpos]
                    fpos += fsize

                set_type = decoded.get(5)
                if set_type == 1:  # active only
                    start_time_fit = decoded.get(6, 0)
                    start_dt = (FIT_EPOCH_BASE + datetime.timedelta(seconds=start_time_fit)).replace(tzinfo=None)
                    raw_reps = decoded.get(3)
                    raw_weight = decoded.get(4)
                    raw_dur = decoded.get(0)
                    # 0xFFFF = invalid sentinel for uint16; 0 duration = no data
                    reps = None if (raw_reps is None or raw_reps == 0xFFFF) else raw_reps
                    weight_kg = None if (raw_weight is None or raw_weight == 0xFFFF) else raw_weight / 16.0
                    duration_s = None if (raw_dur is None or raw_dur == 0) else raw_dur / 1000.0
                    # category / category_subtype: fields 7 and 8 are uint16 arrays (6 bytes = 3 uint16)
                    # First element is the relevant enum; 65534 = unknown
                    cat = decoded.get(7, 65534)
                    sub = decoded.get(8, 65534)
                    records.append(GarminSetRecord(
                        start_time=start_dt,
                        reps=reps,
                        weight_kg=weight_kg,
                        duration_s=duration_s,
                        category_enum_int=cat,
                        exercise_enum_int=sub,
                    ))
            pos += total

    return records


def build_preview(
    match: MatchResult,
    timezone_str: str,
    fit_path: str,
) -> MergePreview:
    """Build before/after comparison without writing any file (D-06, D-08).

    Safe to call multiple times. Phase 5 calls this first, then shows MergePreview
    to the user before calling build_merged_fit() on confirm (D-09).

    Per-set timestamps are taken from Garmin mesg 225 field 6 (D-03). If Hevy has more
    sets than Garmin timestamps, the overflow sets receive linearly-distributed timestamps (D-04).

    Weight in before_sets is decoded from the FIT wire format (stored uint16 / 16.0 = kg).
    Weight in after_sets is the raw Hevy weight_kg (float) — garmin-fit-sdk will apply x16
    during build_merged_fit() encoding (D-10).

    Args:
        match: Paired Garmin + Hevy workout from matcher.py.
        timezone_str: IANA timezone string (e.g. 'Asia/Singapore'). Currently unused in
                      build_preview (timestamps come from Garmin FIT, not Hevy local time),
                      but retained for API symmetry with build_merged_fit (D-08).
        fit_path: Absolute path to the original Garmin FIT binary file.

    Returns:
        MergePreview with biometric_summary, before_sets (Garmin active sets),
        and after_sets (Hevy replacement sets with assigned timestamps).

    Raises:
        FileNotFoundError: If fit_path does not exist.
        ValueError: If FitWorkout has no start_time.
    """
    fit_path_obj = pathlib.Path(fit_path)
    if not fit_path_obj.exists():
        raise FileNotFoundError(f"FIT file not found: {fit_path!r}")

    fit_bytes = fit_path_obj.read_bytes()
    fit_workout = match.fit_workout
    hevy_workout = match.hevy_workout

    # --- Biometric summary (from FitWorkout populated by parse_fit_file) ---
    summary = BiometricSummary(
        total_elapsed_time=fit_workout.total_elapsed_time,
        total_calories=fit_workout.total_calories,
        avg_heart_rate=fit_workout.avg_heart_rate,
        max_heart_rate=fit_workout.max_heart_rate,
    )

    # --- Before sets: Garmin active mesg 225 records decoded from binary ---
    before_sets = _extract_before_sets(fit_bytes)

    # --- After sets: Hevy replacement sets with assigned timestamps ---
    _, active_start_times = _walk_fit_binary(fit_bytes)
    workout_end_fit = _get_workout_end_fit(fit_workout)
    flat_sets = _flatten_hevy_sets(hevy_workout)
    timestamps = _assign_timestamps(active_start_times, len(flat_sets), workout_end_fit)

    FIT_EPOCH_BASE = datetime.datetime(1989, 12, 31, tzinfo=datetime.timezone.utc)
    after_sets: list[HevySetRecord] = []
    for i, (ex, s) in enumerate(flat_sets):
        garmin_ex = mapper.get_confirmed_mapping(ex.title)
        if garmin_ex is None:
            candidates = mapper.suggest_mapping(ex.title, limit=1)
            if candidates and candidates[0][1] >= mapper.UNRESOLVED_THRESHOLD:
                garmin_ex = candidates[0][0]
            else:
                garmin_ex = mapper.GENERIC_FALLBACK
        ts_fit = timestamps[i]
        start_dt = (FIT_EPOCH_BASE + datetime.timedelta(seconds=ts_fit)).replace(tzinfo=None)
        after_sets.append(HevySetRecord(
            start_time=start_dt,
            hevy_exercise_name=ex.title,
            garmin_exercise=garmin_ex,
            reps=s.reps,
            weight_kg=s.weight_kg,
        ))

    return MergePreview(
        biometric_summary=summary,
        before_sets=before_sets,
        after_sets=after_sets,
    )


# ---------------------------------------------------------------------------
# Phase 4: merge pipeline (Wave 4: build_merged_fit + validation)
# ---------------------------------------------------------------------------

_PROJECT_ROOT = pathlib.Path(__file__).parent.resolve()


def _check_out_path(out_path: str) -> pathlib.Path:
    """Verify out_path is inside the project directory. Raises ValueError if not (D-12).

    Prevents path traversal: a caller cannot use ../../../etc/passwd or similar.
    Phase 5 supplies out_path from a temp file or output/ subfolder — both are safe.
    """
    resolved = pathlib.Path(out_path).resolve()
    if not str(resolved).startswith(str(_PROJECT_ROOT)):
        raise ValueError(
            f"out_path must be inside the project directory ({_PROJECT_ROOT}). "
            f"Refusing to write to: {resolved}"
        )
    return resolved


def _validate_fit_output(path: str) -> None:
    """Double-validate a merged FIT file: fit-tool parse gate + fitparse parse gate (D-11).

    Raises descriptive ValueError (not bare RuntimeError) on failure so Phase 5 can
    surface a clear error message to the user (D-12).

    Note: fit-tool 0.9.15 may raise UnicodeDecodeError on byte 0xa7 in sport name fields.
    If this occurs in the venv, re-apply the patch to
    .venv/lib/python3.11/site-packages/fit_tool/field.py:
      change `.decode('utf-8')` to `.decode('utf-8', errors='replace')` in _decode_string.

    Args:
        path: Absolute path to the FIT file to validate.

    Raises:
        ValueError: If either parse gate fails. Message begins with 'fit-tool' or 'fitparse'.
    """
    try:
        FitFile.from_file(path)
    except Exception as exc:
        raise ValueError(
            f"fit-tool validation failed for merged FIT: {exc}\nPath: {path}"
        ) from exc
    try:
        with FitParseFile(path) as ff:
            list(ff.get_messages())
    except Exception as exc:
        raise ValueError(
            f"fitparse validation failed for merged FIT: {exc}\nPath: {path}"
        ) from exc


def build_merged_fit(
    match: MatchResult,
    timezone_str: str,
    fit_path: str,
    out_path: str,
) -> str:
    """Write merged FIT file and return out_path (D-08).

    Byte-level splice strategy (D-01, D-02):
      1. Walk the Garmin FIT binary with _walk_fit_binary().
         - Copies all non-mesg-225/227 records verbatim (biometric pass-through).
         - Extracts per-set start_time values from mesg 225 field 6 (D-03).
      2. Assign timestamps to Hevy sets using _assign_timestamps():
         - First min(N_garmin, N_hevy) sets get Garmin timestamps (D-03).
         - Overflow sets get linearly distributed timestamps (D-04).
      3. Encode Hevy sets via garmin-fit-sdk Encoder using _encode_hevy_sets() (D-10).
      4. Assemble: updated header + pass_through + hevy_records + file CRC.
      5. Write to out_path and double-validate (D-11, D-12).

    Weight encoding (D-10): pass float kg to garmin-fit-sdk; SDK applies x16 internally.
    Do NOT multiply by 1000 or 16 — that produces incorrect values.

    Args:
        match: Paired Garmin + Hevy workout from matcher.py.
        timezone_str: IANA timezone string (e.g. 'Asia/Singapore'). Used for future
                      Hevy-timestamp-based features; currently timestamps come from
                      Garmin mesg 225 field 6, making timezone_str unused in this function.
        fit_path: Absolute path to the original Garmin FIT binary file.
        out_path: Destination path for the merged .fit file. Must be inside the
                  project directory (path traversal check enforced).

    Returns:
        out_path (same as input) after successful write and double-validation.

    Raises:
        FileNotFoundError: If fit_path does not exist.
        ValueError: If out_path is outside the project directory (path traversal).
        ValueError: If CRC or parse validation fails (D-12). Message begins with
                    'fit-tool' or 'fitparse' for Phase 5 error display.
        KeyError: If a Hevy exercise has no confirmed mapping and mapper raises.
    """
    # Security: reject out_path outside project root
    out_resolved = _check_out_path(out_path)

    fit_path_obj = pathlib.Path(fit_path)
    if not fit_path_obj.exists():
        raise FileNotFoundError(f"FIT file not found: {fit_path!r}")

    original = fit_path_obj.read_bytes()
    header_size = original[0]

    # Pass 1: walk binary — extract timestamps, build pass-through (D-01, D-02)
    pass_through, active_start_times = _walk_fit_binary(original)

    # Assign timestamps to Hevy sets (D-03, D-04)
    fit_workout = match.fit_workout
    hevy_workout = match.hevy_workout
    workout_end_fit = _get_workout_end_fit(fit_workout)
    flat_sets = _flatten_hevy_sets(hevy_workout)
    timestamps = _assign_timestamps(active_start_times, len(flat_sets), workout_end_fit)

    # Encode Hevy sets via garmin-fit-sdk (D-10)
    set_dicts = _build_set_dicts(flat_sets, timestamps)
    hevy_records = _encode_hevy_sets(set_dicts)

    # Assemble: pass_through + hevy_records form the new data region
    combined_records = bytes(pass_through) + hevy_records

    # Update header: copy original header, rewrite data_size, recompute header CRC
    new_header = bytearray(original[:header_size])
    struct.pack_into('<I', new_header, 4, len(combined_records))
    if header_size == 14:  # 14-byte header includes a header CRC at bytes 12-13
        struct.pack_into('<H', new_header, 12, _compute_fit_crc(bytes(new_header[:12])))

    # Append file CRC over complete assembled bytes
    file_bytes = bytes(new_header) + combined_records
    file_crc = _compute_fit_crc(file_bytes)
    final = file_bytes + struct.pack('<H', file_crc)

    # Write output
    out_resolved.parent.mkdir(parents=True, exist_ok=True)
    out_resolved.write_bytes(final)

    # Double-validate (D-11); raises ValueError on failure (D-12)
    _validate_fit_output(str(out_resolved))

    return str(out_resolved)
