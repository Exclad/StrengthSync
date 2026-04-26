"""Hevy CSV parser module.

Uses stdlib csv.DictReader — pandas is not installed and not needed.
Phase 2: parses to naive local datetimes (D-05). Phase 3 applies timezone conversion.
"""
import csv
import pathlib
from datetime import datetime, timezone
from models import HevyWorkout, HevyExercise, HevySet

HEVY_TS_FMT = "%b %d, %Y, %I:%M %p"
# Verified against all 95 workouts in original_hevy.csv.
# Handles: "Apr 17, 2026, 5:46 PM" and "Mar 9, 2026, 10:58 AM" (single-digit day).

LBS_TO_KG = 0.45359237


def _convert_weight(value: float | None, weight_unit: str) -> float | None:
    """Convert weight to kg if the source unit is lbs. None passes through unchanged."""
    if value is None or weight_unit != 'lbs':
        return value
    return round(value * LBS_TO_KG, 4)


def _opt_float(val: str) -> float | None:
    """Return float or None for an empty CSV cell."""
    return float(val) if val.strip() else None


def _opt_int(val: str) -> int | None:
    """Return int or None for an empty CSV cell."""
    return int(float(val)) if val.strip() else None


def _is_cardio(row: dict) -> bool:
    """D-07: no weight AND no reps = cardio row.

    Catches Treadmill, Stair Machine, Stair Machine (Floors),
    Stair Machine (Steps), Walking — without a hardcoded name list.
    Does NOT flag Decline Crunch or Russian Twist (no weight but has reps).
    """
    return not row["weight_kg"].strip() and not row["reps"].strip()


def parse_hevy_csv(path: str, weight_unit: str = 'kg') -> list[HevyWorkout]:
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
                weight_kg=_convert_weight(_opt_float(row["weight_kg"]), weight_unit),
                reps=_opt_int(row["reps"]),
                distance_km=_opt_float(row.get("distance_km", "")),
                duration_seconds=_opt_float(row.get("duration_seconds", "")),
                rpe=_opt_float(row.get("rpe", "")),
                superset_id=row.get("superset_id") or None,
            ))

    return list(workouts.values())


def parse_hevy_api_response(workouts_data: list[dict], weight_unit: str = 'kg') -> list[HevyWorkout]:
    """Convert Hevy API workout list to list[HevyWorkout].

    API timestamps are ISO 8601 with UTC offset (e.g. "2026-04-22T14:33:00+00:00").
    They are converted to naive UTC datetimes. This differs from parse_hevy_csv()
    which produces naive LOCAL datetimes. The caller (app.py /api/hevy/workouts)
    must set session["hevy_tz_mode"] = "utc" so matcher.py skips localization.

    Cardio detection mirrors _is_cardio(): sets with weight_kg=None AND reps=None
    are skipped; their exercise title is collected in HevyWorkout.skipped_cardio.
    """
    result = []
    for w in workouts_data:
        # Parse ISO timestamps with timezone offset → naive UTC
        start_raw = w.get("start_time", "")
        end_raw = w.get("end_time", start_raw)
        start_aware = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
        end_aware = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
        start_naive = start_aware.astimezone(timezone.utc).replace(tzinfo=None)
        end_naive = end_aware.astimezone(timezone.utc).replace(tzinfo=None)

        exercises = []
        skipped_cardio: list[str] = []

        for ex in w.get("exercises", []):
            # Defensive title resolution — API field name is uncertain
            title = (
                ex.get("title")
                or ex.get("exercise_template", {}).get("title", "")
                or "Unknown"
            )
            sets: list[HevySet] = []
            for s in ex.get("sets", []):
                weight = _convert_weight(s.get("weight_kg"), weight_unit)
                reps = s.get("reps")
                # Cardio detection: no weight AND no reps
                if weight is None and reps is None:
                    if title not in skipped_cardio:
                        skipped_cardio.append(title)
                    continue
                dist_meters = s.get("distance_meters")
                sets.append(HevySet(
                    set_index=s.get("index"),
                    set_type=s.get("set_type", "normal"),
                    weight_kg=weight,
                    reps=reps,
                    distance_km=dist_meters / 1000 if dist_meters is not None else None,
                    duration_seconds=s.get("duration_seconds"),
                    rpe=s.get("rpe"),
                    superset_id=s.get("superset_id"),
                ))
            if sets:  # Only add exercise if it has at least one non-cardio set
                exercises.append(HevyExercise(title=title, sets=sets))

        result.append(HevyWorkout(
            title=w.get("title", ""),
            start_time=start_naive,
            end_time=end_naive,
            description=w.get("description", ""),
            exercises=exercises,
            skipped_cardio=skipped_cardio,
        ))
    return result
