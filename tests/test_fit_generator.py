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
