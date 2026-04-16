/**
 * Vercel Edge Function - BTC runtime V4 proxy.
 */

export const config = {
  runtime: 'edge',
};

// SECTION: constants
const CACHE_DURATION = 300;
const UPSTREAM_TIMEOUT_MS = 8000;
const STATIC_LATEST_PATH = '/btc_indicators_latest.json';
const STATIC_HISTORY_LIGHT_PATH = '/btc_indicators_history_light.json';
const COINBASE_SPOT_URL = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
const COINGECKO_SPOT_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
const RESERVE_RISK_DISABLE_LAG_DAYS = 30;
const SCORE_CONFIRM_RATIO = 7 / 12;
const SCHEMA_VERSION = 'v4';
const SCORING_MODEL_VERSION = 'v4_core6_mvrv_substitute';
const LEGACY_SCORING_MODEL_VERSION = 'v3_no_lookahead_replacement';
const CORE_INDICATOR_SET = 'core6_bottom_v4_mvrv_substitute';

const BGEOMETRICS_SERIES = {
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
  mvrvZscore: {
    dataKey: 'mvrvZscore',
    urls: ['https://charts.bgeometrics.com/files/mvrv_zscore_data.json'],
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

const RESERVE_RISK_BACKUP_URLS = [
  'https://bitcoin-data.com/v1/reserve-risk/1',
  'https://r.jina.ai/http://bitcoin-data.com/v1/reserve-risk/1',
];

const INDICATOR_ROUTE_MAP = {
  '/btc-data/v1/mvrv-zscore/1': { seriesKey: 'mvrvZscore', dataKey: 'mvrvZscore', dateKey: 'mvrvZscore' },
  '/btc-data/v1/lth-mvrv/1': { seriesKey: 'lthMvrv', dataKey: 'lthMvrv', dateKey: 'lthMvrv' },
  '/btc-data/v1/puell-multiple/1': { seriesKey: 'puellMultiple', dataKey: 'puellMultiple', dateKey: 'puell' },
  '/btc-data/v1/reserve-risk/1': { seriesKey: 'reserveRisk', dataKey: 'reserveRisk', dateKey: 'reserveRisk' },
  '/btc-data/v1/realized-price/1': { seriesKey: 'realizedPrice', dataKey: 'realizedPrice', dateKey: 'priceRealized' },
  '/btc-data/v1/sth-sopr/1': { seriesKey: 'sthSopr', dataKey: 'sthSopr', dateKey: 'sthSopr' },
  '/btc-data/v1/sth-mvrv/1': { seriesKey: 'sthMvrv', dataKey: 'sthMvrv', dateKey: 'sthMvrv' },
  '/btc-data/v1/200wma/1': { seriesKey: 'ma200w', dataKey: 'ma200w', dateKey: 'priceMa200w' },
};

const DEFAULT_THRESHOLDS = {
  priceMa200wRatio: { trigger: 1, deep: 0.85 },
  priceRealizedRatio: { trigger: 1, deep: 0.9 },
  reserveRisk: { trigger: 0.0016, deep: 0.0012 },
  sthSopr: { trigger: 1, deep: 0.97 },
  sthMvrv: { trigger: 1, deep: 0.85 },
  puellMultiple: { trigger: 0.6, deep: 0.5 },
  lthMvrv: { trigger: 1, deep: 0.9 },
  mvrvZscore: { trigger: 0, deep: -0.5 },
  mvrvZscoreCore: { trigger: 0, deep: -0.5, role: 'valuation_core_v4' },
  reserveRiskV4Compatibility: { aliasOf: 'mvrvZscoreCore', deprecated: true },
};

const FRESHNESS_LIMITS = {
  btcPrice: 2,
  ma200w: 7,
  realizedPrice: 7,
  reserveRisk: RESERVE_RISK_DISABLE_LAG_DAYS,
  lthMvrv: 7,
  mvrvZscore: 7,
  sthSopr: 7,
  sthMvrv: 7,
  puellMultiple: 7,
};

// SECTION: helpers
function asRecord(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value;
}

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = toNumber(value, Number.NaN);
  return Number.isNaN(parsed) ? null : parsed;
}

function asString(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(digits));
}

function getTodayUtcDate() {
  return new Date().toISOString().split('T')[0];
}

function withTimeout(init = {}, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    init: {
      ...init,
      signal: controller.signal,
    },
    done: () => clearTimeout(timeoutId),
  };
}

async function fetchJsonSafely(url, fallback, init = {}) {
  const { init: requestInit, done } = withTimeout(init);

  try {
    const response = await fetch(url, requestInit);
    if (!response.ok) {
      return fallback;
    }

    const text = await response.text();
    if (!text) {
      return fallback;
    }

    return JSON.parse(text);
  } catch (error) {
    console.warn('Upstream JSON fetch failed:', url, error);
    return fallback;
  } finally {
    done();
  }
}

async function fetchTextSafely(url, fallback, init = {}) {
  const { init: requestInit, done } = withTimeout(init);

  try {
    const response = await fetch(url, requestInit);
    if (!response.ok) {
      return fallback;
    }

    return await response.text();
  } catch (error) {
    console.warn('Upstream text fetch failed:', url, error);
    return fallback;
  } finally {
    done();
  }
}

