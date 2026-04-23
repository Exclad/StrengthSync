"""Tests for build_preview() and build_merged_fit(): FIT splice, CRC, weight scaling.

FIT-03: Merged FIT accepted by Garmin Connect — proprietary messages preserved
FIT-04: CRC validation + descriptive error on failure
MERGE-01: Non-set messages preserved verbatim
MERGE-02: Weight scaling correct (kg * 16 in wire format)
MERGE-03: Set timestamps assigned from Garmin mesg 225 field 6
MERGE-04: build_preview returns MergePreview with before/after sets
"""
import os
import struct
import pytest
import fitparse
from fit_tool.fit_file import FitFile
from fit_generator import build_preview, build_merged_fit
from models import MergePreview, GarminSetRecord, HevySetRecord, BiometricSummary


# ---------------------------------------------------------------------------
# FIT-03: Merged FIT accepted by both parse gates
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="build_merged_fit not yet implemented — Wave 3/4")
def test_build_merged_fit_validates(sample_match_result, sample_fit_path, output_dir):
    """FIT-03: Merged FIT passes fitparse + fit-tool double validation (D-11)."""
    out_path = output_dir + "/merged.fit"
    result_path = build_merged_fit(
        sample_match_result, "Asia/Singapore", sample_fit_path, out_path
    )
    assert os.path.exists(result_path)
    with fitparse.FitFile(result_path) as ff:
        list(ff.get_messages())
    FitFile.from_file(result_path)


@pytest.mark.xfail(reason="build_merged_fit not yet implemented — Wave 3/4")
def test_proprietary_messages_preserved(sample_match_result, sample_fit_path, output_dir):
    """FIT-03: Proprietary message types 140, 288 must survive the byte-level splice."""
    out_path = output_dir + "/merged_prop.fit"
    build_merged_fit(
        sample_match_result, "Asia/Singapore", sample_fit_path, out_path
    )
    with open(out_path, "rb") as f:
        data = f.read()
    # Walk binary to collect all global message numbers
    header_size = data[0]
    data_size = struct.unpack_from("<I", data, 4)[0]
    file_end = header_size + data_size
    local_info: dict[int, int] = {}  # local_num -> global_num
    global_nums: set[int] = set()
    pos = header_size
    while pos < file_end:
        rh = data[pos]
        if rh & 0x80:
            local_num = (rh >> 5) & 0x03
            if local_num in local_info:
                info = local_info[local_num]
                pos += 1 + info["data_size"]
            else:
                break
            continue
        is_def = bool(rh & 0x40)
        local_num = rh & 0x0F
        if is_def:
            arch = data[pos + 2]
            fmt = "<H" if arch == 0 else ">H"
            global_num = struct.unpack_from(fmt, data, pos + 3)[0]
            num_fields = data[pos + 5]
            fields = [(data[pos + 6 + i * 3], data[pos + 6 + i * 3 + 1]) for i in range(num_fields)]
            def_size = 6 + num_fields * 3
            data_sz = sum(sz for _, sz in fields)
            local_info[local_num] = {"global": global_num, "data_size": data_sz}
            global_nums.add(global_num)
            pos += def_size
        else:
            info = local_info[local_num]
            global_nums.add(info["global"])
            pos += 1 + info["data_size"]
    assert 140 in global_nums, f"Proprietary mesg 140 missing from output. Found: {sorted(global_nums)}"
    assert 288 in global_nums, f"Proprietary mesg 288 missing from output. Found: {sorted(global_nums)}"


# ---------------------------------------------------------------------------
# FIT-04: Validation failure raises descriptive exception
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="_validate_fit_output not yet implemented — Wave 4")
def test_validation_failure_raises(tmp_path):
    """FIT-04: A deliberately corrupt FIT file raises ValueError with a clear message (D-12)."""
    from fit_generator import _validate_fit_output
    bad = tmp_path / "corrupt.fit"
    bad.write_bytes(b"\x00" * 100)
    with pytest.raises(ValueError, match="fit-tool|fitparse"):
        _validate_fit_output(str(bad))


