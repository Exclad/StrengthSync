# Phase 6: Monetization + UI Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 06-monetization-ui-polish
**Areas discussed:** Revenue model (deferred), Settings screen, Timezone UX, Polish scope

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Revenue model | One-time purchase, subscription, freemium, or open source? | Deferred |
| Settings screen | Timezone default, output folder, DB reset, export filename | ✓ |
| Timezone UX improvement | Auto-detect, persist, or move to Settings | ✓ |
| Polish scope | Library/History polish, empty states, error UX | ✓ |

**User's note:** "Let's focus mainly on UI. Monetization will only be discussed once I am satisfied with full UI and functionality."

---

## Settings Screen

| Option | Description | Selected |
|--------|-------------|----------|
| Timezone default | Save a default timezone so users don't re-pick it every session | ✓ |
| Output folder | Let users choose where merged FIT files are saved | ✓ |
| Database reset | "Clear all exercise mappings" button | ✓ |
| Export filename pattern | Let users customize the output filename | ✓ |

**User's choice:** All four items selected.

---

## Timezone UX

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect + persist | Pre-fill with browser timezone (Intl.DateTimeFormat), save to Settings | ✓ |
| Persist only | Remember last-used timezone, no auto-detect | |
| Just move to Settings | Keep current behaviour, save default via Settings | |

**User's choice:** Auto-detect + persist.

---

## Polish Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Settings screen (new) | Build Settings with all 4 items | ✓ |
| Empty states | Library + History empty state copy | ✓ |
| Responsive layout | Smaller window / tablet support | |
| Error UX polish | Review and improve error banners | ✓ |

**User's notes:**
- "For Error UX and multiple exercise mapping, remember to use Playwright CLI and test to make sure it looks easy to fix for the user."
- "Also, the logo on the top left is very hard to see when we're on dark mode."

---

## Claude's Discretion

- Visual design of Settings screen (follow existing design token system)
- Whether output folder uses text input or OS file picker
- Export filename pattern syntax

## Deferred Ideas

- Monetization (revenue model, payment gating) — deferred until UI is satisfactory
- Responsive/mobile layout — not prioritized
