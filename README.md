# BTC Monitor

A BTC indicator dashboard with a static-data pipeline designed for reliable deployment on GitHub + Vercel.

## What It Tracks (Core-6 V4)

- `BTC Price / 200W-MA` (computed)
- `BTC Price / Realized Price` (computed)
- `Reserve Risk`
- `Puell Multiple`
- `STH-MVRV`
- `LTH-MVRV`

Auxiliary indicators:

- `STH-SOPR`
- `MVRV Z-Score`

V4 scoring:

- layered score: `valuationScore + triggerScore + confirmationScore`
- per-indicator score: `0 / 1 / 2`
- no-lookahead thresholds: `Reserve Risk` / `STH-SOPR` / `STH-MVRV` use rolling quantile thresholds computed only from past data
- Reserve Risk soft fallback: when Reserve Risk becomes stale, only `MVRV Z-Score` can provide a reduced-score fallback
- total score: `totalScoreV4` (dynamic max in `maxTotalScoreV4`)
- confidence fields: `signalConfidence`, `dataFreshnessScore`, `fallbackMode`, `staleIndicators`
- legacy rollback fields remain available: `signalScoreV2`, `maxSignalScoreV2`, `signalBandV2`
- confirmation flags: `signalConfirmed3dV4` and legacy `signalConfirmed3d`

## Project Structure

- `fetch_btc_indicators_history_files.py`: data fetch + transform script
- `validate_btc_data_quality.py`: JSON data quality gate
- `app/public/btc_indicators_history.json`: frontend historical dataset
- `app/public/btc_indicators_history_light.json`: lightweight recent-history dataset (default frontend load)
- `app/public/btc_indicators_latest.json`: frontend latest snapshot
- `app/public/btc_indicators_manifest.json`: data manifest for observability
- `app/public/btc_signal_events_v4.json`: event-level V4 backtest windows
- `app/`: Vite + React frontend
- `tests/`: Python unit tests for data pipeline logic
- `.github/workflows/update-btc-data.yml`: scheduled auto-update workflow

## Data Flow

1. Script fetches historical series from `charts.bgeometrics.com/files/*.json`.
2. Script computes derived ratios plus parallel `V2 legacy` and `V4 layered` signal fields.
3. Script archives current JSON outputs before overwrite, then writes full + light history, latest snapshot, manifest, and event files.
4. Data quality validator checks structural/incremental consistency.
5. GitHub Actions runs on schedule and commits updated JSON.
6. Vercel redeploys from GitHub and serves fresh data.
7. Manual refresh can optionally hit the Vercel Edge proxy, which rebuilds a runtime `Core-6 V4` latest payload from BGeometrics latest points plus the current static thresholds/history tail.

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

Archive current JSON outputs before release (default behavior):

```bash
python fetch_btc_indicators_history_files.py --skip-tabular --release-label v4_cutover
```

Rollback to an archived snapshot:

```bash
python fetch_btc_indicators_history_files.py --rollback-from archive/releases/<snapshot_dir>
```

Run data quality validation:

```bash
python validate_btc_data_quality.py \
  --current-history app/public/btc_indicators_history.json \
  --current-latest app/public/btc_indicators_latest.json \
  --max-indicator-lag-days 30
```

Note:

- When `reserveRisk` source-date lag exceeds `--reserve-risk-disable-lag-days` (default `30`), V4 first tries a reduced-score soft fallback from `MVRV Z-Score`; only when fallback is unavailable does it reduce active dimensions.
- The pipeline archives existing JSON outputs to `archive/releases/` before overwrite unless `--skip-archive` is passed.
- Release metadata and rollback hints are written into `btc_indicators_manifest.json`.

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

Check the Edge proxy syntax locally:

```bash
cd app
node --check api/btc-data.js
```

## Automation

The workflow `.github/workflows/update-btc-data.yml` runs every 6 hours and also supports manual trigger (`workflow_dispatch`).

It will:

1. run the fetch script
2. run quality checks
3. update `app/public` JSON files
4. auto-commit/push when data changes
