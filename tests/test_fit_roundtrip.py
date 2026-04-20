"""Tests for FIT round-trip: read original_garmin.fit, write output, re-parse.

Phase 1 RED state: functions raise NotImplementedError.
Phase 1 GREEN state: round-trip writes a file that re-parses without errors.
"""
import pytest
import fitparse
from fit_parser import read_fit_file
from fit_generator import write_roundtrip_fit


def test_roundtrip_reparses(sample_fit_path, output_dir):
    """Round-trip: read original_garmin.fit, write to output, re-parse with fitparse."""
    out_path = output_dir + "/roundtrip.fit"

    # Write the round-trip file
    write_roundtrip_fit(sample_fit_path, out_path)

    # Re-parse with fitparse to verify structural integrity
    with fitparse.FitFile(out_path) as ff:
        messages = list(ff.get_messages())
    assert len(messages) > 0, "Re-parsed FIT file must contain at least one message"


def test_output_dir_fixture_uses_tmp_path(output_dir):
    """Verify the output_dir fixture uses tmp_path, not the production output/ dir."""
    assert not output_dir.startswith("/workspace/GarminHevyMerge/output"), (
        f"Tests must not write to production output dir, got: {output_dir}"
    )
