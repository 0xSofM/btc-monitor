export const BLOCKCHAIN_INFO_STATS_URL = 'https://api.blockchain.info/stats';
export const COINBASE_SPOT_URL = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
export const COINGECKO_SPOT_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';

export const RESERVE_RISK_DISABLE_LAG_DAYS = 30;
export const SCORE_CONFIRM_RATIO = 7 / 12;
export const SOPR_SMOOTHING_DAYS = 3;

export const BGEOMETRICS_SERIES = {
  btcPrice: {
    dataKey: 'btcPrice',
    urls: ['https://charts.bgeometrics.com/files/moving_average_price.json'],
  },
  ma200w: {
    dataKey: 'ma200w',
    urls: ['https://charts.bgeometrics.com/files/200wma.json'],
  },
  realizedPrice: {
    dataKey: 'realizedPrice',
    urls: ['https://charts.bgeometrics.com/files/realized_price.json'],
  },
  reserveRisk: {
    dataKey: 'reserveRisk',
    urls: ['https://charts.bgeometrics.com/files/reserve_risk.json'],
  },
  lthMvrv: {
    dataKey: 'lthMvrv',
    urls: ['https://charts.bgeometrics.com/files/lth_mvrv.json'],
  },
  lthSopr: {
    dataKey: 'lthSopr',
    urls: ['https://charts.bgeometrics.com/files/lth_sopr.json'],
  },
  mvrvZscore: {
    dataKey: 'mvrvZscore',
    urls: ['https://charts.bgeometrics.com/files/mvrv_zscore_data.json'],
  },
  nupl: {
    dataKey: 'nupl',
    urls: ['https://charts.bgeometrics.com/files/nupl_data.json'],
  },
  sthSopr: {
    dataKey: 'sthSopr',
    urls: ['https://charts.bgeometrics.com/files/sth_sopr.json'],
  },
  sthMvrv: {
    dataKey: 'sthMvrv',
    urls: ['https://charts.bgeometrics.com/files/sth_mvrv.json'],
  },
  puellMultiple: {
    dataKey: 'puellMultiple',
    urls: [
      'https://charts.bgeometrics.com/files/puell_multiple_data.json',
      'https://charts.bgeometrics.com/files/puell_multiple_7dma.json',
    ],
  },
};

export const RESERVE_RISK_BACKUP_URLS = [
  'https://bitcoin-data.com/v1/reserve-risk/1',
  'https://r.jina.ai/http://bitcoin-data.com/v1/reserve-risk/1',
];

export const NUPL_BACKUP_URLS = [
  'https://bitcoin-data.com/v1/nupl/1',
  'https://r.jina.ai/http://bitcoin-data.com/v1/nupl/1',
];

export const MVRV_ZSCORE_BACKUP_URLS = [
  'https://bitcoin-data.com/v1/mvrv-zscore/1',
  'https://r.jina.ai/http://bitcoin-data.com/v1/mvrv-zscore/1',
];

/**
 * Checkonchain (checkmatey) pre-rendered chart pages — fallback sources for
 * LTH/STH metrics when BGeometrics files lag too long. Each page embeds the
 * full Plotly data (x: ISO dates, y: base64 float64), so one page can back
 * several traces:
 *   - mvrv_lth page     -> lthMvrv ("LTH-MVRV") + lthSopr ("LTH-SOPR")
 *   - mvrv_sth page     -> sthMvrv ("STH-MVRV")
 *   - sthsopr_indicator -> sthSopr (clipped band traces "STH-SOPR > 1" / "STH-SOPR < 1")
 */
export const CHECKONCHAIN_CHARTS = {
  lthMvrv: {
    url: 'https://charts-cdn.checkonchain.com/btconchain/unrealised/mvrv_lth/mvrv_lth_light.html',
    trace: 'LTH-MVRV',
  },
  lthSopr: {
    url: 'https://charts-cdn.checkonchain.com/btconchain/unrealised/mvrv_lth/mvrv_lth_light.html',
    trace: 'LTH-SOPR',
  },
  sthMvrv: {
    url: 'https://charts-cdn.checkonchain.com/btconchain/unrealised/mvrv_sth/mvrv_sth_light.html',
    trace: 'STH-MVRV',
  },
  sthSopr: {
    url: 'https://charts-cdn.checkonchain.com/btconchain/realised/sthsopr_indicator/sthsopr_indicator_light.html',
    traces: ['STH-SOPR > 1', 'STH-SOPR < 1'],
  },
};

/** Only consult the heavy checkonchain fallback when the primary lags this many days. */
export const CHECKONCHAIN_STALE_TRIGGER_DAYS = 6;

