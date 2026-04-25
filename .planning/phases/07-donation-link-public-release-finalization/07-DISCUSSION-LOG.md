# Phase 7: Hevy Import UX + Donation Link - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 07 — Hevy Import UX + Donation Link
**Areas discussed:** Upload screen layout, CSV cache UI, cache staleness, Hevy API key management, API data scope, API failure fallback, donation link, phase rename

---

## Upload Screen Layout

| Option | Description | Selected |
|--------|-------------|----------|
| A) Tabbed | "Upload CSV" / "Use cached" / "API (Beta)" as explicit tabs | |
| B) Progressive disclosure | Cache banner auto-appears when cache exists; API sits below as secondary option | ✓ |
| C) Settings-driven | Preferred source configured in Settings; upload screen reflects that choice | |

**User's choice:** B — progressive disclosure
**Notes:** Cache banner only appears when useful; doesn't clutter new-user experience; CSV upload always available as escape hatch.

---

## CSV Cache — Banner Content

| Option | Description | Selected |
|--------|-------------|----------|
| A) Manual only | Date + workout count, no staleness warning | |
| B) Age indicator | Yellow chip after threshold days | ✓ (combined) |
| C) Workout count + date | Facts only, user judges staleness | ✓ (combined) |

**User's choice:** Both B and C — show workout count + date + age warning chip
**Notes:** "Show them the age warning and also show the workout count and date"

---

## Cache Staleness Threshold

**Question:** Default 7 days, 14 days, or user-configurable?
**User's choice:** Default 7 days, user-configurable in Settings
**Notes:** Add "CSV cache freshness warning" field to Settings screen.

---

## Hevy API Key Management

| Option | Description | Selected |
|--------|-------------|----------|
| A) Settings screen input | Text input + "Test connection" button, key in localStorage | ✓ |
| B) Local config file | Key in data/hevy_api_key.txt or .env, no UI | |
| C) Settings + server-side | UI entry but server-side storage, survives browser clears | |

**User's choice:** A
**Notes:** Consistent with how timezone is handled. "Test connection" gives immediate feedback.

---

## API Data Scope

| Option | Description | Selected |
|--------|-------------|----------|
| A) All workouts, match by date | Full history, reuse existing match pipeline | ✓ |
| B) Date-range filtered | Date picker on Upload screen, fetch targeted range | |
| C) Recent N workouts | Last 30 (configurable), fast and low payload | |

**User's choice:** A
**Notes:** Zero new matching logic; API response converted to same HevyWorkout dataclass format as CSV parser.

---

## API Failure Fallback

**Question:** Auto-fall back to cached CSV, or show error and let user choose?
**User's choice:** Auto-fallback — API fails → cached CSV → prompt to upload if no cache
**Notes:** "Yes, if API call fails, fall back to cached CSV. If it doesn't exist, ask the user to upload."

---

## Donation Link

**Question:** Separate Phase 8, or fold into Phase 7 as minor task?
**User's choice:** Fold into Phase 7 as a minor task
**Notes:** Platform (Ko-fi, GitHub Sponsors, PayPal.me) still TBD — implement UI slot with placeholder URL.

---

## Deferred Ideas

- Donation platform selection — user to decide separately before implementation
- Hevy OAuth2 / Pro API — still deferred from PROJECT.md Phase 3
- Date-range filter for API fetch — future phase if needed
