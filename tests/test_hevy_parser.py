"""Tests for parse_hevy_csv(): workout grouping, cardio detection, null coercion.

Phase 2 RED state: parse_hevy_csv does not yet exist in hevy_parser.py.
Tests will fail with ImportError until Plan 03 implements parse_hevy_csv().
"""
import pytest
from datetime import datetime
from hevy_parser import parse_hevy_csv
from models import HevyWorkout


def test_parse_hevy_workout_count(sample_hevy_path):
    """parse_hevy_csv() must return 95 HevyWorkout objects (per RESEARCH.md live count)."""
    workouts = parse_hevy_csv(sample_hevy_path)
    assert len(workouts) == 95
    assert all(isinstance(w, HevyWorkout) for w in workouts)


def test_parse_hevy_timestamps(sample_hevy_path):
    """Timestamps must parse to naive datetime objects (D-05)."""
    workouts = parse_hevy_csv(sample_hevy_path)
    wo = workouts[0]
    assert isinstance(wo.start_time, datetime)
    assert isinstance(wo.end_time, datetime)
    assert wo.start_time.tzinfo is None, "timestamps must be naive (D-05)"
    assert wo.end_time.tzinfo is None, "timestamps must be naive (D-05)"


def test_parse_hevy_null_coercion(sample_hevy_path):
    """Empty CSV cells must be None, not 0 or empty string (HEVY-01)."""
    workouts = parse_hevy_csv(sample_hevy_path)
    # At least one set must have weight_kg=None (bodyweight exercises exist in sample)
    found_none_weight = False
    for wo in workouts:
        for ex in wo.exercises:
            for s in ex.sets:
                if s.weight_kg is None:
                    found_none_weight = True
                    # When weight is None for bodyweight, reps must still be present
                    assert s.reps is not None, "bodyweight exercise must have reps"
    assert found_none_weight, "Expected at least one set with weight_kg=None (bodyweight)"


def test_parse_hevy_cardio_detection(sample_hevy_path):
    """Cardio rows (Treadmill) must appear in skipped_cardio, not exercises (HEVY-02, D-07)."""
    workouts = parse_hevy_csv(sample_hevy_path)
    all_cardio = [name for wo in workouts for name in wo.skipped_cardio]
    assert "Treadmill" in all_cardio
    # Treadmill must NOT appear as a regular exercise
    all_exercise_titles = [ex.title for wo in workouts for ex in wo.exercises]
    assert "Treadmill" not in all_exercise_titles


def test_parse_hevy_bodyweight_not_cardio(sample_hevy_path):
    """Bodyweight exercises (no weight, has reps) must NOT be in skipped_cardio (D-07)."""
    workouts = parse_hevy_csv(sample_hevy_path)
    all_cardio = [name for wo in workouts for name in wo.skipped_cardio]
    assert "Decline Crunch" not in all_cardio, (
        "Decline Crunch has reps — D-07 requires BOTH weight AND reps absent for cardio"
    )
    # Decline Crunch must appear as a regular exercise
    all_exercise_titles = [ex.title for wo in workouts for ex in wo.exercises]
    assert "Decline Crunch" in all_exercise_titles


# ---------------------------------------------------------------------------
# Phase 7 stub — RED until Wave 1 hevy_parser.py is extended
# ---------------------------------------------------------------------------

def test_parse_hevy_api_response():
    """parse_hevy_api_response() converts Hevy API dicts to list[HevyWorkout]."""
    from hevy_parser import parse_hevy_api_response
    from models import HevyWorkout
    sample = [{
        "title": "Test Workout",
        "start_time": "2026-04-22T14:33:00+00:00",
        "end_time": "2026-04-22T16:05:00+00:00",
        "description": "",
        "exercises": [{
            "title": "Barbell Bench Press",
            "sets": [{"set_type": "normal", "weight_kg": 100.0, "reps": 5, "rpe": None}]
        }]
    }]
    result = parse_hevy_api_response(sample)
    assert len(result) == 1
    assert isinstance(result[0], HevyWorkout)
    assert result[0].title == "Test Workout"
    assert len(result[0].exercises) == 1
    assert result[0].exercises[0].sets[0].weight_kg == 100.0
    # Timestamps must be naive UTC datetimes
    from datetime import datetime, timezone
    assert result[0].start_time.tzinfo is None, "API timestamps must be stored as naive UTC"
    assert result[0].start_time.hour == 14  # 14:33 UTC
