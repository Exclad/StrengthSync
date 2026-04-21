"""Exercise mapper module.

Fuzzy-matches Hevy exercise names against Garmin exercise enums (MAP-02).
Confirmed mappings are persisted via database.py (MAP-01).
Only user-confirmed mappings enter the DB (D-08) — suggest_mapping() never writes.
Loads data/garmin_exercises.csv once at module import.
"""
from __future__ import annotations
import csv
import pathlib
import re
from rapidfuzz import process, fuzz
from models import GarminExercise
import database

# Score threshold: >= UNRESOLVED_THRESHOLD = auto-accept candidate; below = UNRESOLVED (D-05, MAP-03)
UNRESOLVED_THRESHOLD: int = 70

_CSV_PATH: pathlib.Path = pathlib.Path(__file__).parent / "data" / "garmin_exercises.csv"


def _load_exercises() -> list[GarminExercise]:
    """Load garmin_exercises.csv into memory once at module import.

    Returns:
        List of GarminExercise objects, one per CSV row.

    Raises:
        FileNotFoundError: If data/garmin_exercises.csv has not been generated yet.
    """
    if not _CSV_PATH.exists():
        raise FileNotFoundError(
            f"Garmin exercises CSV not found: {_CSV_PATH}\n"
            "Run: .venv/bin/python scripts/extract_garmin_exercises.py"
        )
    with open(_CSV_PATH, newline="", encoding="utf-8") as f:
        return [
            GarminExercise(
                exercise_name=row["exercise_name"],
                exercise_enum_int=int(row["exercise_enum_int"]),
                exercise_category=row["exercise_category"],
                exercise_category_enum_int=int(row["exercise_category_enum_int"]),
            )
            for row in csv.DictReader(f)
        ]


_GARMIN_EXERCISES: list[GarminExercise] = _load_exercises()

# MAP-04: Generic fallback for unrecognized exercises (e.g. machine-specific movements).
# 65534 (0xFFFE) is the FIT SDK sentinel for "unknown" exercise category and subtype.
GENERIC_FALLBACK: GarminExercise = GarminExercise(
    exercise_name="unknown",
    exercise_enum_int=65534,
    exercise_category="unknown",
    exercise_category_enum_int=65534,
)


def normalize(name: str) -> str:
    """Strip parenthetical equipment qualifiers; lowercase; underscores/hyphens to spaces.

    Example: 'Bench Press (Dumbbell)' -> 'bench press'
    This raises rapidfuzz WRatio match scores dramatically (Pitfall 2 in RESEARCH.md).

    Args:
        name: Raw exercise name from Hevy CSV or Garmin SDK.

    Returns:
        Normalized lowercase string with no parentheticals or special separators.
    """
    name = re.sub(r'\s*\(.*?\)\s*', ' ', name)
    return re.sub(r'\s+', ' ', name.lower().replace('_', ' ').replace('-', ' ')).strip()


def suggest_mapping(
    hevy_name: str,
    limit: int = 5,
) -> list[tuple[GarminExercise, float]]:
    """Return up to `limit` ranked (GarminExercise, score) candidates for a Hevy exercise name.

    Uses rapidfuzz WRatio scorer with normalization applied to both query and candidates.
    Never writes to DB (D-08) — suggestions are ephemeral until user confirms.

    Args:
        hevy_name: Raw exercise name from Hevy CSV.
        limit: Maximum candidates to return. Default 5.

    Returns:
        List of (GarminExercise, float_score) tuples, descending by score.
        Score >= UNRESOLVED_THRESHOLD (70) indicates an auto-acceptable match.
    """
    normalized_query = normalize(hevy_name)
    results = process.extract(
        normalized_query,
        _GARMIN_EXERCISES,
        scorer=fuzz.WRatio,
        processor=lambda x: normalize(x.exercise_name) if isinstance(x, GarminExercise) else x,
        limit=limit,
    )
    return [(exercise, score) for exercise, score, _idx in results]


def get_exercises_by_category(category: str) -> list[GarminExercise]:
    """Return all GarminExercises matching the given exercise_category string (D-04).

    Used by Phase 5 UI to power the muscle-group -> exercise picker flow.

    Args:
        category: Garmin exercise category string (e.g. 'bench_press', 'squat').

    Returns:
        List of GarminExercise objects in that category. Empty list if none found.
    """
    return [e for e in _GARMIN_EXERCISES if e.exercise_category == category]


def confirm_mapping(
    hevy_name: str,
    garmin_exercise: GarminExercise,
    db_path: str | pathlib.Path = database.DB_PATH,
) -> None:
    """Persist a user-confirmed Hevy->Garmin exercise mapping to SQLite (D-08, MAP-01).

    Only call this after the user explicitly confirms the mapping. Fuzzy suggestions
    from suggest_mapping() must NOT be auto-confirmed without user review.

    Args:
        hevy_name: Raw exercise name from Hevy CSV (primary key in DB).
        garmin_exercise: The confirmed GarminExercise to associate with hevy_name.
        db_path: Path to the SQLite database. Defaults to production DB_PATH.
    """
    database.confirm_mapping_db(
        hevy_name=hevy_name,
        enum_int=garmin_exercise.exercise_enum_int,
        garmin_name=garmin_exercise.exercise_name,
        db_path=db_path,
    )


def get_confirmed_mapping(
    hevy_name: str,
    db_path: str | pathlib.Path = database.DB_PATH,
) -> GarminExercise | None:
    """Look up a previously confirmed Hevy->Garmin exercise mapping from SQLite (MAP-01).

    Reconstructs the full GarminExercise (including category fields) by matching
    against the loaded _GARMIN_EXERCISES list. If the CSV was regenerated without
    this entry, returns a partial GarminExercise with category='unknown'.

    Args:
        hevy_name: Raw exercise name from Hevy CSV to look up.
        db_path: Path to the SQLite database. Defaults to production DB_PATH.

    Returns:
        GarminExercise if a confirmed mapping exists, else None.
    """
    row = database.get_confirmed_mapping_db(hevy_name, db_path=db_path)
    if row is None:
        return None
    enum_int, garmin_name = row
    for ex in _GARMIN_EXERCISES:
        if ex.exercise_enum_int == enum_int and ex.exercise_name == garmin_name:
            return ex
    # CSV was regenerated without this entry — return partial with known fields
    return GarminExercise(
        exercise_name=garmin_name,
        exercise_enum_int=enum_int,
        exercise_category="unknown",
        exercise_category_enum_int=65534,
    )
