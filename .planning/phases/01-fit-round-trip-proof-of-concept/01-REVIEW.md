---
phase: 01-fit-round-trip-proof-of-concept
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - fit_parser.py
  - fit_generator.py
  - poc_roundtrip.py
  - requirements.txt
  - tests/conftest.py
  - tests/test_fit_roundtrip.py
  - tests/test_fit_scratch.py
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 1 establishes a FIT round-trip and from-scratch write capability. The
implementation is minimal by design, and the approach is sound: binary copy for
the round-trip (avoiding fit-tool's field-dropping on proprietary messages) and
garmin-fit-sdk for the from-scratch file. The code is clear and well-commented.

Four warnings are worth addressing before Phase 2 proceeds. Most are exception
handling gaps that could produce confusing runtime failures. Three info items
are minor quality observations. No security or critical correctness issues were
found.

## Warnings

### WR-01: `write_roundtrip_fit` silently swallows fit-tool parse errors

**File:** `fit_generator.py:40`
**Issue:** `FitFile.from_file(in_path)` is called for validation, but its return
value is discarded and any exception it raises propagates as a raw fit-tool
internal error with no context. A corrupt or non-FIT file will surface an
exception from deep inside fit-tool rather than a clean `ValueError` or
`FileNotFoundError`, making debugging harder for callers and for Phase 2 code
that will call this function programmatically.
**Fix:**
```python
try:
    FitFile.from_file(in_path)
except Exception as exc:
    raise ValueError(f"fit-tool could not parse {in_path!r}: {exc}") from exc
```

### WR-02: `build_minimal_strength_fit` has no error handling around `encoder.close()` or file write

**File:** `fit_generator.py:135-137`
**Issue:** If `encoder.close()` returns empty bytes (e.g., SDK internal error) or
the `open(out_path, 'wb')` call fails due to a missing parent directory, the
exception propagates with no context and no cleanup. A zero-byte file may be
left on disk if the write partially succeeds.
**Fix:**
```python
data = encoder.close()
if not data:
    raise RuntimeError("garmin-fit-sdk encoder.close() returned empty bytes")
out_path_obj = pathlib.Path(out_path)
out_path_obj.parent.mkdir(parents=True, exist_ok=True)
out_path_obj.write_bytes(data)
```

### WR-03: `poc_roundtrip.py` catches `NotImplementedError` from `build_minimal_strength_fit` but the function no longer raises it

**File:** `poc_roundtrip.py:55-57`
**Issue:** The `run_minimal_fit_test()` function wraps `build_minimal_strength_fit`
in a `try/except NotImplementedError` block and returns `True` if caught,
treating it as a non-failure. The function is now fully implemented and will
never raise `NotImplementedError`. This dead catch masks real unexpected
exceptions — if the SDK raises any exception, it will be silently eaten and
reported as a pass.
**Fix:** Remove the try/except entirely and let exceptions propagate:
```python
def run_minimal_fit_test() -> bool:
    print("\n=== Test 2: From-scratch minimal FIT ===")
    out_path = os.path.join(OUTPUT_DIR, "minimal.fit")
    print(f"  Building: {out_path}")
    build_minimal_strength_fit(out_path)
    # ... rest of function unchanged
```

### WR-04: `test_roundtrip_output_inside_project` does not actually test the constraint it names

**File:** `tests/test_fit_roundtrip.py:25-29`
**Issue:** The test is named `STRUCT-01: output path must be inside GarminHevyMerge/`
but the assertion accepts any path starting with `/tmp`, which is what pytest's
`tmp_path` always returns. The test will always pass and provides no enforcement
of the stated constraint. Either the test name should reflect what it actually
checks (that `output_dir` comes from `tmp_path` and not the production
`output/` directory), or the test should be removed since it adds no value.
**Fix:** Rename and clarify the test's actual intent:
```python
def test_output_dir_fixture_uses_tmp_path(output_dir):
    """Verify the output_dir fixture uses tmp_path, not the production output/ dir."""
    assert not output_dir.startswith("/workspace/GarminHevyMerge/output"), (
        f"Tests must not write to production output dir, got: {output_dir}"
    )
```

## Info

### IN-01: `fit_generator.py` imports `FitFileBuilder` but never uses it

**File:** `fit_generator.py:10`
**Issue:** `from fit_tool.fit_file_builder import FitFileBuilder` is imported but
unused. The comment in `build_minimal_strength_fit` explains that fit-tool's
builder was attempted and rejected in favour of garmin-fit-sdk, but the import
was not removed.
**Fix:** Remove the unused import:
```python
# Remove this line:
from fit_tool.fit_file_builder import FitFileBuilder
```

### IN-02: `requirements.txt` includes packages unrelated to Phase 1

**File:** `requirements.txt:2,3,11`
**Issue:** `et_xmlfile==2.0.0` and `openpyxl==3.1.5` are Excel-processing libraries
with no stated use in this project (not listed in CLAUDE.md stack). `Pygments`
is a syntax-highlighter not listed in the project stack. These appear to be
transitive or stale dependencies. If they are genuinely unused, they increase
the install footprint and future dependency audit surface unnecessarily.
**Fix:** Confirm whether these are auto-generated from `pip freeze` (acceptable)
or manually curated. If manually curated, remove unneeded packages. Consider
separating `pip freeze` output from a hand-curated `requirements.in` for
clarity.

### IN-03: `conftest.py` hardcodes an absolute path that is machine-specific

**File:** `tests/conftest.py:6`
**Issue:** `SAMPLE_FIT = "/workspace/GarminHevyMerge/original_garmin.fit"` is an
absolute path that only works in this WSL environment. Any collaborator or CI
runner with a different workspace root will see test failures on the
`sample_fit_path` fixture before any FIT logic runs.
**Fix:** Derive the path from `__file__` to make it portable:
```python
import pathlib
_PROJECT_ROOT = pathlib.Path(__file__).parent.parent
SAMPLE_FIT = str(_PROJECT_ROOT / "original_garmin.fit")
```

---

_Reviewed: 2026-04-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