/**
 * Light latest-point backups on bitcoin-data.com for the LTH/STH metrics.
 * Response field name matches the seriesKey:
 *   GET /v1/lth-mvrv/last -> {"d":"2026-08-13","unixTs":...,"lthMvrv":1.29}
 * (The `{last}` path parameter takes the literal "last", not "1".)
 */
export const LTH_STH_POINT_BACKUP_URLS = {
  lthMvrv: [
    'https://bitcoin-data.com/v1/lth-mvrv/last',
    'https://r.jina.ai/http://bitcoin-data.com/v1/lth-mvrv/last',
  ],
  lthSopr: [
    'https://bitcoin-data.com/v1/lth-sopr/last',
    'https://r.jina.ai/http://bitcoin-data.com/v1/lth-sopr/last',
  ],
  sthSopr: [
    'https://bitcoin-data.com/v1/sth-sopr/last',
    'https://r.jina.ai/http://bitcoin-data.com/v1/sth-sopr/last',
  ],
  sthMvrv: [
    'https://bitcoin-data.com/v1/sth-mvrv/last',
    'https://r.jina.ai/http://bitcoin-data.com/v1/sth-mvrv/last',
  ],
};

export const INDICATOR_ROUTE_MAP = {
  '/btc-data/v1/mvrv-zscore/1': { seriesKey: 'mvrvZscore', dataKey: 'mvrvZscore', dateKey: 'mvrvZscore' },
  '/btc-data/v1/nupl/1': { seriesKey: 'nupl', dataKey: 'nupl', dateKey: 'nupl' },
  '/btc-data/v1/lth-mvrv/1': { seriesKey: 'lthMvrv', dataKey: 'lthMvrv', dateKey: 'lthMvrv' },
  '/btc-data/v1/lth-sopr/1': { seriesKey: 'lthSopr', dataKey: 'lthSopr', dateKey: 'lthSopr' },
  '/btc-data/v1/puell-multiple/1': { seriesKey: 'puellMultiple', dataKey: 'puellMultiple', dateKey: 'puell' },
  '/btc-data/v1/reserve-risk/1': { seriesKey: 'reserveRisk', dataKey: 'reserveRisk', dateKey: 'reserveRisk' },
  '/btc-data/v1/realized-price/1': { seriesKey: 'realizedPrice', dataKey: 'realizedPrice', dateKey: 'priceRealized' },
  '/btc-data/v1/sth-sopr/1': { seriesKey: 'sthSopr', dataKey: 'sthSopr', dateKey: 'sthSopr' },
  '/btc-data/v1/sth-mvrv/1': { seriesKey: 'sthMvrv', dataKey: 'sthMvrv', dateKey: 'sthMvrv' },
  '/btc-data/v1/200wma/1': { seriesKey: 'ma200w', dataKey: 'ma200w', dateKey: 'priceMa200w' },
};

export const DEFAULT_THRESHOLDS = {
  priceMa200wRatio: { trigger: 1, deep: 0.85 },
  priceRealizedRatio: { trigger: 1, deep: 0.9 },
  reserveRisk: { trigger: 0.0016, deep: 0.0012 },
  sthSopr: { trigger: 1, deep: 0.97 },
  sthMvrv: { trigger: 1, deep: 0.85 },
  puellMultiple: { trigger: 0.6, deep: 0.5 },
  lthMvrv: { trigger: 1, deep: 0.9 },
  lthSopr: { trigger: 0.9, deep: 0.75 },
  mvrvZscore: { trigger: 0, deep: -0.5 },
  mvrvZscoreCore: { trigger: 0, deep: -0.5, role: 'valuation_core_v4' },
  nupl: { trigger: 0.15, deep: 0 },
  nuplCore: { trigger: 0.15, deep: 0, role: 'valuation_core_v6' },
  valuationBlendV6: {
    method: 'max(mvrvZscoreCore,nuplCore)',
    role: 'shared_valuation_slot_v6',
    displayRole: 'legacy_compatibility_only',
  },
  reserveRiskV4Compatibility: { aliasOf: 'mvrvZscoreCore', deprecated: true },
};

export const FRESHNESS_LIMITS = {
  btcPrice: 2,
  ma200w: 7,
  realizedPrice: 7,
  reserveRisk: RESERVE_RISK_DISABLE_LAG_DAYS,
  lthMvrv: 7,
  lthSopr: 7,
  mvrvZscore: 7,
  nupl: 7,
  sthSopr: 7,
  sthMvrv: 7,
  puellMultiple: 7,
};
