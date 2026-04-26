"""Phase 5 API route tests — Flask test client stubs.

Wave 0: All 9 tests are RED stubs. Each turns GREEN when the corresponding
route is implemented in Wave 1 (05-01-PLAN.md).

Run: .venv/bin/pytest tests/test_app_api.py -x -q
"""
import io
import os
import pathlib
import pytest

_ROOT = pathlib.Path(__file__).parent.parent
_SAMPLE_FIT = str(_ROOT / "original_garmin.fit")
_SAMPLE_HEVY = str(_ROOT / "original_hevy.csv")


def test_index_serves_html(app_client):
    """GET / returns 200 with text/html content."""
    resp = app_client.get("/")
    assert resp.status_code == 200
    assert b"<html" in resp.data.lower() or b"<!doctype" in resp.data.lower()


def test_upload_valid_files(app_client):
    """POST /api/upload with valid FIT + CSV returns 200 with fitWorkout and hevyWorkouts keys."""
    fit_bytes = pathlib.Path(_SAMPLE_FIT).read_bytes()
    hevy_bytes = pathlib.Path(_SAMPLE_HEVY).read_bytes()
    data = {
        "fit_file": (io.BytesIO(fit_bytes), "original_garmin.fit"),
        "hevy_csv": (io.BytesIO(hevy_bytes), "original_hevy.csv"),
        "timezone": "Asia/Singapore",
    }
    resp = app_client.post(
        "/api/upload",
        data=data,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert "fitWorkout" in body
    assert "hevyWorkouts" in body
    assert isinstance(body["hevyWorkouts"], list)
    assert len(body["hevyWorkouts"]) > 0


def test_upload_invalid_fit(app_client):
    """POST /api/upload with a non-FIT binary returns 400 with error key."""
    data = {
        "fit_file": (io.BytesIO(b"not a fit file"), "fake.fit"),
        "hevy_csv": (io.BytesIO(pathlib.Path(_SAMPLE_HEVY).read_bytes()), "original_hevy.csv"),
        "timezone": "America/New_York",
    }
    resp = app_client.post(
        "/api/upload",
        data=data,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    body = resp.get_json()
    assert "error" in body


def test_upload_corrupt_fit(app_client):
    """POST /api/upload with a truncated FIT file returns 400 with error key."""
    fit_bytes = pathlib.Path(_SAMPLE_FIT).read_bytes()[:50]  # intentionally truncate
    data = {
        "fit_file": (io.BytesIO(fit_bytes), "truncated.fit"),
        "hevy_csv": (io.BytesIO(pathlib.Path(_SAMPLE_HEVY).read_bytes()), "original_hevy.csv"),
        "timezone": "America/New_York",
    }
    resp = app_client.post(
        "/api/upload",
        data=data,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    body = resp.get_json()
    assert "error" in body


def test_upload_invalid_csv(app_client):
    """POST /api/upload with a non-Hevy CSV returns 400 with error key."""
    data = {
        "fit_file": (io.BytesIO(pathlib.Path(_SAMPLE_FIT).read_bytes()), "original_garmin.fit"),
        "hevy_csv": (io.BytesIO(b"col1,col2\nval1,val2\n"), "notHevy.csv"),
        "timezone": "America/New_York",
    }
    resp = app_client.post(
        "/api/upload",
        data=data,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400
    body = resp.get_json()
    assert "error" in body


def test_timezones_endpoint(app_client):
    """GET /api/timezones returns 200 with a list of strings, America/New_York first."""
    resp = app_client.get("/api/timezones")
    assert resp.status_code == 200
    body = resp.get_json()
    assert isinstance(body, list)
    assert len(body) > 400  # zoneinfo has ~599 IANA zones
    assert "America/New_York" in body
    assert body[0] == "America/New_York"  # common zones float to top


def test_map_suggest(app_client):
    """POST /api/map/suggest returns 200 with list of suggestions."""
    resp = app_client.post(
        "/api/map/suggest",
        json={"hevy_exercise_name": "Bench Press (Barbell)"},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert "suggestions" in body
    assert isinstance(body["suggestions"], list)
    assert len(body["suggestions"]) > 0
    first = body["suggestions"][0]
    assert "id" in first
    assert "label" in first
    assert "score" in first


def test_map_confirm(app_client):
    """POST /api/map/confirm persists a mapping and returns 200 with ok:true."""
    resp = app_client.post(
        "/api/map/confirm",
        json={
            "hevy_name": "__test_exercise_wave0__",
            "garmin_name": "barbell_bench_press",
        },
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body.get("ok") is True


def test_export_returns_fit(app_client):
    """POST /api/export after a valid upload+match session returns FIT binary.

    This test uploads files, stores session state, then calls export.
    Confirms Content-Type is application/octet-stream and response is non-empty.
    """
    # Step 1: upload to populate session
    fit_bytes = pathlib.Path(_SAMPLE_FIT).read_bytes()
    hevy_bytes = pathlib.Path(_SAMPLE_HEVY).read_bytes()
    upload_data = {
        "fit_file": (io.BytesIO(fit_bytes), "original_garmin.fit"),
        "hevy_csv": (io.BytesIO(hevy_bytes), "original_hevy.csv"),
        "timezone": "Asia/Singapore",
    }
    upload_resp = app_client.post(
        "/api/upload",
        data=upload_data,
        content_type="multipart/form-data",
    )
    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.get_json()}"

    # Step 2: match (use auto-match, no override)
    match_resp = app_client.post(
        "/api/match",
        json={"garmin_workout_id": None, "hevy_workout_id": None},
    )
    assert match_resp.status_code == 200, f"Match failed: {match_resp.get_json()}"

    # Step 3: export
    export_resp = app_client.post("/api/export", json={})
    assert export_resp.status_code == 200
    assert export_resp.content_type == "application/octet-stream" or \
           "octet-stream" in export_resp.content_type
    assert len(export_resp.data) > 100  # non-trivial FIT binary


# ---------------------------------------------------------------------------
# Phase 7 stubs — all RED until Wave 1 backend is implemented
# ---------------------------------------------------------------------------

def test_hevy_cache_status(app_client):
    """GET /api/hevy/cache-status returns 200 with {exists, workout_count, last_updated}."""
    resp = app_client.get("/api/hevy/cache-status")
    assert resp.status_code == 200
    body = resp.get_json()
    assert "exists" in body
    assert "workout_count" in body
    assert "last_updated" in body


def test_upload_writes_cache(app_client, tmp_path):
    """POST /api/upload copies hevy CSV to data/hevy_cache.csv on success."""
    import io, pathlib
    _ROOT = pathlib.Path(__file__).parent.parent
    fit_bytes = (_ROOT / "original_garmin.fit").read_bytes()
    hevy_bytes = (_ROOT / "original_hevy.csv").read_bytes()
    resp = app_client.post(
        "/api/upload",
        data={
            "fit_file": (io.BytesIO(fit_bytes), "original_garmin.fit"),
            "hevy_csv": (io.BytesIO(hevy_bytes), "original_hevy.csv"),
            "timezone": "Asia/Singapore",
        },
        content_type="multipart/form-data",
    )
    assert resp.status_code == 200
    cache_path = _ROOT / "data" / "hevy_cache.csv"
    assert cache_path.exists(), "data/hevy_cache.csv must exist after successful upload"


def test_hevy_test_invalid_key(app_client):
    """POST /api/hevy/test with a bad key returns {ok: false, reason: ...}."""
    resp = app_client.post("/api/hevy/test", json={"key": "invalid-key-00000"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["ok"] is False
    assert body["reason"] in ("invalid_key", "unreachable")


def test_hevy_workouts_fallback(app_client, tmp_path, monkeypatch):
    """GET /api/hevy/workouts returns {error: no_cache_fallback} when API fails and no cache exists."""
    import pathlib, app as flask_app_module
    # Remove cache file if it exists to force no-cache path
    cache_path = pathlib.Path(__file__).parent.parent / "data" / "hevy_cache.csv"
    if cache_path.exists():
        cache_path.rename(cache_path.with_suffix(".csv.bak"))
    try:
        resp = app_client.get(
            "/api/hevy/workouts",
            headers={"X-Hevy-Key": "invalid-key-00000"},
        )
        assert resp.status_code in (200, 400)
        body = resp.get_json()
        assert "error" in body
        assert body["error"] == "no_cache_fallback"
    finally:
        bak = cache_path.with_suffix(".csv.bak")
        if bak.exists():
            bak.rename(cache_path)
