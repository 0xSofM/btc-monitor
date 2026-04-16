import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndicatorData, LatestData } from '@/types';
import { getLocalData, getLocalLatestData, saveLocalData } from '@/services/storage';

class QuotaStorage implements Storage {
  private values = new Map<string, string>();
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    const currentValue = this.values.get(key);
    const currentSize = this.totalSize();
    const nextSize = currentSize - this.entrySize(key, currentValue) + this.entrySize(key, value);

    if (nextSize > this.capacity) {
      const error = new Error('Quota exceeded while writing local cache.') as Error & { code?: number };
      error.name = 'QuotaExceededError';
      error.code = 22;
      throw error;
    }

    this.values.set(key, value);
  }

  private entrySize(key: string, value: string | undefined): number {
    if (value === undefined) {
      return 0;
    }

    return key.length + value.length;
  }

  private totalSize(): number {
    return Array.from(this.values.entries()).reduce((total, [key, value]) => total + this.entrySize(key, value), 0);
  }
}

function createLatest(date = '2026-04-16'): LatestData {
  return {
    date,
    btcPrice: 74762,
    priceMa200wRatio: 1.25,
    priceRealizedRatio: 1.39,
    ma200w: 59800,
    realizedPrice: 53661,
    reserveRisk: 0.0006,
    sthSopr: 1.0035,
    sthMvrv: 0.92,
    puellMultiple: 0.7283,
    lthMvrv: 1.67,
    signalCount: 2,
    activeIndicatorCount: 5,
    signalCountV4: 0,
    activeIndicatorCountV4: 6,
    maxSignalScoreV2: 10,
    totalScoreV4: 0,
    maxTotalScoreV4: 11,
    signalConfidence: 0.17,
    dataFreshnessScore: 0.94,
    fallbackMode: 'reserve_risk_soft_fallback',
    signals: {
      priceMa200w: false,
      priceRealized: false,
      reserveRisk: true,
      sthSopr: false,
      sthMvrv: false,
      sthGroup: false,
      puell: false,
    },
    signalsV4: {
      priceMa200w: false,
      priceRealized: false,
      reserveRisk: true,
      sthMvrv: false,
      lthMvrv: false,
      puell: false,
      sthSoprAux: false,
    },
    indicatorDates: {
      priceMa200w: date,
      priceRealized: '2026-04-15',
      reserveRisk: '2026-04-15',
      lthMvrv: '2026-04-15',
      sthSopr: date,
      sthMvrv: '2026-04-15',
      puell: '2026-04-15',
    },
  };
}

function createHistoryRows(count: number): IndicatorData[] {
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
    const signal = index % 5 === 0;

    return {
      d: day,
      unixTs: 1735689600 + (index * 86400),
      btcPrice: 20000 + index,
      priceMa200wRatio: 0.8 + ((index % 25) / 100),
      priceRealizedRatio: 0.82 + ((index % 25) / 100),
      ma200w: 18000 + index,
      realizedPrice: 17000 + index,
      reserveRisk: 0.0005 + (index / 1_000_000),
      mvrvZscore: -0.5 + (index / 1000),
      lthMvrv: 0.9 + ((index % 20) / 100),
      sthSopr: 0.95 + ((index % 10) / 100),
      sthMvrv: 0.88 + ((index % 10) / 100),
      puellMultiple: 0.45 + ((index % 10) / 100),
      signalPriceMa200w: signal,
      signalPriceRealized: signal,
      signalReserveRisk: signal,
      signalReserveRiskV4: signal,
      signalSthSopr: signal,
      signalSthMvrv: signal,
      signalLthMvrv: signal,
      signalSthSoprAux: signal,
      signalPuell: signal,
      signalCount: signal ? 4 : 1,
      signalCountV4: signal ? 5 : 1,
      activeIndicatorCount: 5,
      activeIndicatorCountV4: 6,
      maxSignalScoreV2: 10,
      signalScoreV2: signal ? 7 : 2,
      valuationScore: signal ? 5 : 1,
      maxValuationScore: 7,
      triggerScore: signal ? 1 : 0,
      maxTriggerScore: 2,
      confirmationScore: signal ? 1 : 0,
      maxConfirmationScore: 2,
      totalScoreV4: signal ? 8 : 2,
      maxTotalScoreV4: 12,
      signalConfirmed3dV4: signal,
      signalConfidence: signal ? 0.8 : 0.2,
      dataFreshnessScore: 0.95,
      staleIndicators: [
        { key: 'reserveRisk', lagDays: 1, maxLagDays: 2, sourceDate: day },
        { key: 'lthMvrv', lagDays: 1, maxLagDays: 2, sourceDate: day },
      ],
      coreIndicatorSet: 'core-6-v4',
      scoringModelVersion: 'v4.2.0',
      indicatorDates: {
        priceMa200w: day,
        priceRealized: day,
        reserveRisk: day,
        lthMvrv: day,
        mvrvZscore: day,
        sthSopr: day,
        sthMvrv: day,
        puell: day,
      },
      signalBandV4: signal ? 'accumulate' : 'watch',
      fallbackMode: signal ? 'reserve_risk_soft_fallback' : undefined,
    };
  });
}

function installStorage(storage: Storage): void {
  vi.stubGlobal('window', { localStorage: storage });
  vi.stubGlobal('localStorage', storage);
}

describe('storage quota handling', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the latest cache even when old history already consumes storage quota', () => {
    const storage = new QuotaStorage(1800);
    installStorage(storage);

    storage.setItem('btc_indicators_history', 'x'.repeat(1500));

    saveLocalData({ latest: createLatest() });

    expect(getLocalLatestData()?.date).toBe('2026-04-16');
    expect(storage.getItem('btc_indicators_history')).toBeNull();
  });

  it('truncates history cache to fit storage limits without emitting console errors', () => {
    const storage = new QuotaStorage(45000);
    installStorage(storage);

    const history = createHistoryRows(720);
    saveLocalData({
      latest: createLatest(history[history.length - 1]?.d),
      history,
    });

    const storedHistoryRaw = storage.getItem('btc_indicators_history');
    expect(storedHistoryRaw).not.toBeNull();

    const storedHistory = JSON.parse(storedHistoryRaw ?? '{}') as { storedRows?: number; truncated?: boolean };
    expect(storedHistory.storedRows).toBeDefined();
    expect(storedHistory.storedRows).toBeGreaterThan(0);
    expect(storedHistory.storedRows).toBeLessThan(history.length);
    expect(storedHistory.truncated).toBe(true);
    expect(getLocalData().at(-1)?.d).toBe(history.at(-1)?.d);
    expect(getLocalLatestData()?.date).toBe(history.at(-1)?.d);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('skips history persistence entirely when quota only fits latest data', () => {
    const storage = new QuotaStorage(1500);
    installStorage(storage);

    saveLocalData({
      latest: createLatest(),
      history: createHistoryRows(240),
    });

    expect(getLocalLatestData()?.date).toBe('2026-04-16');
    expect(getLocalData()).toEqual([]);
    expect(console.error).not.toHaveBeenCalled();
  });
});
