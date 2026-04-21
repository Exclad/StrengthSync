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


# --- Phase 3 fixtures ---

@pytest.fixture
def sample_fit_workout(sample_fit_path):
    """Return a parsed FitWorkout from the sample Garmin FIT file."""
    from fit_parser import parse_fit_file
    return parse_fit_file(sample_fit_path)


@pytest.fixture
def sample_hevy_workouts(sample_hevy_path):
    """Return parsed list[HevyWorkout] from the sample Hevy CSV."""
    from hevy_parser import parse_hevy_csv
    return parse_hevy_csv(sample_hevy_path)


@pytest.fixture
def tmp_db_path(tmp_path):
    """Isolated SQLite DB path for each mapper/database test (Pitfall 5 prevention)."""
    from database import init_db
    p = tmp_path / "test_mappings.db"
    init_db(p)
    return p
