# StrengthSync &nbsp; [![Donate BTC](https://img.shields.io/badge/Donate-Bitcoin-F7931A?logo=bitcoin&logoColor=white)](#support-the-project) [![Donate ETH](https://img.shields.io/badge/Donate-Ethereum-627EEA?logo=ethereum&logoColor=white)](#support-the-project)

**Merge Garmin FIT biometric data with Hevy strength training logs into a single enhanced FIT file — then upload it to Garmin Connect.**

Garmin records your heart rate, calories, and GPS during a workout but labels every set as a generic "strength" exercise. Hevy knows exactly which exercise you did, how many reps, and how much weight. StrengthSync combines both into one FIT file that Garmin Connect accepts — giving you rich exercise detail alongside real biometrics.

> All processing is local. Your files never leave your machine.

---

## Requirements

- **Python 3.9 or later** — [python.org/downloads](https://www.python.org/downloads/)
  - Windows: check **"Add Python to PATH"** during installation
  - macOS shortcut: `brew install python3`
- A Garmin `.fit` activity file (strength training activity exported from Garmin Connect)
- A Hevy CSV export — or a Hevy API key to fetch workouts directly

---

## Quick start

### Windows

1. **Download or clone** this repo
2. Double-click **`setup.bat`** — installs everything (first time only)
3. Double-click **`start.bat`** — launches the app and opens your browser

### macOS / Linux

1. **Clone** the repo:
   ```bash
   git clone https://github.com/Exclad/StrengthSync.git
   cd StrengthSync
   ```
2. **Run setup** (first time only):
   ```bash
   chmod +x setup.sh start.sh
   ./setup.sh
   ```
3. **Launch the app:**
   ```bash
   ./start.sh
   ```

The app opens automatically at **http://localhost:5000**

---

## How to use

### Step 1 — Export your files

**From Garmin Connect:**
1. Open [connect.garmin.com](https://connect.garmin.com)
2. Go to **Activities** → open your strength training workout
3. Click **⋯ → Export Original**
4. Save the `.fit` file

**From Hevy** (CSV export):
1. Open Hevy → **Settings → Export Workout Data → CSV**

**Or use the Hevy API** (Settings → Hevy API) to fetch workouts directly — no CSV needed.

---

### Step 2 — Upload

On the **Sync** screen:
- Drop your Garmin `.fit` file on the left
- Drop your Hevy CSV on the right — or click **"Use cached export"** if you've synced before, or **"Fetch from Hevy API"** if you have an API key set up in Settings
- Select your timezone (auto-detected from your browser)
- Click **Continue**

---

### Step 3 — Match workouts

The app finds the Hevy workout closest in time to your Garmin activity (within 30 minutes). If the match looks wrong, pick the correct Hevy workout manually.

---

### Step 4 — Map exercises

The app fuzzy-matches your Hevy exercise names to Garmin's exercise library. Each match shows a confidence score:

| Confidence | Colour | Action |
|------------|--------|--------|
| ≥ 70% | Green | Auto-accepted |
| < 70% | Amber | Review — pick from suggestions or search |
| No match | Grey | Search manually or skip |

Confirmed mappings are saved so you only map each exercise once across all future syncs.

---

### Step 5 — Preview & export

Review the side-by-side comparison of Garmin biometrics vs. Hevy exercise detail. Click **Export merged FIT** to download.

---

### Step 6 — Upload to Garmin Connect

1. Go to [connect.garmin.com](https://connect.garmin.com)
2. Click the **+** upload button (top right)
3. Drag the downloaded `merged.fit` file

---

## Settings

Click **Settings** in the top nav to configure:

| Setting | Description |
|---------|-------------|
| **Timezone Default** | Pre-fills the timezone on the Sync screen. Auto-detected from your browser. |
| **Export Filename** | Template for downloaded filenames. Use `{date}` and `{workout}` as placeholders. |
| **Output Folder** | Label for where files are saved (informational). |
| **CSV Cache Warning** | Show an OUTDATED warning when your cached Hevy export is older than N days (default 7). |
| **Hevy API (Beta)** | Paste your Hevy API key to fetch workouts directly without uploading a CSV each time. |
| **Danger Zone** | Clear all saved exercise mappings and start fresh. |

---

## Library & History

- **Library** — all your confirmed exercise mappings, searchable and editable
- **History** — all merged FIT files in the `output/` folder, re-downloadable anytime

---

## Project structure

```
StrengthSync/
├── setup.bat / setup.sh    # First-time setup (creates venv, installs deps)
├── start.bat / start.sh    # Launch the app
├── app.py                  # Flask web server + API routes
├── fit_parser.py           # Garmin FIT file reader
├── fit_generator.py        # FIT file writer + merge pipeline
├── hevy_parser.py          # Hevy CSV + API response parser
├── matcher.py              # Workout time-matching (timezone-aware)
├── mapper.py               # Exercise fuzzy-matching + DB lookup
├── database.py             # SQLite schema and queries
├── models.py               # Shared data models
├── requirements.txt        # Python dependencies
├── data/
│   ├── garmin_exercises.csv   # Garmin exercise enum database (~600 exercises)
│   └── hevy_cache.csv         # Cached Hevy export (auto-created after first sync)
├── static/src/                # React JSX components
└── templates/index.html       # Single-page app shell
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
| `qrcode[pil]` | Donation QR code generation |

---

## Limitations & known behaviour

- **Intensity minutes** — Garmin does not award intensity minutes to manually-uploaded FIT files regardless of heart rate data. This is a Garmin platform limitation.
- **Set timing** — Hevy does not record per-set timestamps. The merged file distributes set times linearly within the Garmin workout window.
- **Cardio exercises** — Treadmill, stair machine, and other cardio rows in the Hevy CSV are automatically skipped.
- **Single user** — Local single-user app. No login, no cloud sync.
- **Hevy API** — The Hevy API is unofficial and may change without notice. CSV export is always the reliable fallback.

---

## Troubleshooting

**"FIT file failed to parse"** — Re-export from Garmin Connect using **Export Original** (not GPX or CSV).

**"No Hevy workout found within 30 minutes"** — The workouts are more than 30 minutes apart. Use the manual match selector.

**"Session expired"** — Flask sessions expire after inactivity. Re-upload your files to start a new session.

**Mapping seems wrong** — Go to the Map step, click the exercise name, and search for the correct Garmin exercise. Changes save immediately.

**start.bat does nothing / closes immediately** — Make sure you ran `setup.bat` first. If Python isn't found, reinstall Python with **"Add Python to PATH"** checked.

---

## Support the project

StrengthSync is free and open source. If it saves you time, a small donation is appreciated — you can also click the **₿ BTC** or **Ξ ETH** buttons inside the app.

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
