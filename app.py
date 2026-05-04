import io
import os
import sys
import socket
import threading
import tempfile
import secrets
import pathlib
import zoneinfo
import webbrowser
import shutil
import datetime
import csv
import json
import urllib.request
import zipfile
from urllib.error import HTTPError, URLError
from werkzeug.utils import secure_filename
from flask import Flask, render_template, request, jsonify, session, send_file

app = Flask(__name__)

_secret = os.environ.get("SECRET_KEY")
if not _secret:
    print(
        "WARNING: SECRET_KEY not set in environment — using random key. "
        "Flask session cookies will be invalidated on restart.",
        file=sys.stderr,
    )
    _secret = secrets.token_hex(32)
app.secret_key = _secret

# Sessions persist 24 hours — survives browser close/reopen without re-uploading files
from datetime import timedelta
app.config["SESSION_PERMANENT"] = True
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=24)

# Volume-backed upload directory — FIT files survive container restarts
UPLOADS_DIR = pathlib.Path(__file__).parent / "data" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

import fit_parser
import hevy_parser
import matcher
import mapper
import fit_generator
import database

database.init_db()

# ---------------------------------------------------------------------------
# Static data
# ---------------------------------------------------------------------------

_COMMON_TIMEZONES = [
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Phoenix", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney",
]

# ---------------------------------------------------------------------------
# Phase 7 constants
# ---------------------------------------------------------------------------

CACHE_PATH = pathlib.Path(__file__).parent / "data" / "hevy_cache.csv"

BTC_ADDRESS = "bc1qhjqappn6ere3239dqnzksuectktp62pdhu77qt"
ETH_ADDRESS = "0x2716b0D80465a98Ada440b0c440f43c23E1Bd717"

# ---------------------------------------------------------------------------
# Phase 7 helpers
# ---------------------------------------------------------------------------


