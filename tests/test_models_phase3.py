"""Tests for GarminExercise and MatchResult dataclasses added in Phase 3.

RED state: GarminExercise and MatchResult do not yet exist in models.py.
Tests will fail with ImportError until Task 1 appends them.
"""
import pytest
from datetime import datetime


def test_garmin_exercise_importable():
    """GarminExercise must be importable from models."""
    from models import GarminExercise
    assert GarminExercise is not None


def test_garmin_exercise_fields():
    """GarminExercise must have all four required fields."""
    from models import GarminExercise
    ex = GarminExercise(
        exercise_name="barbell_bench_press",
        exercise_enum_int=0,
        exercise_category="bench_press",
        exercise_category_enum_int=1,
    )
    assert ex.exercise_name == "barbell_bench_press"
    assert ex.exercise_enum_int == 0
    assert ex.exercise_category == "bench_press"
    assert ex.exercise_category_enum_int == 1


def test_match_result_importable():
    """MatchResult must be importable from models."""
    from models import MatchResult
    assert MatchResult is not None


def test_match_result_fields():
    """MatchResult must have fit_workout, hevy_workout, delta_minutes, is_forced."""
    from models import MatchResult, FitWorkout, HevyWorkout, HevyExercise
    fit = FitWorkout(
        start_time=datetime(2026, 4, 17, 9, 46),
        end_time=None,
        total_calories=None,
        total_elapsed_time=None,
        device_serial=None,
    )
    hevy = HevyWorkout(
        title="Test",
        start_time=datetime(2026, 4, 17, 17, 46),
        end_time=datetime(2026, 4, 17, 18, 30),
        description="",
        exercises=[],
        skipped_cardio=[],
    )
    result = MatchResult(
        fit_workout=fit,
        hevy_workout=hevy,
        delta_minutes=5.0,
        is_forced=False,
    )
    assert result.fit_workout is fit
    assert result.hevy_workout is hevy
    assert result.delta_minutes == 5.0
    assert result.is_forced is False


def test_match_result_forced():
    """MatchResult is_forced=True for manually forced matches."""
    from models import MatchResult, FitWorkout, HevyWorkout
    fit = FitWorkout(
        start_time=datetime(2026, 4, 17, 9, 46),
        end_time=None, total_calories=None,
        total_elapsed_time=None, device_serial=None,
    )
    hevy = HevyWorkout(
        title="Test", start_time=datetime(2026, 4, 17, 17, 46),
        end_time=datetime(2026, 4, 17, 18, 30),
        description="", exercises=[], skipped_cardio=[],
    )
    result = MatchResult(
        fit_workout=fit, hevy_workout=hevy,
        delta_minutes=0.0, is_forced=True,
    )
    assert result.is_forced is True
    assert result.delta_minutes == 0.0
