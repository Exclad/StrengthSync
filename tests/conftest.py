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


# --- Phase 4 fixtures ---

@pytest.fixture
def sample_match_result(sample_fit_workout, sample_hevy_workouts):
    """Return a MatchResult pairing original_garmin.fit with the Apr 17 Hevy 'Legs' workout.

    Uses Asia/Singapore timezone (UTC+8). Garmin workout starts 2026-04-17 09:45:49 UTC;
    Hevy 'Legs' workout starts 2026-04-17 17:46 local (= 09:46 UTC). Delta ~0.18 min.
    """
    from matcher import match_workouts
    result = match_workouts(sample_fit_workout, sample_hevy_workouts, "Asia/Singapore")
    assert result is not None, (
        "sample_match_result fixture: no match found for original_garmin.fit + original_hevy.csv. "
        "Verify that original_hevy.csv contains the Apr 17, 2026 Legs workout."
    )
    return result


# --- Phase 5 fixtures ---

@pytest.fixture
def app_client():
    """Flask test client for Phase 5 API route tests.

    Sets a SECRET_KEY so Flask session signing works during tests.
    Uses testing=True to surface exceptions as 500 responses (not silent swallows).
    """
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app import app as flask_app
    flask_app.config["TESTING"] = True
    flask_app.config["SECRET_KEY"] = "test-secret-key-phase5"
    with flask_app.test_client() as client:
        yield client
