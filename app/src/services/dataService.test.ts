import { describe, expect, it, vi } from 'vitest';

import type { IndicatorData, LatestData } from '@/types';
import {
  getEffectiveDataDate,
  getDataFreshnessHours,
  getIndicatorChartData,
  getLatestFromHistory,
  getMA200ChartData,
  mergeLatestIntoHistory,
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
        nupl: 0.32,
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
        nupl: 0.12,
        lthMvrv: 0.92,
        sthSopr: 0.99,
        sthMvrv: 0.92,
        puellMultiple: 0.45,
        signalCountV4: 6,
        signalCountV6: 7,
        totalScoreV4: 9,
        totalScoreV6: 9,
        maxTotalScoreV4: 12,
        maxTotalScoreV6: 14,
        signalLthMvrv: true,
        signalReserveRiskV4: true,
        signalMvrvZscoreCore: true,
        signalNuplCore: true,
        valuationBlendScoreV6: 2,
        signalsV6: {
          priceMa200w: true,
          priceRealized: true,
          mvrvZscore: true,
          nupl: true,
          valuationBlend: true,
          sthMvrv: true,
          lthMvrv: true,
          lthSopr: false,
          puell: true,
          sthSoprTrigger: false,
        },
        thresholds: {
          sthMvrv: { trigger: 0.914, deep: 0.846 },
          nuplCore: { trigger: 0.25, deep: 0 },
        },
        api_data_date: {
          price_ma200w: '2026-03-28',
          price_realized: '2026-03-27',
          reserve_risk: '2026-03-27',
          mvrv_zscore: '2026-03-27',
          nupl: '2026-03-28',
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
    expect(latest?.signalCountV6).toBe(7);
    expect(latest?.totalScoreV4).toBe(9);
    expect(latest?.totalScoreV6).toBe(9);
    expect(latest?.nupl).toBe(0.12);
    expect(latest?.indicatorDates?.priceRealized).toBe('2026-03-27');
    expect(latest?.indicatorDates?.reserveRisk).toBe('2026-03-27');
    expect(latest?.indicatorDates?.mvrvZscore).toBe('2026-03-27');
    expect(latest?.indicatorDates?.nupl).toBe('2026-03-28');
    expect(latest?.indicatorDates?.lthMvrv).toBe('2026-03-27');
    expect(latest?.indicatorDates?.puell).toBe('2026-03-28');
    expect(latest?.signalsV4?.mvrvZscore).toBe(true);
    expect(latest?.signalsV6?.nupl).toBe(true);
    expect(latest?.valuationBlendScoreV6).toBe(2);
    expect(latest?.thresholds?.sthMvrv?.trigger).toBe(0.914);
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
    expect(chartData.map((point) => point.triggerValue)).toEqual([0, 0, 0, 0]);
  });

  it('getIndicatorChartData carries rolling STH-MVRV thresholds alongside values', () => {
    const history = [
      {
        d: '2026-04-14',
        btcPrice: 83500,
        sthMvrv: 0.95,
        signalSthMvrv: false,
        thresholds: {
          sthMvrv: { trigger: 0.918, deep: 0.851 },
        },
      },
      {
        d: '2026-04-15',
        btcPrice: 82800,
        sthMvrv: 0.89,
        signalSthMvrv: true,
        thresholds: {
          sthMvrv: { trigger: 0.914, deep: 0.846 },
        },
      },
    ] as IndicatorData[];

    const chartData = getIndicatorChartData(history, 'sthMvrv', 'all');
    expect(chartData).toHaveLength(2);
    expect(chartData.map((point) => point.triggerValue)).toEqual([0.918, 0.914]);
    expect(chartData.map((point) => point.deepValue)).toEqual([0.851, 0.846]);
    expect(chartData.map((point) => point.signal)).toEqual([false, true]);
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

  it('getIndicatorChartData keeps NUPL stale carry-forward days as chart gaps', () => {
    const history = [
      {
        d: '2026-04-14',
        btcPrice: 83000,
        nupl: 0.18,
        indicatorDates: { nupl: '2026-04-14' },
      },
      {
        d: '2026-04-15',
        btcPrice: 83500,
        nupl: 0.18,
        indicatorDates: { nupl: '2026-04-14' },
      },
    ] as IndicatorData[];

    const chartData = getIndicatorChartData(history, 'nupl', 'all');
    expect(chartData).toHaveLength(2);
    expect(chartData.map((point) => point.value)).toEqual([0.18, null]);
    expect(chartData.map((point) => point.triggerValue)).toEqual([0.25, 0.25]);
  });


  it('mergeLatestIntoHistory appends and replaces the realtime latest chart row', () => {
    const history = [
      {
        d: '2026-04-15',
        btcPrice: 82800,
        priceMa200wRatio: 1.2,
        ma200w: 69000,
        sthMvrv: 0.96,
        signalPriceMa200w: false,
        signalSthMvrv: false,
      },
    ] as IndicatorData[];

    const latest = {
      date: '2026-04-16',
      btcPrice: 84000,
      priceMa200wRatio: 1.25,
      priceRealizedRatio: 1.45,
      ma200w: 67200,
      realizedPrice: 57931,
      reserveRisk: 0.0018,
      mvrvZscore: 0.4,
      nupl: 0.18,
      lthMvrv: 1.4,
      lthSopr: 1.01,
      sthSopr: 1.002,
      sthMvrv: 0.91,
      puellMultiple: 0.72,
      signalCount: 1,
      activeIndicatorCount: 5,
      signalCountV4: 1,
      activeIndicatorCountV4: 7,
      signalCountV6: 2,
      activeIndicatorCountV6: 8,
      scoreSthMvrv: 1,
      scoreSthGroup: 1,
      scoreNupl: 1,
      scoreNuplCore: 1,
      valuationBlendScoreV6: 1,
      signals: {
        priceMa200w: false,
        priceRealized: false,
        reserveRisk: false,
        sthSopr: false,
        sthMvrv: true,
        sthGroup: true,
        puell: false,
      },
      signalsV4: {
        priceMa200w: false,
        priceRealized: false,
        reserveRisk: false,
        mvrvZscore: false,
        sthMvrv: true,
        lthMvrv: false,
        lthSopr: false,
        puell: false,
        sthSoprTrigger: false,
      },
      signalsV6: {
        priceMa200w: false,
        priceRealized: false,
        mvrvZscore: false,
        nupl: true,
        valuationBlend: true,
        sthMvrv: true,
        lthMvrv: false,
        lthSopr: false,
        puell: false,
        sthSoprTrigger: false,
      },
      thresholds: {
        sthMvrv: { trigger: 0.914, deep: 0.846 },
        nuplCore: { trigger: 0.25, deep: 0 },
      },
      indicatorDates: {
        priceMa200w: '2026-04-16',
        priceRealized: '2026-04-16',
        mvrvZscore: '2026-04-16',
        nupl: '2026-04-16',
        lthMvrv: '2026-04-16',
        lthSopr: '2026-04-16',
        sthSopr: '2026-04-16',
        sthMvrv: '2026-04-16',
        puell: '2026-04-16',
      },
    } satisfies LatestData;

    const appended = mergeLatestIntoHistory(history, latest);
    expect(appended).toHaveLength(2);
    expect(appended.at(-1)?.d).toBe('2026-04-16');
    expect(getMA200ChartData(appended, 'all').at(-1)).toMatchObject({
      date: '2026-04-16',
      price: 84000,
      ma200: 67200,
    });
    expect(getIndicatorChartData(appended, 'sthMvrv', 'all').at(-1)).toMatchObject({
      date: '2026-04-16',
      value: 0.91,
      signal: true,
      triggerValue: 0.914,
    });
    expect(getIndicatorChartData(appended, 'nupl', 'all').at(-1)).toMatchObject({
      date: '2026-04-16',
      value: 0.18,
      signal: true,
      triggerValue: 0.25,
    });

    const replaced = mergeLatestIntoHistory(appended, {
      ...latest,
      btcPrice: 84500,
      priceMa200wRatio: 1.3,
      ma200w: 65000,
    });
    expect(replaced).toHaveLength(2);
    expect(getMA200ChartData(replaced, 'all').at(-1)).toMatchObject({
      date: '2026-04-16',
      price: 84500,
      ma200: 65000,
    });
  });

  it('getDataFreshnessHours prefers exact timestamps and falls back to date start', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'));

    expect(getDataFreshnessHours('2026-03-29T08:30:00Z')).toBe(3.5);
    expect(getDataFreshnessHours('2026-03-29')).toBe(12);
    expect(getDataFreshnessHours('2026-03-28')).toBe(36);
    expect(getDataFreshnessHours('')).toBe(0);

    vi.useRealTimers();
  });

  it('getEffectiveDataDate uses the oldest core indicator date when the snapshot is not aligned', () => {
    expect(getEffectiveDataDate('2026-05-06', {
      priceMa200w: '2026-05-05',
      priceRealized: '2026-05-05',
      reserveRisk: '2026-05-06',
      lthMvrv: '2026-05-05',
      mvrvZscore: '2026-05-05',
      nupl: '2026-05-04',
      sthSopr: '2026-05-05',
      sthMvrv: '2026-05-05',
      puell: '2026-05-05',
    })).toBe('2026-05-04');
  });

  it('getEffectiveDataDate falls back to the snapshot date when core indicators are aligned', () => {
    expect(getEffectiveDataDate('2026-05-06', {
      priceMa200w: '2026-05-06',
      priceRealized: '2026-05-06',
      mvrvZscore: '2026-05-06',
      nupl: '2026-05-06',
      lthMvrv: '2026-05-06',
      sthMvrv: '2026-05-06',
      puell: '2026-05-06',
    })).toBe('2026-05-06');
    expect(getEffectiveDataDate('2026-05-06')).toBe('2026-05-06');
  });
});
