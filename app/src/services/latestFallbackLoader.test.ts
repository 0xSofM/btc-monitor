import type { IndicatorData, LatestData } from '@/types';
import { describe, expect, it, vi } from 'vitest';

import {
  loadLatestFromHistoryFallback,
  loadLocalLatestFallback,
} from './latestFallbackLoader';

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

describe('latest fallback loader', () => {
  it('returns local latest without reading history when enrichment is disabled', () => {
    const readLocalLatest = vi.fn(() => latest);
    const readLocalHistory = vi.fn(() => [] as IndicatorData[]);

    const fallback = loadLocalLatestFallback({
      enrichWithHistory: false,
      readLocalLatest,
      readLocalHistory,
    });

    expect(fallback).toBe(latest);
    expect(readLocalLatest).toHaveBeenCalledTimes(1);
    expect(readLocalHistory).not.toHaveBeenCalled();
  });

  it('enriches local latest with local history when requested', () => {
    const history = [{
      d: '2026-04-16',
      indicatorDates: {
        nupl: '2026-04-15',
      },
    }] satisfies IndicatorData[];
    const readLocalLatest = vi.fn(() => latest);
    const readLocalHistory = vi.fn(() => history);

    const fallback = loadLocalLatestFallback({
      enrichWithHistory: true,
      readLocalLatest,
      readLocalHistory,
    });

    expect(fallback?.indicatorDates?.nupl).toBe('2026-04-15');
    expect(readLocalLatest).toHaveBeenCalledTimes(1);
    expect(readLocalHistory).toHaveBeenCalledTimes(1);
  });

  it('derives and remembers latest data from history', async () => {
    const history = [{ d: '2026-04-16', btcPrice: 84000 }] satisfies IndicatorData[];
    const fetchHistory = vi.fn(async () => history);
    const getLatestFromHistory = vi.fn(() => latest);
    const rememberLatest = vi.fn((value: LatestData) => value);

    const fallback = await loadLatestFromHistoryFallback({
      timestamp: 1234,
      fetchHistory,
      getLatestFromHistory,
      rememberLatest,
    });

    expect(fallback).toBe(latest);
    expect(fetchHistory).toHaveBeenCalledTimes(1);
    expect(getLatestFromHistory).toHaveBeenCalledWith(history);
    expect(rememberLatest).toHaveBeenCalledWith(latest, 1234);
  });

  it('returns null when history cannot produce latest data', async () => {
    const fetchHistory = vi.fn(async () => [] as IndicatorData[]);
    const getLatestFromHistory = vi.fn(() => null);
    const rememberLatest = vi.fn((value: LatestData) => value);

    const fallback = await loadLatestFromHistoryFallback({
      timestamp: 1234,
      fetchHistory,
      getLatestFromHistory,
      rememberLatest,
    });

    expect(fallback).toBeNull();
    expect(getLatestFromHistory).toHaveBeenCalledWith([]);
    expect(rememberLatest).not.toHaveBeenCalled();
  });
});
