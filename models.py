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
