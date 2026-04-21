"""Tests for match_workouts() and force_match(): timezone conversion, tolerance, forced pairing.

MATCH-01: Hevy local time -> UTC conversion via IANA timezone (test_match_singapore_timezone, test_invalid_timezone)
MATCH-02: Auto-match by proximity (test_auto_match_within_tolerance, test_no_match_returns_none, test_closest_candidate_wins)
MATCH-03: Manual pairing (test_force_match)
"""
import pytest
from datetime import datetime
from matcher import match_workouts, force_match, MATCH_TOLERANCE_MINUTES
from models import FitWorkout, HevyWorkout, MatchResult


def _make_fit(start: datetime) -> FitWorkout:
    """Minimal FitWorkout with only start_time populated."""
    return FitWorkout(
        start_time=start,
        end_time=None,
        total_calories=None,
        total_elapsed_time=None,
        device_serial=None,
    )


def _make_hevy(start: datetime) -> HevyWorkout:
    """Minimal HevyWorkout with only start_time populated."""
    return HevyWorkout(
        title="Test",
        start_time=start,
        end_time=start,
        description="",
        exercises=[],
        skipped_cardio=[],
    )


def test_match_singapore_timezone():
    """MATCH-01: Singapore (UTC+8) Hevy local 17:46 -> UTC 09:46 matches Garmin 09:45:49 (delta 0.18 min)."""
    fit = _make_fit(datetime(2026, 4, 17, 9, 45, 49))    # naive UTC from fitparse
    hevy = _make_hevy(datetime(2026, 4, 17, 17, 46, 0))  # naive local Singapore time
    result = match_workouts(fit, [hevy], "Asia/Singapore")
    assert result is not None, "Expected a match for Singapore timezone"
    assert result.delta_minutes < 1.0, f"Expected delta < 1 min, got {result.delta_minutes}"
    assert result.is_forced is False
    assert isinstance(result, MatchResult)


def test_invalid_timezone():
    """MATCH-01: Invalid IANA timezone string must raise ValueError."""
    fit = _make_fit(datetime(2026, 1, 1, 10, 0, 0))
    hevy = _make_hevy(datetime(2026, 1, 1, 10, 0, 0))
    with pytest.raises(ValueError, match="Unknown IANA timezone"):
        match_workouts(fit, [hevy], "Not/AZone")


def test_auto_match_within_tolerance():
    """MATCH-02: Hevy workout 15 minutes after Garmin (UTC timezone) -> matched, delta 15 min."""
    fit = _make_fit(datetime(2026, 1, 1, 10, 0, 0))
    hevy = _make_hevy(datetime(2026, 1, 1, 10, 15, 0))
    result = match_workouts(fit, [hevy], "UTC")
    assert result is not None
    assert result.delta_minutes <= MATCH_TOLERANCE_MINUTES
    assert abs(result.delta_minutes - 15.0) < 0.01


def test_no_match_returns_none():
    """MATCH-02: Hevy workout 31 minutes after Garmin -> no match (outside 30-min tolerance)."""
    fit = _make_fit(datetime(2026, 1, 1, 10, 0, 0))
    hevy = _make_hevy(datetime(2026, 1, 1, 10, 31, 0))
    result = match_workouts(fit, [hevy], "UTC")
    assert result is None, f"Expected None for 31-min gap, got {result}"


def test_closest_candidate_wins():
    """MATCH-02: Two Hevy workouts within tolerance -> closest (5 min) wins over farther (20 min)."""
    fit = _make_fit(datetime(2026, 1, 1, 10, 0, 0))
    hevy_close = _make_hevy(datetime(2026, 1, 1, 10, 5, 0))   # 5-minute delta
    hevy_far = _make_hevy(datetime(2026, 1, 1, 10, 20, 0))    # 20-minute delta
    result = match_workouts(fit, [hevy_close, hevy_far], "UTC")
    assert result is not None
    assert result.hevy_workout is hevy_close, "Closest candidate must win (D-02)"
    assert abs(result.delta_minutes - 5.0) < 0.01


def test_force_match():
    """MATCH-03: force_match() bypasses tolerance; returns MatchResult(is_forced=True, delta=0.0)."""
    fit = _make_fit(datetime(2026, 1, 1, 10, 0, 0))
    hevy = _make_hevy(datetime(2026, 1, 1, 18, 0, 0))  # 8 hours apart - would never auto-match
    result = force_match(fit, hevy)
    assert isinstance(result, MatchResult)
    assert result.is_forced is True
    assert result.delta_minutes == 0.0
    assert result.fit_workout is fit
    assert result.hevy_workout is hevy
