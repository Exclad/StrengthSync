---
phase: 2
slug: core-parsers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 |
| **Config file** | none — pytest auto-discovery |
| **Quick run command** | `pytest tests/test_fit_parser.py tests/test_hevy_parser.py -x` |
| **Full suite command** | `pytest tests/ -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/test_fit_parser.py tests/test_hevy_parser.py -x`
- **After every plan wave:** Run `pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | FIT-02, HEVY-01, HEVY-02 | — | N/A | unit | `pytest tests/test_fit_parser.py tests/test_hevy_parser.py -x` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | FIT-02 | — | N/A | unit | `pytest tests/test_fit_parser.py::test_parse_fit_returns_hr_samples -x` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | FIT-02 | — | N/A | unit | `pytest tests/test_fit_parser.py::test_parse_fit_gps_absent_is_empty_list -x` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | FIT-02 | — | N/A | unit | `pytest tests/test_fit_parser.py::test_parse_fit_session_metadata -x` | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 1 | FIT-02 | — | regression | unit | `pytest tests/test_fit_roundtrip.py -x` | ✅ exists | ⬜ pending |
| 2-03-01 | 03 | 1 | HEVY-01 | — | N/A | unit | `pytest tests/test_hevy_parser.py::test_parse_hevy_workout_count -x` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 1 | HEVY-01 | — | N/A | unit | `pytest tests/test_hevy_parser.py::test_parse_hevy_timestamps -x` | ❌ W0 | ⬜ pending |
| 2-03-03 | 03 | 1 | HEVY-01 | — | N/A | unit | `pytest tests/test_hevy_parser.py::test_parse_hevy_null_coercion -x` | ❌ W0 | ⬜ pending |
| 2-03-04 | 03 | 1 | HEVY-02 | — | N/A | unit | `pytest tests/test_hevy_parser.py::test_parse_hevy_cardio_detection -x` | ❌ W0 | ⬜ pending |
| 2-03-05 | 03 | 1 | HEVY-02 | — | N/A | unit | `pytest tests/test_hevy_parser.py::test_parse_hevy_bodyweight_not_cardio -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_fit_parser.py` — stubs for FIT-02 test cases
- [ ] `tests/test_hevy_parser.py` — stubs for HEVY-01, HEVY-02 test cases
- [ ] `tests/conftest.py` — extend with `sample_hevy_path` fixture pointing to `original_hevy.csv`

*Wave 0 creates test files and fixtures before any implementation code is written.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | — |

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
