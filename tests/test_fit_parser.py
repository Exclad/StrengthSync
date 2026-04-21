"""Tests for parse_fit_file(): typed field extraction from original_garmin.fit.

Phase 2 RED state: parse_fit_file does not yet exist in fit_parser.py.
Tests will fail with ImportError until Plan 02 implements parse_fit_file().
"""
import pytest
from fit_parser import parse_fit_file
from models import FitWorkout, HRSample


def test_parse_fit_returns_hr_samples(sample_fit_path):
    """parse_fit_file() must return FitWorkout with non-empty heart_rate_samples."""
    result = parse_fit_file(sample_fit_path)
    assert isinstance(result, FitWorkout)
    assert len(result.heart_rate_samples) > 0
    assert isinstance(result.heart_rate_samples[0], HRSample)
    assert result.heart_rate_samples[0].heart_rate > 0


def test_parse_fit_gps_absent_is_empty_list(sample_fit_path):
    """GPS absent in sample file — gps_track must be [] not None (D-04)."""
    result = parse_fit_file(sample_fit_path)
    assert result.gps_track == [], "absent sensor must be empty list, not None"
    assert result.cadence_samples == []
    assert result.power_samples == []


def test_parse_fit_session_metadata(sample_fit_path):
    """parse_fit_file() must extract start_time, end_time, and total_calories from session."""
    result = parse_fit_file(sample_fit_path)
    assert result.start_time is not None
    assert result.end_time is not None
    assert result.end_time > result.start_time
    assert result.total_calories == 266  # known value from sample (per RESEARCH.md live inspection)
    # fitparse returns naive UTC-equivalent datetimes per D-05/pitfall 1
    assert result.start_time.tzinfo is None
