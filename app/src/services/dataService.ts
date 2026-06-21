import type { IndicatorData, LatestData, StrategyMnavData } from '@/types';

import {
  PROXY_URL,
} from './apiClient';
import {
  CACHE_DURATION,
  MANIFEST_CACHE_DURATION,
  REFRESH_INTERVAL,
  cache,
  getCachedDataStatus,
  isTimestampFresh,
  loadCachedResource,
  rememberLatestInCache,
} from './dataCache';
import type { DataManifest, FetchHistoricalOptions, FetchStaticLatestOptions, HistoryMode } from './contracts';
import { checkRemoteDataSources } from './dataSourceHealth';
import {
  buildHistoryRequestPlan,
  hasUsableCachedHistory,
} from './historyDataLoader';
import { loadHistoryWithFallbacks } from './historyFallbackLoader';
import {
  enrichLatestWithOptionalHistory,
  loadRuntimeLatestData,
  loadStaticLatestData,
} from './latestDataLoader';
import { loadLatestFromHistoryFallback, loadLocalLatestFallback } from './latestFallbackLoader';
import { loadDataManifest, loadStrategyMnavData } from './metadataDataLoader';
import { CORE8_COVERAGE_FIELDS } from './schema';
import {
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
} from './selectors';
import {
  getLocalData as readLocalData,
  getLocalLatestData as readLocalLatestData,
  saveLocalData as persistLocalData,
  validateLocalDataConsistency,
} from './storage';

function mergeCachedLatestIntoHistory(rows: IndicatorData[]): IndicatorData[] {
  return cache.latest ? mergeLatestIntoHistory(rows, cache.latest) : rows;
}

function rememberLatestData(latest: LatestData, timestamp = Date.now()): LatestData {
  return rememberLatestInCache(latest, {
    timestamp,
    mergeLatestIntoHistory,
    persistLatest: (value) => persistLocalData({ latest: value }),
  });
}

function rememberHistoryData(
  history: IndicatorData[],
  mode: Exclude<HistoryMode, 'none'>,
): IndicatorData[] {
  persistLocalData({ history });
  cache.history = history;
  cache.historyMode = mode;
  return history;
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
  return loadCachedResource({
    forceRefresh,
    cachedValue: cache.manifest,
    cachedTimestamp: cache.manifestTimestamp,
    durationMs: MANIFEST_CACHE_DURATION,
    load: loadDataManifest,
    remember: (manifest, timestamp) => {
      cache.manifest = manifest;
      cache.manifestTimestamp = timestamp;
    },
    onError: (error) => {
      console.error('[DataService] Error fetching manifest:', error);
    },
  });
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

  const remoteHistory = await loadHistoryWithFallbacks({
    plan,
    cachedHistory: cache.history,
    cacheHistoryMode: cache.historyMode,
    mergeLatestIntoRows: mergeCachedLatestIntoHistory,
    rememberHistory: rememberHistoryData,
  });
  if (remoteHistory.loaded) {
    return remoteHistory.history;
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

export async function fetchStrategyMnavData(forceRefresh = false): Promise<StrategyMnavData | null> {
  return loadCachedResource({
    forceRefresh,
    cachedValue: cache.strategyMnav,
    cachedTimestamp: cache.strategyMnavTimestamp,
    durationMs: MANIFEST_CACHE_DURATION,
    load: loadStrategyMnavData,
    remember: (data, timestamp) => {
      cache.strategyMnav = data;
      cache.strategyMnavTimestamp = timestamp;
    },
    onError: (error) => {
      console.error('[DataService] Error fetching Strategy mNAV data:', error);
    },
  });
}

export async function fetchStaticLatestData(options: FetchStaticLatestOptions = {}): Promise<LatestData | null> {
  const now = Date.now();
  const enrichWithHistory = options.enrichWithHistory ?? false;
  const forceRefresh = options.forceRefresh ?? false;

  if (!forceRefresh && cache.latest && isTimestampFresh(cache.latestTimestamp, now, CACHE_DURATION)) {
    if (!enrichWithHistory) {
      return cache.latest;
    }

    return enrichLatestWithOptionalHistory(cache.latest, cache.history);
  }

  try {
    const latest = await loadStaticLatestData(cache.history, enrichWithHistory);
    return rememberLatestData(latest, now);
  } catch (error) {
    console.error('[DataService] Error fetching latest static data:', error);
    return loadLocalLatestFallback({
      enrichWithHistory,
      readLocalLatest: readLocalLatestData,
      readLocalHistory: readLocalData,
    });
  }
}

export async function fetchRuntimeLatestData(): Promise<LatestData | null> {
  if (!PROXY_URL) {
    return null;
  }

  try {
    const latest = await loadRuntimeLatestData(cache.history);
    return rememberLatestData(latest);
  } catch (error) {
    console.error('[DataService] Error fetching runtime latest data:', error);
    return null;
  }
}

export async function fetchAllLatestIndicators(useCache = true): Promise<LatestData | null> {
  const now = Date.now();
  if (useCache && cache.latest && isTimestampFresh(cache.latestTimestamp, now, CACHE_DURATION)) {
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

    return loadLatestFromHistoryFallback({
      timestamp: now,
      fetchHistory: fetchHistoricalData,
      getLatestFromHistory,
      rememberLatest: rememberLatestData,
    });
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
  const remoteHealth = await checkRemoteDataSources();

  return {
    ...remoteHealth,
    localAvailable: !!readLocalLatestData(),
  };
}

export function getDataStatus(): {
  cacheAge: number;
  cacheValid: boolean;
  lastUpdate: string | null;
} {
  return getCachedDataStatus();
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
