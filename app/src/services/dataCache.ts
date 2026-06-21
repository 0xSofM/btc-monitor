import type { IndicatorData, LatestData, StrategyMnavData } from '@/types';

import type { DataManifest, HistoryMode } from './contracts';

export const REFRESH_INTERVAL = 5 * 60 * 1000;
export const CACHE_DURATION = 60 * 1000;
export const MANIFEST_CACHE_DURATION = 60 * 1000;

export type CacheState = {
  latest: LatestData | null;
  history: IndicatorData[];
  historyMode: HistoryMode;
  latestTimestamp: number;
  manifest: DataManifest | null;
  manifestTimestamp: number;
  strategyMnav: StrategyMnavData | null;
  strategyMnavTimestamp: number;
};

export const cache: CacheState = {
  latest: null,
  history: [],
  historyMode: 'none',
  latestTimestamp: 0,
  manifest: null,
  manifestTimestamp: 0,
  strategyMnav: null,
  strategyMnavTimestamp: 0,
};

export function isTimestampFresh(timestamp: number, now: number, durationMs: number): boolean {
  return (now - timestamp) < durationMs;
}

export function getCachedDataStatus(now = Date.now()): {
  cacheAge: number;
  cacheValid: boolean;
  lastUpdate: string | null;
} {
  const cacheAgeMs = now - cache.latestTimestamp;

  return {
    cacheAge: Math.floor(cacheAgeMs / 1000),
    cacheValid: cache.latest !== null && isTimestampFresh(cache.latestTimestamp, now, CACHE_DURATION),
    lastUpdate: cache.latest?.date ?? null,
  };
}