# ---------------------------------------------------------------------------
# MERGE-01: Non-set messages preserved verbatim
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="build_merged_fit not yet implemented — Wave 3/4")
def test_non_set_messages_preserved(sample_match_result, sample_fit_path, output_dir):
    """MERGE-01: Non-mesg-225/227 message count unchanged after splice."""
    out_path = output_dir + "/merged_preserve.fit"
    build_merged_fit(
        sample_match_result, "Asia/Singapore", sample_fit_path, out_path
    )
    # original_garmin.fit: 4871 total messages, 36 mesg 225, 0 mesg 227 => 4835 non-set
    with fitparse.FitFile(out_path) as ff:
        msgs = list(ff.get_messages())
    non_set = [m for m in msgs if m.mesg_num not in (225, 227)]
    assert len(non_set) == 4835, (
        f"Expected 4835 non-set messages, got {len(non_set)}. "
        "Biometric messages may have been dropped during splice."
    )


# ---------------------------------------------------------------------------
# MERGE-02: Weight scaling
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="build_merged_fit not yet implemented — Wave 3/4")
def test_weight_scaling(sample_match_result, sample_fit_path, output_dir):
    """MERGE-02: Weights are stored correctly (garmin-fit-sdk applies x16; do NOT pre-multiply)."""
    out_path = output_dir + "/merged_weight.fit"
    build_merged_fit(
        sample_match_result, "Asia/Singapore", sample_fit_path, out_path
    )
    with fitparse.FitFile(out_path) as ff:
        set_msgs = list(ff.get_messages("set"))
    weights = [m.get_value("weight") for m in set_msgs if m.get_value("weight") is not None]
    assert len(weights) > 0, "No weight values found in merged output set messages"
    # All weights must be plausible (0-300 kg range); a x1000 bug would give values >1000
    assert all(0.0 <= w <= 300.0 for w in weights), (
        f"Weight out of plausible range — possible scaling bug: {weights}"
    )


# ---------------------------------------------------------------------------
# MERGE-03: Timestamp assignment
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="build_merged_fit not yet implemented — Wave 3/4")
def test_timestamp_assignment(sample_match_result, sample_fit_path, output_dir):
    """MERGE-03: 18 Garmin timestamps assigned to first 18 Hevy sets; linear fallback for overflow."""
    out_path = output_dir + "/merged_ts.fit"
    build_merged_fit(
        sample_match_result, "Asia/Singapore", sample_fit_path, out_path
    )
    with fitparse.FitFile(out_path) as ff:
        set_msgs = [m for m in ff.get_messages("set") if m.get_value("set_type") == "active"]
    # Sample data: 18 Garmin timestamps + 19 Hevy sets => 1 overflow set gets linear timestamp
    assert len(set_msgs) == 19, f"Expected 19 active sets, got {len(set_msgs)}"
    timestamps = [m.get_value("start_time") for m in set_msgs]
    assert all(ts is not None for ts in timestamps), "All sets must have a start_time"
    # First 18 must be strictly increasing (Garmin real timestamps)
    for i in range(17):
        assert timestamps[i] < timestamps[i + 1], (
            f"Timestamps not increasing at index {i}: {timestamps[i]} >= {timestamps[i+1]}"
        )


# ---------------------------------------------------------------------------
# MERGE-04: build_preview
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="build_preview not yet implemented — Wave 3")
def test_build_preview(sample_match_result, sample_fit_path):
    """MERGE-04: build_preview returns MergePreview with biometric_summary + before/after sets."""
    preview = build_preview(sample_match_result, "Asia/Singapore", sample_fit_path)
    assert isinstance(preview, MergePreview)
    assert isinstance(preview.biometric_summary, BiometricSummary)
    assert len(preview.before_sets) > 0, "before_sets must contain Garmin set records"
    assert len(preview.after_sets) > 0, "after_sets must contain Hevy set records"
    assert all(isinstance(s, GarminSetRecord) for s in preview.before_sets)
    assert all(isinstance(s, HevySetRecord) for s in preview.after_sets)
    # Biometric summary must carry known sample values
    assert preview.biometric_summary.avg_heart_rate == 114
    assert preview.biometric_summary.max_heart_rate == 151
    assert preview.biometric_summary.total_calories == 266


# ---------------------------------------------------------------------------
# Internal helpers: _compute_fit_crc and _assign_timestamps (Wave 2, Plan 04-02)
# ---------------------------------------------------------------------------

def test_compute_fit_crc_header(sample_fit_path):
    """_compute_fit_crc reproduces header CRC 0x5AA9 for first 12 bytes of original_garmin.fit."""
    from fit_generator import _compute_fit_crc
    with open(sample_fit_path, "rb") as f:
        data = f.read()
    header_crc = _compute_fit_crc(data[:12])
    assert header_crc == 0x5AA9, f"Expected 0x5AA9, got {hex(header_crc)}"


