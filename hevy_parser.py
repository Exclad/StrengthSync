"""Hevy CSV parser module.

Uses stdlib csv.DictReader — pandas is not installed and not needed.
Phase 2: parses to naive local datetimes (D-05). Phase 3 applies timezone conversion.
"""
import csv
import pathlib
from datetime import datetime
from models import HevyWorkout, HevyExercise, HevySet

HEVY_TS_FMT = "%b %d, %Y, %I:%M %p"
# Verified against all 95 workouts in original_hevy.csv.
# Handles: "Apr 17, 2026, 5:46 PM" and "Mar 9, 2026, 10:58 AM" (single-digit day).


def _opt_float(val: str) -> float | None:
    """Return float or None for an empty CSV cell."""
    return float(val) if val.strip() else None


def _opt_int(val: str) -> int | None:
    """Return int or None for an empty CSV cell."""
    return int(val) if val.strip() else None


def _is_cardio(row: dict) -> bool:
    """D-07: no weight AND no reps = cardio row.

    Catches Treadmill, Stair Machine, Stair Machine (Floors),
    Stair Machine (Steps), Walking — without a hardcoded name list.
    Does NOT flag Decline Crunch or Russian Twist (no weight but has reps).
    """
    return not row["weight_kg"].strip() and not row["reps"].strip()


def parse_hevy_csv(path: str) -> list[HevyWorkout]:
    """Parse a Hevy CSV export into a list of HevyWorkout objects.

    Groups rows by (title, start_time, end_time) triple into workouts.
    Cardio rows (D-07: no weight AND no reps) are collected in
    HevyWorkout.skipped_cardio rather than exercises.

    Args:
        path: Absolute or relative path to the Hevy CSV export file.

    Returns:
        List of HevyWorkout objects in order of first appearance.
        Timestamps are naive local datetimes (D-05); Phase 3 applies UTC conversion.

    Raises:
        FileNotFoundError: If path does not exist.
        ValueError: If a timestamp cannot be parsed with HEVY_TS_FMT.
    """
    workouts: dict[tuple, HevyWorkout] = {}
    workout_exercises: dict[tuple, dict[str, HevyExercise]] = {}

    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = (row["title"], row["start_time"], row["end_time"])

            if key not in workouts:
                workouts[key] = HevyWorkout(
                    title=row["title"],
                    start_time=datetime.strptime(row["start_time"], HEVY_TS_FMT),
                    end_time=datetime.strptime(row["end_time"], HEVY_TS_FMT),
                    description=row.get("description", ""),
                    exercises=[],
                    skipped_cardio=[],
                )
                workout_exercises[key] = {}

            wo = workouts[key]

            if _is_cardio(row):
                name = row["exercise_title"]
                if name not in wo.skipped_cardio:
                    wo.skipped_cardio.append(name)
                continue

            ex_title = row["exercise_title"]
            if ex_title not in workout_exercises[key]:
                ex = HevyExercise(title=ex_title, sets=[])
                workout_exercises[key][ex_title] = ex
                wo.exercises.append(ex)

            workout_exercises[key][ex_title].sets.append(HevySet(
                set_index=_opt_int(row["set_index"]),
                set_type=row.get("set_type", "normal"),
                weight_kg=_opt_float(row["weight_kg"]),
                reps=_opt_int(row["reps"]),
                distance_km=_opt_float(row.get("distance_km", "")),
                duration_seconds=_opt_float(row.get("duration_seconds", "")),
                rpe=_opt_float(row.get("rpe", "")),
                superset_id=row.get("superset_id") or None,
            ))

    return list(workouts.values())
