"""Shared dataclasses for FitWorkout and HevyWorkout.

Imported by fit_parser.py, hevy_parser.py, and Phase 3+ merge modules.
All FIT timestamps are naive UTC-equivalent datetimes (fitparse output).
All Hevy timestamps are naive local datetimes (Phase 3 applies timezone).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class HRSample:
    timestamp: datetime
    heart_rate: int


@dataclass
class GPSPoint:
    timestamp: datetime
    lat: float
    lon: float


@dataclass
class CadenceSample:
    timestamp: datetime
    cadence: int


@dataclass
class PowerSample:
    timestamp: datetime
    power: int


@dataclass
class FitWorkout:
    start_time: datetime | None
    end_time: datetime | None
    total_calories: int | None
    total_elapsed_time: float | None
    device_serial: int | None
    heart_rate_samples: list[HRSample] = field(default_factory=list)
    gps_track: list[GPSPoint] = field(default_factory=list)
    cadence_samples: list[CadenceSample] = field(default_factory=list)
    power_samples: list[PowerSample] = field(default_factory=list)
    avg_heart_rate: int | None = None
    max_heart_rate: int | None = None


@dataclass
class HevySet:
    set_index: int | None
    set_type: str
    weight_kg: float | None
    reps: int | None
    distance_km: float | None
    duration_seconds: float | None
    rpe: float | None
    superset_id: str | None


@dataclass
class HevyExercise:
    title: str
    sets: list[HevySet]


@dataclass
class HevyWorkout:
    title: str
    start_time: datetime
    end_time: datetime
    description: str
    exercises: list[HevyExercise]
    skipped_cardio: list[str]


@dataclass
class GarminExercise:
    exercise_name: str               # e.g. 'barbell_bench_press' (underscored from SDK)
    exercise_enum_int: int           # category_subtype for FIT set message field 8
    exercise_category: str           # e.g. 'bench_press' — grouping key for Phase 5 picker
    exercise_category_enum_int: int  # category int for FIT set message field 7


@dataclass
class MatchResult:
    fit_workout: FitWorkout
    hevy_workout: HevyWorkout
    delta_minutes: float   # 0.0 for forced matches; actual UTC delta for auto-matches
    is_forced: bool        # True when produced by force_match(); False for auto-match


@dataclass
class BiometricSummary:
    """Garmin session-level biometric fields for MergePreview display."""
    total_elapsed_time: float | None    # seconds, from session message
    total_calories: int | None          # from session message
    avg_heart_rate: int | None          # from session message; None if no HR sensor
    max_heart_rate: int | None          # from session message; None if no HR sensor


@dataclass
class GarminSetRecord:
    """Original set data extracted from Garmin FIT mesg 225 (before_sets in MergePreview)."""
    start_time: datetime               # from field 6, converted to naive UTC datetime
    reps: int | None                   # field 3; None if 0xFFFF
    weight_kg: float | None            # field 4 / 16; None if 0xFFFF
    duration_s: float | None           # field 0 / 1000; None if 0
    category_enum_int: int             # field 7[0]; 65534 = unknown
    exercise_enum_int: int             # field 8[0]; 65534 = unknown


@dataclass
class HevySetRecord:
    """Hevy replacement set for after_sets in MergePreview."""
    start_time: datetime               # assigned from D-03/D-04 timestamp
    hevy_exercise_name: str            # raw exercise name from HevyExercise.title
    garmin_exercise: GarminExercise    # confirmed mapping (or GENERIC_FALLBACK)
    reps: int | None                   # from HevySet.reps
    weight_kg: float | None            # from HevySet.weight_kg


@dataclass
class MergePreview:
    """Before/after comparison for Phase 5 confirmation UI (D-06)."""
    biometric_summary: BiometricSummary
    before_sets: list[GarminSetRecord]
    after_sets: list[HevySetRecord]
