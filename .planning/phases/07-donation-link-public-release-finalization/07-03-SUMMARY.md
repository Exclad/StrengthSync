---
phase: 07-hevy-import-ux-donation-link
plan: "03"
subsystem: frontend
tags: [hevy-api, settings-ui, donate, qr-code, cache-warning, react]
dependency_graph:
  requires: [07-01]
  provides: [frontend-phase7-wave2]
  affects: [static/src/screen_settings.jsx]
tech_stack:
  added: []
  patterns: [react-useref-qrcode, localStorage-persistence, fetch-api-config, chip-feedback-pattern]
key_files:
  created: []
  modified:
    - static/src/screen_settings.jsx
decisions:
  - "QR codes rendered via window.QRCode useEffect triggered on btcAddress/ethAddress state change — ensures refs are mounted before render attempt"
  - "DONATE card conditionally rendered only when btcAddress || ethAddress is truthy — graceful fallback if /api/config unreachable"
  - "apiTestResult resets to null on each new test click — chip clears between attempts without requiring screen remount"
  - "CSV CACHE WARNING placed inside OUTPUT FOLDER card separated by a divider — groups related output configuration together"
  - "HEVY API card inserted between OUTPUT FOLDER and DANGER ZONE as Group E per plan spec"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-26T07:00:00Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 7 Plan 03: Settings UI — Hevy API, CSV Cache Warning, Donate Card Summary

Settings screen extended with HEVY API BETA card (Group E), CSV CACHE WARNING section inside OUTPUT FOLDER card (Group C extension), and DONATE card with BTC/ETH QR codes fetched from /api/config.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Group E (Hevy API), Group C extension, and donation footer to screen_settings.jsx | dc4b10f | static/src/screen_settings.jsx |

## Results

- 169 lines added to screen_settings.jsx
- All 28 acceptance criteria verified present in file
- All existing Settings functionality preserved (Groups A, B, D unchanged)

### Features Delivered

- **Group E — HEVY API BETA card**: API key text input (onBlur → `localStorage['ss-hevy-api-key']`), "Test connection" button calling `POST /api/hevy/test`, result chips: CONNECTED (good), INVALID KEY / UNREACHABLE / RATE LIMITED (bad), button disabled when key is empty
- **Group C extension — CSV CACHE WARNING**: Number input (min 1, max 365, default 7) inside OUTPUT FOLDER card, onBlur saves to `localStorage['ss-cache-warning-days']`, separated from folder path by a divider line
- **DONATE card**: Conditional on `btcAddress || ethAddress` from `GET /api/config`; BTC and ETH rows each with 120×120 QR code (window.QRCode), monospace address display, copy-to-clipboard button with 2s "Copied!" feedback, ETH ERC-20 token note; card hidden if /api/config unreachable

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to live endpoints (/api/config, /api/hevy/test).

## Threat Flags

None — threat model mitigations from plan are implemented:
- T-07-09: API key input type="text" (intentional, per UI-SPEC)
- T-07-10: apiTestResult only drives chip display, no DOM injection

## Self-Check: PASSED

- static/src/screen_settings.jsx modified: FOUND
- Commit dc4b10f exists: CONFIRMED
- hevyApiKey state: FOUND (line 19)
- cacheWarningDays state: FOUND (line 20)
- apiTestResult state: FOUND (line 23)
- btcAddress / ethAddress state: FOUND (lines 25-26)
- btcQrRef / ethQrRef refs: FOUND (lines 29-30)
- ss-hevy-api-key: FOUND (line 19)
- ss-cache-warning-days: FOUND (line 21)
- HEVY API + BETA: FOUND (lines 274-275)
- CSV CACHE WARNING: FOUND (line 253)
- DONATE card: FOUND (line 361)
- Bitcoin (BTC): FOUND (line 368)
- Ethereum / ERC-20: FOUND (line 387)
- ERC-20 tokens: FOUND (line 397)
- window.QRCode: FOUND (lines 70-80)
- navigator.clipboard.writeText: FOUND (lines 375, 394)
- fetch('/api/hevy/test'): FOUND (line 303)
- fetch('/api/config'): FOUND (line 62)
- IconHeart: FOUND (line 360)
- CONNECTED / INVALID KEY: FOUND (lines 321, 325)
- DANGER ZONE: FOUND (line 336)
</content>
</invoke>