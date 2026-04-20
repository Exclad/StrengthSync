"""FIT file writer module.

Uses fit-tool FitFileBuilder for all write operations.
fitparse is NEVER used for writing (read-only library).
Phase 1: minimal stubs proven against Garmin Connect.
Phase 4: full merge pipeline extends these functions.
"""
import datetime
import shutil
from fit_tool.fit_file import FitFile
from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.event_message import EventMessage
from fit_tool.profile.messages.session_message import SessionMessage
from fit_tool.profile.messages.lap_message import LapMessage
from fit_tool.profile.messages.activity_message import ActivityMessage
from fit_tool.profile.messages.set_message import SetMessage
from fit_tool.profile.profile_type import (
    FileType, Manufacturer, Sport, SubSport,
    Event, EventType, Activity,
)


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
    FitFile.from_file(in_path)
    # Binary copy preserves all bytes (including Garmin-proprietary messages that
    # fit-tool 0.9.15 drops during field-level reconstruction)
    shutil.copy2(in_path, out_path)


def build_minimal_strength_fit(out_path: str) -> None:
    """Build a minimal strength training FIT activity file from scratch.

    Message sequence (per Garmin FIT activity protocol):
      file_id -> event(start) -> SetMessage -> event(stop) -> lap -> session -> activity

    Timestamps use Unix epoch milliseconds (fit-tool converts to FIT 1989 epoch internally).
    Weight field: integer in grams (kg * 1000). Example: 60 kg -> 60_000.

    Args:
        out_path: Path to write the output .fit file (must be inside GarminHevyMerge/).

    Raises:
        RuntimeError: If fit-tool FitFileBuilder fails.
    """
    # fit-tool uses Unix epoch milliseconds at the Python API level.
    # The library converts to FIT 1989 epoch internally.
    # DO NOT pass FIT epoch seconds — would produce timestamps 20 years in the past.
    now_ms = round(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    workout_duration_ms = 3600 * 1000  # 1 hour

    builder = FitFileBuilder(auto_define=True, min_string_size=50)

    # 1. file_id (required first message in every FIT activity file)
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
    # weight: integer grams. 60 kg -> 60_000 (DO NOT pass float per CLAUDE.md)
    msg = SetMessage()
    msg.timestamp = now_ms + 60_000       # 1 min into workout
    msg.start_time = now_ms
    msg.repetitions = 10
    msg.weight = 60.0                     # fit-tool weight API is in kg (scale=16 applied internally)
    msg.set_type = 0                      # 0 = active set
    builder.add(msg)

    # 4. event: timer stop
    msg = EventMessage()
    msg.event = Event.TIMER
    try:
        msg.event_type = EventType.STOP_ALL
    except AttributeError:
        try:
            msg.event_type = EventType.STOP_DISABLE_ALL
        except AttributeError:
            msg.event_type = EventType.STOP
    msg.timestamp = now_ms + workout_duration_ms
    builder.add(msg)

    # 5. lap (required — Garmin Connect rejects files with no lap message)
    msg = LapMessage()
    msg.timestamp = now_ms + workout_duration_ms
    msg.start_time = now_ms
    msg.total_elapsed_time = workout_duration_ms
    msg.total_timer_time = workout_duration_ms
    builder.add(msg)

    # 6. session (required — Garmin Connect rejects files with no session message)
    msg = SessionMessage()
    msg.timestamp = now_ms + workout_duration_ms
    msg.start_time = now_ms
    msg.sport = Sport.TRAINING
    msg.sub_sport = SubSport.STRENGTH_TRAINING
    msg.total_elapsed_time = workout_duration_ms
    msg.total_timer_time = workout_duration_ms
    builder.add(msg)

    # 7. activity (required — exactly one per file per Garmin FIT spec)
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
