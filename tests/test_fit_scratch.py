"""Tests for from-scratch FIT file: build minimal strength workout, re-parse.

Phase 1 RED state: function raises NotImplementedError.
Phase 1 GREEN state: build_minimal_strength_fit writes a file that re-parses without errors
and contains the expected message types.
"""
import pytest
import os
import fitparse
from fit_generator import build_minimal_strength_fit


def test_minimal_fit_reparses(output_dir):
    """From-scratch FIT file must re-parse with fitparse without errors."""
    out_path = output_dir + "/minimal.fit"

    build_minimal_strength_fit(out_path)

    assert os.path.exists(out_path), "Output file must exist after build"
    with fitparse.FitFile(out_path) as ff:
        messages = list(ff.get_messages())
    assert len(messages) > 0, "Re-parsed FIT file must contain at least one message"


def test_minimal_fit_has_required_messages(output_dir):
    """From-scratch FIT file must contain file_id, session, lap, activity messages."""
    out_path = output_dir + "/minimal_required.fit"
    build_minimal_strength_fit(out_path)

    with fitparse.FitFile(out_path) as ff:
        msg_names = {m.name for m in ff.get_messages()}

    required = {"file_id", "session", "lap", "activity"}
    missing = required - msg_names
    assert not missing, f"FIT file missing required messages: {missing}"


def test_minimal_fit_has_set_message(output_dir):
    """From-scratch FIT file must contain at least one set message (mesg_num 225)."""
    out_path = output_dir + "/minimal_set.fit"
    build_minimal_strength_fit(out_path)

    with fitparse.FitFile(out_path) as ff:
        set_messages = [m for m in ff.get_messages() if m.name == "set"]
    assert len(set_messages) >= 1, "FIT file must contain at least one set message (mesg_num 225)"
