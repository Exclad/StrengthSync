---
phase: 02-core-parsers
fixed_at: 2026-04-21T04:36:59Z
review_path: .planning/phases/02-core-parsers/02-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-04-21T04:36:59Z
**Source review:** .planning/phases/02-core-parsers/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (WR-01, WR-02)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `_opt_int` crashes on float-formatted CSV cells

**Files modified:** `hevy_parser.py`
**Commit:** c907b6a
**Applied fix:** Changed `int(val)` to `int(float(val))` in `_opt_int` so that float-formatted integer strings like `"1.0"` and `"10.0"` convert correctly instead of raising `ValueError`.

### WR-02: Hardcoded absolute paths in test fixtures break on any other machine

**Files modified:** `tests/conftest.py`
**Commit:** a5465c4
**Applied fix:** Added `import pathlib` and a `_PROJECT_ROOT = pathlib.Path(__file__).parent.parent` constant. Replaced both hardcoded `/workspace/GarminHevyMerge/` prefixes in `SAMPLE_FIT` and `SAMPLE_HEVY` with `_PROJECT_ROOT`-relative expressions. Also updated `OUTPUT_DIR` to use the same pattern for consistency.

---

_Fixed: 2026-04-21T04:36:59Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
