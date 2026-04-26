---
status: complete
phase: 07-donation-link-public-release-finalization
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md]
started: 2026-04-26T00:00:00Z
updated: 2026-04-26T08:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Upload screen — no cache state
expected: With a fresh session (no prior Hevy upload), open the Upload screen. No cache banner should appear anywhere on the Hevy card. The Hevy API section should show an "Open Settings" link (not a Fetch button, because no API key is stored). The CSV drop zone is visible and the Continue button is disabled until a CSV is uploaded.
result: pass

### 2. Cache banner appears after upload
expected: Upload a Hevy CSV file and complete the workflow once. Then return to the Upload screen in the same session (or click back). A cache banner now appears inside the Hevy card showing the workout count and the date/time of the last cache. No OUTDATED chip appears since the cache was just written.
result: pass

### 3. "Use cached export" hides Hevy drop zone
expected: With a cache banner visible, click "Use cached export". The banner transitions to a CACHED chip state and the CSV drop zone disappears. The Continue button becomes available without re-uploading a CSV file.
result: pass

### 4. "Upload new instead" restores drop zone
expected: After clicking "Use cached export" (CACHED state active), click the "Upload new instead" link. The CSV drop zone reappears and the CACHED chip goes away, returning the banner to its original state.
result: pass

### 5. Hevy API key test connection — invalid key
expected: Open Settings → scroll to the HEVY API [BETA] card. Enter a clearly invalid API key (e.g. "badkey123") and click "Test connection". The button should show a loading/disabled state while testing, then display an INVALID KEY or UNREACHABLE chip (not a crash or blank response).
result: pass

### 6. Upload screen — API READY state when key saved
expected: After saving a Hevy API key in Settings (even an invalid one), return to the Upload screen. The Hevy API section should now show an "API READY" chip alongside a "Fetch from Hevy API" button — instead of the "Open Settings" link shown when no key is stored.
result: pass

### 7. CSV cache warning days field in Settings
expected: In Settings, inside the OUTPUT FOLDER card, find a "Cache warning after X days" (or similar label) number input with a default value of 7. Change it to a different number, click away (blur), and reload Settings. The new value persists.
result: pass

### 8. Topbar donation pills visible
expected: In the app topbar, between the navigation links and the theme toggle, an orange-accented "Donate" container is visible with two pills: one labelled ₿ BTC and one labelled Ξ ETH (or similar crypto symbols).
result: pass

### 9. BTC donation modal
expected: Click the BTC pill in the topbar. A centered modal opens containing: a large QR code (~330px), the full BTC address displayed in monospace, and a copy-to-clipboard button. Clicking the copy button briefly shows "Copied!" feedback then resets.
result: pass

### 10. ETH donation modal with ERC-20 note
expected: Click the ETH pill in the topbar. A centered modal opens with the ETH QR code, ETH address in monospace, copy button, and a note clarifying it accepts ERC-20 tokens (not just native ETH).
result: pass

### 11. DONATE card in Settings
expected: In Settings, scroll past the HEVY API card toward the bottom. A DONATE card is visible showing both BTC and ETH addresses with QR codes and copy-to-clipboard buttons (the same addresses as the topbar modals).
result: issue
reported: "DONATE card not found in Settings — only DANGER ZONE at bottom. Donation UI was implemented as topbar modal only (shell.jsx), not as a Settings card. The 07-03 plan specified a DONATE card in screen_settings.jsx with window.QRCode, but the 07-04 checkpoint replaced this with the /api/donation/qr PNG approach in shell.jsx without adding the card to Settings."
severity: minor

## Summary

total: 11
passed: 10
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Settings screen has a DONATE card showing BTC and ETH addresses with QR codes and copy buttons"
  status: failed
  reason: "User reported: DONATE card not found in Settings — only DANGER ZONE at bottom. Donation UI was implemented as topbar modal only (shell.jsx), not as a Settings card. The 07-03 plan specified a DONATE card in screen_settings.jsx with window.QRCode, but the 07-04 checkpoint replaced this with the /api/donation/qr PNG approach in shell.jsx without adding the card to Settings."
  severity: minor
  test: 11
  root_cause: "07-04 checkpoint added topbar pills + QR modal in shell.jsx as a design improvement, but the Settings DONATE card from 07-03 was never implemented in screen_settings.jsx — it ends with DANGER ZONE"
  artifacts:
    - path: "static/src/screen_settings.jsx"
      issue: "No DONATE card — file ends after DANGER ZONE (367 lines)"
    - path: "static/src/shell.jsx"
      issue: "DonateModal and DonateBtn implemented here (topbar only)"
  missing:
    - "Add DONATE card section to screen_settings.jsx after DANGER ZONE, reusing the /api/donation/qr endpoints already wired in shell.jsx"