function parseDateFromTimestamp(timestampRaw) {
  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const safeTimestamp = timestamp < 10 ** 11 ? timestamp * 1000 : timestamp;
  const date = new Date(safeTimestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().split('T')[0];
}

function buildPoint(date, value, source = null) {
  const numericValue = toNumberOrNull(value);
  if (!date || numericValue === null) {
    return null;
  }

  return {
    d: date,
    value: numericValue,
    source,
  };
}

function pointToArray(point, dataKey) {
  if (!point) {
    return [];
  }

  return [
    {
      d: point.d,
      [dataKey]: point.value,
    },
  ];
}

function compareDateStrings(left, right) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return -1;
  }

  if (!right) {
    return 1;
  }

  return left.localeCompare(right);
}

function pickNewerPoint(primary, backup) {
  if (!primary) {
    return backup;
  }

  if (!backup) {
    return primary;
  }

  return compareDateStrings(backup.d, primary.d) >= 0 ? backup : primary;
}

function daysBetween(laterDate, earlierDate) {
  if (!laterDate || !earlierDate) {
    return null;
  }

  const later = Date.parse(`${laterDate}T00:00:00Z`);
  const earlier = Date.parse(`${earlierDate}T00:00:00Z`);
  if (Number.isNaN(later) || Number.isNaN(earlier)) {
    return null;
  }

  return Math.round((later - earlier) / (1000 * 60 * 60 * 24));
}

function freshnessScore(lagDays, maxLagDays) {
  if (lagDays === null || lagDays === undefined) {
    return 0;
  }

  const safeMaxLag = Math.max(1, maxLagDays);
  return Math.max(0, Math.min(1, 1 - (Math.max(0, lagDays) / safeMaxLag)));
}

function isFresh(lagDays, maxLagDays) {
  if (lagDays === null || lagDays === undefined) {
    return false;
  }

  return lagDays <= maxLagDays;
}

function scoreByLt(value, trigger, deep) {
  const numericValue = toNumberOrNull(value);
  if (numericValue === null) {
    return 0;
  }

  if (numericValue < Math.min(trigger, deep)) {
    return 2;
  }

  if (numericValue < trigger) {
    return 1;
  }

  return 0;
}

function classifyScoreBand(score, maxScore) {
  const safeMaxScore = Math.max(1, toNumber(maxScore, 0));
  const normalizedScore = (toNumber(score, 0) / safeMaxScore) * 12;

  if (normalizedScore < 4) return 'watch';
  if (normalizedScore < 7) return 'focus';
  if (normalizedScore < 10) return 'accumulate';
  return 'extreme_bottom';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getThresholdConfig(staticLatest, key) {
  const snapshotThresholds = asRecord(staticLatest?.thresholds);
  const threshold = asRecord(snapshotThresholds?.[key]);
  const fallback = DEFAULT_THRESHOLDS[key];

  if (!threshold) {
    return fallback;
  }

  return {
    ...fallback,
    ...threshold,
  };
}

function buildSnapshotPoint(snapshot, valueKey, dateKey, fallbackDate = undefined, source = 'static_snapshot') {
  const snapshotDate = asString(snapshot?.indicatorDates?.[dateKey]) ?? fallbackDate ?? asString(snapshot?.date);
  return buildPoint(snapshotDate, snapshot?.[valueKey], source);
}

function extractJsonPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
}

function parseReserveRiskBackupPayload(payload) {
  let point = null;

  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'd' in payload && 'reserveRisk' in payload) {
    point = payload;
  } else if (Array.isArray(payload) && payload.length > 0) {
    const candidate = payload[payload.length - 1];
    if (candidate && typeof candidate === 'object') {
      point = candidate;
    }
  }

  if (!point) {
    return null;
  }

  const date = asString(point.d);
  const value = toNumberOrNull(point.reserveRisk);
  if (!date || value === null) {
    return null;
  }

  return buildPoint(date, value, 'reserve_risk_backup');
}

function buildLatestRollingMin(historyRows, latestDate, field, newValue) {
  if (!Array.isArray(historyRows) || historyRows.length === 0) {
    return null;
  }

  const tail = historyRows
    .slice(-4)
    .map((row) => ({
      d: asString(row?.d),
      value: toNumberOrNull(row?.[field]),
    }))
    .filter((row) => row.d && row.value !== null);

  const withoutSameDateTail = tail.length > 0 && tail[tail.length - 1].d === latestDate
    ? tail.slice(0, -1)
    : tail;

  const values = withoutSameDateTail
    .slice(-2)
    .map((row) => row.value)
    .filter((value) => value !== null);

  if (newValue !== null && newValue !== undefined) {
    values.push(newValue);
  }

  if (values.length < 3) {
    return null;
  }

  return Math.min(...values.slice(-3));
}

