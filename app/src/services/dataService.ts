import type { IndicatorData, LatestData } from '@/types';

import {
  API_BASE_URL,
  PROXY_URL,
  STATIC_HISTORY_FULL_PATH,
  checkEndpoint,
  fetchRuntimeLatestRaw,
  fetchStaticHistoryRaw,
  fetchStaticLatestRaw,
  fetchStaticManifestRaw,
} from './apiClient';
import type { DataManifest, FetchHistoricalOptions, FetchStaticLatestOptions } from './contracts';
import { normalizeIndicatorData, normalizeLatestData, toFiniteNumber } from './normalizers';
import {
  INDICATOR_CONFIG,
  TIME_RANGE_LABELS,
  enrichLatestDataWithHistory,
  getEffectiveDataDate,
  getDataFreshnessHours,
  getPriceFreshnessHours,
  getOnchainFreshnessHours,
  getIndicatorChartData,
  getLatestFromHistory,
  getMA200ChartData,
  mergeLatestIntoHistory,
  getSignalEvents,
} from './selectors';
import {
  getLocalData as readLocalData,
  getLocalLatestData as readLocalLatestData,
  saveLocalData as persistLocalData,
  validateLocalDataConsistency,
} from './storage';

const REFRESH_INTERVAL = 5 * 60 * 1000;
const CACHE_DURATION = 60 * 1000;
const MANIFEST_CACHE_DURATION = 60 * 1000;

type CacheState = {
  latest: LatestData | null;
  history: IndicatorData[];
  latestTimestamp: number;
  manifest: DataManifest | null;
  manifestTimestamp: number;
};

const cache: CacheState = {
  latest: null,
  history: [],
  latestTimestamp: 0,
  manifest: null,
  manifestTimestamp: 0,
};

function mergeCachedLatestIntoHistory(rows: IndicatorData[]): IndicatorData[] {
  return cache.latest ? mergeLatestIntoHistory(rows, cache.latest) : rows;
}

function rememberLatestData(latest: LatestData, timestamp = Date.now()): LatestData {
  cache.latest = latest;
  cache.latestTimestamp = timestamp;

  if (cache.history.length > 0) {
    cache.history = mergeLatestIntoHistory(cache.history, latest);
  }

  persistLocalData({ latest });
  return latest;
}

export function hasCore8Coverage(rows: IndicatorData[]): boolean {
  if (!rows.length) {
    return false;
  }

  const recent = rows.slice(-Math.min(rows.length, 365));
  const required: Array<keyof IndicatorData> = [
    'priceMa200wRatio',
    'priceRealizedRatio',
    'mvrvZscore',
    'nupl',
    'lthMvrv',
    'lthSopr',
    'sthSopr',
    'sthMvrv',
    'puellMultiple',
  ];

  return required.every((field) =>
    recent.some((row) => row[field] !== null && row[field] !== undefined),
  );
}

function normalizeHistoryRows(rawRows: unknown[]): IndicatorData[] {
  return rawRows
    .map((item) => normalizeIndicatorData(item))
    .filter((item): item is IndicatorData => item !== null)
    .sort((left, right) => left.d.localeCompare(right.d));
}

