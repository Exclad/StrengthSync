# Technology Stack

**Project:** Garmin-Hevy Workout Sync
**Researched:** 2026-04-20
**Confidence note:** External tool access (WebSearch, WebFetch, Bash/Context7 CLI) was unavailable during this research session. All findings are from training data (cutoff August 2025) plus inspection of the local sample files. Confidence levels are marked honestly throughout. **Verify versions against PyPI before pinning in requirements.txt.**

---

## The Critical Decision: FIT Write Library

This is the make-or-break choice for the entire project. Writing valid FIT files is harder than reading them. The three candidates:

### Candidate 1: fitparse

- **What it is:** The most widely used Python FIT reader. Pure-Python, parses binary FIT messages into Python objects.
- **FIT READ support:** Yes, comprehensive. Handles all standard message types, compressed timestamps, developer fields.
- **FIT WRITE support:** NO. fitparse is read-only. It has never supported writing FIT files. The project explicitly scopes itself to parsing.
- **Last known active development:** fitparse 1.2.0 was the last stable release; maintenance activity has been low since ~2022.
- **Verdict:** Use for reading in a pinch, but do NOT plan to use for output. You will need a second library for writes.
- **Confidence:** HIGH (well-documented limitation, consistent across all community references)

### Candidate 2: garmin-fit-sdk (official Garmin SDK)

- **What it is:** Garmin's officially released Python SDK, generated from the FIT Protocol specification. Available as `garmin-fit-sdk` on PyPI.
- **FIT READ support:** Yes. Decodes FIT files to Python dicts/objects.
- **FIT WRITE support:** UNCERTAIN — this is the critical unknown flagged in PROJECT.md.
  - The SDK is auto-generated from the FIT SDK and mirrors the official C/C++/Java SDKs.
  - The official FIT SDK (non-Python) supports encoding (writing). Whether the Python bindings expose an Encoder class is NOT confirmed from training data.
  - The Python SDK was released more recently than fitparse and community usage examples are predominantly read-focused.
  - **Action required:** Before committing to this library, verify `from garmin_fit_sdk import Encoder` (or equivalent) actually exists in the installed package. Check the GitHub repo at `https://github.com/garmin/fit-python-sdk` for an `encoder.py` or `encode` submodule.
- **If write IS supported:** This becomes the top recommendation. Official Garmin SDK means the output binary format will match what Garmin Connect expects exactly.
- **If write is NOT supported:** Do not use this library for the write path.
- **Confidence for read:** MEDIUM-HIGH. **Confidence for write:** LOW (unverified).

### Candidate 3: fit-tool

- **What it is:** A less-known third-party Python library explicitly designed to both read AND write FIT files.
- **PyPI package:** `fit-tool`
- **FIT READ support:** Yes.
- **FIT WRITE support:** YES — this is the library's primary differentiator. It exposes a `FitFile` builder API where you construct messages and serialize them to binary. Community examples exist showing strength workout FIT file construction.
- **Format validity:** fit-tool produces valid FIT files that Garmin Connect accepts, based on community reports as of 2024. However, it is third-party, meaning edge cases in the FIT spec (developer fields, compressed timestamps) may not be handled as reliably as an official SDK.
- **Maintenance:** Active as of mid-2024, smaller community than fitparse.
- **Confidence:** MEDIUM (write support confirmed from multiple community sources; exact version and continued maintenance post-August 2025 unverified)

### Recommendation: fit-tool for write path, with verification gate

**Use fit-tool as the primary library for both reading and writing.** This keeps a single library on the FIT path, avoids the dual-library complexity of fitparse (read) + something else (write), and fit-tool's write support is the most clearly documented among the three options.

**However:** Before writing any application code, run this validation spike (Phase 1, Day 1):

```python
# validation_spike.py — run against GarminHevyMerge/original_garmin.fit
from fit_tool.fit_file import FitFile
from fit_tool.profile.messages.file_id_message import FileIdMessage

# 1. Parse the real Garmin FIT file
fit = FitFile.from_file('GarminHevyMerge/original_garmin.fit')
for record in fit.records:
    print(record.message)

# 2. Construct a minimal FIT file and write it
# 3. Upload to Garmin Connect manually and confirm acceptance
# If this fails → pivot to garmin-fit-sdk (if encoder exists) or investigate python-fitparse + manual binary encoding
```

**If fit-tool write produces files Garmin Connect rejects:** Escalate to the garmin-fit-sdk encoder (verify it exists first). The official SDK is most likely to produce spec-compliant output.

---

## Recommended Stack

### Core FIT Processing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| fit-tool | latest (verify on PyPI) | Read AND write FIT files | Only well-documented Python lib with both read+write; single dependency on critical path |
| fitparse | 1.2.0 | Fallback read-only parser if fit-tool parse has gaps | Battle-tested parser; use only if fit-tool read proves incomplete |

**Note:** Do NOT install both as primary parsers. Pick fit-tool. Keep fitparse as a listed alternative in comments only if fit-tool read is confirmed to handle the sample file fully.

### CSV Parsing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pandas | 2.x | Parse Hevy CSV exports | The Hevy CSV (confirmed from sample file) has quoted fields, mixed datetime strings ("Apr 17, 2026, 5:46 PM"), and optional columns. pandas `read_csv` with `parse_dates` handles this more robustly than stdlib csv. |

