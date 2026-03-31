# BTC Monitor

A BTC indicator dashboard with a static-data pipeline designed for reliable deployment on GitHub + Vercel.

## What It Tracks (Core-6 V2)

- `BTC Price / 200W-MA` (computed)
- `BTC Price / Realized Price` (computed)
- `Reserve Risk`
- `STH-SOPR`
- `STH-MVRV`
- `Puell Multiple`

V2 scoring:

- per-indicator score: `0 / 1 / 2`
- short-term group de-correlation: `STH-SOPR` + `STH-MVRV` are merged as one scoring dimension (`max(scoreSthSopr, scoreSthMvrv)`)
- no-lookahead thresholds: `Reserve Risk` / `STH-SOPR` / `STH-MVRV` use rolling quantile thresholds computed only from past data
- Reserve Risk replacement: when Reserve Risk becomes stale, `LTH-MVRV` and `MVRV Z-Score` replace that scoring dimension automatically
- total score: `signalScoreV2` (grouped baseline `0..10`, dynamic max available in `maxSignalScoreV2`)
- confirmation flag: `signalConfirmed3d` (3-day confirmation)

## Project Structure

- `fetch_btc_indicators_history_files.py`: data fetch + transform script
- `validate_btc_data_quality.py`: JSON data quality gate
- `app/public/btc_indicators_history.json`: frontend historical dataset
- `app/public/btc_indicators_history_light.json`: lightweight recent-history dataset (default frontend load)
- `app/public/btc_indicators_latest.json`: frontend latest snapshot
- `app/public/btc_indicators_manifest.json`: data manifest for observability
- `app/`: Vite + React frontend
- `tests/`: Python unit tests for data pipeline logic
- `.github/workflows/update-btc-data.yml`: scheduled auto-update workflow

## Data Flow

1. Script fetches historical series from `charts.bgeometrics.com/files/*.json`.
2. Script computes derived ratios and Core-6 V2 signal/score fields (with grouped short-term cohort scoring).
3. Script writes full + light history, latest snapshot, and manifest JSON files.
4. Data quality validator checks structural/incremental consistency.
5. GitHub Actions runs on schedule and commits updated JSON.
6. Vercel redeploys from GitHub and serves fresh data.

## Run Locally

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Generate frontend JSON + tabular files:

```bash
python fetch_btc_indicators_history_files.py --output-dir . --file-prefix btc_indicators_from_files
```

Generate only frontend JSON (used in CI automation):

```bash
python fetch_btc_indicators_history_files.py --skip-tabular
```

Reserve Risk stale handling (recommended when upstream is stale):

```bash
python fetch_btc_indicators_history_files.py --skip-tabular --reserve-risk-disable-lag-days 30
```

Run data quality validation:

```bash
python validate_btc_data_quality.py \
  --current-history app/public/btc_indicators_history.json \
  --current-latest app/public/btc_indicators_latest.json \
  --max-indicator-lag-days 21
```

Note:

- When `reserveRisk` source-date lag exceeds `--reserve-risk-disable-lag-days` (default `30`), the pipeline first tries replacement scoring from `LTH-MVRV` / `MVRV Z-Score`; only when replacement is unavailable does it reduce active dimensions.
- Source mode metadata is written to `reserveRiskSourceMode`, `reserveRiskReplacementActive`, and `inactiveIndicators` in latest/history outputs.

Run frontend:

```bash
cd app
npm install
npm run dev
```

Run frontend tests:

```bash
cd app
npm run test
```

## Automation

The workflow `.github/workflows/update-btc-data.yml` runs every 6 hours and also supports manual trigger (`workflow_dispatch`).

It will:

1. run the fetch script
2. run quality checks
3. update `app/public` JSON files
4. auto-commit/push when data changes
