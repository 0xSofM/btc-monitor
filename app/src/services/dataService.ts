import type { IndicatorData, LatestData, StrategyMnavData } from '@/types';

import {
  API_BASE_URL,
  PROXY_URL,
  STATIC_HISTORY_FULL_PATH,
  STATIC_HISTORY_LIGHT_PATH,
  checkEndpoint,
  fetchRuntimeLatestRaw,
  fetchStaticHistoryShardsRaw,
  fetchStaticHistoryRaw,
  fetchStaticLatestRaw,
  fetchStaticManifestRaw,
  fetchStaticStrategyMnavRaw,
} from './apiClient';
import type { DataManifest, FetchHistoricalOptions, FetchStaticLatestOptions } from './contracts';
import { normalizeIndicatorData, normalizeLatestData, normalizeStrategyMnavData, toFiniteNumber } from './normalizers';
import { CORE8_COVERAGE_FIELDS, missingCoreHistoryFields } from './schema';
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
  historyMode: 'none' | 'light' | 'full';
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

function normalizeHistoryRows(rawRows: unknown[]): IndicatorData[] {
  return rawRows
    .map((item) => normalizeIndicatorData(item))
    .filter((item): item is IndicatorData => item !== null)
    .sort((left, right) => left.d.localeCompare(right.d));
}

function getYearlyHistoryPaths(manifest: DataManifest | null): string[] {
  const yearly = manifest?.historyFiles?.yearly;
  if (!yearly) {
    return [];
  }

  return Object.entries(yearly)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, path]) => path)
    .filter((path) => path.trim().length > 0);
}

