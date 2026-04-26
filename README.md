# StrengthSync

**Merge Garmin FIT biometric data with Hevy strength training logs into a single enhanced FIT file — then upload it to Garmin Connect.**

Garmin records your heart rate, calories, and GPS during a workout but labels every set as a generic "strength" exercise. Hevy knows exactly which exercise you did, how many reps, and how much weight. StrengthSync combines both into one FIT file that Garmin Connect accepts — giving you rich exercise detail alongside real biometrics.

---

## What it does

- Reads your Garmin `.fit` activity file (exported from Garmin Connect)
- Reads your Hevy workout CSV export
- Matches the two workouts by time
- Maps Hevy exercise names to Garmin exercise IDs (with fuzzy matching + a persistent library you can edit)
- Writes a merged `.fit` file with Garmin's biometrics and Hevy's exercise detail
- Uploads cleanly to Garmin Connect — tested and verified

All processing is local. Your files never leave your machine.

---

## Requirements

- Python 3.9 or later — [python.org/downloads](https://www.python.org/downloads/)
- A Garmin `.fit` activity file (strength training activity exported from Garmin Connect)
- A Hevy CSV export (`Settings → Export Workout Data`)

---

## Quick start

### 1. Clone the repo

```bash
git clone https://github.com/Exclad/StrengthSync.git
cd StrengthSync
```

### 2. Create and activate a virtual environment

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows (Command Prompt):**
```bat
python -m venv .venv
.venv\Scripts\activate.bat
```

**Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the app

```bash
python app.py
```

### 5. Open in your browser

```
http://localhost:5000
```

---

## Step-by-step usage

### Step 1 — Export your files

**From Garmin Connect:**
1. Open [connect.garmin.com](https://connect.garmin.com)
2. Go to **Activities** and open your strength training workout
3. Click the **⋯ menu → Export Original**
4. Save the `.fit` file

**From Hevy:**
1. Open Hevy → **Settings → Export Workout Data**
2. Choose **CSV** and save the file

### Step 2 — Upload

On the Sync screen, drop your `.fit` file into the left panel and your Hevy CSV into the right panel. Select the timezone you were working out in — the app will try to auto-detect it from your browser. Click **Continue**.

### Step 3 — Match workouts

The app finds the Hevy workout that is closest in time to your Garmin activity (within 30 minutes by default). If the match looks wrong, you can manually pick any workout from the list.

### Step 4 — Map exercises

The app fuzzy-matches your Hevy exercise names to Garmin's exercise library. Each match shows a confidence score:

- **High confidence (≥ 70%)** — auto-accepted, shown in green
- **Needs review (< 70%)** — shown in amber; pick the correct Garmin exercise from the suggestions or search
- **Unresolved** — no good match found; use the search to assign manually or skip to keep Garmin's original

Confirmed mappings are saved to a local database so you only map each exercise once across all future syncs.

### Step 5 — Preview & export

Review a side-by-side comparison of the original Garmin sets vs. the merged result (with Hevy reps, weight, and exercise names). Click **Export merged FIT** to download the file.

### Step 6 — Upload to Garmin Connect

1. Go to [connect.garmin.com](https://connect.garmin.com)
2. Click the **+** upload button (top right)
3. Drag the downloaded `merged.fit` file
4. Garmin Connect will import it with full exercise detail

---

## Settings

Click **Settings** in the nav bar to configure:

| Setting | Description |
|---------|-------------|
| **Timezone Default** | Pre-fills the timezone picker on the Sync screen. Auto-detected from your browser when not set. |
| **Export Filename** | Template for the downloaded filename. Use `{date}` and `{workout}` as placeholders. |
| **Output Folder** | Display label for where files are saved (informational). |
| **Danger Zone** | Clear all saved exercise mappings and start fresh. |

Settings are stored in your browser's localStorage — they persist across sessions but are device-specific.

---

## Exercise mapping library

The **Library** tab shows all your confirmed exercise mappings. You can search, change individual mappings, or delete them. The next time you sync a workout containing the same Hevy exercise name, the saved mapping is used automatically.

---

## History

The **History** tab lists all merged FIT files saved in the `output/` folder, with file size and export time. Click **Download** to re-download any previous merge.

---

## Project structure

```
StrengthSync/
├── app.py                  # Flask web server + API routes
├── fit_parser.py           # Garmin FIT file reader (fitparse)
├── fit_generator.py        # FIT file writer + merge pipeline
├── hevy_parser.py          # Hevy CSV parser
├── matcher.py              # Workout time-matching
├── mapper.py               # Exercise fuzzy-matching (rapidfuzz) + DB lookup
├── database.py             # SQLite schema and queries
├── models.py               # Shared data models
├── requirements.txt        # Python dependencies
├── data/
│   └── garmin_exercises.csv   # Garmin exercise enum database (~600 exercises)
├── static/
│   └── src/                   # React JSX components (loaded via Babel CDN)
└── templates/
    └── index.html             # Single-page app shell
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `flask` | Web server |
| `fitparse` | Reading Garmin FIT files |
| `fit-tool` | FIT file validation |
| `garmin-fit-sdk` | Writing FIT records (official Garmin encoder) |
| `pandas` | Hevy CSV parsing |
| `python-dateutil` | Timestamp parsing |
| `rapidfuzz` | Exercise name fuzzy matching |

---

## Limitations & known behaviour

- **Intensity minutes** — Garmin does not award intensity minutes to manually-uploaded FIT files regardless of heart rate data. This is a Garmin platform limitation.
- **Set timing** — Hevy does not record per-set timestamps. The merged file distributes set times linearly within the Garmin workout window, matching Garmin's original set count where possible.
- **Cardio exercises** — Treadmill, stair machine, and other cardio rows in the Hevy CSV are automatically skipped; they don't map to strength set records.
- **Single user** — This is a local single-user app. No login, no cloud sync.

---

## Troubleshooting

**"FIT file failed to parse"** — The uploaded file may not be a valid Garmin FIT file. Re-export from Garmin Connect using **Export Original** (not GPX or CSV).

**"No Hevy workout found within 30 minutes"** — The Garmin and Hevy workouts are more than 30 minutes apart in start time. Use the manual match selector to pick the correct Hevy workout.

**"Session expired"** — Flask sessions expire after inactivity. Re-upload your files to start a new session.

**Mapping seems wrong** — Go to the Map step, click the exercise name, and use the search box to find the correct Garmin exercise. Your change is saved immediately.

---

## Support the project

StrengthSync is free and open source. If it saves you time, a small donation is appreciated.

**Bitcoin (BTC)**
```
bc1qhjqappn6ere3239dqnzksuectktp62pdhu77qt
```

**Ethereum (ETH) / ERC-20 tokens**
```
0x2716b0D80465a98Ada440b0c440f43c23E1Bd717
```

> The ETH address accepts Ether and any ERC-20 token (USDC, USDT, DAI, etc.) on the Ethereum mainnet.

---

## License

MIT