function buildThresholdBundle(staticLatest) {
  return {
    priceMa200wRatio: getThresholdConfig(staticLatest, 'priceMa200wRatio'),
    priceRealizedRatio: getThresholdConfig(staticLatest, 'priceRealizedRatio'),
    reserveRisk: getThresholdConfig(staticLatest, 'reserveRisk'),
    sthSopr: getThresholdConfig(staticLatest, 'sthSopr'),
    sthMvrv: getThresholdConfig(staticLatest, 'sthMvrv'),
    puellMultiple: getThresholdConfig(staticLatest, 'puellMultiple'),
    lthMvrv: getThresholdConfig(staticLatest, 'lthMvrv'),
    mvrvZscore: getThresholdConfig(staticLatest, 'mvrvZscore'),
    mvrvZscoreCore: getThresholdConfig(staticLatest, 'mvrvZscoreCore'),
    reserveRiskV4Compatibility: getThresholdConfig(staticLatest, 'reserveRiskV4Compatibility'),
  };
}

// SECTION: upstream fetchers
async function fetchStaticLatestSnapshot(request) {
  try {
    const url = new URL(STATIC_LATEST_PATH, request.url);
    const payload = await fetchJsonSafely(url.toString(), null);
    return asRecord(payload);
  } catch (error) {
    console.warn('Static latest snapshot fetch failed:', error);
    return null;
  }
}

async function fetchStaticHistoryLight(request) {
  try {
    const url = new URL(STATIC_HISTORY_LIGHT_PATH, request.url);
    const payload = await fetchJsonSafely(url.toString(), []);
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    console.warn('Static history-light fetch failed:', error);
    return [];
  }
}

async function fetchLatestFilePoint(seriesKey) {
  const config = BGEOMETRICS_SERIES[seriesKey];
  if (!config) {
    return null;
  }

  for (const url of config.urls) {
    const payload = await fetchJsonSafely(url, [], {
      headers: {
        'User-Agent': 'btc-monitor',
      },
    });

    if (!Array.isArray(payload)) {
      continue;
    }

    for (let index = payload.length - 1; index >= 0; index -= 1) {
      const row = payload[index];
      if (!Array.isArray(row) || row.length < 2) {
        continue;
      }

      const date = parseDateFromTimestamp(row[0]);
      const value = toNumberOrNull(row[1]);
      if (!date || value === null) {
        continue;
      }

      return buildPoint(date, value, 'bgeometrics');
    }
  }

  return null;
}

async function fetchReserveRiskBackupPoint() {
  for (const url of RESERVE_RISK_BACKUP_URLS) {
    const text = await fetchTextSafely(url, null, {
      headers: {
        'User-Agent': 'btc-monitor',
      },
    });

    if (!text) {
      continue;
    }

    const payload = extractJsonPayload(text);
    const point = parseReserveRiskBackupPayload(payload);
    if (point) {
      return point;
    }
  }

  return null;
}

async function fetchCoinbaseSpotPrice() {
  const payload = await fetchJsonSafely(COINBASE_SPOT_URL, null, {
    headers: {
      'User-Agent': 'btc-monitor',
    },
  });

  const amount = payload?.data?.amount;
  if (amount === undefined || amount === null) {
    return null;
  }

  return buildPoint(getTodayUtcDate(), amount, 'coinbase');
}

async function fetchCoinGeckoSpotPrice() {
  const headers = {
    'User-Agent': 'btc-monitor',
  };

  const demoKey = process.env.COINGECKO_DEMO_API_KEY;
  if (demoKey) {
    headers['x-cg-demo-api-key'] = demoKey;
  }

  const payload = await fetchJsonSafely(COINGECKO_SPOT_URL, null, { headers });
  const amount = payload?.bitcoin?.usd;
  if (amount === undefined || amount === null) {
    return null;
  }

  return buildPoint(getTodayUtcDate(), amount, 'coingecko');
}

async function fetchBackupSpotPrice() {
  const coinbase = await fetchCoinbaseSpotPrice();
  if (coinbase) {
    return coinbase;
  }

  return fetchCoinGeckoSpotPrice();
}

async function fetchRuntimeInputs(request) {
  const [
    staticLatest,
    staticHistory,
    filePricePoint,
    ma200wPoint,
    realizedPricePoint,
    reserveRiskPrimaryPoint,
    reserveRiskBackupPoint,
    lthMvrvPoint,
    mvrvZscorePoint,
    sthSoprPoint,
    sthMvrvPoint,
    puellPoint,
  ] = await Promise.all([
    fetchStaticLatestSnapshot(request),
    fetchStaticHistoryLight(request),
    fetchLatestFilePoint('btcPrice'),
    fetchLatestFilePoint('ma200w'),
    fetchLatestFilePoint('realizedPrice'),
    fetchLatestFilePoint('reserveRisk'),
    fetchReserveRiskBackupPoint(),
    fetchLatestFilePoint('lthMvrv'),
    fetchLatestFilePoint('mvrvZscore'),
    fetchLatestFilePoint('sthSopr'),
    fetchLatestFilePoint('sthMvrv'),
    fetchLatestFilePoint('puellMultiple'),
  ]);

  const backupSpotPrice = filePricePoint ? null : await fetchBackupSpotPrice();
  const resolvedPricePoint = pickNewerPoint(filePricePoint, backupSpotPrice);
  const resolvedReserveRiskPoint = pickNewerPoint(reserveRiskPrimaryPoint, reserveRiskBackupPoint);

  return {
    staticLatest,
    staticHistory,
    pricePoint: resolvedPricePoint,
    seriesPoints: {
      ma200w: ma200wPoint,
      realizedPrice: realizedPricePoint,
      reserveRisk: resolvedReserveRiskPoint,
      reserveRiskPrimary: reserveRiskPrimaryPoint,
      lthMvrv: lthMvrvPoint,
      mvrvZscore: mvrvZscorePoint,
      sthSopr: sthSoprPoint,
      sthMvrv: sthMvrvPoint,
      puellMultiple: puellPoint,
    },
  };
}

