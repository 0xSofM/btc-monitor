# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BTC定投指标监控 — a Bitcoin DCA (Dollar-Cost Averaging) indicator monitoring dashboard. It tracks 5 on-chain indicators to identify cycle bottoms and optimal buy opportunities. The UI is in Chinese.

## Architecture

Two-part system:

1. **Frontend app** (`app/`): React + TypeScript + Vite SPA, deployed to Vercel
2. **Data pipeline**: Python script (`update_data.py`, referenced but lives outside this checkout) runs via GitHub Actions (twice daily) to fetch indicator data from BGeometrics API and commit JSON files to the repo

### Data Flow
- GitHub Actions runs `update_data.py` → produces `btc_indicators_history.json` and `btc_indicators_latest.json` at repo root
- Frontend loads history from `/btc_indicators_history.json` (static file served by Vercel)
- Frontend also fetches live data directly from `https://bitcoin-data.com/v1/` APIs with fallback to history JSON
- `app/api/btc-data.js` is a Vercel Edge Function proxy for CORS

### Frontend Structure
- `app/src/App.tsx` — root component with 3 tabs: Dashboard, History Review, Indicator Guide
- `app/src/services/dataService.ts` — all data fetching, caching, normalization, and chart data transforms
- `app/src/types/index.ts` — shared TypeScript interfaces (`IndicatorData`, `LatestData`, `SignalEvent`, `TimeRange`, `ChartDataPoint`)
- `app/src/components/` — feature components:
  - `SignalOverview.tsx` — signal count summary and market status
  - `IndicatorCard.tsx` — individual indicator display with buy signal badge
  - `IndicatorCharts.tsx` — recharts-based historical charts with brush/zoom
  - `HistoryReview.tsx` — filterable table of historical signal events
  - `IndicatorExplanation.tsx` — educational accordion for each indicator
- `app/src/components/ui/` — shadcn/ui components (new-york style, Tailwind CSS v3)

### 5 Monitored Indicators
| Indicator | Buy Signal Threshold |
|---|---|
| BTC Price / 200W-MA | < 1 |
| MVRV Z-Score | < 0 |
| LTH-MVRV | < 1 |
| Puell Multiple | < 0.5 |
| NUPL | < 0 |

When 4-5 indicators trigger simultaneously, it signals a cycle bottom.

## Commands

All commands run from `app/` directory:

```bash
cd app
npm install        # install dependencies
npm run dev        # start dev server (Vite)
npm run build      # tsc -b && vite build
npm run lint       # eslint
npm run preview    # preview production build
```

## Key Conventions

- Path alias `@/` maps to `app/src/` (configured in vite.config.ts and tsconfig)
- shadcn/ui with new-york style, Tailwind CSS v3, CSS variables for theming
- History data uses both snake_case (from Python) and camelCase (frontend) — `normalizeIndicatorData()` in dataService handles conversion
- `VITE_API_PROXY_URL` env var optionally configures a CORS proxy
- Data caching: 1-minute local cache, 5-minute auto-refresh interval
- Vercel deployment config in `app/vercel.json`
