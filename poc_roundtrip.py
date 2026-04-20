"""Phase 1 POC entry point: FIT round-trip and from-scratch tests.

Run with: python poc_roundtrip.py
Output files are written to output/ directory inside GarminHevyMerge/.

This runner invokes the real module functions — Phase 2 and Phase 4 extend those
modules directly. This file is the developer's test harness for Phase 1.
"""
import os
import sys
import fitparse
from fit_parser import read_fit_file
from fit_generator import write_roundtrip_fit, build_minimal_strength_fit

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
SAMPLE_FIT = os.path.join(PROJECT_ROOT, "original_garmin.fit")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output")


def run_roundtrip_test() -> bool:
    """Test 1: Round-trip original_garmin.fit through fit-tool read/write."""
    print("\n=== Test 1: Round-trip ===")
    out_path = os.path.join(OUTPUT_DIR, "roundtrip.fit")

    if not os.path.exists(SAMPLE_FIT):
        print(f"ERROR: Sample FIT not found: {SAMPLE_FIT}")
        return False

    print(f"  Reading:  {SAMPLE_FIT}")
    fit = read_fit_file(SAMPLE_FIT)
    print(f"  Records:  {len(fit.records)} messages read")

    print(f"  Writing:  {out_path}")
    write_roundtrip_fit(SAMPLE_FIT, out_path)

    # Re-parse with fitparse to verify structural integrity
    print("  Re-parsing with fitparse ...")
    with fitparse.FitFile(out_path) as ff:
        messages = list(ff.get_messages())
    print(f"  Re-parsed: {len(messages)} messages OK")

    print(f"  OUTPUT: {out_path}")
    print("  RESULT: PASS — upload this file to Garmin Connect to complete FIT-01 Part A")
    return True


def run_minimal_fit_test() -> bool:
    """Test 2: Build a minimal from-scratch strength training FIT file."""
    print("\n=== Test 2: From-scratch minimal FIT ===")
    out_path = os.path.join(OUTPUT_DIR, "minimal.fit")

    print(f"  Building: {out_path}")
    build_minimal_strength_fit(out_path)

    # Re-parse with fitparse to verify structural integrity
    print("  Re-parsing with fitparse ...")
    with fitparse.FitFile(out_path) as ff:
        messages = list(ff.get_messages())
    print(f"  Re-parsed: {len(messages)} messages OK")

    print(f"  OUTPUT: {out_path}")
    print("  RESULT: PASS — upload this file to Garmin Connect to complete FIT-01 Part B")
    return True


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Phase 1 POC: FIT Round-trip + From-scratch tests")
    print(f"Project root: {PROJECT_ROOT}")

    results = []
    results.append(run_roundtrip_test())
    results.append(run_minimal_fit_test())

    print("\n=== Summary ===")
    if all(results):
        print("All automated tests PASSED.")
        print("Next step: Upload output/roundtrip.fit and output/minimal.fit to Garmin Connect.")
        print("Phase 1 is complete only after both uploads are accepted by Garmin Connect.")
        sys.exit(0)
    else:
        print("One or more tests FAILED. See output above.")
        sys.exit(1)