// SECTION: V4 payload builder
function buildRuntimePayload({
  staticLatest,
  staticHistory,
  pricePoint,
  seriesPoints,
}) {
  const thresholds = buildThresholdBundle(staticLatest);
  const snapshotDate = asString(staticLatest?.date) ?? getTodayUtcDate();

  const points = {
    btcPrice: pricePoint ?? buildSnapshotPoint(staticLatest, 'btcPrice', 'priceMa200w', snapshotDate),
    ma200w: seriesPoints.ma200w ?? buildSnapshotPoint(staticLatest, 'ma200w', 'priceMa200w', snapshotDate),
    realizedPrice: seriesPoints.realizedPrice ?? buildSnapshotPoint(staticLatest, 'realizedPrice', 'priceRealized', snapshotDate),
    reserveRisk: seriesPoints.reserveRisk ?? buildSnapshotPoint(staticLatest, 'reserveRisk', 'reserveRisk', snapshotDate),
    lthMvrv: seriesPoints.lthMvrv ?? buildSnapshotPoint(staticLatest, 'lthMvrv', 'lthMvrv', snapshotDate),
    mvrvZscore: seriesPoints.mvrvZscore ?? buildSnapshotPoint(staticLatest, 'mvrvZscore', 'mvrvZscore', snapshotDate),
    sthSopr: seriesPoints.sthSopr ?? buildSnapshotPoint(staticLatest, 'sthSopr', 'sthSopr', snapshotDate),
    sthMvrv: seriesPoints.sthMvrv ?? buildSnapshotPoint(staticLatest, 'sthMvrv', 'sthMvrv', snapshotDate),
    puellMultiple: seriesPoints.puellMultiple ?? buildSnapshotPoint(staticLatest, 'puellMultiple', 'puell', snapshotDate),
  };

  if (!points.btcPrice && !staticLatest) {
    return null;
  }

  const latestDate = points.btcPrice?.d ?? snapshotDate;
  const btcPrice = points.btcPrice?.value ?? toNumber(staticLatest?.btcPrice);
  const ma200w = points.ma200w?.value ?? toNumberOrNull(staticLatest?.ma200w);
  const realizedPrice = points.realizedPrice?.value ?? toNumberOrNull(staticLatest?.realizedPrice);
  const reserveRisk = points.reserveRisk?.value ?? toNumberOrNull(staticLatest?.reserveRisk);
  const lthMvrv = points.lthMvrv?.value ?? toNumberOrNull(staticLatest?.lthMvrv);
  const mvrvZscore = points.mvrvZscore?.value ?? toNumberOrNull(staticLatest?.mvrvZscore);
  const sthSopr = points.sthSopr?.value ?? toNumberOrNull(staticLatest?.sthSopr);
  const sthMvrv = points.sthMvrv?.value ?? toNumberOrNull(staticLatest?.sthMvrv);
  const puellMultiple = points.puellMultiple?.value ?? toNumberOrNull(staticLatest?.puellMultiple);
  const priceMa200wRatio = ma200w && ma200w > 0 ? btcPrice / ma200w : toNumber(staticLatest?.priceMa200wRatio);
  const priceRealizedRatio = realizedPrice && realizedPrice > 0 ? btcPrice / realizedPrice : toNumber(staticLatest?.priceRealizedRatio);

  const btcPriceLagDays = daysBetween(latestDate, points.btcPrice?.d);
  const ma200wLagDays = daysBetween(latestDate, points.ma200w?.d);
  const realizedPriceLagDays = daysBetween(latestDate, points.realizedPrice?.d);
  const reserveRiskLagDays = daysBetween(latestDate, points.reserveRisk?.d);
  const lthMvrvLagDays = daysBetween(latestDate, points.lthMvrv?.d);
  const mvrvZscoreLagDays = daysBetween(latestDate, points.mvrvZscore?.d);
  const sthSoprLagDays = daysBetween(latestDate, points.sthSopr?.d);
  const sthMvrvLagDays = daysBetween(latestDate, points.sthMvrv?.d);
  const puellLagDays = daysBetween(latestDate, points.puellMultiple?.d);

  const btcPriceFreshnessScore = freshnessScore(btcPriceLagDays, FRESHNESS_LIMITS.btcPrice);
  const ma200wFreshnessScore = freshnessScore(ma200wLagDays, FRESHNESS_LIMITS.ma200w);
  const realizedPriceFreshnessScore = freshnessScore(realizedPriceLagDays, FRESHNESS_LIMITS.realizedPrice);
  const reserveRiskFreshnessScore = freshnessScore(reserveRiskLagDays, FRESHNESS_LIMITS.reserveRisk);
  const lthMvrvFreshnessScore = freshnessScore(lthMvrvLagDays, FRESHNESS_LIMITS.lthMvrv);
  const mvrvZscoreFreshnessScore = freshnessScore(mvrvZscoreLagDays, FRESHNESS_LIMITS.mvrvZscore);
  const sthSoprFreshnessScore = freshnessScore(sthSoprLagDays, FRESHNESS_LIMITS.sthSopr);
  const sthMvrvFreshnessScore = freshnessScore(sthMvrvLagDays, FRESHNESS_LIMITS.sthMvrv);
  const puellFreshnessScore = freshnessScore(puellLagDays, FRESHNESS_LIMITS.puellMultiple);

  const ma200wIsFresh = isFresh(ma200wLagDays, FRESHNESS_LIMITS.ma200w);
  const realizedPriceIsFresh = isFresh(realizedPriceLagDays, FRESHNESS_LIMITS.realizedPrice);
  const reserveRiskIsFresh = isFresh(reserveRiskLagDays, FRESHNESS_LIMITS.reserveRisk);
  const lthMvrvIsFresh = isFresh(lthMvrvLagDays, FRESHNESS_LIMITS.lthMvrv);
  const mvrvZscoreIsFresh = isFresh(mvrvZscoreLagDays, FRESHNESS_LIMITS.mvrvZscore);
  const sthSoprIsFresh = isFresh(sthSoprLagDays, FRESHNESS_LIMITS.sthSopr);
  const sthMvrvIsFresh = isFresh(sthMvrvLagDays, FRESHNESS_LIMITS.sthMvrv);
  const puellIsFresh = isFresh(puellLagDays, FRESHNESS_LIMITS.puellMultiple);

  const scorePriceMa200w = scoreByLt(priceMa200wRatio, thresholds.priceMa200wRatio.trigger, thresholds.priceMa200wRatio.deep);
  const scorePriceRealized = scoreByLt(priceRealizedRatio, thresholds.priceRealizedRatio.trigger, thresholds.priceRealizedRatio.deep);
  const scoreReserveRiskPrimary = scoreByLt(reserveRisk, thresholds.reserveRisk.trigger, thresholds.reserveRisk.deep);
  const scoreSthSopr = scoreByLt(sthSopr, thresholds.sthSopr.trigger, thresholds.sthSopr.deep);
  const scoreSthMvrv = scoreByLt(sthMvrv, thresholds.sthMvrv.trigger, thresholds.sthMvrv.deep);
  const scoreSthGroup = Math.max(scoreSthSopr, scoreSthMvrv);
  const scorePuell = scoreByLt(puellMultiple, thresholds.puellMultiple.trigger, thresholds.puellMultiple.deep);
  const scoreLthMvrv = scoreByLt(lthMvrv, thresholds.lthMvrv.trigger, thresholds.lthMvrv.deep);
  const scoreMvrvZscore = scoreByLt(mvrvZscore, thresholds.mvrvZscore.trigger, thresholds.mvrvZscore.deep);
  const mvrvZscoreCoreActive = Boolean(points.mvrvZscore?.d && mvrvZscoreIsFresh);
  const scoreMvrvZscoreCore = mvrvZscoreCoreActive ? scoreMvrvZscore : 0;

  const reserveRiskPrimaryLagDays = daysBetween(latestDate, seriesPoints.reserveRiskPrimary?.d);
  const reserveRiskActive = Boolean(
    points.reserveRisk?.d
      && reserveRiskPrimaryLagDays !== null
      && reserveRiskPrimaryLagDays <= RESERVE_RISK_DISABLE_LAG_DAYS
      && reserveRiskIsFresh
  );
  const replacementLagCandidates = [lthMvrvLagDays, mvrvZscoreLagDays].filter((value) => value !== null);
  const reserveRiskReplacementLagDays = replacementLagCandidates.length > 0
    ? Math.min(...replacementLagCandidates)
    : null;
  const reserveRiskReplacementActive = !reserveRiskActive
    && reserveRiskReplacementLagDays !== null
    && reserveRiskReplacementLagDays <= RESERVE_RISK_DISABLE_LAG_DAYS;
  const reserveRiskReplacementSource = reserveRiskReplacementActive
    ? (scoreLthMvrv >= scoreMvrvZscore ? 'lth_mvrv' : 'mvrv_zscore_data')
    : null;
  const reserveRiskSourceMode = reserveRiskActive
    ? 'primary'
    : (reserveRiskReplacementActive ? 'replacement' : 'inactive');
  const reserveDimensionActive = reserveRiskSourceMode !== 'inactive';
  const scoreReserveRiskReplacement = Math.max(scoreLthMvrv, scoreMvrvZscore);
  const scoreReserveRisk = reserveRiskActive
    ? scoreReserveRiskPrimary
    : (reserveRiskReplacementActive ? scoreReserveRiskReplacement : 0);

  const reserveRiskSoftFallbackActive = false;
  const scoreReserveRiskV4 = scoreMvrvZscoreCore;
  const maxReserveRiskScoreV4 = mvrvZscoreCoreActive ? 2 : 0;
  const reserveRiskSourceModeV4 = mvrvZscoreCoreActive ? 'compat_mvrv_zscore' : 'inactive';
  const reserveRiskFallbackLagDaysV4 = null;

  const signalPriceMa200w = scorePriceMa200w > 0;
  const signalPriceRealized = scorePriceRealized > 0;
  const signalReserveRisk = scoreReserveRisk > 0;
  const signalSthSopr = scoreSthSopr > 0;
  const signalSthMvrv = scoreSthMvrv > 0;
  const signalSthGroup = scoreSthGroup > 0;
  const signalPuell = scorePuell > 0;
  const signalMvrvZscoreCore = scoreMvrvZscoreCore > 0;
  const signalReserveRiskV4 = signalMvrvZscoreCore;
  const signalLthMvrv = scoreLthMvrv > 0;
  const signalSthSoprAux = scoreSthSopr > 0;

  const inactiveIndicatorCount = reserveDimensionActive ? 0 : 1;
  const activeIndicatorCount = 5 - inactiveIndicatorCount;
  const signalCount = [
    signalPriceMa200w,
    signalPriceRealized,
    signalReserveRisk,
    signalSthGroup,
    signalPuell,
  ].filter(Boolean).length;
  const signalScoreV2 = scorePriceMa200w + scorePriceRealized + scoreReserveRisk + scoreSthGroup + scorePuell;
  const maxSignalScoreV2 = activeIndicatorCount * 2;

  const valuationScore = scorePriceMa200w + scorePriceRealized + scoreMvrvZscoreCore + scorePuell;
  const maxValuationScore = 6 + maxReserveRiskScoreV4;
  const triggerScore = scoreSthMvrv;
  const maxTriggerScore = 2;
  const confirmationScore = scoreLthMvrv;
  const maxConfirmationScore = 2;
  const auxiliaryScore = scoreSthSopr;
  const maxAuxiliaryScore = 2;
  const activeIndicatorCountV4 = 5 + (mvrvZscoreCoreActive ? 1 : 0);
  const signalCountV4 = [
    signalPriceMa200w,
    signalPriceRealized,
    signalReserveRiskV4,
    signalSthMvrv,
    signalLthMvrv,
    signalPuell,
  ].filter(Boolean).length;
  const maxTotalScoreV4 = maxValuationScore + maxTriggerScore + maxConfirmationScore;
  const totalScoreV4 = valuationScore + triggerScore + confirmationScore;

  const signalScoreV2Min3d = buildLatestRollingMin(staticHistory, latestDate, 'signalScoreV2', signalScoreV2);
  const totalScoreV4Min3d = buildLatestRollingMin(staticHistory, latestDate, 'totalScoreV4', totalScoreV4);
  const signalConfirmed3d = signalScoreV2Min3d !== null && maxSignalScoreV2 > 0
    ? (signalScoreV2Min3d / maxSignalScoreV2) >= SCORE_CONFIRM_RATIO
    : false;
  const signalConfirmed3dV4 = totalScoreV4Min3d !== null && maxTotalScoreV4 > 0
    ? (totalScoreV4Min3d / maxTotalScoreV4) >= SCORE_CONFIRM_RATIO
    : false;
  const signalBandV2 = classifyScoreBand(signalScoreV2, maxSignalScoreV2);
  const signalBandV4 = classifyScoreBand(totalScoreV4, maxTotalScoreV4);

  const reserveEffectiveFreshness = mvrvZscoreCoreActive ? mvrvZscoreFreshnessScore : 0;
  const dataFreshnessScore = round(
    (
      btcPriceFreshnessScore
      + realizedPriceFreshnessScore
      + ma200wFreshnessScore
      + sthMvrvFreshnessScore
      + lthMvrvFreshnessScore
      + puellFreshnessScore
      + reserveEffectiveFreshness
    ) / 7,
    6,
  );
  const baseScoreRatio = maxTotalScoreV4 > 0 ? totalScoreV4 / maxTotalScoreV4 : 0;
  const auxiliaryBonus = signalSthSoprAux ? 0.1 : 0;
  const confirmationBonus = signalConfirmed3dV4 ? 0.1 : 0;
  const fallbackPenalty = mvrvZscoreCoreActive ? 0 : 0.2;
  const signalConfidence = round(
    clamp(
      (0.5 * baseScoreRatio) + (0.3 * dataFreshnessScore) + auxiliaryBonus + confirmationBonus - fallbackPenalty,
      0,
      1,
    ),
    4,
  );

  const reserveRiskEffectiveDateLegacy = reserveRiskSourceMode === 'replacement'
    ? (reserveRiskReplacementSource === 'mvrv_zscore_data'
      ? (points.mvrvZscore?.d ?? latestDate)
      : (points.lthMvrv?.d ?? latestDate))
    : (points.reserveRisk?.d ?? latestDate);
  const indicatorLagDays = {
    priceMa200w: ma200wLagDays,
    priceRealized: realizedPriceLagDays,
    reserveRisk: reserveRiskLagDays,
    lthMvrv: lthMvrvLagDays,
    mvrvZscore: mvrvZscoreLagDays,
    sthSopr: sthSoprLagDays,
    sthMvrv: sthMvrvLagDays,
    puell: puellLagDays,
  };
  const indicatorDates = {
    priceMa200w: points.btcPrice?.d ?? latestDate,
    priceRealized: points.realizedPrice?.d ?? latestDate,
    reserveRisk: points.reserveRisk?.d ?? latestDate,
    lthMvrv: points.lthMvrv?.d ?? latestDate,
    mvrvZscore: points.mvrvZscore?.d ?? latestDate,
    sthSopr: points.sthSopr?.d ?? latestDate,
    sthMvrv: points.sthMvrv?.d ?? latestDate,
    puell: points.puellMultiple?.d ?? latestDate,
  };

  const staleIndicatorKeys = [];
  if (!ma200wIsFresh) staleIndicatorKeys.push('priceMa200w');
  if (!realizedPriceIsFresh) staleIndicatorKeys.push('priceRealized');
  if (!reserveRiskIsFresh) staleIndicatorKeys.push('reserveRisk');
  if (!sthSoprIsFresh) staleIndicatorKeys.push('sthSopr');
  if (!sthMvrvIsFresh) staleIndicatorKeys.push('sthMvrv');
  if (!lthMvrvIsFresh) staleIndicatorKeys.push('lthMvrv');
  if (!puellIsFresh) staleIndicatorKeys.push('puell');
  if (!mvrvZscoreCoreActive) staleIndicatorKeys.push('mvrvZscore');

  const staleIndicators = staleIndicatorKeys.map((key) => {
    const freshnessLimitMap = {
      priceMa200w: FRESHNESS_LIMITS.ma200w,
      priceRealized: FRESHNESS_LIMITS.realizedPrice,
      reserveRisk: RESERVE_RISK_DISABLE_LAG_DAYS,
      lthMvrv: FRESHNESS_LIMITS.lthMvrv,
      mvrvZscore: FRESHNESS_LIMITS.mvrvZscore,
      sthSopr: FRESHNESS_LIMITS.sthSopr,
      sthMvrv: FRESHNESS_LIMITS.sthMvrv,
      puell: FRESHNESS_LIMITS.puellMultiple,
    };

    return {
      key,
      lagDays: indicatorLagDays[key] ?? null,
      maxLagDays: freshnessLimitMap[key] ?? null,
      sourceDate: indicatorDates[key] ?? null,
    };
  });

  const inactiveIndicators = [];
  if (reserveRiskSourceMode === 'inactive') {
    inactiveIndicators.push({
      key: 'reserveRisk',
      reason: reserveRiskPrimaryLagDays !== null && reserveRiskPrimaryLagDays > RESERVE_RISK_DISABLE_LAG_DAYS
        ? 'primary_source_stale'
        : 'stale_source_lag',
      sourceDate: points.reserveRisk?.d ?? null,
      primarySourceDate: seriesPoints.reserveRiskPrimary?.d ?? null,
      latestDate,
      lagDays: reserveRiskLagDays,
      primaryLagDays: reserveRiskPrimaryLagDays,
      disableLagDays: RESERVE_RISK_DISABLE_LAG_DAYS,
      replacementCandidates: ['lth_mvrv', 'mvrv_zscore_data'],
    });
  }
  if (!mvrvZscoreCoreActive) {
    inactiveIndicators.push({
      key: 'mvrvZscore',
      reason: 'core_indicator_stale',
      sourceDate: points.mvrvZscore?.d ?? null,
      latestDate,
      lagDays: mvrvZscoreLagDays,
      disableLagDays: FRESHNESS_LIMITS.mvrvZscore,
    });
  }

  return {
    date: latestDate,
    btcPrice,
    realizedPrice: realizedPrice ?? 0,
    priceMa200wRatio,
    priceRealizedRatio,
    reserveRisk: reserveRisk ?? 0,
    lthMvrv,
    mvrvZscore,
    sthSopr: sthSopr ?? 0,
    sthMvrv: sthMvrv ?? 0,
    ma200w,
    puellMultiple: puellMultiple ?? 0,
    signalCount,
    activeIndicatorCount,
    signalCountV4,
    activeIndicatorCountV4,
    signalScoreV2,
    maxSignalScoreV2,
    signalScoreV2Min3d,
    signalConfirmed3d,
    signalBandV2,
    valuationScore,
    maxValuationScore,
    triggerScore,
    maxTriggerScore,
    confirmationScore,
    maxConfirmationScore,
    auxiliaryScore,
    maxAuxiliaryScore,
    totalScoreV4,
    maxTotalScoreV4,
    totalScoreV4Min3d,
    signalConfirmed3dV4,
    signalBandV4,
    signalConfidence,
    dataFreshnessScore,
    fallbackMode: mvrvZscoreCoreActive ? 'none' : 'mvrv_zscore_inactive',
    scorePriceMa200w,
    scorePriceRealized,
    scoreReserveRisk,
    scoreReserveRiskV4,
    scoreSthSopr,
    scoreSthMvrv,
    scorePuell,
    scoreReserveRiskPrimary,
    scoreReserveRiskReplacement,
    scoreLthMvrv,
    scoreMvrvZscore,
    scoreMvrvZscoreCore,
    scoreSthGroup,
    signalSthGroup,
    signalMvrvZscoreCore,
    scoringModelVersion: asString(staticLatest?.scoringModelVersion) ?? SCORING_MODEL_VERSION,
    legacyScoringModelVersion: asString(staticLatest?.legacyScoringModelVersion) ?? LEGACY_SCORING_MODEL_VERSION,
    reserveRiskActive,
    reserveRiskReplacementActive,
    reserveRiskReplacementSource,
    reserveRiskReplacementLagDays,
    reserveRiskSourceMode,
    reserveRiskSourceModeV4,
    reserveRiskSoftFallbackActive,
    reserveRiskFallbackLagDaysV4,
    reserveRiskLagDays,
    reserveRiskPrimaryLagDays,
    inactiveIndicators,
    staleIndicators,
    indicatorLagDays,
    signals: {
      priceMa200w: signalPriceMa200w,
      priceRealized: signalPriceRealized,
      reserveRisk: signalReserveRisk,
      sthSopr: signalSthSopr,
      sthMvrv: signalSthMvrv,
      sthGroup: signalSthGroup,
      puell: signalPuell,
    },
    signalsV4: {
      priceMa200w: signalPriceMa200w,
      priceRealized: signalPriceRealized,
      reserveRisk: signalReserveRiskV4,
      mvrvZscore: signalMvrvZscoreCore,
      sthMvrv: signalSthMvrv,
      lthMvrv: signalLthMvrv,
      puell: signalPuell,
      sthSoprAux: signalSthSoprAux,
    },
    indicatorDates: {
      ...indicatorDates,
      reserveRiskLegacy: reserveRiskEffectiveDateLegacy,
    },
    coreIndicatorSet: asString(staticLatest?.coreIndicatorSet) ?? CORE_INDICATOR_SET,
    schemaVersion: asString(staticLatest?.schemaVersion) ?? SCHEMA_VERSION,
    thresholds: {
      ...(asRecord(staticLatest?.thresholds) ?? {}),
      ...thresholds,
    },
    raw: {
      runtimeSource: 'bgeometrics_latest_v4',
      priceSource: points.btcPrice?.source ?? null,
      reserveRiskSource: points.reserveRisk?.source ?? null,
      reserveRiskV4Source: reserveRiskSourceModeV4,
    },
    lastUpdated: new Date().toISOString(),
  };
}

