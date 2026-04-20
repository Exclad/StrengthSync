"""FIT file writer module.

Uses fit-tool FitFileBuilder for all write operations.
fitparse is NEVER used for writing (read-only library).
Phase 1: minimal stubs proven against Garmin Connect.
Phase 4: full merge pipeline extends these functions.
"""
import shutil
from fit_tool.fit_file import FitFile
from fit_tool.fit_file_builder import FitFileBuilder


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
    raise NotImplementedError("Plan 03 implements the from-scratch FIT builder")
