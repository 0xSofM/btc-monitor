import type { IndicatorData, LatestData } from '@/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cache, loadCachedResource, rememberLatestInCache } from './dataCache';

const latest = {
  date: '2026-04-16',
  btcPrice: 84000,
  priceMa200wRatio: 1.2,
  priceRealizedRatio: 1.1,
  reserveRisk: 0.001,
  sthSopr: 1.01,
  sthMvrv: 0.95,
  puellMultiple: 0.7,
  signalCount: 1,
  signals: {
    priceMa200w: false,
    priceRealized: false,
    reserveRisk: false,
    sthSopr: false,
    sthMvrv: true,
    puell: false,
  },
} satisfies LatestData;

describe('data cache helpers', () => {
  beforeEach(() => {
    cache.latest = null;
    cache.history = [];
    cache.latestTimestamp = 0;
  });

  it('returns a fresh cached resource without loading', async () => {
    const load = vi.fn(async () => 'remote');
    const remember = vi.fn();
    const onError = vi.fn();

    const value = await loadCachedResource({
      forceRefresh: false,
      cachedValue: 'cached',
      cachedTimestamp: Date.now(),
      durationMs: 60_000,
      load,
      remember,
      onError,
    });

    expect(value).toBe('cached');
    expect(load).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('returns the previous cached resource when loading fails', async () => {
    const error = new Error('network failed');
    const load = vi.fn(async () => {
      throw error;
    });
    const remember = vi.fn();
    const onError = vi.fn();

    const value = await loadCachedResource({
      forceRefresh: true,
      cachedValue: 'cached',
      cachedTimestamp: 0,
      durationMs: 60_000,
      load,
      remember,
      onError,
    });

    expect(value).toBe('cached');
    expect(load).toHaveBeenCalledTimes(1);
    expect(remember).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('remembers latest data and merges it into cached history', () => {
    cache.history = [{ d: '2026-04-15', btcPrice: 83000 }];
    const mergedHistory = [{ d: '2026-04-16', btcPrice: 84000 }] as IndicatorData[];
    const mergeLatestIntoHistory = vi.fn(() => mergedHistory);
    const persistLatest = vi.fn();

    const value = rememberLatestInCache(latest, {
      timestamp: 1234,
      mergeLatestIntoHistory,
      persistLatest,
    });

    expect(value).toBe(latest);
    expect(cache.latest).toBe(latest);
    expect(cache.latestTimestamp).toBe(1234);
    expect(cache.history).toBe(mergedHistory);
    expect(mergeLatestIntoHistory).toHaveBeenCalledWith(
      [{ d: '2026-04-15', btcPrice: 83000 }],
      latest,
    );
    expect(persistLatest).toHaveBeenCalledWith(latest);
  });
});