// SECTION: route handlers
async function fetchIndicatorRoute(path, request) {
  const routeConfig = INDICATOR_ROUTE_MAP[path];
  if (!routeConfig) {
    return null;
  }

  const staticLatest = await fetchStaticLatestSnapshot(request);
  let point = null;

  if (routeConfig.seriesKey === 'reserveRisk') {
    const [primary, backup] = await Promise.all([
      fetchLatestFilePoint('reserveRisk'),
      fetchReserveRiskBackupPoint(),
    ]);
    point = pickNewerPoint(primary, backup);
  } else {
    point = await fetchLatestFilePoint(routeConfig.seriesKey);
  }

  if (!point) {
    const snapshotKeyMap = {
      mvrvZscore: 'mvrvZscore',
      lthMvrv: 'lthMvrv',
      puellMultiple: 'puellMultiple',
      reserveRisk: 'reserveRisk',
      realizedPrice: 'realizedPrice',
      sthSopr: 'sthSopr',
      sthMvrv: 'sthMvrv',
      ma200w: 'ma200w',
    };

    point = buildSnapshotPoint(
      staticLatest,
      snapshotKeyMap[routeConfig.seriesKey],
      routeConfig.dateKey,
      asString(staticLatest?.date),
    );
  }

  return pointToArray(point, routeConfig.dataKey);
}