def _fetch_hevy_api_workouts(api_key: str) -> list[dict]:
    """Fetch all workout pages from Hevy API. Returns raw workout dicts.

    Max 200 pages guard prevents runaway fetches. Per-request timeout: 15s.
    """
    all_workouts: list[dict] = []
    page = 1
    page_size = 10  # Conservative — API may support higher but 10 is safe
    max_pages = 200
    while page <= max_pages:
        url = f"https://api.hevyapp.com/v1/workouts?page={page}&pageSize={page_size}"
        req = urllib.request.Request(
            url, headers={"api-key": api_key, "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        all_workouts.extend(data.get("workouts", []))
        if page >= data.get("page_count", 1):
            break
        page += 1
    return all_workouts


def _write_hevy_api_cache(raw_workouts: list[dict]) -> None:
    """Persist API workouts to data/hevy_cache.csv in Hevy CSV export format.

    Writes a minimal CSV matching Hevy's export schema so parse_hevy_csv()
    can read it on future sessions (hevy_tz_mode=csv path).
    Only the fields parse_hevy_csv() uses are written: title, start_time,
    end_time, exercise_title, set_index, set_type, weight_kg, reps.
    """
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "title", "start_time", "end_time", "description",
        "exercise_title", "superset_id", "exercise_notes",
        "set_index", "set_type", "weight_kg", "reps",
        "distance_meters", "duration_seconds", "rpe",
    ]
    with open(CACHE_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for w in raw_workouts:
            for ex in w.get("exercises", []):
                ex_title = (
                    ex.get("title")
                    or ex.get("exercise_template", {}).get("title", "Unknown")
                )
                for s in ex.get("sets", []):
                    writer.writerow({
                        "title": w.get("title", ""),
                        "start_time": w.get("start_time", ""),
                        "end_time": w.get("end_time", ""),
                        "description": w.get("description", ""),
                        "exercise_title": ex_title,
                        "superset_id": s.get("superset_id", ""),
                        "exercise_notes": "",
                        "set_index": s.get("index", ""),
                        "set_type": s.get("set_type", "normal"),
                        "weight_kg": s.get("weight_kg", ""),
                        "reps": s.get("reps", ""),
                        "distance_meters": s.get("distance_meters", ""),
                        "duration_seconds": s.get("duration_seconds", ""),
                        "rpe": s.get("rpe", ""),
                    })


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/timezones")
def api_timezones():
    all_tz = sorted(zoneinfo.available_timezones())
    ordered = _COMMON_TIMEZONES + [tz for tz in all_tz if tz not in set(_COMMON_TIMEZONES)]
    return jsonify(ordered)


@app.route("/api/exercises")
def api_exercises():
    result = [
        {
            "exercise_name": ex.exercise_name,
            "exercise_category": ex.exercise_category,
            "exercise_enum_int": ex.exercise_enum_int,
            "exercise_category_enum_int": ex.exercise_category_enum_int,
        }
        for ex in mapper._GARMIN_EXERCISES
    ]
    return jsonify(result)


@app.route("/api/hevy/cache-status")
def api_hevy_cache_status():
    """D-04: Returns cache file metadata for Upload screen banner."""
    if not CACHE_PATH.exists():
        return jsonify({"exists": False, "workout_count": 0, "last_updated": None})

    mtime = CACHE_PATH.stat().st_mtime
    last_updated = datetime.datetime.utcfromtimestamp(mtime).isoformat() + "Z"

    workout_count = 0
    try:
        seen = set()
        with open(CACHE_PATH, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                key = (row.get("title", ""), row.get("start_time", ""))
                seen.add(key)
        workout_count = len(seen)
    except Exception:
        workout_count = 0

    return jsonify({"exists": True, "workout_count": workout_count, "last_updated": last_updated})


@app.route("/api/hevy/use-cache", methods=["POST"])
def api_hevy_use_cache():
    """D-01/D-04: Activate cached CSV as the session's Hevy data source."""
    if not CACHE_PATH.exists():
        return jsonify({"error": "No cached export found. Please upload a Hevy CSV.", "detail": "cache missing"}), 400
    session["hevy_csv_path"] = str(CACHE_PATH)
    session["hevy_tz_mode"] = "csv"  # matcher.py applies normal tz localization for CSV data
    return jsonify({"ok": True})


@app.route("/api/hevy/test", methods=["POST"])
def api_hevy_test():
    """D-05: Test Hevy API key. API key must be in JSON body to avoid log leakage."""
    data = request.get_json(silent=True) or {}
    key = data.get("key", "").strip()
    if not key:
        return jsonify({"ok": False, "reason": "invalid_key"})

    req = urllib.request.Request(
        "https://api.hevyapp.com/v1/workouts/count",
        headers={"api-key": key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8):
            return jsonify({"ok": True})
    except HTTPError as e:
        if e.code == 401:
            return jsonify({"ok": False, "reason": "invalid_key"})
        if e.code == 429:
            return jsonify({"ok": False, "reason": "rate_limited"})
        return jsonify({"ok": False, "reason": "unreachable"})
    except (URLError, OSError):
        return jsonify({"ok": False, "reason": "unreachable"})


@app.route("/api/hevy/workouts")
def api_hevy_workouts():
    """D-06/D-07: Fetch all workouts from Hevy API, save to cache, set session.

    API key passed in X-Hevy-Key header from frontend (avoids query param log leakage).
    Fallback chain: API fails → cached CSV → error response.
    """
    api_key = request.headers.get("X-Hevy-Key", "").strip()
    if not api_key:
        api_key = request.args.get("key", "").strip()

    hevy_workouts = None

    if api_key:
        try:
            raw_workouts = _fetch_hevy_api_workouts(api_key)
            hevy_workouts = hevy_parser.parse_hevy_api_response(raw_workouts, weight_unit=session.get("weight_unit", "kg"))
            # Save to cache for future sessions
            try:
                _write_hevy_api_cache(raw_workouts)
            except Exception:
                pass  # Non-fatal
        except HTTPError as e:
            pass  # Fall through to cache fallback
        except (URLError, OSError):
            pass  # Fall through to cache fallback

    # Fallback to cached CSV if API failed
    if hevy_workouts is None:
        if CACHE_PATH.exists():
            try:
                hevy_workouts = hevy_parser.parse_hevy_csv(str(CACHE_PATH), weight_unit=session.get("weight_unit", "kg"))
                session["hevy_csv_path"] = str(CACHE_PATH)
                session["hevy_tz_mode"] = "csv"
                return jsonify({
                    "hevy_workout_count": len(hevy_workouts),
                    "source": "cache",
                    "warning": "Couldn't reach Hevy's API. Using your cached export instead.",
                })
            except Exception:
                pass
        # Both API and cache failed
        return jsonify({"error": "no_cache_fallback"}), 400

    # API success — set session using the saved cache file (which now has API data)
    if not CACHE_PATH.exists():
        return jsonify({"error": "no_cache_fallback"}), 400
    session["hevy_csv_path"] = str(CACHE_PATH)
    session["hevy_tz_mode"] = "utc"  # parse_hevy_api_response produces naive UTC — skip tz localization
    return jsonify({"hevy_workout_count": len(hevy_workouts), "source": "api"})


@app.route("/api/config")
def api_config():
    """Expose frontend-safe config constants."""
    return jsonify({"btc_address": BTC_ADDRESS, "eth_address": ETH_ADDRESS})


@app.route("/api/donation/qr/<coin>")
def api_donation_qr(coin):
    """Return a QR code PNG for BTC or ETH donation address."""
    import qrcode
    addresses = {"btc": BTC_ADDRESS, "eth": ETH_ADDRESS}
    address = addresses.get(coin.lower())
    if not address:
        return jsonify({"error": "unknown coin"}), 404
    qr = qrcode.QRCode(box_size=10, border=2)
    qr.add_data(address)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return send_file(buf, mimetype="image/png", max_age=86400)


def _extract_fit_from_zip(zip_path: str, dest_path: str) -> bool:
    """Extract the first .fit file found in a zip into dest_path. Returns True on success."""
    with zipfile.ZipFile(zip_path, 'r') as zf:
        fit_names = [n for n in zf.namelist() if n.lower().endswith('.fit')]
        if not fit_names:
            return False
        # Prefer the largest .fit file (activity files are bigger than device logs)
        fit_names.sort(key=lambda n: zf.getinfo(n).file_size, reverse=True)
        with zf.open(fit_names[0]) as src, open(dest_path, 'wb') as dst:
            dst.write(src.read())
    return True


def _current_fit_path() -> str | None:
    """Return the active FIT file path for the current session, respecting batch index."""
    paths = session.get("fit_paths") or ([session.get("fit_path")] if session.get("fit_path") else [])
    idx = session.get("fit_index", 0)
    return paths[idx] if paths and idx < len(paths) else None


@app.route("/api/upload", methods=["POST"])
def api_upload():
    fit_files = request.files.getlist("fit_file")
    if not fit_files or all(f.filename == "" for f in fit_files):
        return jsonify({"error": "No FIT file provided.", "detail": "fit_file field missing"}), 400

    use_session_hevy = request.form.get("use_session_hevy", "").lower() == "true"
    if "hevy_csv" not in request.files and not use_session_hevy:
        return jsonify({"error": "No Hevy CSV provided.", "detail": "hevy_csv field missing"}), 400

    timezone_str = request.form.get("timezone", "").strip()
    weight_unit = request.form.get("weight_unit", "kg").strip().lower()
    if weight_unit not in ("kg", "lbs"):
        weight_unit = "kg"

    if not timezone_str:
        return jsonify({"error": "No timezone provided.", "detail": "timezone field missing"}), 400

    try:
        zoneinfo.ZoneInfo(timezone_str)
    except (zoneinfo.ZoneInfoNotFoundError, KeyError):
        return jsonify({"error": f"Invalid timezone '{timezone_str}'.", "detail": "Must be a valid IANA timezone string"}), 400

    # Save all FIT files to volume-backed directory (zip files are extracted automatically)
    fit_paths = []
    for i, fit_file in enumerate(fit_files):
        original_name = (fit_file.filename or "").lower()
        if original_name.endswith('.zip'):
            zip_tmp = str(UPLOADS_DIR / f"fit_{i}.zip")
            fit_file.save(zip_tmp)
            dest = str(UPLOADS_DIR / f"fit_{i}.fit")
            if not _extract_fit_from_zip(zip_tmp, dest):
                return jsonify({"error": f"No .fit file found inside the uploaded zip ({fit_file.filename}).", "detail": "zip contained no .fit entries"}), 400
            os.unlink(zip_tmp)
            fit_paths.append(dest)
        else:
            path = str(UPLOADS_DIR / f"fit_{i}.fit")
            fit_file.save(path)
            fit_paths.append(path)

    # Validate first FIT file (representative parse for upload response)
    try:
        fit_workout = fit_parser.parse_fit_file(fit_paths[0])
    except Exception as exc:
        err_str = str(exc).lower()
        if "not a fit file" in err_str or "magic" in err_str or "header" in err_str:
            msg = "That doesn't look like a FIT file. Download the original from Garmin Connect → Activity → ⋯ → Export original."
        else:
            msg = "FIT file failed to parse. Try re-exporting from Garmin Connect."
        return jsonify({"error": msg, "detail": str(exc)}), 400

    if fit_workout.start_time is None:
        return jsonify({
            "error": (
                "This FIT file doesn't contain a workout session — it looks like a "
                "health monitoring file from Garmin's data archive. "
                "To get the right file: open Garmin Connect, go to Activities, "
                "click your strength workout, then use the ⋯ menu → Export Original. "
                "Each workout needs its own FIT file."
            ),
            "detail": "No session message found in FIT file (likely a MONITOR-type file from the Garmin data archive)",
        }), 400

    if use_session_hevy:
        # Cache / API path: use Hevy data already set in session by /api/hevy/use-cache or /api/hevy/workouts
        # T-07-07 mitigation: verify session path exists on disk before using (prevents path injection)
        hevy_csv_path_existing = session.get("hevy_csv_path")
        if not hevy_csv_path_existing or not pathlib.Path(hevy_csv_path_existing).exists():
            return jsonify({"error": "No cached Hevy data found. Please upload a Hevy CSV.", "detail": "session hevy_csv_path missing or file gone"}), 400
        try:
            hevy_workouts = hevy_parser.parse_hevy_csv(hevy_csv_path_existing, weight_unit=weight_unit)
            if not hevy_workouts:
                raise ValueError("Cached CSV contains no workouts")
        except Exception as exc:
            return jsonify({"error": "Failed to parse cached Hevy export.", "detail": str(exc)}), 400
        hevy_csv_path = hevy_csv_path_existing
    else:
        # Normal upload path: user uploaded a new CSV file
        hevy_file = request.files["hevy_csv"]
        tmp_hevy = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
        hevy_file.save(tmp_hevy.name)

        # Validate Hevy CSV
        try:
            hevy_workouts = hevy_parser.parse_hevy_csv(tmp_hevy.name, weight_unit=weight_unit)
            if not hevy_workouts:
                raise ValueError("CSV parsed but contains no workouts")
            # Persist to data/hevy_cache.csv (volume-backed) — session always uses this path
            CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(tmp_hevy.name, str(CACHE_PATH))
        except Exception as exc:
            return jsonify({
                "error": "This doesn't look like a Hevy export. Go to Hevy Settings → Export and try again.",
                "detail": str(exc),
            }), 400
        finally:
            os.unlink(tmp_hevy.name)
        hevy_csv_path = str(CACHE_PATH)

    # Store minimal state in session (only string keys — D-24)
    session["fit_paths"] = fit_paths
    session["fit_index"] = 0
    session["fit_path"] = fit_paths[0]  # backwards-compat alias
    session["hevy_csv_path"] = hevy_csv_path
    session["timezone"] = timezone_str
    session["weight_unit"] = weight_unit

    # Serialize FitWorkout manually (no dataclasses.asdict — datetime fields)
    def dt_iso(dt):
        return dt.isoformat() if dt is not None else None

    fit_json = {
        "start_time": dt_iso(fit_workout.start_time),
        "end_time": dt_iso(fit_workout.end_time),
        "total_calories": fit_workout.total_calories,
        "total_elapsed_time": fit_workout.total_elapsed_time,
        "device_serial": fit_workout.device_serial,
        "avg_heart_rate": fit_workout.avg_heart_rate,
        "max_heart_rate": fit_workout.max_heart_rate,
        "hr_sample_count": len(fit_workout.heart_rate_samples),
        "gps_point_count": len(fit_workout.gps_track),
    }

    hevy_json = [
        {
            "title": w.title,
            "start_time": dt_iso(w.start_time),
            "end_time": dt_iso(w.end_time),
            "description": w.description,
            "exercise_count": len(w.exercises),
            "skipped_cardio": w.skipped_cardio,
            "exercises": [
                {
                    "title": ex.title,
                    "set_count": len(ex.sets),
                }
                for ex in w.exercises
            ],
        }
        for w in hevy_workouts
    ]

    return jsonify({"fitWorkout": fit_json, "hevyWorkouts": hevy_json, "fitCount": len(fit_paths), "fitIndex": 0})


@app.route("/api/next-fit", methods=["POST"])
def api_next_fit():
    """Advance to the next FIT file in a batch upload. Returns new index and count."""
    paths = session.get("fit_paths", [])
    if not paths:
        return jsonify({"error": "No batch upload in session."}), 400
    idx = session.get("fit_index", 0) + 1
    if idx >= len(paths):
        return jsonify({"error": "No more FIT files in this batch."}), 400
    session["fit_index"] = idx
    session["fit_path"] = paths[idx]
    return jsonify({"fit_index": idx, "fit_count": len(paths)})


@app.route("/api/match", methods=["POST"])
def api_match():
    fit_path = _current_fit_path()
    hevy_csv_path = session.get("hevy_csv_path")
    timezone_str = session.get("timezone")
    if not fit_path or not hevy_csv_path or not timezone_str:
        return jsonify({"error": "Session expired. Please re-upload your files.", "detail": "session missing"}), 400

    try:
        fit_workout = fit_parser.parse_fit_file(fit_path)
        hevy_workouts = hevy_parser.parse_hevy_csv(hevy_csv_path, weight_unit=session.get("weight_unit", "kg"))
    except Exception as exc:
        return jsonify({"error": "Failed to re-parse uploaded files.", "detail": str(exc)}), 400

    data = request.get_json(silent=True) or {}
    hevy_workout_id = data.get("hevy_workout_id")

    if hevy_workout_id is not None:
        # Manual override: find hevy workout by index
        idx = int(hevy_workout_id) if str(hevy_workout_id).isdigit() else 0
        if idx < 0 or idx >= len(hevy_workouts):
            return jsonify({"error": f"Invalid hevy_workout_id: {hevy_workout_id}", "detail": "out of range"}), 400
        match = matcher.force_match(fit_workout, hevy_workouts[idx])
    else:
        match = matcher.match_workouts(fit_workout, hevy_workouts, timezone_str)
        if match is None:
            start_str = fit_workout.start_time.isoformat() if fit_workout.start_time else "unknown"
            return jsonify({
                "error": f"No Hevy workout found within 30 minutes of {start_str}. Check your timezone selection or use manual match.",
                "detail": "match_workouts returned None",
            }), 400

    def dt_iso(dt):
        return dt.isoformat() if dt is not None else None

    hevy_idx = hevy_workouts.index(match.hevy_workout) if match.hevy_workout in hevy_workouts else 0

    return jsonify({
        "delta_minutes": match.delta_minutes,
        "is_forced": match.is_forced,
        "hevy_workout_index": hevy_idx,
        "garmin": {
            "start_time": dt_iso(fit_workout.start_time),
            "end_time": dt_iso(fit_workout.end_time),
            "total_calories": fit_workout.total_calories,
            "total_elapsed_time": fit_workout.total_elapsed_time,
            "avg_heart_rate": fit_workout.avg_heart_rate,
        },
        "hevy": {
            "title": match.hevy_workout.title,
            "start_time": dt_iso(match.hevy_workout.start_time),
            "end_time": dt_iso(match.hevy_workout.end_time),
            "exercise_count": len(match.hevy_workout.exercises),
            "skipped_cardio": match.hevy_workout.skipped_cardio,
        },
    })


@app.route("/api/map/suggest", methods=["POST"])
def api_map_suggest():
    data = request.get_json(silent=True) or {}
    hevy_name = data.get("hevy_exercise_name", "").strip()
    if not hevy_name:
        return jsonify({"error": "hevy_exercise_name is required.", "detail": "empty string"}), 400
    confirmed_ex = mapper.get_confirmed_mapping(hevy_name)
    if confirmed_ex is not None:
        fuzzy = mapper.suggest_mapping(hevy_name, limit=4)
        confirmed_entry = {
            "id": confirmed_ex.exercise_name,
            "label": confirmed_ex.exercise_name.replace("_", " ").title(),
            "score": 100.0,
            "confirmed": True,
        }
        fuzzy_entries = [
            {"id": ex.exercise_name, "label": ex.exercise_name.replace("_", " ").title(), "score": round(score, 2), "confirmed": False}
            for ex, score in fuzzy
            if ex.exercise_name != confirmed_ex.exercise_name
        ]
        return jsonify({"suggestions": [confirmed_entry] + fuzzy_entries, "confirmed": True})
    suggestions = mapper.suggest_mapping(hevy_name, limit=5)
    return jsonify({
        "suggestions": [
            {"id": ex.exercise_name, "label": ex.exercise_name.replace("_", " ").title(), "score": round(score, 2), "confirmed": False}
            for ex, score in suggestions
        ],
        "confirmed": False,
    })


@app.route("/api/map/confirm", methods=["POST"])
def api_map_confirm():
    data = request.get_json(silent=True) or {}
    hevy_name = data.get("hevy_name", "").strip()
    garmin_name = data.get("garmin_name", "").strip()
    if not hevy_name or not garmin_name:
        return jsonify({"error": "hevy_name and garmin_name are required.", "detail": "empty field"}), 400
    garmin_ex = next((e for e in mapper._GARMIN_EXERCISES if e.exercise_name == garmin_name), None)
    if garmin_ex is None:
        return jsonify({"error": f"Unknown Garmin exercise: {garmin_name}", "detail": "not in garmin_exercises.csv"}), 400
    mapper.confirm_mapping(hevy_name, garmin_ex)
    return jsonify({"ok": True})


@app.route("/api/preview", methods=["POST"])
def api_preview():
    fit_path = _current_fit_path()
    hevy_csv_path = session.get("hevy_csv_path")
    timezone_str = session.get("timezone")
    if not fit_path or not hevy_csv_path or not timezone_str:
        return jsonify({"error": "Session expired. Please re-upload your files.", "detail": "session missing"}), 400

    data = request.get_json(silent=True) or {}
    hevy_idx = int(data.get("hevy_workout_index", 0))

    try:
        fit_workout = fit_parser.parse_fit_file(fit_path)
        hevy_workouts = hevy_parser.parse_hevy_csv(hevy_csv_path, weight_unit=session.get("weight_unit", "kg"))
    except Exception as exc:
        return jsonify({"error": "Failed to re-parse uploaded files.", "detail": str(exc)}), 400

    if hevy_idx >= len(hevy_workouts):
        hevy_idx = 0
    match = matcher.force_match(fit_workout, hevy_workouts[hevy_idx])

    try:
        preview = fit_generator.build_preview(match, timezone_str, fit_path)
    except Exception as exc:
        return jsonify({"error": "Failed to build preview.", "detail": str(exc)}), 500

    def dt_iso(dt):
        return dt.isoformat() if dt is not None else None

    # Downsample HR to max 720 points
    hr_samples = fit_workout.heart_rate_samples
    if len(hr_samples) > 720:
        step = len(hr_samples) / 720
        hr_samples = [hr_samples[int(i * step)] for i in range(720)]
    hr_json = [{"t": s.timestamp.isoformat(), "hr": s.heart_rate} for s in hr_samples]

    before_sets = [
        {
            "start_time": dt_iso(s.start_time),
            "reps": s.reps,
            "weight_kg": s.weight_kg,
            "duration_s": s.duration_s,
            "category_enum_int": s.category_enum_int,
            "exercise_enum_int": s.exercise_enum_int,
        }
        for s in preview.before_sets
    ]
    after_sets = [
        {
            "start_time": dt_iso(s.start_time),
            "hevy_exercise_name": s.hevy_exercise_name,
            "garmin_exercise_name": s.garmin_exercise.exercise_name,
            "reps": s.reps,
            "weight_kg": s.weight_kg,
        }
        for s in preview.after_sets
    ]
    return jsonify({
        "biometricSummary": {
            "total_elapsed_time": preview.biometric_summary.total_elapsed_time,
            "total_calories": preview.biometric_summary.total_calories,
            "avg_heart_rate": preview.biometric_summary.avg_heart_rate,
            "max_heart_rate": preview.biometric_summary.max_heart_rate,
        },
        "heartRateSamples": hr_json,
        "beforeSets": before_sets,
        "afterSets": after_sets,
    })


@app.route("/api/export", methods=["POST"])
def api_export():
    fit_path = _current_fit_path()
    hevy_csv_path = session.get("hevy_csv_path")
    timezone_str = session.get("timezone")
    if not fit_path or not hevy_csv_path or not timezone_str:
        return jsonify({"error": "Session expired. Please re-upload your files.", "detail": "session missing"}), 400

    data = request.get_json(silent=True) or {}
    hevy_idx = int(data.get("hevy_workout_index", 0))

    try:
        fit_workout = fit_parser.parse_fit_file(fit_path)
        hevy_workouts = hevy_parser.parse_hevy_csv(hevy_csv_path, weight_unit=session.get("weight_unit", "kg"))
    except Exception as exc:
        return jsonify({"error": "Failed to re-parse uploaded files.", "detail": str(exc)}), 400

    if hevy_idx >= len(hevy_workouts):
        hevy_idx = 0
    match = matcher.force_match(fit_workout, hevy_workouts[hevy_idx])

    out_hex = secrets.token_hex(8)
    project_root = pathlib.Path(__file__).parent.resolve()
    out_path = str(project_root / "output" / f"merged-{out_hex}.fit")

    try:
        result_path = fit_generator.build_merged_fit(match, timezone_str, fit_path, out_path)
    except ValueError as exc:
        if "crc" in str(exc).lower() or "fitparse" in str(exc).lower() or "fit-tool" in str(exc).lower():
            return jsonify({"error": "Merged FIT failed integrity check. This is a bug — please report it.", "detail": str(exc)}), 500
        return jsonify({"error": "Export failed.", "detail": str(exc)}), 500
    except Exception as exc:
        return jsonify({"error": "Export failed.", "detail": str(exc)}), 500

    return send_file(
        result_path,
        mimetype="application/octet-stream",
        as_attachment=True,
        download_name="merged.fit",
    )


# ---------------------------------------------------------------------------
# Library + History routes
# ---------------------------------------------------------------------------

@app.route("/api/mappings")
def api_mappings():
    rows = database.get_all_mappings_db()
    return jsonify([
        {"hevy_name": r[0], "garmin_name": r[1], "garmin_enum_int": r[2], "confirmed_at": r[3]}
        for r in rows
    ])


@app.route("/api/map/delete", methods=["POST"])
def api_map_delete():
    data = request.get_json(silent=True) or {}
    hevy_name = data.get("hevy_name", "").strip()
    if not hevy_name:
        return jsonify({"error": "hevy_name is required.", "detail": "empty"}), 400
    database.delete_mapping_db(hevy_name)
    return jsonify({"ok": True})


@app.route("/api/map/reset", methods=["POST"])
def api_map_reset():
    deleted = database.reset_all_mappings_db()
    return jsonify({"ok": True, "deleted": deleted})


@app.route("/api/history")
def api_history():
    output_dir = pathlib.Path(__file__).parent / "output"
    if not output_dir.exists():
        return jsonify([])
    files = []
    for f in sorted(output_dir.glob("merged-*.fit"), key=lambda x: x.stat().st_mtime, reverse=True):
        stat = f.stat()
        files.append({
            "name": f.name,
            "size_kb": round(stat.st_size / 1024, 1),
            "mtime": stat.st_mtime,
        })
    return jsonify(files)


@app.route("/api/history/download")
def api_history_download():
    name = request.args.get("name", "").strip()
    if not name or "/" in name or "\\" in name or not name.endswith(".fit"):
        return jsonify({"error": "Invalid filename."}), 400
    output_dir = pathlib.Path(__file__).parent / "output"
    target = output_dir / name
    if not target.exists() or not target.is_file():
        return jsonify({"error": "File not found."}), 404
    return send_file(str(target), mimetype="application/octet-stream", as_attachment=True, download_name=name)


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

def _find_free_port(preferred: int) -> int:
    """Return preferred port if available, otherwise scan upward up to +20."""
    for port in range(preferred, preferred + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    # Last resort: let the OS pick any free port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    preferred_port = int(os.environ.get("PORT", 5000))
    port = _find_free_port(preferred_port) if host == "127.0.0.1" else preferred_port
    if port != preferred_port:
        print(
            f"Port {preferred_port} is already in use (on macOS this is often AirPlay Receiver — "
            f"you can disable it in System Settings → General → AirDrop & Handoff). "
            f"Starting on port {port} instead.",
            file=sys.stderr,
        )
    url = f"http://localhost:{port}"
    print(f"StrengthSync running at {url}", file=sys.stderr)
    if host == "127.0.0.1":
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    app.run(debug=False, host=host, port=port)
