# Phase 1: FIT Round-Trip Proof-of-Concept - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 01-fit-round-trip-proof-of-concept
**Areas discussed:** Python install method, Round-trip fidelity, Fallback library, POC script structure

---

## Python install method

| Option | Description | Selected |
|--------|-------------|----------|
| apt install python3 | Simple, system-managed, installs Python 3.10 or 3.12 depending on Ubuntu version | ✓ |
| deadsnakes PPA | Adds PPA for pinning a specific Python version | |
| pyenv | Most flexible for multiple versions, adds tooling layer | |
| You decide | Claude picks simplest approach | |

**User's choice:** apt install python3
**Notes:** None — straightforward preference for simplicity.

---

## Round-trip fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Functionally equivalent | Re-parses without errors AND uploads to Garmin Connect; byte-for-byte unrealistic | ✓ |
| Byte-for-byte identical | Output must match original_garmin.fit exactly (md5/sha match) | |
| Garmin Connect is the only bar | Skip re-parse check; upload acceptance is the sole criterion | |

**User's choice:** Functionally equivalent
**Notes:** ROADMAP phrase "byte-for-byte equivalent" is interpreted as functionally identical — libraries may legitimately rewrite CRC, padding, or field ordering.

---

## Fallback library

| Option | Description | Selected |
|--------|-------------|----------|
| Try garmin-fit-sdk next | Official Garmin SDK; requires Java runtime; closest to spec-correct | ✓ |
| Raw binary construction | Implement FIT encoding from scratch; high effort, last resort | |
| Declare Phase 1 blocked | Stop and pivot if fit-tool fails; no fallback baked in | |

**User's choice:** Try garmin-fit-sdk next
**Notes:** Phase 1 scope expands slightly to include garmin-fit-sdk if fit-tool fails. Raw construction is not in scope.

---

## POC script structure

| Option | Description | Selected |
|--------|-------------|----------|
| Early module scaffolding | fit_parser.py + fit_generator.py stubs; Phase 2 extends real modules | ✓ |
| Single standalone script | poc_roundtrip.py — isolated, throwaway, deleted or absorbed after Phase 1 | |
| Both — script first, scaffold after | poc_roundtrip.py first, then refactor into modules before Phase 1 closes | |

**User's choice:** Early module scaffolding
**Notes:** No throwaway scripts. Logic lives in fit_parser.py and fit_generator.py from the start.

---

## Claude's Discretion

- Exact Python version (3.10 vs 3.12) — whatever apt delivers is acceptable
- Minimal from-scratch FIT file content beyond the specified message types
- venv location and activation instructions

## Deferred Ideas

None.
