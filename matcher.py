"""Workout matcher module.

Converts Hevy naive local datetimes to UTC using python-dateutil (MATCH-01).
Tolerance window: MATCH_TOLERANCE_MINUTES = 30 (D-01).
Closest UTC delta wins when multiple candidates match (D-02).
force_match() bypasses tolerance for manual pairing (D-10, MATCH-03).
"""
from __future__ import annotations
from dateutil import tz
from models import FitWorkout, HevyWorkout, MatchResult

MATCH_TOLERANCE_MINUTES: int = 30  # D-01: constant for easy discovery and adjustment


def match_workouts(
    fit: FitWorkout,
    hevy_list: list[HevyWorkout],
    timezone_str: str,
) -> MatchResult | None:
    """Find the closest Hevy workout within MATCH_TOLERANCE_MINUTES of the Garmin workout.

    Hevy naive local datetimes are converted to naive UTC inline using timezone_str.
    FitWorkout.start_time is already naive UTC (fitparse output). Both are stripped of
    tzinfo before delta calculation — no cross-timezone comparison.

    Args:
        fit: Parsed Garmin FIT workout with start_time as naive UTC datetime.
        hevy_list: All parsed Hevy workouts; start_time is naive local datetime (D-05).
        timezone_str: IANA timezone string (e.g. 'Asia/Singapore'). Applied to Hevy times.

    Returns:
        MatchResult with the closest Hevy workout if within tolerance, else None.

    Raises:
        ValueError: If timezone_str is not a valid IANA timezone identifier.
    """
    if fit.start_time is None:
        return None

    user_tz = tz.gettz(timezone_str)
    if user_tz is None:
        raise ValueError(f"Unknown IANA timezone: {timezone_str!r}")

    best: MatchResult | None = None
    for hevy in hevy_list:
        aware = hevy.start_time.replace(tzinfo=user_tz)
        hevy_utc = aware.astimezone(tz.UTC).replace(tzinfo=None)
        delta_minutes = abs((fit.start_time - hevy_utc).total_seconds()) / 60
        if delta_minutes <= MATCH_TOLERANCE_MINUTES:
            if best is None or delta_minutes < best.delta_minutes:
                best = MatchResult(
                    fit_workout=fit,
                    hevy_workout=hevy,
                    delta_minutes=delta_minutes,
                    is_forced=False,
                )
    return best


def force_match(fit: FitWorkout, hevy: HevyWorkout) -> MatchResult:
    """Pair a Garmin and Hevy workout without tolerance check (D-10, MATCH-03).

    Used by Phase 5 UI when the user manually selects a workout pair.

    Args:
        fit: Garmin FIT workout to pair.
        hevy: Hevy workout to pair with fit.

    Returns:
        MatchResult with is_forced=True and delta_minutes=0.0.
    """
    return MatchResult(
        fit_workout=fit,
        hevy_workout=hevy,
        delta_minutes=0.0,
        is_forced=True,
    )
