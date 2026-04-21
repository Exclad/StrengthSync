---
phase: 3
slug: workout-matching-exercise-mapping
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 |
| **Config file** | none — existing pytest setup in tests/ |
| **Quick run command** | `python -m pytest tests/test_matcher.py tests/test_mapper.py -v` |
| **Full suite command** | `python -m pytest tests/ -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest tests/test_matcher.py tests/test_mapper.py -v`
- **After every plan wave:** Run `python -m pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | MATCH-01 | — | N/A | unit stub | `python -m pytest tests/test_matcher.py -v` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | MAP-01 | — | N/A | unit stub | `python -m pytest tests/test_mapper.py -v` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | MATCH-01 | — | N/A | unit | `python -m pytest tests/test_matcher.py::test_match_singapore_timezone -v` | ✅ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | MATCH-01,MATCH-02 | — | N/A | unit | `python -m pytest tests/test_matcher.py::test_auto_match_within_tolerance -v` | ✅ W0 | ⬜ pending |
| 3-02-03 | 02 | 1 | MATCH-03 | — | N/A | unit | `python -m pytest tests/test_matcher.py -v` | ✅ W0 | ⬜ pending |
| 3-03-01 | 03 | 1 | MAP-02 | — | N/A | unit | `python -m pytest tests/test_mapper.py::test_suggest_mapping_bench_press -v` | ✅ W0 | ⬜ pending |
| 3-03-02 | 03 | 1 | MAP-01 | — | N/A | unit | `python -m pytest tests/test_mapper.py::test_confirm_and_retrieve_mapping -v` | ✅ W0 | ⬜ pending |
| 3-03-03 | 03 | 1 | MAP-04 | — | N/A | unit | `python -m pytest tests/test_mapper.py::test_unresolved_threshold_exported -v` | ✅ W0 | ⬜ pending |
| 3-03-04 | 03 | 1 | MAP-03 | — | N/A | unit | `python -m pytest tests/test_mapper.py::test_get_exercises_by_category -v` | ✅ W0 | ⬜ pending |
| 3-04-01 | 04 | 2 | MAP-01,MAP-02 | — | N/A | integration | `python -m pytest tests/ -v` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_matcher.py` — stubs for MATCH-01, MATCH-02, MATCH-03
- [ ] `tests/test_mapper.py` — stubs for MAP-01, MAP-02, MAP-03, MAP-04
- [ ] `tests/conftest.py` — add matcher/mapper fixtures (fit_workout, hevy_workouts, timezone_str)

*Existing pytest infrastructure covers the framework; only new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| garmin_exercises.csv extraction correctness | MAP-02 | Requires visual inspection that enum integers map to correct exercise names | Open data/garmin_exercises.csv, spot-check 5 entries against FIT SDK Profile |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
