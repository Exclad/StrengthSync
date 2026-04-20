# Phase 1: FIT Round-Trip Proof-of-Concept - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that Python can write a FIT file Garmin Connect accepts — this is a hard gate for all subsequent phases. Also initialize the project directory structure. No application logic, no UI, no parsers beyond what's needed for the validation.

</domain>

<decisions>
## Implementation Decisions

### Python Installation
- **D-01:** Install Python globally via `apt install python3` on WSL2 (Ubuntu). No pyenv, no deadsnakes PPA unless apt delivers an unsupported version. After global install, create a project-local venv for dependency isolation (`python3 -m venv .venv`).

### Round-Trip Fidelity
- **D-02:** Functional equivalence is the bar — the output FIT file must re-parse without errors AND upload to Garmin Connect successfully. Byte-for-byte identical output is NOT required; libraries legitimately rewrite CRC, padding, or field ordering. The ROADMAP phrase "byte-for-byte equivalent" is interpreted as "functionally identical" for Phase 1 purposes.

### FIT Write Library
- **D-03:** Primary candidate is `fit-tool`. If `fit-tool` produces files Garmin Connect rejects, try `garmin-fit-sdk` (official Garmin SDK, requires Java runtime) before declaring Phase 1 blocked. Raw binary FIT construction from scratch is last resort only.
- **D-04:** `fitparse` is read-only and must never be used for writing — use it for reading only.

### Script / Module Structure
- **D-05:** Phase 1 code goes into early module scaffolding: `fit_parser.py` (read) and `fit_generator.py` (write) with minimal stubs sufficient for the POC. No throwaway standalone script — Phase 2 extends these real modules. A `poc_roundtrip.py` entry point may exist as a runner but the logic lives in the modules.

### Claude's Discretion
- Exact Python version (3.10 vs 3.12 etc.) — whatever `apt` delivers on this Ubuntu version is fine
- Minimal from-scratch FIT file content — success criteria specifies `file_id + session + one set message (mesg 225)`; implementation details are Claude's call
- venv location and activation instructions for the project README

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Constraints
- `CLAUDE.md` — Critical technical facts: FIT epoch, weight field encoding, fitparse is read-only, fit-tool is the write library, Python installation requirements
- `.planning/REQUIREMENTS.md` — FIT-01 and STRUCT-01 are the requirements gating this phase
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (5 items) define exactly what must be true for Phase 1 to pass

### No external specs
No external ADRs or third-party spec documents beyond the above project files.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — codebase is empty. Phase 1 creates the first source files.

### Established Patterns
- None yet — Phase 1 establishes the patterns (module structure, venv setup) that later phases follow.

### Integration Points
- `original_garmin.fit` — sample Garmin FIT file available at project root for round-trip testing
- `original_hevy.csv` — sample Hevy CSV (not used in Phase 1)
- All output files must remain inside `GarminHevyMerge/` (STRUCT-01)

</code_context>

<specifics>
## Specific Ideas

- The from-scratch FIT test must include: `file_id` message + `session` message + one `set` message (mesg 225). This is the minimum needed to prove the write path for strength workout data.
- Manual Garmin Connect upload is an explicit success criterion — the developer performs this manually; it is not automated.
- Phase 1 passes only when BOTH tests pass: (a) round-trip of `original_garmin.fit` and (b) from-scratch minimal FIT — each uploaded and accepted by Garmin Connect.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-fit-round-trip-proof-of-concept*
*Context gathered: 2026-04-20*
