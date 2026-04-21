"""FIT file reader module.

Uses fit-tool (read path) and fitparse (verification).
Phase 1: minimal implementation — Phase 2 extends with full field extraction.
"""
from fit_tool.fit_file import FitFile
from datetime import timedelta
from fitparse import FitFile as FitParseFile
from models import FitWorkout, HRSample, GPSPoint, CadenceSample, PowerSample


def read_fit_file(path: str) -> FitFile:
    """Read a FIT file using fit-tool. Returns a FitFile object.

    Args:
        path: Absolute or relative path to the .fit file.

    Returns:
        FitFile object with .records list and .header.

    Raises:
        FileNotFoundError: If path does not exist.
        Exception: If fit-tool cannot parse the file.
    """
    return FitFile.from_file(path)


_SEMICIRCLES_TO_DEG = 180.0 / (2 ** 31)


def parse_fit_file(path: str) -> FitWorkout:
    """Parse a FIT file using fitparse and return a typed FitWorkout.

    Uses fitparse (D-01) — not fit-tool — to capture all message types
    including Garmin-proprietary messages (140, 288, 326, 327).

    Args:
        path: Absolute or relative path to the .fit file.

    Returns:
        FitWorkout dataclass. Absent sensors return empty lists (D-04).
        Timestamps are naive UTC-equivalent datetimes (no tzinfo) —
        Phase 3 applies timezone conversion, not Phase 2.

    Raises:
        fitparse.FitParseError: If the file cannot be parsed or CRC fails.
        FileNotFoundError: If path does not exist.
    """
    hr_samples: list[HRSample] = []
    gps_track: list[GPSPoint] = []
    cadence_samples: list[CadenceSample] = []
    power_samples: list[PowerSample] = []
    start_time = None
    end_time = None
    total_calories = None
    total_elapsed_time = None
    device_serial = None

    with FitParseFile(path) as fitfile:
        for msg in fitfile.get_messages("record"):
            ts = msg.get_value("timestamp")        # naive datetime (UTC-equivalent)
            hr = msg.get_value("heart_rate")       # int bpm or None
            lat = msg.get_value("position_lat")    # int semicircles or None
            lng = msg.get_value("position_long")   # int semicircles or None
            cad = msg.get_value("cadence")         # int rpm or None
            pwr = msg.get_value("power")           # int watts or None

            if hr is not None and ts is not None:
                hr_samples.append(HRSample(timestamp=ts, heart_rate=hr))
            if lat is not None and lng is not None and ts is not None:
                gps_track.append(GPSPoint(
                    timestamp=ts,
                    lat=lat * _SEMICIRCLES_TO_DEG,
                    lon=lng * _SEMICIRCLES_TO_DEG,
                ))
            if cad is not None and ts is not None:
                cadence_samples.append(CadenceSample(timestamp=ts, cadence=cad))
            if pwr is not None and ts is not None:
                power_samples.append(PowerSample(timestamp=ts, power=pwr))

        sessions = list(fitfile.get_messages("session"))
        if sessions:
            s = sessions[0]
            start_time = s.get_value("start_time")
            total_calories = s.get_value("total_calories")
            total_elapsed_time = s.get_value("total_elapsed_time")
            if start_time is not None and total_elapsed_time is not None:
                end_time = start_time + timedelta(seconds=total_elapsed_time)

        for msg in fitfile.get_messages("device_info"):
            if msg.get_value("device_index") == 0:  # "creator" device
                device_serial = msg.get_value("serial_number")
                break

    return FitWorkout(
        start_time=start_time,
        end_time=end_time,
        total_calories=total_calories,
        total_elapsed_time=total_elapsed_time,
        device_serial=device_serial,
        heart_rate_samples=hr_samples,
        gps_track=gps_track,
        cadence_samples=cadence_samples,
        power_samples=power_samples,
    )