async function fetchFullHistoricalRaw(timeoutMs: number): Promise<unknown[]> {
  const manifest = await fetchDataManifest();
  const yearlyPaths = getYearlyHistoryPaths(manifest);
  if (yearlyPaths.length > 0) {
    try {
      return await fetchStaticHistoryShardsRaw(yearlyPaths, timeoutMs);
    } catch (error) {
      console.error('[DataService] Error fetching yearly historical shards:', error);
    }
  }

  return fetchStaticHistoryRaw(STATIC_HISTORY_FULL_PATH, timeoutMs);
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
  const historyLightRows = toFiniteNumber(record.historyLightRows, Number.NaN);
  const schemaVersion = typeof record.schemaVersion === 'string' ? record.schemaVersion : 'unknown';
  const signalEventsV4Rows = toFiniteNumber(record.signalEventsV4Rows, 0);
  const indicatorSet = typeof record.indicatorSet === 'string' ? record.indicatorSet : undefined;
  const scoringModelVersion = typeof record.scoringModelVersion === 'string' ? record.scoringModelVersion : undefined;
  const activeIndicatorCountV4 = toFiniteNumber(record.activeIndicatorCountV4, Number.NaN);
  const maxTotalScoreV4 = toFiniteNumber(record.maxTotalScoreV4, Number.NaN);
  const activeIndicatorCountV6 = toFiniteNumber(record.activeIndicatorCountV6, Number.NaN);
  const maxTotalScoreV6 = toFiniteNumber(record.maxTotalScoreV6, Number.NaN);

  const historyFilesPayload = record.historyFiles && typeof record.historyFiles === 'object'
    ? record.historyFiles as Record<string, unknown>
    : null;
  const historyFiles = historyFilesPayload
    ? {
        full: typeof historyFilesPayload.full === 'string' ? historyFilesPayload.full : undefined,
        light: typeof historyFilesPayload.light === 'string' ? historyFilesPayload.light : undefined,
        lightRecentDays: toFiniteNumber(historyFilesPayload.lightRecentDays, Number.NaN),
        lightFields: Array.isArray(historyFilesPayload.lightFields)
          ? historyFilesPayload.lightFields.filter((item): item is string => typeof item === 'string')
          : undefined,
        yearly: historyFilesPayload.yearly && typeof historyFilesPayload.yearly === 'object'
          ? Object.fromEntries(
              Object.entries(historyFilesPayload.yearly as Record<string, unknown>)
                .filter((entry): entry is [string, string] => (
                  /^\d{4}$/.test(entry[0]) && typeof entry[1] === 'string' && entry[1].trim().length > 0
                ))
                .sort(([left], [right]) => left.localeCompare(right)),
            )
          : undefined,
      }
    : undefined;
  const dataHealth = record.dataHealth && typeof record.dataHealth === 'object'
    ? record.dataHealth as DataManifest['dataHealth']
    : undefined;
  const auxiliaryDataFiles = record.auxiliaryDataFiles && typeof record.auxiliaryDataFiles === 'object'
    ? record.auxiliaryDataFiles as DataManifest['auxiliaryDataFiles']
    : undefined;
  const strategyMnavHealth = record.strategyMnavHealth && typeof record.strategyMnavHealth === 'object'
    ? record.strategyMnavHealth as DataManifest['strategyMnavHealth']
    : undefined;
  const schemaContract = record.schemaContract && typeof record.schemaContract === 'object'
    ? record.schemaContract as DataManifest['schemaContract']
    : undefined;
  const schemaContractMissingFields = missingCoreHistoryFields(
    schemaContract?.historyRequiredFields ?? historyFiles?.lightFields,
  );

  if (!generatedAt || !latestDate) {
    return null;
  }

  return {
    generatedAt,
    latestDate,
    lastUpdated,
    historyRows,
    historyLightRows: Number.isNaN(historyLightRows) ? undefined : historyLightRows,
    historyFiles: historyFiles
      ? {
          ...historyFiles,
          lightRecentDays: Number.isNaN(historyFiles.lightRecentDays ?? Number.NaN)
            ? undefined
            : historyFiles.lightRecentDays,
        }
      : undefined,
    schemaVersion,
    signalEventsV4Rows: signalEventsV4Rows > 0 ? signalEventsV4Rows : undefined,
    indicatorSet,
    scoringModelVersion,
    activeIndicatorCountV4: Number.isNaN(activeIndicatorCountV4) ? undefined : activeIndicatorCountV4,
    maxTotalScoreV4: Number.isNaN(maxTotalScoreV4) ? undefined : maxTotalScoreV4,
    activeIndicatorCountV6: Number.isNaN(activeIndicatorCountV6) ? undefined : activeIndicatorCountV6,
    maxTotalScoreV6: Number.isNaN(maxTotalScoreV6) ? undefined : maxTotalScoreV6,
    dataHealth,
    auxiliaryDataFiles,
    strategyMnavHealth,
    schemaContract: schemaContract
      ? {
          ...schemaContract,
          missingCoreHistoryFields: schemaContractMissingFields,
        }
      : {
          missingCoreHistoryFields: schemaContractMissingFields,
        },
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
  const full = options.full ?? false;
  const requestedMode: CacheState['historyMode'] = full ? 'full' : 'light';
  const historyPath = full ? STATIC_HISTORY_FULL_PATH : STATIC_HISTORY_LIGHT_PATH;
  const timeoutMs = full ? 120000 : 30000;

  if (
    !forceRefresh
    && cache.history.length > 0
    && (cache.historyMode === requestedMode || cache.historyMode === 'full')
  ) {
    return cache.history;
  }

  try {
    const raw = full
      ? await fetchFullHistoricalRaw(timeoutMs)
      : await fetchStaticHistoryRaw(historyPath, timeoutMs);
    const history = mergeCachedLatestIntoHistory(normalizeHistoryRows(raw));
    if (requestedMode === 'light' && cache.historyMode === 'full') {
      return cache.history;
    }

    persistLocalData({ history });
    cache.history = history;
    cache.historyMode = requestedMode;
    return history;
  } catch (error) {
    console.error(`[DataService] Error fetching historical data (${historyPath}):`, error);

    if (!full) {
      try {
        const raw = await fetchFullHistoricalRaw(120000);
        const history = mergeCachedLatestIntoHistory(normalizeHistoryRows(raw));
        persistLocalData({ history });
        cache.history = history;
        cache.historyMode = 'full';
        return history;
      } catch (fallbackError) {
        console.error(`[DataService] Error fetching fallback full historical data (${STATIC_HISTORY_FULL_PATH}):`, fallbackError);
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
    const raw = await fetchStaticStrategyMnavRaw();
    const data = normalizeStrategyMnavData(raw);
    if (!data) {
      throw new Error('Invalid Strategy mNAV data format');
    }

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
    checkEndpoint(STATIC_HISTORY_FULL_PATH),
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
