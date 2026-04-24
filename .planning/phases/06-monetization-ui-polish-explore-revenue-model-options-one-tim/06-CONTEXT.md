# Phase 6: Monetization + UI Polish - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver UI polish and a new Settings screen. The app is functionally complete after Phase 5 — Phase 6 tightens the experience: adds Settings (timezone default, output folder, DB reset, export filename), improves timezone UX with browser auto-detect, fixes dark-mode logo visibility, adds empty states to Library and History, and polishes error UX. Monetization is explicitly deferred — it will be discussed in a follow-up after the user is satisfied with full UI and functionality.

</domain>

<decisions>
## Implementation Decisions

### Settings Screen (new screen)
- **D-01:** Build a new Settings screen accessible via the nav rail (add "Settings" tab alongside Sync / Library / History).
- **D-02:** Settings screen contains four items:
  1. **Timezone default** — saved default IANA timezone; pre-populates the Upload screen's timezone picker. Persisted to `localStorage` (no server-side user profile needed).
  2. **Output folder** — let users specify where merged FIT files are saved on disk (currently temp + re-downloadable from History).
  3. **Database reset** — "Clear all exercise mappings" button with confirmation. Calls a new `POST /api/map/reset` (or similar) endpoint that truncates the SQLite mappings table.
  4. **Export filename pattern** — let users customize the merged FIT output filename (e.g. include date, workout name). Provide a live preview of the rendered filename.

### Timezone UX
- **D-03:** On the Upload screen, pre-fill the timezone `<select>` using `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser auto-detect) when no saved default exists.
- **D-04:** When a user completes a sync, persist the used timezone to `localStorage` as the new default (and sync to Settings). No re-picking each session.
- **D-05:** Settings screen shows the saved timezone default with the same searchable `<select>` UI for manual override.

### Dark Mode — Logo Visibility
- **D-06:** The brand mark ("S" logo) in the topbar is invisible or very low-contrast in dark mode. Fix: adjust the brand mark's color/background so it is clearly visible in both `[data-theme="light"]` and `[data-theme="dark"]`. Inspect and fix in `templates/index.html` CSS tokens or `shell.jsx` inline styles.

### Empty States
- **D-07:** Library screen — when no mappings exist yet, show a friendly empty state: copy like "No exercise mappings saved yet. Complete a sync and your confirmed mappings will appear here." with a CTA to go to Sync.
- **D-08:** History screen — when no exports exist yet, show: "No merged files yet. Complete a sync and your downloads will appear here." with a CTA to go to Sync.

### Error UX Polish
- **D-09:** Review and improve all user-facing error banners across the 5 sync screens for tone, specificity, and retry affordance. Errors must be actionable — each message should tell the user exactly what went wrong and what to do next.
- **D-10:** Exercise mapping screen specifically: when an exercise is UNRESOLVED, the path to resolving it must be obviously visible. Improve affordance if needed (clearer CTA, better visual weight on the "Search all Garmin exercises" escape hatch).
- **D-11:** Use Playwright CLI to test error UX and exercise mapping UX before marking this phase complete. Screenshots must confirm the UI looks clear and fixable to a real user. See `.claude/projects/-workspace-GarminHevyMerge/memory/` for Playwright setup notes.

### Monetization
- **D-12:** Monetization is **deferred** — not in scope for this phase. No payment code, no license gating, no revenue model implementation. Will be discussed and planned separately once the user is satisfied with full UI and functionality.

### Claude's Discretion
- Exact visual design of the Settings screen — follow the existing design token system (CSS variables, Inter Tight + JetBrains Mono, chip/card patterns from other screens)
- Whether "output folder" setting is a text input or OS file picker (OS file picker requires a backend endpoint; text input is simpler — choose based on what's feasible with Flask's `webbrowser`-style local integration)
- Export filename pattern syntax (e.g. `{date}_{workout_name}.fit` vs a simpler date-only option)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing UI implementation
- `static/src/shell.jsx` — nav structure, topbar, theme toggle, page routing
- `static/src/screen_library.jsx` — Library screen (full CRUD for mappings)
- `static/src/screen_history.jsx` — History screen (list + download)
- `templates/index.html` — CSS design tokens, dark/light theme vars, font imports
- `static/src/app.jsx` — top-level React app, state, page/step routing

### Backend routes (existing)
- `app.py` lines 369–410 — `/api/mappings`, `/api/map/delete`, `/api/history`, `/api/history/download`

### Playwright testing
- `/root/.claude/projects/-workspace-GarminHevyMerge/memory/feedback_playwright_cli_usage.md` — setup guide, known issues, working script template

### Phase 5 context (design system decisions)
- `.planning/phases/05-web-ui-deployment/05-CONTEXT.md` — D-01 through D-24 are locked; follow all design decisions (CSS tokens, React CDN stack, error banner patterns)

No external ADRs — all design decisions carried forward from Phase 5 CONTEXT.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shell.jsx` Shell component: adding a "Settings" tab is a 1-line change to the nav array `[["sync","Sync"],["library","Library"],["history","History"]]`
- CSS design tokens in `templates/index.html`: all spacing, color, typography variables already defined — Settings screen should use them without new tokens
- `screen_library.jsx` and `screen_history.jsx`: pattern for `useState` + `useEffect` + fetch can be replicated for Settings persistence

### Established Patterns
- Empty state pattern: no existing component, but the `chip neutral mono` + eyebrow + display heading pattern from other screens is the right approach
- Error banners: `chip.bad` + `IconWarn` from Phase 5 D-18 — extend this for improved messaging
- localStorage: currently used for theme (`theme`) and step state — extend for `savedTimezone` and Settings values

### Integration Points
- New `POST /api/map/reset` endpoint needed in `app.py` for DB reset button
- New `GET/POST /api/settings` or localStorage-only for Settings persistence (localStorage preferred — no server state needed for timezone + filename pattern)
- Output folder setting may need a new Flask endpoint if OS picker is used

</code_context>

<specifics>
## Specific Ideas

- Logo dark-mode fix: the brand mark is specifically called out as "very hard to see" on dark mode — this is a high-priority visual bug, not optional polish
- Playwright testing: not optional — user explicitly requires Playwright CLI screenshots to verify error UX and exercise mapping UX before the phase is considered done
- Exercise mapping screen: the "path to resolving UNRESOLVED exercises" must be obviously visible — if it currently requires hunting, improve the affordance

</specifics>

<deferred>
## Deferred Ideas

### Monetization (explicitly deferred)
- Revenue model exploration (one-time purchase, subscription, freemium) — will be discussed after user is satisfied with full UI and functionality
- No payment gating, license keys, or Gumroad/Stripe integration in Phase 6

### Not selected in this discussion
- Responsive/mobile layout — not prioritized for Phase 6
- Direct Garmin Connect API upload — v2 deferred item from earlier phases

</deferred>

---

*Phase: 06-monetization-ui-polish-explore-revenue-model-options-one-tim*
*Context gathered: 2026-04-24*
