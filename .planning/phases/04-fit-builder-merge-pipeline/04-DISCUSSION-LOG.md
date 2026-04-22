# Phase 4: FIT Builder + Merge Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 04-fit-builder-merge-pipeline
**Areas discussed:** Biometric pass-through, Set timestamp distribution, Preview data contract, fit_generator.py interface

---

## Biometric Pass-Through

| Option | Description | Selected |
|--------|-------------|----------|
| Byte-level splice | Read Garmin FIT binary directly, copy non-set/non-exercise_title bytes verbatim, append garmin-fit-sdk Hevy sets | ✓ |
| fitparse reconstruction | Use fitparse to iterate messages, filter, re-encode with garmin-fit-sdk | |

**User's choice:** Byte-level splice
**Notes:** fit-tool drops proprietary message types 140/288/326/327. fitparse may not faithfully round-trip them either. Byte-level splice is the only approach that guarantees 100% of Garmin data survives.

---

## Set Timestamp Distribution

| Option | Description | Selected |
|--------|-------------|----------|
| Garmin mesg 225 timestamps | Extract real per-set timestamps from existing Garmin set records | ✓ |
| Equal intervals | Divide total workout duration by number of sets | |
| Fixed duration per set | Allocate fixed active+rest time per set | |

**User's choice:** Use Garmin's real timestamps from mesg 225 records
**Notes:** User presses the Garmin lap button at end of each set — so the FIT file already records accurate per-set timestamps. User specifically asked whether real timestamps could be preserved. Answer: yes, by extracting them from the original mesg 225 records before splicing.

**Mismatch fallback:**

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to linear for extras | Real timestamps for matched sets, linear distribution for extras | ✓ |
| Truncate to Garmin count | Drop extra Hevy sets with a warning | |
| Warn and require manual fix | Surface error, block merge until resolved | |

**User's choice:** Fall back to linear for extras
**Notes:** Best-effort — no crash, no silent data loss.

---

## Preview Data Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Summary + exercise list | Biometric summary + exercise list (name, sets, reps, weight) | |
| Full before/after comparison | Original Garmin set records alongside Hevy replacements + biometric summary | ✓ |
| Exercise list only | Just Hevy exercise breakdown, no biometrics | |

**User's choice:** Full before/after comparison
**Notes:** MergePreview contains biometric_summary, before_sets (original Garmin mesg 225 data), and after_sets (Hevy replacements with mapped exercise names). Defined as dataclasses in models.py.

---

## fit_generator.py Interface

| Option | Description | Selected |
|--------|-------------|----------|
| Two functions | build_preview() → MergePreview + build_merged_fit() → path | ✓ |
| One function with dry_run flag | build_merged_fit(..., dry_run=False) → MergePreview | |

**User's choice:** Two functions
**Notes:** Phase 5 flow: call build_preview() → show to user → on confirm, call build_merged_fit(). Clean separation — preview is free, file write is explicit.

---

## Claude's Discretion

- Exact structure of the minimal FIT binary parser
- Whether orphaned definition messages for mesg 225/227 are removed or left in the pass-through stream
- Internal helper decomposition within fit_generator.py
- How MergePreview handles None fields (e.g., no HR sensor)

## Deferred Ideas

- UNRESOLVED exercise mapping handling at Phase 4 level (Phase 5 resolves before calling build_preview)
- Batch processing — v2
