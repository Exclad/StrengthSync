---
phase: 01-fit-round-trip-proof-of-concept
plan: 03
subsystem: fit-io
tags: [garmin-fit-sdk, fitparse, from-scratch, poc, garmin-connect, phase-gate]
status: complete
completed: 2026-04-20
---

# Plan 01-03 Summary: From-Scratch FIT + Garmin Connect Upload Gate

## What Was Built

`build_minimal_strength_fit(out_path)` implemented in `fit_generator.py` using garmin-fit-sdk (official Garmin Python encoder). Produces a valid strength workout FIT file from scratch:

  file_id → event(start) → set(10 reps × 60 kg) → event(stop) → lap → session → activity

`output/minimal.fit` (254 bytes) generated and confirmed accepted by Garmin Connect — shows 1 hour, 10 reps, 60 kg, 600 kg volume.

## Phase 1 Gate: CLEARED

- `output/roundtrip.fit` — accepted by Garmin Connect (duplicate warning = already uploaded original; file structurally valid)
- `output/minimal.fit` — accepted by Garmin Connect; activity visible in feed with correct values

## Key Deviation: garmin-fit-sdk replaces fit-tool for from-scratch writes

fit-tool FitFileBuilder output was rejected by Garmin Connect with "An error occurred with your upload." Root cause unknown (likely proprietary header or message structure Garmin Connect requires). garmin-fit-sdk (official Garmin-authored SDK, v21.200.0) produces accepted output.

**garmin-fit-sdk API contract (for Phase 4):**
- Timestamps: FIT epoch seconds = Unix seconds − 631,065,600
- Weight: kg as float/int — SDK applies ×16 scale internally; DO NOT pre-multiply
- total_elapsed_time / total_timer_time: seconds — SDK applies ×1000 scale internally
- CLAUDE.md note "grams × 1000" applies to raw FIT binary format, NOT to garmin-fit-sdk API

## Self-Check: PASSED

- [x] All 5 pytest tests GREEN (test_fit_roundtrip.py + test_fit_scratch.py)
- [x] poc_roundtrip.py exits 0, Test 1 PASS + Test 2 PASS
- [x] output/roundtrip.fit accepted by Garmin Connect
- [x] output/minimal.fit accepted by Garmin Connect
- [x] Phase 1 success criteria SC1–SC5 all met

## key-files

### created
- output/minimal.fit — from-scratch FIT file, Garmin Connect validated

### modified
- fit_generator.py — build_minimal_strength_fit implemented (garmin-fit-sdk encoder)