**Alternative:** Python stdlib `csv` module. Acceptable if you want zero dependencies on the parse path, but the Hevy datetime format ("Apr 17, 2026, 5:46 PM") requires manual parsing either way. pandas is the pragmatic choice.

### Web Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Flask | 3.x | Local web server, file upload/download endpoints | **Flask over FastAPI for this project.** Rationale below. |

**Flask vs FastAPI — recommendation: Flask**

- This is a local tool with 2-3 endpoints (upload FIT, upload CSV, download result, maybe a mapping UI endpoint). There is no async I/O benefit: file parsing is CPU-bound and synchronous, SQLite access is synchronous, the user is a single person running locally.
- FastAPI's value proposition (async, automatic OpenAPI, Pydantic validation) is overhead without payoff here. You would spend time configuring Pydantic models for what is effectively a 3-route app.
- Flask 3.x is production-stable, has `request.files` for multipart upload that works with zero boilerplate, and the entire community is familiar with it.
- Flask's `send_file()` for the FIT download response is one line.
- **Use FastAPI if:** Phase 3 Hevy API integration requires async OAuth2 flows that block. At that point, consider migrating the two new async endpoints or wrapping them in `asyncio.run()` inside Flask.

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SQLite (via Python stdlib sqlite3) | stdlib | Store exercise name mappings | No ORM needed. The schema is one table: `(hevy_name TEXT, garmin_name TEXT, confirmed BOOLEAN)`. Direct sqlite3 calls are 10 lines of code. |

**SQLAlchemy alternative:** Only warranted if Phase 2 mapping database grows into multiple tables with joins. Start without it.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytz or zoneinfo | stdlib (zoneinfo, Python 3.9+) | Timezone conversion for workout matching | Garmin timestamps are UTC epoch; user specifies local timezone (e.g., "Asia/Singapore"). Use `zoneinfo.ZoneInfo` (Python 3.9+ stdlib, no install needed). |
| python-dateutil | 2.x | Parse Hevy's non-ISO datetime strings | "Apr 17, 2026, 5:46 PM" is not ISO 8601. `dateutil.parser.parse()` handles it. If using pandas, `pd.to_datetime()` with `infer_datetime_format=True` may suffice. |
| Jinja2 | bundled with Flask | Template rendering for the web UI | Flask includes Jinja2. No separate install. |

### Dev / Tooling

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest | 7.x+ | Unit tests for merge logic | The merge algorithm (timestamp matching, exercise mapping) is the core of the app. Test it thoroughly, independent of the web layer. |
| black | latest | Code formatting | Consistency; no config needed. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| FIT read+write | fit-tool | garmin-fit-sdk | garmin-fit-sdk write support unconfirmed in Python bindings; if confirmed, it becomes equal or preferred |
| FIT read+write | fit-tool | Manual binary encoding against FIT spec | The FIT binary format (CRC, message definitions, endianness) is error-prone to hand-implement. Only resort to this if both libraries fail. |
| Web framework | Flask | FastAPI | No async I/O in this app; FastAPI overhead without payoff for a local 3-route tool |
| Web framework | Flask | Django | Massive overkill for a local single-user tool with 3 endpoints |
| CSV parsing | pandas | stdlib csv | Hevy datetime format requires non-trivial parsing; pandas is more ergonomic |
| ORM | None (raw sqlite3) | SQLAlchemy | One-table schema doesn't justify an ORM |
| Timezone | zoneinfo (stdlib) | pytz | pytz is deprecated in favor of zoneinfo for Python 3.9+; no install needed |

---

## Installation

```bash
# Core runtime
pip install fit-tool flask pandas python-dateutil

# Dev dependencies
pip install pytest black

# Verify fit-tool write support immediately after install:
python -c "from fit_tool.fit_file import FitFile; print('fit-tool import OK')"
```

**requirements.txt starting point (pin after validation spike):**
```
fit-tool>=0.9       # verify latest version on PyPI — UNVERIFIED as of research date
flask>=3.0
pandas>=2.0
python-dateutil>=2.8
```

---

## Version Verification Required

The following versions were NOT confirmed against live PyPI during this research session (all external network tools were unavailable). **Before writing requirements.txt, run:**

```bash
pip index versions fit-tool
pip index versions flask
pip index versions pandas
pip index versions garmin-fit-sdk   # also check if encoder/write support exists
```

And verify fit-tool's GitHub README confirms FIT write support is still maintained.

---

## Sources

- Training data (cutoff August 2025): fitparse documentation, fit-tool GitHub README, garmin-fit-sdk PyPI page, Flask 3.x changelog
- LOCAL INSPECTION: `GarminHevyMerge/original_hevy.csv` — confirmed datetime format "Apr 17, 2026, 5:46 PM", column schema (title, start_time, end_time, exercise_title, set_index, weight_kg, reps, rpe, etc.)
- PROJECT.md context: confirmed Python 3.9+ target, Flask/FastAPI decision pending, SQLite for mappings
- CONFIDENCE CAVEAT: garmin-fit-sdk Python write support is LOW confidence — must verify before architecture commits to it
