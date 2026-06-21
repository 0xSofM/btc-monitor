import type { IndicatorData, LatestData, StrategyMnavData } from '@/types';

import {
  API_BASE_URL,
  PROXY_URL,
  STATIC_HISTORY_FULL_LIGHT_PATH,
  STATIC_HISTORY_LIGHT_PATH,
  checkEndpoint,
  fetchRuntimeLatestRaw,
  fetchStaticLatestRaw,
} from './apiClient';
import type { DataManifest, FetchHistoricalOptions, FetchStaticLatestOptions, HistoryMode } from './contracts';
import {
  buildHistoryRequestPlan,
  fetchHistoryRows,
  hasUsableCachedHistory,
} from './historyDataLoader';
import { loadDataManifest, loadStrategyMnavData } from './metadataDataLoader';
import { normalizeLatestData } from './normalizers';
import { CORE8_COVERAGE_FIELDS } from './schema';
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
  historyMode: HistoryMode;
  latestTimestamp: number;
  manifest: DataManifest | null;
  manifestTimestamp: number;
  strategyMnav: StrategyMnavData | null;
  strategyMnavTimestamp: number;
};

const cache: CacheState = {
  latest: null,
  history: [],
  historyMode: 'none',
  latestTimestamp: 0,
  manifest: null,
  manifestTimestamp: 0,
  strategyMnav: null,
  strategyMnavTimestamp: 0,
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

  return CORE8_COVERAGE_FIELDS.every((field) =>
    recent.some((row) => row[field] !== null && row[field] !== undefined),
  );
}

export async function fetchDataManifest(forceRefresh = false): Promise<DataManifest | null> {
  const now = Date.now();
  if (!forceRefresh && cache.manifest && (now - cache.manifestTimestamp) < MANIFEST_CACHE_DURATION) {
    return cache.manifest;
  }

  try {
    const manifest = await loadDataManifest();
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
  const plan = buildHistoryRequestPlan(options.full ?? false);

  if (
    !forceRefresh
    && hasUsableCachedHistory(cache.historyMode, plan.mode, cache.history.length)
  ) {
    return cache.history;
  }

  try {
    const loaded = await fetchHistoryRows(plan.primaryPath, plan.primaryTimeoutMs, plan.mode);
    const history = mergeCachedLatestIntoHistory(loaded.rows);
    if (plan.mode === 'light' && cache.historyMode === 'full') {
      return cache.history;
    }

    persistLocalData({ history });
    cache.history = history;
    cache.historyMode = loaded.mode;
    return history;
  } catch (error) {
    console.error(`[DataService] Error fetching historical data (${plan.primaryPath}):`, error);

    try {
      const loaded = await fetchHistoryRows(plan.fallbackPath, plan.fallbackTimeoutMs, 'full');
      const history = mergeCachedLatestIntoHistory(loaded.rows);
      persistLocalData({ history });
      cache.history = history;
      cache.historyMode = loaded.mode;
      return history;
    } catch (fallbackError) {
      console.error(`[DataService] Error fetching fallback historical data (${plan.fallbackPath}):`, fallbackError);
    }

    if (plan.legacyFullPath && plan.legacyFullTimeoutMs) {
      try {
        const loaded = await fetchHistoryRows(plan.legacyFullPath, plan.legacyFullTimeoutMs, 'full');
        const history = mergeCachedLatestIntoHistory(loaded.rows);
        persistLocalData({ history });
        cache.history = history;
        cache.historyMode = loaded.mode;
        return history;
      } catch (fallbackError) {
        console.error(`[DataService] Error fetching fallback full historical data (${plan.legacyFullPath}):`, fallbackError);
      }
    }

    const localHistory = readLocalData();
    if (localHistory.length > 0 && hasCore8Coverage(localHistory)) {
      const mergedLocalHistory = mergeCachedLatestIntoHistory(localHistory);
      cache.history = mergedLocalHistory;
      cache.historyMode = 'light';
      return mergedLocalHistory;
    }

    return [];
  }
}

export async function fetchStrategyMnavData(forceRefresh = false): Promise<StrategyMnavData | null> {
  const now = Date.now();
  if (!forceRefresh && cache.strategyMnav && (now - cache.strategyMnavTimestamp) < MANIFEST_CACHE_DURATION) {
    return cache.strategyMnav;
  }

  try {
    const data = await loadStrategyMnavData();
    cache.strategyMnav = data;
    cache.strategyMnavTimestamp = now;
    return data;
  } catch (error) {
    console.error('[DataService] Error fetching Strategy mNAV data:', error);
    return cache.strategyMnav;
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
  historyLightAvailable: boolean;
  historyFullAvailable: boolean;
  localAvailable: boolean;
  manifestAvailable: boolean;
}> {
  const [apiAvailable, historyLightAvailable, historyFullAvailable, manifestAvailable] = await Promise.all([
    checkEndpoint(`${API_BASE_URL}/v1/btc-price/1`),
    checkEndpoint(STATIC_HISTORY_LIGHT_PATH),
    checkEndpoint(STATIC_HISTORY_FULL_LIGHT_PATH),
    checkEndpoint('/btc_indicators_manifest.json'),
  ]);

  const proxyAvailable = PROXY_URL
    ? await checkEndpoint(`${PROXY_URL}/latest`)
    : false;

  return {
    apiAvailable,
    proxyAvailable,
    historyAvailable: historyLightAvailable || historyFullAvailable,
    historyLightAvailable,
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
