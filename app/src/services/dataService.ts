import type { IndicatorData, LatestData } from '@/types';

import {
  API_BASE_URL,
  PROXY_URL,
  STATIC_HISTORY_FULL_PATH,
  STATIC_HISTORY_LIGHT_PATH,
  checkEndpoint,
  fetchRuntimeLatestRaw,
  fetchStaticHistoryRaw,
  fetchStaticLatestRaw,
  fetchStaticManifestRaw,
} from './apiClient';
import type { DataManifest, FetchHistoricalOptions, FetchStaticLatestOptions, HistoryMode } from './contracts';
import { normalizeIndicatorData, normalizeLatestData, toFiniteNumber } from './normalizers';
import {
  INDICATOR_CONFIG,
  TIME_RANGE_LABELS,
  enrichLatestDataWithHistory,
  getDataFreshnessHours,
  getIndicatorChartData,
  getLatestFromHistory,
  getMA200ChartData,
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
  historyLight: IndicatorData[];
  historyFull: IndicatorData[];
  latestTimestamp: number;
  manifest: DataManifest | null;
  manifestTimestamp: number;
};

const cache: CacheState = {
  latest: null,
  historyLight: [],
  historyFull: [],
  latestTimestamp: 0,
  manifest: null,
  manifestTimestamp: 0,
};

function hasCore6Coverage(rows: IndicatorData[]): boolean {
  if (!rows.length) {
    return false;
  }

  const recent = rows.slice(-Math.min(rows.length, 365));
  const required: Array<keyof IndicatorData> = [
    'priceMa200wRatio',
    'priceRealizedRatio',
    'mvrvZscore',
    'lthMvrv',
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
  const historyLightRows = toFiniteNumber(record.historyLightRows, 0);
  const schemaVersion = typeof record.schemaVersion === 'string' ? record.schemaVersion : 'unknown';

  if (!generatedAt || !latestDate) {
    return null;
  }

  return {
    generatedAt,
    latestDate,
    lastUpdated,
    historyRows,
    historyLightRows,
    schemaVersion,
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
  const mode: HistoryMode = options.mode ?? 'light';
  const forceRefresh = options.forceRefresh ?? false;

  if (mode === 'light' && !forceRefresh && cache.historyLight.length > 0) {
    return cache.historyLight;
  }

  if (mode === 'full' && !forceRefresh && cache.historyFull.length > 0) {
    return cache.historyFull;
  }

  const primaryPath = mode === 'full' ? STATIC_HISTORY_FULL_PATH : STATIC_HISTORY_LIGHT_PATH;
  const primaryTimeout = mode === 'full' ? 120000 : 30000;
  const fallbackPath = mode === 'light' ? STATIC_HISTORY_FULL_PATH : null;

  try {
    const primaryRaw = await fetchStaticHistoryRaw(primaryPath, primaryTimeout);
    const primaryData = normalizeHistoryRows(primaryRaw);
    persistLocalData({ history: primaryData });

    if (mode === 'full') {
      cache.historyFull = primaryData;
      if (cache.historyLight.length === 0) {
        cache.historyLight = primaryData;
      }
    } else {
      cache.historyLight = primaryData;
    }

    return primaryData;
  } catch (primaryError) {
    if (mode === 'full') {
      console.warn(`[DataService] Full history source failed (${primaryPath}).`, primaryError);
      const localHistory = readLocalData();
      if (localHistory.length > 0 && hasCore6Coverage(localHistory)) {
        cache.historyFull = localHistory;
        return localHistory;
      }
      return [];
    }

    console.warn(`[DataService] Primary history source failed (${primaryPath}), trying fallback (${fallbackPath}).`, primaryError);

    try {
      if (!fallbackPath) {
        return [];
      }

      const fallbackRaw = await fetchStaticHistoryRaw(fallbackPath, 30000);
      const fallbackData = normalizeHistoryRows(fallbackRaw);
      persistLocalData({ history: fallbackData });

      cache.historyLight = fallbackData;

      return fallbackData;
    } catch (fallbackError) {
      console.error('[DataService] Error fetching historical data:', fallbackError);

      const localHistory = readLocalData();
      if (localHistory.length > 0) {
        cache.historyLight = localHistory;
      }

      return localHistory;
    }
  }
}

export async function fetchFullHistoricalData(forceRefresh = false): Promise<IndicatorData[]> {
  return fetchHistoricalData({ mode: 'full', forceRefresh });
}

export async function fetchStaticLatestData(options: FetchStaticLatestOptions = {}): Promise<LatestData | null> {
  const now = Date.now();
  const enrichWithHistory = options.enrichWithHistory ?? false;
  const forceRefresh = options.forceRefresh ?? false;

  if (!forceRefresh && cache.latest && (now - cache.latestTimestamp) < CACHE_DURATION) {
    if (!enrichWithHistory) {
      return cache.latest;
    }

    const history = cache.historyLight.length > 0
      ? cache.historyLight
      : (cache.historyFull.length > 0 ? cache.historyFull : await fetchHistoricalData({ mode: 'light' }));

    return enrichLatestDataWithHistory(cache.latest, history);
  }

  try {
    const raw = await fetchStaticLatestRaw();
    const normalized = normalizeLatestData(raw);
    if (!normalized) {
      throw new Error('Invalid latest static data format');
    }

    let latest = normalized;
    if (enrichWithHistory) {
      const history = cache.historyLight.length > 0
        ? cache.historyLight
        : (cache.historyFull.length > 0 ? cache.historyFull : await fetchHistoricalData({ mode: 'light' }));

      latest = enrichLatestDataWithHistory(latest, history);
    }

    cache.latest = latest;
    cache.latestTimestamp = now;
    persistLocalData({ latest });
    return latest;
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

    const history = cache.historyLight.length > 0
      ? cache.historyLight
      : (cache.historyFull.length > 0 ? cache.historyFull : await fetchHistoricalData({ mode: 'light' }));

    return enrichLatestDataWithHistory(normalized, history);
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

    const historyData = await fetchHistoricalData({ mode: 'light' });
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
  getDataFreshnessHours,
  getIndicatorChartData,
  getLatestFromHistory,
  getMA200ChartData,
  getSignalEvents,
  validateLocalDataConsistency,
};
