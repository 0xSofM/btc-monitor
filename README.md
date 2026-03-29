# BTC Monitor

A BTC indicator dashboard with a static-data pipeline designed for reliable deployment on GitHub + Vercel.

## What It Tracks

- `BTC Price / 200W-MA` (computed)
- `MVRV Z-Score`
- `LTH-MVRV`
- `Puell Multiple`
- `NUPL`

## Project Structure

- `fetch_btc_indicators_history_files.py`: data fetch + transform script
- `app/public/btc_indicators_history.json`: frontend historical dataset
- `app/public/btc_indicators_latest.json`: frontend latest snapshot
- `app/`: Vite + React frontend
- `.github/workflows/update-btc-data.yml`: scheduled auto-update workflow

## Data Flow

1. Script fetches historical series from `charts.bgeometrics.com/files/*.json`.
2. Script computes `BTC Price / 200W-MA` and signal flags.
3. Script writes frontend JSON files in `app/public`.
4. GitHub Actions runs on schedule and commits updated JSON.
5. Vercel redeploys from GitHub and serves fresh data.

## Run Locally

Install Python dependencies:

```bash
pip install pandas requests openpyxl
```

Generate frontend JSON + tabular files:

```bash
python fetch_btc_indicators_history_files.py --output-dir . --file-prefix btc_indicators_from_files
```

Generate only frontend JSON (used in CI automation):

```bash
python fetch_btc_indicators_history_files.py --skip-tabular
```

Run frontend:

```bash
cd app
npm install
npm run dev
```

## Automation

The workflow `.github/workflows/update-btc-data.yml` runs every 6 hours and also supports manual trigger (`workflow_dispatch`).

It will:

1. run the fetch script
2. update `app/public` JSON files
3. auto-commit/push when data changes

