import { describe, expect, it, vi } from 'vitest';

import type { IndicatorData } from '@/types';
import {
  getDataFreshnessHours,
  getIndicatorChartData,
  getLatestFromHistory,
  getMA200ChartData,
} from '@/services/dataService';

describe('dataService helpers', () => {
  it('getLatestFromHistory reads latest row and api_data_date fields', () => {
    const history = [
      {
        d: '2026-03-27',
        btcPrice: 80000,
        priceMa200wRatio: 1.2,
        priceRealizedRatio: 1.05,
        reserveRisk: 0.002,
        mvrvZscore: 0.2,
        sthSopr: 1.01,
        sthMvrv: 1.1,
        puellMultiple: 0.8,
      },
      {
        d: '2026-03-28',
        btcPrice: 79000,
        priceMa200wRatio: 0.95,
        priceRealizedRatio: 0.97,
        reserveRisk: 0.0012,
        mvrvZscore: -0.3,
        lthMvrv: 0.92,
        sthSopr: 0.99,
        sthMvrv: 0.92,
        puellMultiple: 0.45,
        signalCountV4: 6,
        totalScoreV4: 9,
        maxTotalScoreV4: 12,
        signalLthMvrv: true,
        signalReserveRiskV4: true,
        signalMvrvZscoreCore: true,
        api_data_date: {
          price_ma200w: '2026-03-28',
          price_realized: '2026-03-27',
          reserve_risk: '2026-03-27',
          mvrv_zscore: '2026-03-27',
          lth_mvrv: '2026-03-27',
          sth_sopr: '2026-03-28',
          sth_mvrv: '2026-03-27',
          puell: '2026-03-28',
        },
      },
    ] as IndicatorData[];

    const latest = getLatestFromHistory(history);
    expect(latest).not.toBeNull();
    expect(latest?.date).toBe('2026-03-28');
    expect(latest?.signalCount).toBe(5);
    expect(latest?.signalCountV4).toBe(6);
    expect(latest?.totalScoreV4).toBe(9);
    expect(latest?.indicatorDates?.priceRealized).toBe('2026-03-27');
    expect(latest?.indicatorDates?.reserveRisk).toBe('2026-03-27');
    expect(latest?.indicatorDates?.mvrvZscore).toBe('2026-03-27');
    expect(latest?.indicatorDates?.lthMvrv).toBe('2026-03-27');
    expect(latest?.indicatorDates?.puell).toBe('2026-03-28');
    expect(latest?.signalsV4?.mvrvZscore).toBe(true);
  });

  it('getIndicatorChartData filters placeholder zero rows', () => {
    const history = [
      { d: '2026-01-01', btcPrice: 0, reserveRisk: 0, signalReserveRisk: false },
      { d: '2026-01-02', btcPrice: 90000, reserveRisk: 0.0012, signalReserveRisk: true },
    ] as IndicatorData[];

    const chartData = getIndicatorChartData(history, 'reserveRisk', 'all');
    expect(chartData).toHaveLength(1);
    expect(chartData[0].date).toBe('2026-01-02');
    expect(chartData[0].signal).toBe(true);
  });

  it('getIndicatorChartData keeps MVRV Z-Score stale carry-forward days as chart gaps', () => {
    const history = [
      {
        d: '2025-12-28',
        btcPrice: 95000,
        mvrvZscore: -0.84,
        indicatorDates: { mvrvZscore: '2025-12-28' },
      },
      {
        d: '2025-12-29',
        btcPrice: 95200,
        mvrvZscore: -0.84,
        indicatorDates: { mvrvZscore: '2025-12-28' },
      },
      {
        d: '2026-04-15',
        btcPrice: 84000,
        mvrvZscore: -0.21,
        indicatorDates: { mvrvZscore: '2026-04-15' },
      },
      {
        d: '2026-04-16',
        btcPrice: 84500,
        mvrvZscore: -0.21,
        indicatorDates: { mvrvZscore: '2026-04-15' },
      },
    ] as IndicatorData[];

    const chartData = getIndicatorChartData(history, 'mvrvZscore', 'all');
    expect(chartData).toHaveLength(4);
    expect(chartData.map((point) => point.value)).toEqual([
      -0.84,
      null,
      -0.21,
      null,
    ]);
  });

  it('getMA200ChartData derives ma200 from ratio when ma200w is missing', () => {
    const history = [
      {
        d: '2026-02-01',
        btcPrice: 60000,
        priceMa200wRatio: 1.2,
        signalPriceMa200w: false,
      },
    ] as IndicatorData[];

    const chartData = getMA200ChartData(history, 'all');
    expect(chartData).toHaveLength(1);
    expect(chartData[0].ma200).toBeCloseTo(50000, 6);
  });

  it('getDataFreshnessHours calculates elapsed hours from date start', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'));

    expect(getDataFreshnessHours('2026-03-29')).toBe(12);
    expect(getDataFreshnessHours('2026-03-28')).toBe(36);
    expect(getDataFreshnessHours('')).toBe(0);

    vi.useRealTimers();
  });
});
