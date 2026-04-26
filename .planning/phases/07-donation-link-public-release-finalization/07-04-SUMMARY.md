---
plan: 07-04
phase: 07-hevy-import-ux-donation-link
status: complete
completed: 2026-04-26
---

# Plan 07-04 Summary — ROADMAP Update + Human Visual Checkpoint

## What was built

- ROADMAP.md Phase 7 entry updated with all 5 plan entries and D-01–D-09 requirements (Task 1 — already present from planning phase, verified correct)
- Human visual checkpoint completed and approved by user

## Human verification result: APPROVED

All Phase 7 UI confirmed working in browser:

**Upload screen:**
- Cache banner appears after first upload showing workout count + date
- "Use cached export" transitions to CACHED state, hides CSV drop zone
- "Upload new instead" restores drop zone
- Hevy API section shows "Open Settings" when no key; "API READY + Fetch" when key present

**Settings screen:**
- HEVY API [BETA] card with disclaimer, API key input, Test connection button
- CSV CACHE WARNING number field inside OUTPUT FOLDER card (default 7 days)
- All existing settings unchanged

**Topbar donation (post-checkpoint additions, also approved):**
- "Donate" labelled orange pill container with ₿ BTC and Ξ ETH buttons between nav and theme toggle
- Clicking either opens a centered modal with server-generated QR code (330×330px PNG), full address, copy button
- ETH modal includes ERC-20 note
- Font readability improved throughout: ink-3 → ink-2/ink, +1px font sizes

**Additional changes made during checkpoint:**
- `DONATION_URL` replaced with `BTC_ADDRESS` + `ETH_ADDRESS` constants in app.py
- `/api/donation/qr/{btc,eth}` endpoints added (Python qrcode library, 330px PNG)
- Brand "StrengthSync /v1.0" → "StrengthSync" (v1.0 removed)
- README.md "Support the project" section added with both addresses + ERC-20 note
- qrcode[pil] added to requirements.txt

## Test suite

72/72 tests GREEN (67 original + 5 Phase 7 stubs)

## Self-Check: PASSED