function normalizeManifest(raw: unknown): DataManifest | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const generatedAt = typeof record.generatedAt === 'string' ? record.generatedAt : '';
  const latestDate = typeof record.latestDate === 'string' ? record.latestDate : '';
  const lastUpdated = typeof record.lastUpdated === 'string' ? record.lastUpdated : '';
  const historyRows = toFiniteNumber(record.historyRows, 0);
  const schemaVersion = typeof record.schemaVersion === 'string' ? record.schemaVersion : 'unknown';
  const signalEventsV4Rows = toFiniteNumber(record.signalEventsV4Rows, 0);
  const indicatorSet = typeof record.indicatorSet === 'string' ? record.indicatorSet : undefined;
  const scoringModelVersion = typeof record.scoringModelVersion === 'string' ? record.scoringModelVersion : undefined;
  const activeIndicatorCountV4 = toFiniteNumber(record.activeIndicatorCountV4, Number.NaN);
  const maxTotalScoreV4 = toFiniteNumber(record.maxTotalScoreV4, Number.NaN);
  const activeIndicatorCountV6 = toFiniteNumber(record.activeIndicatorCountV6, Number.NaN);
  const maxTotalScoreV6 = toFiniteNumber(record.maxTotalScoreV6, Number.NaN);

  if (!generatedAt || !latestDate) {
    return null;
  }

  return {
    generatedAt,
    latestDate,
    lastUpdated,
    historyRows,
    schemaVersion,
    signalEventsV4Rows: signalEventsV4Rows > 0 ? signalEventsV4Rows : undefined,
    indicatorSet,
    scoringModelVersion,
    activeIndicatorCountV4: Number.isNaN(activeIndicatorCountV4) ? undefined : activeIndicatorCountV4,
    maxTotalScoreV4: Number.isNaN(maxTotalScoreV4) ? undefined : maxTotalScoreV4,
    activeIndicatorCountV6: Number.isNaN(activeIndicatorCountV6) ? undefined : activeIndicatorCountV6,
    maxTotalScoreV6: Number.isNaN(maxTotalScoreV6) ? undefined : maxTotalScoreV6,
  };
}

export async function fetchDataManifest(forceRefresh = false): Promise<DataManifest | null> {
  const now = Date.now();
  if (!forceRefresh && cache.manifest && (now - cache.manifestTimestamp) < MANIFEST_CACHE_DURATION) {
    return cache.manifest;
  }

  try {
    const raw = await fetchStaticManifestRaw();
    const manifest = normalizeManifest(raw);
    if (!manifest) {
      throw new Error('Invalid manifest format');
    }

    cache.manifest = manifest;
    cache.manifestTimestamp = now;
    return manifest;
  } catch (error) {
    console.error('[DataService] Error fetching manifest:', error);
    return cache.manifest;
  }
}

export async function fetchHistoricalData(options: FetchHistoricalOptions = {}): Promise<IndicatorData[]> {
  const forceRefresh = options.forceRefresh ?? false;

  if (!forceRefresh && cache.history.length > 0) {
    return cache.history;
  }

  try {
    const raw = await fetchStaticHistoryRaw(STATIC_HISTORY_FULL_PATH, 120000);
    const history = mergeCachedLatestIntoHistory(normalizeHistoryRows(raw));
    persistLocalData({ history });
    cache.history = history;
    return history;
  } catch (error) {
    console.error(`[DataService] Error fetching full historical data (${STATIC_HISTORY_FULL_PATH}):`, error);

    const localHistory = readLocalData();
    if (localHistory.length > 0 && hasCore8Coverage(localHistory)) {
      const mergedLocalHistory = mergeCachedLatestIntoHistory(localHistory);
      cache.history = mergedLocalHistory;
      return mergedLocalHistory;
    }

    return [];
  }
}

export async function fetchStaticLatestData(options: FetchStaticLatestOptions = {}): Promise<LatestData | null> {
  const now = Date.now();
  const enrichWithHistory = options.enrichWithHistory ?? false;
  const forceRefresh = options.forceRefresh ?? false;

  if (!forceRefresh && cache.latest && (now - cache.latestTimestamp) < CACHE_DURATION) {
    if (!enrichWithHistory) {
      return cache.latest;
    }

    return cache.history.length > 0
      ? enrichLatestDataWithHistory(cache.latest, cache.history)
      : cache.latest;
  }

  try {
    const raw = await fetchStaticLatestRaw();
    const normalized = normalizeLatestData(raw);
    if (!normalized) {
      throw new Error('Invalid latest static data format');
    }

    let latest = normalized;
    if (enrichWithHistory && cache.history.length > 0) {
      latest = enrichLatestDataWithHistory(latest, cache.history);
    }

    return rememberLatestData(latest, now);
  } catch (error) {
    console.error('[DataService] Error fetching latest static data:', error);

    const localLatest = readLocalLatestData();
    if (!localLatest) {
      return null;
    }

    if (!enrichWithHistory) {
      return localLatest;
    }

    const localHistory = readLocalData();
    return enrichLatestDataWithHistory(localLatest, localHistory);
  }
}

