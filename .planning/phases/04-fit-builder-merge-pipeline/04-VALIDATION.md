---
phase: 4
slug: fit-builder-merge-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 |
| **Config file** | none (pytest discovers from project root) |
| **Quick run command** | `.venv/bin/pytest tests/test_fit_generator.py -x -q` |
| **Full suite command** | `.venv/bin/pytest tests/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `.venv/bin/pytest tests/test_fit_generator.py -x -q`
- **After every plan wave:** Run `.venv/bin/pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | MERGE-01 | — | N/A | unit | `.venv/bin/pytest tests/test_fit_generator.py -x -q` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 0 | MERGE-04 | — | N/A | unit | `.venv/bin/pytest tests/test_fit_generator.py::test_build_preview -x` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | MERGE-01 | — | N/A | unit | `.venv/bin/pytest tests/test_fit_generator.py::test_non_set_messages_preserved -x` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | MERGE-03 | — | N/A | unit | `.venv/bin/pytest tests/test_fit_generator.py::test_timestamp_assignment -x` | ❌ W0 | ⬜ pending |
| 4-02-03 | 02 | 1 | MERGE-02 | — | N/A | unit | `.venv/bin/pytest tests/test_fit_generator.py::test_weight_scaling -x` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 2 | FIT-03 | — | N/A | integration | `.venv/bin/pytest tests/test_fit_generator.py::test_build_merged_fit_validates -x` | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 2 | FIT-03 | — | N/A | integration | `.venv/bin/pytest tests/test_fit_generator.py::test_proprietary_messages_preserved -x` | ❌ W0 | ⬜ pending |
| 4-03-03 | 03 | 2 | FIT-04 | — | N/A | unit | `.venv/bin/pytest tests/test_fit_generator.py::test_validation_failure_raises -x` | ❌ W0 | ⬜ pending |
| 4-03-04 | 03 | 2 | FIT-03 | — | Garmin Connect upload accepted | manual | Manual upload to Garmin Connect | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_fit_generator.py` — all Phase 4 tests (new file; stubs for all 7 automated cases above)
- [ ] `tests/conftest.py` update — add `sample_match_result` fixture using `match_workouts()` with `Asia/Singapore` timezone

*Existing infrastructure: pytest 9.0.3 installed, `tests/` directory exists, `tests/conftest.py` exists with sample file fixtures from Phase 3.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Merged FIT uploads to Garmin Connect without rejection | FIT-03 | Requires real Garmin Connect account; no API to automate | Run `python poc_roundtrip.py` or equivalent, upload output to connect.garmin.com, confirm activity appears correctly |
| Weight values show correctly in Garmin Connect (60 kg shows as 60 kg, not raw grams) | FIT-03 | Requires visual inspection in Garmin Connect UI | Open uploaded activity, verify exercise set weights match Hevy source data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