function buildSuccessResponse(payload, headers, cacheState = 'MISS') {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      ...headers,
      'Cache-Control': `public, max-age=${CACHE_DURATION}, s-maxage=${CACHE_DURATION}`,
      'X-Cache': cacheState,
    },
  });
}

export default async function handler(request) {
  const url = new URL(request.url);
  const rewrittenPath = url.searchParams.get('path');
  const path = rewrittenPath || url.pathname.replace('/api', '');
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    if (path === '/btc-data/latest' || path === '/btc-data' || path === '/btc-data/') {
      const runtimeInputs = await fetchRuntimeInputs(request);
      const payload = buildRuntimePayload(runtimeInputs);
      if (payload) {
        return buildSuccessResponse(payload, corsHeaders);
      }

      if (runtimeInputs.staticLatest) {
        return buildSuccessResponse(runtimeInputs.staticLatest, corsHeaders, 'STATIC');
      }
    }

    if (path === '/btc-data/v1/btc-price/1') {
      const runtimeInputs = await fetchRuntimeInputs(request);
      const priceArray = pointToArray(runtimeInputs.pricePoint, 'btcPrice');
      return buildSuccessResponse(priceArray, corsHeaders, runtimeInputs.pricePoint?.source ? 'LIVE' : 'FALLBACK');
    }

    const indicatorData = await fetchIndicatorRoute(path, request);
    if (indicatorData !== null) {
      return buildSuccessResponse(indicatorData, corsHeaders);
    }

    if (path.startsWith('/btc-data/history')) {
      return buildSuccessResponse(
        {
          message: 'History data should be fetched from static JSON file',
          hint: 'Use /btc_indicators_history.json instead',
        },
        corsHeaders,
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Unknown btc-data endpoint',
        path,
      }),
      {
        status: 404,
        headers: corsHeaders,
      },
    );
  } catch (error) {
    console.error('API Error:', error);

    const fallbackData = await fetchStaticLatestSnapshot(request);
    if (fallbackData) {
      return buildSuccessResponse(fallbackData, corsHeaders, 'FALLBACK');
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
