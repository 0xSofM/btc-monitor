import type { IndicatorData, LatestData } from '@/types';

import {
  API_BASE_URL,
  PROXY_URL,
  STATIC_HISTORY_FULL_PATH,
  STATIC_HISTORY_LIGHT_PATH,
  checkEndpoint,
  fetchBtcPrice,
  fetchLthMvrv,
  fetchMvrvZScore,
  fetchNupl,
  fetchPuellMultiple,
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
const MA200W_LOOKBACK_DAYS = 1400;

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

function getMa200wFromHistory(data: IndicatorData[]): number | null {
  const lastWithMa200w = [...data].reverse().find((item) => {
    if (item.ma200w && item.ma200w > 0) {
      return true;
    }

    if (!item.priceMa200wRatio || item.priceMa200wRatio <= 0) {
      return false;
    }

    const price = toFiniteNumber(item.btcPrice, 0);
    return price > 0;
  });

  if (!lastWithMa200w) {
    return null;
  }

  if (lastWithMa200w.ma200w && lastWithMa200w.ma200w > 0) {
    return lastWithMa200w.ma200w;
  }

  const price = toFiniteNumber(lastWithMa200w.btcPrice, 0);
  if (price <= 0 || !lastWithMa200w.priceMa200wRatio || lastWithMa200w.priceMa200wRatio <= 0) {
    return null;
  }

  return price / lastWithMa200w.priceMa200wRatio;
}

function pickDate(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

async function resolveLatestMa200w(): Promise<number | null> {
  if (cache.latest?.ma200w && cache.latest.ma200w > 0) {
    return cache.latest.ma200w;
  }

  const staticLatest = await fetchStaticLatestData({ enrichWithHistory: false });
  if (staticLatest?.ma200w && staticLatest.ma200w > 0) {
    return staticLatest.ma200w;
  }

  const historyData = await fetchHistoricalData({ mode: 'light' });
  return getMa200wFromHistory(historyData);
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
  const fallbackPath = mode === 'full' ? STATIC_HISTORY_LIGHT_PATH : STATIC_HISTORY_FULL_PATH;

  try {
    const primaryRaw = await fetchStaticHistoryRaw(primaryPath, 30000);
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
    console.warn(`[DataService] Primary history source failed (${primaryPath}), trying fallback (${fallbackPath}).`, primaryError);

    try {
      const fallbackRaw = await fetchStaticHistoryRaw(fallbackPath, 30000);
      const fallbackData = normalizeHistoryRows(fallbackRaw);
      persistLocalData({ history: fallbackData });

      if (mode === 'full') {
        cache.historyFull = fallbackData;
      } else {
        cache.historyLight = fallbackData;
      }

      return fallbackData;
    } catch (fallbackError) {
      console.error('[DataService] Error fetching historical data:', fallbackError);

      const localHistory = readLocalData();
      if (localHistory.length > 0) {
        if (mode === 'full') {
          cache.historyFull = localHistory;
        } else {
          cache.historyLight = localHistory;
        }
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

export async function fetchAllLatestIndicators(useCache = true): Promise<LatestData | null> {
  const now = Date.now();
  if (useCache && cache.latest && (now - cache.latestTimestamp) < CACHE_DURATION) {
    return cache.latest;
  }

  try {
    const [mvrvZData, lthMvrvData, puellData, nuplData, btcPriceData] = await Promise.all([
      fetchMvrvZScore(1),
      fetchLthMvrv(1),
      fetchPuellMultiple(1),
      fetchNupl(1),
      fetchBtcPrice(1),
    ]);

    if (btcPriceData.length === 0) {
      const staticLatest = await fetchStaticLatestData({ enrichWithHistory: false });
      if (staticLatest) {
        return staticLatest;
      }

      const historyData = await fetchHistoricalData({ mode: 'light' });
      const latestFromHistory = getLatestFromHistory(historyData);
      if (latestFromHistory) {
        cache.latest = latestFromHistory;
        cache.latestTimestamp = now;
      }
      return latestFromHistory;
    }

    const today = new Date().toISOString().split('T')[0];
    const btcPoint = btcPriceData[0];

    const btcPrice = toFiniteNumber(btcPoint?.btcPrice, 0);
    const priceDate = pickDate(typeof btcPoint?.d === 'string' ? btcPoint.d : undefined, today);

    const mvrvPoint = mvrvZData[0];
    const lthPoint = lthMvrvData[0];
    const puellPoint = puellData[0];
    const nuplPoint = nuplData[0];

    const mvrvZ = toFiniteNumber(mvrvPoint?.mvrvZscore, 0);
    const mvrvZDate = pickDate(typeof mvrvPoint?.d === 'string' ? mvrvPoint.d : undefined, priceDate);

    const lthMvrv = toFiniteNumber(lthPoint?.lthMvrv, 0);
    const lthMvrvDate = pickDate(typeof lthPoint?.d === 'string' ? lthPoint.d : undefined, priceDate);

    const puell = toFiniteNumber(puellPoint?.puellMultiple, 0);
    const puellDate = pickDate(typeof puellPoint?.d === 'string' ? puellPoint.d : undefined, priceDate);

    const nupl = toFiniteNumber(nuplPoint?.nupl, 0);
    const nuplDate = pickDate(typeof nuplPoint?.d === 'string' ? nuplPoint.d : undefined, priceDate);

    let ma200w = 0;
    let priceMa200wRatio = 0;

    try {
      const resolvedMa200w = await resolveLatestMa200w();
      if (resolvedMa200w && resolvedMa200w > 0) {
        ma200w = resolvedMa200w;
        priceMa200wRatio = btcPrice / ma200w;
      } else {
        const priceHistory = await fetchBtcPrice(MA200W_LOOKBACK_DAYS);
        if (priceHistory.length >= MA200W_LOOKBACK_DAYS) {
          const prices = priceHistory
            .map((point) => toFiniteNumber(point.btcPrice, Number.NaN))
            .filter((price) => !Number.isNaN(price));

          if (prices.length > 0) {
            ma200w = prices.reduce((sum, value) => sum + value, 0) / prices.length;
            priceMa200wRatio = ma200w > 0 ? (btcPrice / ma200w) : 0;
          }
        }

        if (ma200w <= 0) {
          const historyData = await fetchHistoricalData({ mode: 'light' });
          const historyMa200w = getMa200wFromHistory(historyData);
          if (historyMa200w && historyMa200w > 0) {
            ma200w = historyMa200w;
            priceMa200wRatio = btcPrice / ma200w;
          }
        }
      }
    } catch (error) {
      console.warn('[DataService] Failed to compute price/200w ratio:', error);
    }

    const signals = {
      priceMa200w: priceMa200wRatio < 1,
      mvrvZ: mvrvZ < 0,
      lthMvrv: lthMvrv < 1,
      puell: puell < 0.5,
      nupl: nupl < 0,
    };

    const latest: LatestData = {
      date: priceDate,
      btcPrice,
      priceMa200wRatio,
      ma200w,
      mvrvZscore: mvrvZ,
      lthMvrv,
      puellMultiple: puell,
      nupl,
      signalCount: Object.values(signals).filter(Boolean).length,
      signals,
      indicatorDates: {
        priceMa200w: priceDate,
        mvrvZ: mvrvZDate,
        lthMvrv: lthMvrvDate,
        puell: puellDate,
        nupl: nuplDate,
      },
    };

    cache.latest = latest;
    cache.latestTimestamp = now;
    persistLocalData({ latest });
    return latest;
  } catch (error) {
    console.error('[DataService] Error fetching latest indicators:', error);
    const staticLatest = await fetchStaticLatestData({ enrichWithHistory: false });
    return staticLatest ?? readLocalLatestData();
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
    ? await checkEndpoint(`${PROXY_URL}/v1/btc-price/1`)
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
