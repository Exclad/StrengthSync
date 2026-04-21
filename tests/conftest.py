"""Shared pytest fixtures for Phase 1 tests."""
import os
import pathlib
import pytest

_PROJECT_ROOT = pathlib.Path(__file__).parent.parent

# Path to the sample Garmin FIT file (committed to repo)
SAMPLE_FIT = str(_PROJECT_ROOT / "original_garmin.fit")

# Output directory for generated FIT files
OUTPUT_DIR = str(_PROJECT_ROOT / "output")


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


# Path to the sample Hevy CSV file (committed to repo)
SAMPLE_HEVY = str(_PROJECT_ROOT / "original_hevy.csv")


@pytest.fixture
def sample_hevy_path():
    """Return the absolute path to the sample Hevy CSV file."""
    assert os.path.exists(SAMPLE_HEVY), f"Sample Hevy CSV not found: {SAMPLE_HEVY}"
    return SAMPLE_HEVY
