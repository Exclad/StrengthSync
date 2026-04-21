"""Tests for mapper.py and database.py: fuzzy matching, DB round-trip, thresholds.

MAP-01: DB round-trip (test_confirm_and_retrieve, test_init_db_idempotent)
MAP-02: Fuzzy matching with normalization (test_suggest_mapping_bench_press, test_normalize_improves_score)
MAP-03: UNRESOLVED_THRESHOLD exported (test_unresolved_threshold_exported)
MAP-04: GENERIC_FALLBACK and category lookup (test_generic_fallback, test_get_exercises_by_category)
"""
import pytest
from mapper import (
    suggest_mapping,
    confirm_mapping,
    get_confirmed_mapping,
    get_exercises_by_category,
    UNRESOLVED_THRESHOLD,
    GENERIC_FALLBACK,
)
from database import init_db
from models import GarminExercise


@pytest.fixture
def db_path(tmp_path):
    """Isolated SQLite DB for each test — prevents cross-test contamination (Pitfall 5)."""
    p = tmp_path / "test_mappings.db"
    init_db(p)
    return p


def test_confirm_and_retrieve(db_path):
    """MAP-01: confirm_mapping + get_confirmed_mapping round-trip stores and retrieves correctly."""
    exercise = GarminExercise(
        exercise_name="barbell_bench_press",
        exercise_enum_int=1,
        exercise_category="bench_press",
        exercise_category_enum_int=0,
    )
    confirm_mapping("Bench Press", exercise, db_path=db_path)
    result = get_confirmed_mapping("Bench Press", db_path=db_path)
    assert result is not None, "Expected confirmed mapping to be retrievable"
    assert result.exercise_name == "barbell_bench_press"
    assert result.exercise_enum_int == 1


def test_init_db_idempotent(tmp_path):
    """MAP-01: Calling init_db() twice on the same path must not raise (IF NOT EXISTS)."""
    p = tmp_path / "idempotent.db"
    init_db(p)
    init_db(p)  # must not raise


def test_suggest_mapping_bench_press():
    """MAP-02: suggest_mapping('Bench Press') returns >=1 candidate with score >= 70."""
    results = suggest_mapping("Bench Press")
    assert len(results) >= 1, "Expected at least one candidate for 'Bench Press'"
    top_score = results[0][1]
    assert top_score >= UNRESOLVED_THRESHOLD, (
        f"Expected top score >= {UNRESOLVED_THRESHOLD}, got {top_score}"
    )
    assert isinstance(results[0][0], GarminExercise)


def test_normalize_improves_score():
    """MAP-02: Normalization must raise 'Bench Press (Dumbbell)' score to >= 70 (Pitfall 2).

    Without normalization this scores ~67 (below threshold). With normalize() stripping
    '(Dumbbell)' it becomes 'bench press' -> score >= 70 against dumbbell_bench_press.
    """
    results = suggest_mapping("Bench Press (Dumbbell)")
    assert len(results) >= 1
    top_score = results[0][1]
    assert top_score >= UNRESOLVED_THRESHOLD, (
        f"Normalization failure: score {top_score} < {UNRESOLVED_THRESHOLD} for 'Bench Press (Dumbbell)'. "
        "Check normalize() strips parenthetical qualifiers."
    )


def test_unresolved_threshold_exported():
    """MAP-03: UNRESOLVED_THRESHOLD must be importable from mapper and equal 70."""
    assert UNRESOLVED_THRESHOLD == 70


def test_generic_fallback():
    """MAP-04: GENERIC_FALLBACK must be importable with sentinel enum values (65534)."""
    assert isinstance(GENERIC_FALLBACK, GarminExercise)
    assert GENERIC_FALLBACK.exercise_enum_int == 65534
    assert GENERIC_FALLBACK.exercise_category_enum_int == 65534
    assert GENERIC_FALLBACK.exercise_name == "unknown"


def test_get_exercises_by_category():
    """MAP-04 / D-04: get_exercises_by_category('bench_press') returns non-empty list of GarminExercise."""
    results = get_exercises_by_category("bench_press")
    assert len(results) > 0, "Expected exercises in 'bench_press' category"
    assert all(isinstance(e, GarminExercise) for e in results)
    assert all(e.exercise_category == "bench_press" for e in results)
