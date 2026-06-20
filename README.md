# BTC Monitor

A BTC indicator dashboard with a static-data pipeline designed for reliable deployment on GitHub + Vercel.

## What It Tracks (Core-8 V6)

- `BTC Price / 200W-MA` (computed)
- `BTC Price / Realized Price` (computed)
- `Valuation Blend (MVRV Z-Score + NUPL)`
- `Puell Multiple`
- `STH-MVRV`
- `STH-SOPR`
- `LTH-MVRV`
- `LTH-SOPR`

Legacy compatibility indicator:

- `Reserve Risk`

Auxiliary market-structure monitor:

- `MSTR mNAV` from Strategy's official API, using Strategy's own `Enterprise Value / BTC Reserve` definition. This is displayed as a BTC proxy premium/sentiment metric and is not included in the Core-8 bottom score.

V6 scoring:

- layered score: `valuationScoreV6 + triggerScoreV6 + confirmationScoreV6`
- per-indicator score: `0 / 1 / 2`
- display indicators: 8 frontend cards/charts; MVRV Z-Score and NUPL share one valuation blend slot
- valuation layer: `Price / 200W-MA`, `Price / Realized Price`, `max(MVRV Z-Score core, NUPL core)`, and `Puell Multiple` (max 8)
- trigger layer: `max(STH-MVRV, STH-SOPR)`
- confirmation layer: `LTH-MVRV + LTH-SOPR`
- SOPR smoothing: STH-SOPR and LTH-SOPR scores use 3-day moving averages; raw values remain available for diagnostics
- dynamic thresholds: STH-SOPR uses rolling p27/p13.5, LTH-SOPR uses rolling p20/p10
- signal count: `signalCountV6` counts the 8 frontend display indicators, while the trigger layer score still uses `max(STH-MVRV, STH-SOPR)`
- total score: `totalScoreV6` with max score in `maxTotalScoreV6` (normally 14)
- no-lookahead thresholds: rolling quantile thresholds are computed only from past data where used
- confidence fields: `signalConfidenceV6`, `dataFreshnessScoreV6`, `fallbackModeV6`, `staleIndicators`
- legacy rollback fields remain available: `signalScoreV2`, `totalScoreV4`, `signalBandV2`, `signalBandV4`
- confirmation flags: `signalConfirmed3dV6`, `signalConfirmed3dV4`, and legacy `signalConfirmed3d`

## Project Structure

- `fetch_btc_indicators_history_files.py`: data fetch + transform script
- `validate_btc_data_quality.py`: JSON data quality gate
- `app/public/btc_indicators_history.json`: full frontend historical dataset
- `app/public/btc_indicators_latest.json`: frontend latest snapshot
- `app/public/btc_indicators_manifest.json`: data manifest for observability
- `app/public/btc_signal_events_v4.json`: event-level V4 backtest windows
- `app/public/strategy_mnav_latest.json`: Strategy official mNAV latest snapshot
- `app/public/strategy_mnav_history.json`: locally accumulated Strategy mNAV daily snapshots
- `app/`: Vite + React frontend
- `tests/`: Python unit tests for data pipeline logic
- `.github/workflows/update-btc-data.yml`: scheduled auto-update workflow

## Data Flow

1. Script fetches historical series from `charts.bgeometrics.com/files/*.json`.
2. Script computes derived ratios plus parallel `V2 legacy`, `V4 layered`, and `V6 Core-8` signal fields.
3. Script archives current JSON outputs before overwrite, then writes full history, latest snapshot, manifest, and event files.
4. Data quality validator checks structural/incremental consistency.
5. GitHub Actions runs on schedule and commits updated JSON.
6. Vercel redeploys from GitHub and serves fresh data.
7. Manual refresh can optionally hit the Vercel Edge proxy, which rebuilds a runtime `Core-8 V6` latest payload from BGeometrics latest points plus the current static thresholds/history tail.
8. Strategy mNAV is fetched independently from Strategy's official `bitcoinKpis` and `mstrKpiData` APIs, written as auxiliary JSON, and surfaced without changing the Core-8 score.

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

Refresh and validate Strategy mNAV:

```bash
python fetch_strategy_mnav.py
python validate_strategy_mnav.py \
  --current-latest app/public/strategy_mnav_latest.json \
  --current-history app/public/strategy_mnav_history.json
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