export async function fetchRuntimeLatestData(): Promise<LatestData | null> {
  if (!PROXY_URL) {
    return null;
  }

  try {
    const raw = await fetchRuntimeLatestRaw();
    const normalized = normalizeLatestData(raw);
    if (!normalized) {
      throw new Error('Invalid runtime latest data format');
    }

    const latest = cache.history.length > 0
      ? enrichLatestDataWithHistory(normalized, cache.history)
      : normalized;
    return rememberLatestData(latest);
  } catch (error) {
    console.error('[DataService] Error fetching runtime latest data:', error);
    return null;
  }
}

export async function fetchAllLatestIndicators(useCache = true): Promise<LatestData | null> {
  const now = Date.now();
  if (useCache && cache.latest && (now - cache.latestTimestamp) < CACHE_DURATION) {
    return cache.latest;
  }

  try {
    const staticLatest = await fetchStaticLatestData({
      enrichWithHistory: true,
      forceRefresh: !useCache,
    });
    if (staticLatest) {
      return staticLatest;
    }

    const historyData = await fetchHistoricalData();
    const latestFromHistory = getLatestFromHistory(historyData);
    if (latestFromHistory) {
      cache.latest = latestFromHistory;
      cache.latestTimestamp = now;
      persistLocalData({ latest: latestFromHistory });
    }
    return latestFromHistory;
  } catch (error) {
    console.error('[DataService] Error fetching latest indicators:', error);
    return readLocalLatestData();
  }
}

export function startAutoRefresh(
  callback: (data: LatestData) => void,
  interval = REFRESH_INTERVAL,
): () => void {
  let active = true;

  const refresh = async () => {
    if (!active) {
      return;
    }

    try {
      const latest = await fetchAllLatestIndicators(false);
      if (latest && active) {
        callback(latest);
      }
    } catch (error) {
      console.error('[DataService] Auto refresh error:', error);
    }
  };

  void refresh();
  const timer = setInterval(() => {
    void refresh();
  }, interval);

  return () => {
    active = false;
    clearInterval(timer);
  };
}

export async function checkDataSource(): Promise<{
  apiAvailable: boolean;
  proxyAvailable: boolean;
  historyAvailable: boolean;
  historyFullAvailable: boolean;
  localAvailable: boolean;
  manifestAvailable: boolean;
}> {
  const [apiAvailable, historyFullAvailable, manifestAvailable] = await Promise.all([
    checkEndpoint(`${API_BASE_URL}/v1/btc-price/1`),
    checkEndpoint(STATIC_HISTORY_FULL_PATH),
    checkEndpoint('/btc_indicators_manifest.json'),
  ]);

  const proxyAvailable = PROXY_URL
    ? await checkEndpoint(`${PROXY_URL}/latest`)
    : false;

  return {
    apiAvailable,
    proxyAvailable,
    historyAvailable: historyFullAvailable,
    historyFullAvailable,
    localAvailable: !!readLocalLatestData(),
    manifestAvailable,
  };
}

export function getDataStatus(): {
  cacheAge: number;
  cacheValid: boolean;
  lastUpdate: string | null;
} {
  const cacheAgeMs = Date.now() - cache.latestTimestamp;

  return {
    cacheAge: Math.floor(cacheAgeMs / 1000),
    cacheValid: cache.latest !== null && cacheAgeMs < CACHE_DURATION,
    lastUpdate: cache.latest?.date ?? null,
  };
}

export const getLocalData = readLocalData;
export const getLocalLatestData = readLocalLatestData;
export const saveLocalData = persistLocalData;

export {
  INDICATOR_CONFIG,
  TIME_RANGE_LABELS,
  getEffectiveDataDate,
  getDataFreshnessHours,
  getPriceFreshnessHours,
  getOnchainFreshnessHours,
  getIndicatorChartData,
  getLatestFromHistory,
  getMA200ChartData,
  mergeLatestIntoHistory,
  getSignalEvents,
  validateLocalDataConsistency,
};
