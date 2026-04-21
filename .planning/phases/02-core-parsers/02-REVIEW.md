---
phase: 02-core-parsers
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - fit_parser.py
  - hevy_parser.py
  - models.py
  - tests/conftest.py
  - tests/test_fit_parser.py
  - tests/test_hevy_parser.py
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-21
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed six files implementing the Phase 2 core parsers: `fit_parser.py`, `hevy_parser.py`, `models.py`, and three test/fixture files. The implementation is clean and well-structured. No critical issues were found. Two warnings address a crash risk in `_opt_int` on float-formatted CSV values and fragile hardcoded absolute paths in the test fixtures. Two info items cover dead code and a minor docstring gap.

---

## Warnings

### WR-01: `_opt_int` crashes on float-formatted CSV cells

**File:** `hevy_parser.py:22`

**Issue:** `int(val)` raises `ValueError` on strings like `"1.0"`. If Hevy ever exports `set_index` or `reps` columns with decimal formatting (e.g., `"1.0"`, `"10.0"`), `_opt_int` will raise an uncaught `ValueError`, terminating CSV parsing entirely. Hevy's own iOS and Android exports have been observed to emit float-formatted integers in some app versions.

**Fix:**
```python
def _opt_int(val: str) -> int | None:
    """Return int or None for an empty CSV cell."""
    return int(float(val)) if val.strip() else None
```
`int(float("1.0"))` returns `1` correctly. `int(float("10"))` is also safe. This handles both integer and float-formatted cells without losing precision for reasonable rep/index values.

---

### WR-02: Hardcoded absolute paths in test fixtures break on any other machine

**File:** `tests/conftest.py:6,28`

**Issue:** `SAMPLE_FIT` and `SAMPLE_HEVY` are hardcoded to `/workspace/GarminHevyMerge/...`. Any developer running tests on a different machine (or if the project moves) gets an immediate `AssertionError` from the fixture rather than a meaningful test failure. CI would also fail without `/workspace/` being the checkout root.

**Fix:**
```python
import pathlib

_PROJECT_ROOT = pathlib.Path(__file__).parent.parent

SAMPLE_FIT = str(_PROJECT_ROOT / "original_garmin.fit")
SAMPLE_HEVY = str(_PROJECT_ROOT / "original_hevy.csv")
```
This resolves paths relative to the conftest file's location, which is correct regardless of where the project is checked out.

---

## Info

### IN-01: `read_fit_file` is dead code with no tests

**File:** `fit_parser.py:12-25`

**Issue:** `read_fit_file` is a Phase 1 artifact that returns a raw `FitFile` object from fit-tool. `parse_fit_file` (the Phase 2 implementation) does not call it. No test covers it. The import `from fit_tool.fit_file import FitFile` exists solely for this unused function. Dead code increases maintenance surface and import cost.

**Fix:** Remove `read_fit_file` and its associated `FitFile` import if nothing outside this file calls it. If it is needed as a lower-level utility for Phase 4 (FIT writing), add a `# noqa: F401` comment to the import and a docstring note that it is retained for Phase 4.

---

### IN-02: `parse_hevy_csv` docstring understates `ValueError` sources

**File:** `hevy_parser.py:53`

**Issue:** The docstring states `ValueError` is raised "If a timestamp cannot be parsed with HEVY_TS_FMT." However, `_opt_float` and `_opt_int` can also raise `ValueError` on malformed non-empty weight, reps, distance, or duration cells. A caller catching `ValueError` to handle timestamp failures would silently absorb data-corruption errors from numeric fields.

**Fix:** Expand the `Raises` section:
```
Raises:
    FileNotFoundError: If path does not exist.
    ValueError: If a timestamp cannot be parsed with HEVY_TS_FMT, or if a
        numeric field (weight_kg, reps, distance_km, duration_seconds, rpe)
        contains a non-numeric non-empty value.
```

---

_Reviewed: 2026-04-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