def test_compute_fit_crc_file(sample_fit_path):
    """_compute_fit_crc reproduces file CRC stored in last 2 bytes of original_garmin.fit."""
    from fit_generator import _compute_fit_crc
    import struct
    with open(sample_fit_path, "rb") as f:
        data = f.read()
    computed = _compute_fit_crc(data[:-2])
    stored = struct.unpack_from("<H", data, len(data) - 2)[0]
    assert computed == stored, f"File CRC mismatch: computed {hex(computed)} stored {hex(stored)}"


def test_assign_timestamps_garmin_priority():
    """_assign_timestamps returns Garmin timestamps for first min(len, n) positions."""
    from fit_generator import _assign_timestamps
    garmin_ts = list(range(1000, 1018))  # 18 timestamps
    result = _assign_timestamps(garmin_ts, 18, 2000)
    assert result == garmin_ts, "All 18 positions must use Garmin timestamps when n == len"


def test_assign_timestamps_linear_fallback():
    """_assign_timestamps distributes overflow sets linearly between last Garmin ts and workout end."""
    from fit_generator import _assign_timestamps
    garmin_ts = list(range(1000, 1018))  # 18 timestamps
    result = _assign_timestamps(garmin_ts, 19, 2000)
    assert len(result) == 19, f"Expected 19 results, got {len(result)}"
    assert result[:18] == garmin_ts, "First 18 must equal Garmin timestamps"
    assert result[18] > garmin_ts[-1], "Overflow timestamp must be after last Garmin ts"
    assert result[18] < 2000, "Overflow timestamp must be before workout end"


def test_assign_timestamps_empty_garmin():
    """_assign_timestamps handles empty garmin_timestamps by distributing all linearly."""
    from fit_generator import _assign_timestamps
    result = _assign_timestamps([], 3, 4000)
    assert len(result) == 3
    # All should be derived from linear fallback based on workout_end - 3600
    assert all(isinstance(t, int) for t in result)


# ---------------------------------------------------------------------------
# Internal helpers: _extract_set_timestamps and _walk_fit_binary (Wave 2, Plan 04-02)
# ---------------------------------------------------------------------------

def test_walk_fit_binary_timestamp_count(sample_fit_path):
    """_walk_fit_binary extracts exactly 18 active-set timestamps from original_garmin.fit."""
    from fit_generator import _walk_fit_binary
    with open(sample_fit_path, "rb") as f:
        data = f.read()
    _, timestamps = _walk_fit_binary(data)
    assert len(timestamps) == 18, f"Expected 18 active timestamps, got {len(timestamps)}"


def test_walk_fit_binary_timestamps_distinct(sample_fit_path):
    """_walk_fit_binary returns 18 distinct start_time values (field 6, not field 254)."""
    from fit_generator import _walk_fit_binary
    with open(sample_fit_path, "rb") as f:
        data = f.read()
    _, timestamps = _walk_fit_binary(data)
    assert len(set(timestamps)) == 18, (
        f"Timestamps not all distinct — possible field 254 (workout start) used instead of field 6: {timestamps}"
    )


def test_walk_fit_binary_pass_through_smaller(sample_fit_path):
    """_walk_fit_binary pass_through is smaller than original data_size (set records removed)."""
    from fit_generator import _walk_fit_binary
    import struct
    with open(sample_fit_path, "rb") as f:
        data = f.read()
    pass_through, _ = _walk_fit_binary(data)
    orig_data_size = struct.unpack_from("<I", data, 4)[0]
    assert len(pass_through) < orig_data_size, (
        f"pass_through ({len(pass_through)}) should be smaller than orig data_size ({orig_data_size})"
    )


def test_walk_fit_binary_pass_through_preserves_biometrics(sample_fit_path):
    """_walk_fit_binary pass_through is > 40KB (biometric record data preserved)."""
    from fit_generator import _walk_fit_binary
    with open(sample_fit_path, "rb") as f:
        data = f.read()
    pass_through, _ = _walk_fit_binary(data)
    assert len(pass_through) > 40_000, (
        f"pass_through too small ({len(pass_through)} bytes) — biometric data may have been dropped"
    )


# ---------------------------------------------------------------------------
# Task 1 (Wave 3): _encode_hevy_sets, _flatten_hevy_sets, _build_set_dicts,
# _get_workout_end_fit helpers
# ---------------------------------------------------------------------------

