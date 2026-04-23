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

# FIT epoch offset: seconds between Unix epoch and FIT epoch (1989-12-31 UTC)
_FIT_EPOCH_OFFSET = 631_065_600


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
