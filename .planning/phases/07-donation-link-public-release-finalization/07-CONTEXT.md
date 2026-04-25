# Phase 7: Hevy Import UX + Donation Link - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Make Hevy data input easier for repeat users. Two new paths sit alongside the existing CSV upload:
1. **Persistent CSV cache** — the app remembers the last uploaded Hevy CSV so users don't re-upload every session. A cache banner appears on the Upload screen when a cached file exists.
2. **Hevy API beta** — users with a Hevy API key can fetch workout data directly, skipping the export/upload step entirely. Clearly marked beta with a disclaimer.

Minor addition: a donation link folded into the Settings screen or footer.

Phase 7 is renamed from "Donation link + public release finalization" to reflect actual scope.

</domain>

<decisions>
## Implementation Decisions

### Upload Screen — Hevy Section Layout
- **D-01:** Progressive disclosure layout. The Hevy section on the Upload screen remains unchanged for new users. When a cached CSV exists (`data/hevy_cache.csv`), a cache banner appears above the CSV drop zone showing the workout count, date, and freshness. The Hevy API option appears below the CSV drop zone as a secondary option. CSV upload is always available as an escape hatch.

### CSV Cache — Banner and Staleness
- **D-02:** Cache banner displays: workout count + last-updated date + an age warning chip. Example: "47 workouts · Apr 22 · ⚠ May be outdated" (chip appears when cache age exceeds the configured threshold).
- **D-03:** Age warning threshold defaults to 7 days. User-configurable in Settings — add a "CSV cache freshness warning" field (number input, days) to the existing Settings screen. Store in `localStorage['ss-cache-warning-days']`.
- **D-04:** Cache stored at `data/hevy_cache.csv` on disk (persistent across server restarts). On `/api/upload`, save a copy there after successful parse. Add a `GET /api/hevy/cache-status` endpoint returning `{ exists, workout_count, last_updated }` for the Upload screen banner.

### Hevy API (Beta)
- **D-05:** New "HEVY API (Beta)" group in the Settings screen. Contains:
  - Text input for API key
  - "Test connection" button — calls a new `GET /api/hevy/test` endpoint, shows green "Connected" or red "Failed" chip
  - API key stored in `localStorage['ss-hevy-api-key']`
  - Beta badge + disclaimer: "Hevy's API is unofficial and may change without notice"
- **D-06:** API fetches full workout history. Backend converts the API response into the same `HevyWorkout` dataclass format the CSV parser produces — all downstream matching/merge logic unchanged.
- **D-07:** Failure fallback chain: API fails → use cached CSV if available → if no cache exists, show error prompting user to upload a CSV manually. Error message distinguishes between bad key, network failure, and rate limit where possible.

### Donation Link
- **D-08:** Add a "Support this project" link as a minor task — placed in the Settings screen (e.g. a small footer line below the Danger Zone) or in the app's topbar/footer. Platform (Ko-fi, GitHub Sponsors, PayPal.me) to be decided by user before implementation — add a placeholder `DONATION_URL` config constant that can be swapped in. If user hasn't decided, implement the UI slot with a `#` href and a TODO comment.

### Phase Rename
- **D-09:** Update ROADMAP.md Phase 7 goal to "Hevy Import UX + Donation Link" — persistent CSV cache, Hevy API beta, and donation link.

### Claude's Discretion
- Exact visual treatment of the cache banner (chip vs inline text vs card)
- Whether "Test connection" result persists between Settings visits or re-tests on each open
- Error message copy for each failure mode in the fallback chain
- Whether the cache banner on Upload auto-uses the cache (no click needed) or requires a "Use this" button click

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Upload screen
- `static/src/screen_upload.jsx` — current Hevy upload UI, state shape, `handleContinue` flow
- `app.py` lines 74–130 — `/api/upload` route, how FIT + CSV are saved to tempfile, session keys

### Settings screen
- `static/src/screen_settings.jsx` — existing settings groups pattern, localStorage keys, modal pattern for Danger Zone
- `static/src/shell.jsx` — nav structure (Settings tab already wired)

### Hevy parsing
- `hevy_parser.py` — `parse_hevy_csv()` signature and `HevyWorkout` dataclass — API response must produce the same output
- `models.py` — `HevyWorkout` dataclass definition

### Design tokens
- `templates/index.html` — CSS variables, chip classes (`chip good`, `chip warn`, `chip bad`), btn classes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `POST /api/upload` already saves `hevy_csv` to `tempfile.mkdtemp()` — extend to also copy to `data/hevy_cache.csv`
- `chip warn` CSS class already exists — use for age warning on cache banner
- Settings screen `DANGER ZONE` pattern (card + confirm modal) — reuse for API key test button feedback
- `localStorage` pattern established for all Settings values — consistent to store API key same way

### Established Patterns
- Flask `session` stores file paths — `hevy_csv_path` is the key downstream routes read
- All Settings values use `localStorage` with `ss-` prefix keys
- Error chips use `chip good` / `chip bad` / `chip warn` classes

### Integration Points
- Upload screen: add cache-status check in the timezones `useEffect` (already runs on mount) or a separate `useEffect`
- Settings screen: add new group between OUTPUT FOLDER and DANGER ZONE
- `app.py`: new routes `/api/hevy/cache-status`, `/api/hevy/test`, `/api/hevy/workouts`
- `hevy_parser.py`: new function `parse_hevy_api_response(data)` → same `list[HevyWorkout]` output

</code_context>

<specifics>
## Specific Ideas

- Cache banner example copy: "47 workouts · Apr 22 · ⚠ May be outdated" — chip only shows when age > threshold
- API disclaimer: "Hevy's API is unofficial and may change without notice" — shown inline in the Settings group, not as a modal
- Fallback error copy when cache missing + API fails: "Hevy API unavailable and no cached export found. Export your workouts from Hevy Settings → Export and upload the CSV."

</specifics>

<deferred>
## Deferred Ideas

- Donation platform selection (Ko-fi vs GitHub Sponsors vs PayPal.me) — user to decide separately; Phase 7 implements the UI slot with a placeholder URL
- Hevy OAuth2 / Pro API integration — originally in PROJECT.md Phase 3; still deferred
- Date-range filter for API fetch — can be added in a future phase if API responses grow large
- Configuring N-workouts limit for API fetch

</deferred>

---

*Phase: 07-hevy-import-ux-donation-link*
*Context gathered: 2026-04-25*
