---
phase: 1
slug: fit-round-trip-proof-of-concept
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `python -m pytest tests/ -x -q` |
| **Full suite command** | `python -m pytest tests/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest tests/ -x -q`
- **After every plan wave:** Run `python -m pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | STRUCT-01 | — | N/A | manual | `python --version` | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | FIT-01 | — | N/A | unit | `python -m pytest tests/test_fit_roundtrip.py -v` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 2 | FIT-01 | — | N/A | unit | `python -m pytest tests/test_fit_scratch.py -v` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_fit_roundtrip.py` — stubs for FIT-01 round-trip test
- [ ] `tests/test_fit_scratch.py` — stubs for FIT-01 from-scratch test
- [ ] `tests/conftest.py` — shared fixtures (sample file paths, FIT epoch constant)
- [ ] `pytest` installation via pip in .venv

*Existing infrastructure: none (empty codebase).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Round-trip FIT uploads to Garmin Connect without rejection | FIT-01 | Garmin Connect has no public API for automated upload validation | Upload output FIT file to connect.garmin.com manually; confirm activity appears without error |
| From-scratch FIT uploads to Garmin Connect without rejection | FIT-01 | Same — no automated upload path | Upload minimal FIT file to connect.garmin.com manually; confirm activity appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
