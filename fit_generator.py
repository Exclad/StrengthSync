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
# Phase 4: merge pipeline stubs (implemented in waves 2-4)
# ---------------------------------------------------------------------------

def build_preview(match, timezone_str: str, fit_path: str):
    """Build before/after comparison without writing any file (D-06, D-08).

    Args:
        match: MatchResult pairing a Garmin FitWorkout with a HevyWorkout.
        timezone_str: IANA timezone string for Hevy timestamp conversion.
        fit_path: Absolute path to the original Garmin FIT binary file.

    Returns:
        MergePreview with biometric_summary, before_sets, after_sets.
    """
    raise NotImplementedError("build_preview not yet implemented — Wave 3")


def build_merged_fit(match, timezone_str: str, fit_path: str, out_path: str) -> str:
    """Write merged FIT file and return out_path (D-08).

    Args:
        match: MatchResult pairing a Garmin FitWorkout with a HevyWorkout.
        timezone_str: IANA timezone string for Hevy timestamp conversion.
        fit_path: Absolute path to the original Garmin FIT binary file.
        out_path: Destination path for the merged .fit file.

    Returns:
        out_path after successful write and validation.

    Raises:
        ValueError: If CRC or parse validation fails (D-12).
    """
    raise NotImplementedError("build_merged_fit not yet implemented — Wave 3/4")


def _validate_fit_output(path: str) -> None:
    """Double-validate merged FIT: fit-tool parse gate + fitparse parse gate (D-11).

    Raises descriptive ValueError (not bare RuntimeError) on failure (D-12).
    """
    raise NotImplementedError("_validate_fit_output not yet implemented — Wave 4")
