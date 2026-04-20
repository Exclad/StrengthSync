"""FIT file writer module.

Uses fit-tool FitFileBuilder for all write operations.
fitparse is NEVER used for writing (read-only library).
Phase 1: minimal stubs proven against Garmin Connect.
Phase 4: full merge pipeline extends these functions.
"""
from fit_tool.fit_file import FitFile
from fit_tool.fit_file_builder import FitFileBuilder


def write_roundtrip_fit(in_path: str, out_path: str) -> None:
    """Read a FIT file with fit-tool and write it verbatim to out_path.

    Args:
        in_path: Path to the source .fit file (e.g. original_garmin.fit).
        out_path: Path to write the output .fit file (must be inside GarminHevyMerge/).

    Raises:
        FileNotFoundError: If in_path does not exist.
        RuntimeError: If fit-tool cannot read or write the file.
    """
    raise NotImplementedError("Plan 02 implements the round-trip write")


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
