---
phase: 5
slug: web-ui-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.3 |
| **Config file** | none — uses default discovery |
| **Quick run command** | `.venv/bin/pytest tests/test_app_api.py -x -q` |
| **Full suite command** | `.venv/bin/pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `.venv/bin/pytest tests/test_app_api.py -x -q`
- **After every plan wave:** Run `.venv/bin/pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-W0-01 | W0 | 0 | UI-01 | — | N/A | stub | `.venv/bin/pytest tests/test_app_api.py::test_index_serves_html -x` | ❌ W0 | ⬜ pending |
| 05-W0-02 | W0 | 0 | UI-01 | — | N/A | stub | `.venv/bin/pytest tests/test_app_api.py::test_upload_valid_files -x` | ❌ W0 | ⬜ pending |
| 05-W0-03 | W0 | 0 | UI-01 | — | N/A | stub | `.venv/bin/pytest tests/test_app_api.py::test_timezones_endpoint -x` | ❌ W0 | ⬜ pending |
| 05-W0-04 | W0 | 0 | UI-04 | T-path-traversal | secure_filename() blocks traversal | stub | `.venv/bin/pytest tests/test_app_api.py::test_upload_invalid_fit -x` | ❌ W0 | ⬜ pending |
| 05-W0-05 | W0 | 0 | UI-04 | — | N/A | stub | `.venv/bin/pytest tests/test_app_api.py::test_upload_corrupt_fit -x` | ❌ W0 | ⬜ pending |
| 05-W0-06 | W0 | 0 | UI-04 | — | N/A | stub | `.venv/bin/pytest tests/test_app_api.py::test_upload_invalid_csv -x` | ❌ W0 | ⬜ pending |
| 05-W0-07 | W0 | 0 | UI-02 | — | N/A | stub | `.venv/bin/pytest tests/test_app_api.py::test_map_suggest -x` | ❌ W0 | ⬜ pending |
| 05-W0-08 | W0 | 0 | UI-02 | — | N/A | stub | `.venv/bin/pytest tests/test_app_api.py::test_map_confirm -x` | ❌ W0 | ⬜ pending |
| 05-W0-09 | W0 | 0 | UI-03 | T-path-traversal | out_path confined to output/ dir | stub | `.venv/bin/pytest tests/test_app_api.py::test_export_returns_fit -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_app_api.py` — Flask test client fixture + stubs for all 9 test cases above
- [ ] `tests/conftest.py` — add `@pytest.fixture def app_client()` using `app.test_client()` (or extend existing conftest.py)
- [ ] No framework install needed — pytest 9.0.3 already in `requirements.txt`

*Wave 0 must be complete before Wave 1 execution starts.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser opens automatically on `python app.py` | DEPLOY-01 | Requires live browser launch via `webbrowser.open` | Run `python app.py`; confirm browser tab opens to `http://localhost:5000` within 2 seconds |
| Drag-and-drop file upload works | UI-01 | Browser drag events can't be automated with pytest | Load upload screen; drag a `.fit` file onto the drop zone; confirm file name appears |
| End-to-end merge produces downloadable FIT accepted by Garmin Connect | UI-03 | Requires real FIT file and manual Garmin Connect upload | Use `original_garmin.fit` + `original_hevy.csv`; complete full 5-screen flow; download merged FIT; upload to Garmin Connect |
| Error banners render correctly in React UI | UI-04 | UI rendering not covered by Flask test client | Trigger each error case (wrong file type, corrupt FIT, no match); confirm styled error card appears, no Python traceback visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