def test_encode_hevy_sets_returns_bytes():
    """_encode_hevy_sets returns non-empty bytes for a single-set input."""
    from fit_generator import _encode_hevy_sets
    dicts = [{
        'timestamp_fit': 1145353549,
        'start_time_fit': 1145353549,
        'repetitions': 8,
        'weight_kg': 22.5,
        'duration_s': 45,
        'category_enum_int': 0,
        'exercise_enum_int': 0,
        'message_index': 0,
    }]
    result = _encode_hevy_sets(dicts)
    assert isinstance(result, bytes), "must return bytes"
    assert len(result) > 0, "must return non-empty bytes"


def test_encode_hevy_sets_weight_scaling(sample_fit_path):
    """_encode_hevy_sets weight=22.5 kg is stored correctly (fitparse reads 22.5)."""
    import tempfile, struct as _struct
    from fit_generator import _encode_hevy_sets, _compute_fit_crc
    import fitparse

    dicts = [{
        'timestamp_fit': 1145353549,
        'start_time_fit': 1145353549,
        'repetitions': 8,
        'weight_kg': 22.5,
        'duration_s': 45,
        'category_enum_int': 0,
        'exercise_enum_int': 0,
        'message_index': 0,
    }]
    record_bytes = _encode_hevy_sets(dicts)

    # Wrap in minimal FIT file and re-parse to verify weight
    header = bytearray(14)
    header[0] = 14
    header[1] = 0x10
    header[2:4] = b'\x89\x0a'
    record_len = len(record_bytes)
    _struct.pack_into('<I', header, 4, record_len)
    header[8:12] = b'.FIT'
    hdr_crc = _compute_fit_crc(bytes(header[:12]))
    _struct.pack_into('<H', header, 12, hdr_crc)
    file_body = bytes(header) + record_bytes
    file_crc = _compute_fit_crc(file_body)
    full_file = file_body + _struct.pack('<H', file_crc)

    with tempfile.NamedTemporaryFile(suffix='.fit', delete=False) as f:
        f.write(full_file)
        tmp_path = f.name

    try:
        with fitparse.FitFile(tmp_path) as ff:
            sets = list(ff.get_messages('set'))
        assert len(sets) == 1, f'expected 1 set, got {len(sets)}'
        weight = sets[0].get_value('weight')
        assert weight == 22.5, f'expected 22.5 kg, got {weight}'
    finally:
        import os; os.unlink(tmp_path)


def test_flatten_hevy_sets_excludes_cardio():
    """_flatten_hevy_sets returns (exercise, set) pairs excluding cardio exercises."""
    from fit_generator import _flatten_hevy_sets
    from models import HevyWorkout, HevyExercise, HevySet

    s = HevySet(set_index=0, set_type='normal', weight_kg=60.0, reps=5,
                distance_km=None, duration_seconds=None, rpe=None, superset_id=None)
    cardio_set = HevySet(set_index=0, set_type='normal', weight_kg=None, reps=None,
                         distance_km=1.0, duration_seconds=300.0, rpe=None, superset_id=None)

    ex1 = HevyExercise(title='Barbell Squat', sets=[s, s])
    ex_cardio = HevyExercise(title='Treadmill', sets=[cardio_set])

    workout = HevyWorkout(
        title='Test', start_time=None, end_time=None, description='',
        exercises=[ex1, ex_cardio], skipped_cardio=['Treadmill']
    )
    pairs = _flatten_hevy_sets(workout)
    assert len(pairs) == 2, f"Expected 2 pairs (cardio excluded), got {len(pairs)}"
    assert all(ex.title == 'Barbell Squat' for ex, _ in pairs)


def test_get_workout_end_fit_computes_correctly():
    """_get_workout_end_fit converts FitWorkout start_time + elapsed to FIT epoch int."""
    import datetime
    from fit_generator import _get_workout_end_fit, _FIT_EPOCH_OFFSET
    from models import FitWorkout

    start = datetime.datetime(2026, 4, 17, 9, 45, 49)  # naive UTC
    fw = FitWorkout(
        start_time=start, end_time=None, total_calories=266,
        total_elapsed_time=3600.0, device_serial=None,
        avg_heart_rate=None, max_heart_rate=None,
    )
    result = _get_workout_end_fit(fw)
    # start + 3600s in Unix epoch, minus FIT epoch offset
    expected_unix = int(start.replace(tzinfo=datetime.timezone.utc).timestamp()) + 3600
    expected_fit = expected_unix - _FIT_EPOCH_OFFSET
    assert result == expected_fit, f"Expected {expected_fit}, got {result}"
