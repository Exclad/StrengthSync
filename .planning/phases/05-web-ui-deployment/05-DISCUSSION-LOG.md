# Phase 5: Web UI + Deployment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 05-web-ui-deployment
**Areas discussed:** UI Style, Timezone Picker, Mapping Review UX, Processing Feedback

---

## UI Style

| Option | Description | Selected |
|--------|-------------|----------|
| Bootstrap | CDN-linked, no build step | |
| Minimal vanilla CSS | Hand-rolled styles | |
| Tailwind (CDN play) | Utility-class styling | |
| StrengthSync design (claude.ai/design) | User provided a full design bundle | ✓ |

**User's choice:** User bypassed the question and provided a complete design bundle from claude.ai/design — the StrengthSync prototype. Implemented directly from the exported bundle.

**Notes:** Design uses custom CSS variables (design tokens), Inter Tight + JetBrains Mono fonts, electric lime + burn orange accent colors. Athletic/energetic aesthetic. Light/dark mode toggle included. React + Babel CDN stack.

---

## Timezone Picker

| Option | Description | Selected |
|--------|-------------|----------|
| Searchable select | Dropdown filtered by typing, populated from Python zoneinfo | ✓ |
| Plain text input | Free-text entry with validation | |
| Curated short list | ~20 common timezones only | |

**User's choice:** Searchable select from `zoneinfo.available_timezones()` served via `/api/timezones`. Common zones floated to top.

---

## Mapping Review UX

| Option | Description | Selected |
|--------|-------------|----------|
| Hero screen from design | Left list + right detail/suggestion panel | ✓ |
| Simple dropdown | Per-exercise select box | |

**User's choice:** The StrengthSync design's hero screen (screen_map.jsx) is the target. UNRESOLVED exercises show ranked fuzzy suggestions; user clicks to accept or searches the full Garmin exercise list. Cardio rows get a "CARDIO — SKIPPED" chip and don't block export.

---

## Processing Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Synchronous POST with spinner | Frontend shows spinner while fetch is in flight | ✓ |
| Async polling | Flask starts job, frontend polls for completion | |
| SSE streaming | Real-time step updates | |

**User's choice:** Synchronous POST. The animated spinner in screen_done.jsx transitions to the ready state when the `/api/export` response arrives. No polling needed — merge completes in < 2s on local hardware.

---

## Claude's Discretion

- Exact `/api/upload` JSON response schema
- Flask SECRET_KEY handling
- Internal error logging format
- `.gitignore` for DB files

## Deferred Ideas

- Hevy OAuth2 API integration (v2)
- Batch processing multiple workouts (v2)
- "Save mapping set" export feature
- SSE real-time progress (only if merge exceeds 3s)
