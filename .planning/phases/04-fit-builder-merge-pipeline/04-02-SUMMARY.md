---
phase: 04-fit-builder-merge-pipeline
plan: "02"
subsystem: fit-binary-walker-crc-helpers
tags: [fit-generator, binary-walker, crc, timestamps, phase4-wave2]
dependency_graph:
  requires:
    - fit_generator.build_preview (stub from 04-01)
    - fit_generator.build_merged_fit (stub from 04-01)
    - models.BiometricSummary
    - models.GarminSetRecord
    - models.HevySetRecord
    - models.MergePreview
  provides:
    - fit_generator._compute_fit_crc
    - fit_generator._assign_timestamps
    - fit_generator._extract_set_timestamps
    - fit_generator._walk_fit_binary
  affects:
    - fit_generator.py (4 new internal helpers + extended imports)
    - tests/test_fit_generator.py (9 new unit tests added)
tech_stack:
  added: []
  patterns:
    - TDD red/green per task
    - FIT CRC-16 nibble-table algorithm
    - FIT binary record walking without full FIT library decode
    - Pitfall 5 guard: always update local_info even for skipped definition records
    - Pitfall 2 guard: compressed timestamp record handling (rh & 0x80)
key_files:
  created: []
  modified:
    - fit_generator.py
    - tests/test_fit_generator.py
decisions:
  - "Extended import block with struct, fitparse.FitFile, models dataclasses, mapper — all needed by Wave 3/4 public API"
  - "_extract_set_timestamps skips field 254 (workout start, same for all sets) and uses field 6 (start_time, per-set distinct)"
  - "local_info always updated for mesg 225/227 definitions even though bytes are not copied (Pitfall 5 guard)"
metrics:
  duration: "~18 minutes"
  completed: "2026-04-23"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 4 Plan 02: Binary Walker and CRC Helpers Summary

FIT binary walker + CRC helpers implemented via TDD: `_compute_fit_crc` reproduces both the header CRC (0x5AA9) and file CRC (0x5135) of `original_garmin.fit`; `_walk_fit_binary` extracts exactly 18 distinct active-set `start_time` values (field 6) and produces a 50,103-byte pass-through buffer (1,671 bytes of set records excised from 51,774); `_assign_timestamps` applies Garmin timestamps by position with linear fallback for overflow sets.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing tests for _compute_fit_crc and _assign_timestamps | a9663db | tests/test_fit_generator.py |
| 1 GREEN | Imports + _FIT_CRC_TABLE + _compute_fit_crc + _assign_timestamps | 107cd7e | fit_generator.py |
| 2 RED | Failing tests for _walk_fit_binary and _extract_set_timestamps | 66eb537 | tests/test_fit_generator.py |
| 2 GREEN | _extract_set_timestamps + _walk_fit_binary | f1ea239 | fit_generator.py |

## Verification Results

- `_compute_fit_crc(data[:12]) == 0x5AA9` — header CRC reproduced: PASS
- `_compute_fit_crc(data[:-2]) == stored_crc (0x5135)` — file CRC reproduced: PASS
- `_walk_fit_binary(original_garmin.fit)` returns 18 distinct active-set timestamps: PASS
- pass_through = 50,103 bytes (smaller than 51,774 orig data_size, larger than 40,000): PASS
- `_assign_timestamps([t0..t17], 19, end)` returns 19 with t0..t17 as first 18: PASS
- 38 pre-existing tests (all phases): still GREEN
- 9 new unit tests for internal helpers: all GREEN

## Deviations from Plan

None — plan executed exactly as written. Both tasks implemented using the exact code patterns from RESEARCH.md and PATTERNS.md. The Pitfall 5 guard (always update `local_info` even for skipped definitions) and Pitfall 2 guard (compressed timestamp `rh & 0x80` check) are both present as specified.

## Known Stubs

The 7 xfail stubs from Plan 04-01 (`build_preview`, `build_merged_fit`, `_validate_fit_output`) remain. They are intentional foundations for Waves 3 and 4. No new stubs introduced in this plan.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. The binary walker reads a local FIT file (trusted local input per threat model T-04-02-03). No new threat surface beyond what was documented in the plan's threat model.

## Self-Check: PASSED

- `fit_generator._compute_fit_crc`: FOUND (line 36)
- `fit_generator._assign_timestamps`: FOUND (line 52)
- `fit_generator._extract_set_timestamps`: FOUND (line 86)
- `fit_generator._walk_fit_binary`: FOUND (line 118)
- `import struct`: FOUND (line 10)
- Commit a9663db: FOUND
- Commit 107cd7e: FOUND
- Commit 66eb537: FOUND
- Commit f1ea239: FOUND
