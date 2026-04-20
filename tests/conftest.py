"""Shared pytest fixtures for Phase 1 tests."""
import os
import pytest

# Absolute path to the sample Garmin FIT file (committed to repo)
SAMPLE_FIT = "/workspace/GarminHevyMerge/original_garmin.fit"

# Output directory for generated FIT files
OUTPUT_DIR = "/workspace/GarminHevyMerge/output"


@pytest.fixture
def sample_fit_path():
    """Return the absolute path to the sample Garmin FIT file."""
    assert os.path.exists(SAMPLE_FIT), f"Sample FIT not found: {SAMPLE_FIT}"
    return SAMPLE_FIT


@pytest.fixture
def output_dir(tmp_path):
    """Return a temporary directory for test output files.
    Uses pytest's tmp_path to avoid polluting the project output/ directory during tests.
    """
    return str(tmp_path)
