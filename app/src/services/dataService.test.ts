import { describe, expect, it, vi } from 'vitest';

import type { IndicatorData, LatestData } from '@/types';
import {
  fetchStrategyMnavData,
  fetchHistoricalData,
  getEffectiveDataDate,
  getDataFreshnessHours,
  getIndicatorChartData,
  getLatestFromHistory,
  getMA200ChartData,
  mergeLatestIntoHistory,
} from '@/services/dataService';
import { normalizeIndicatorData, normalizeLatestData, normalizeManifestData } from '@/services/normalizers';

describe('dataService helpers', () => {
  it('fetchStrategyMnavData normalizes Strategy official mNAV payload', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      date: '2026-06-20',
      generatedAt: '2026-06-20T13:20:00+00:00',
      source: 'strategy_official_api',
      formula: 'enterpriseValueUsd / btcReserveUsd',
      mstr: {
        price: 112.53,
        marketCapUsdM: 40097,
        enterpriseValueUsdM: 61225,
        timestampUtc: '2026-06-18T20:00:00',
      },
      btcReserve: {
        btcHoldings: 846842,
        btcPriceUsd: 63576,
        btcReserveUsdM: 53839,
        timestamp: '2026-06-20T13:08:00',
      },
      mnav: {
        value: 1.1372,
        previousValue: 1.1668,
        change: -0.0296,
        band: 'low_premium',
        riskFlag: 'normal',
        equityPremium: 0.7448,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as ReturnType<typeof vi.fn<(url: RequestInfo | URL) => Promise<Response>>>;
    vi.stubGlobal('fetch', fetchMock);

    const data = await fetchStrategyMnavData(true);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/strategy_mnav_latest.json');
    expect(data?.mnav.value).toBe(1.1372);
    expect(data?.mnav.band).toBe('low_premium');
    expect(data?.mstr.enterpriseValueUsdM).toBe(61225);
    expect(data?.btcReserve.btcHoldings).toBe(846842);

    vi.unstubAllGlobals();
  });

  it('fetchHistoricalData loads light history by default and full history on demand', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      const body = path.includes('btc_indicators_history_light.json')
        ? [
            {
              d: '2026-04-15',
              btcPrice: 83000,
              priceMa200wRatio: 1.2,
              priceRealizedRatio: 1.1,
              mvrvZscore: 0.1,
              nupl: 0.18,
              lthMvrv: 1.1,
              lthSopr: 0.98,
              sthSopr: 1.01,
              sthMvrv: 1.05,
              puellMultiple: 0.72,
            },
          ]
        : path.includes('btc_indicators_history_full_light.json')
          ? [
              {
                d: '2026-04-13',
                btcPrice: 82000,
                priceMa200wRatio: 1.18,
                priceRealizedRatio: 1.07,
                mvrvZscore: 0.03,
                nupl: 0.16,
                lthMvrv: 1.06,
                lthSopr: 0.96,
                sthSopr: 0.99,
                sthMvrv: 1.02,
                puellMultiple: 0.68,
              },
              {
                d: '2026-04-14',
                btcPrice: 82500,
                priceMa200wRatio: 1.19,
                priceRealizedRatio: 1.08,
                mvrvZscore: 0.05,
                nupl: 0.17,
                lthMvrv: 1.08,
                lthSopr: 0.97,
                sthSopr: 1.0,
                sthMvrv: 1.03,
                puellMultiple: 0.7,
              },
              {
                d: '2026-04-15',
                btcPrice: 83000,
                priceMa200wRatio: 1.2,
                priceRealizedRatio: 1.1,
                mvrvZscore: 0.1,
                nupl: 0.18,
                lthMvrv: 1.1,
                lthSopr: 0.98,
                sthSopr: 1.01,
                sthMvrv: 1.05,
                puellMultiple: 0.72,
              },
            ]
        : [
            {
              d: '2026-04-14',
              btcPrice: 82500,
              priceMa200wRatio: 1.19,
              priceRealizedRatio: 1.08,
              mvrvZscore: 0.05,
              nupl: 0.17,
              lthMvrv: 1.08,
              lthSopr: 0.97,
              sthSopr: 1.0,
              sthMvrv: 1.03,
              puellMultiple: 0.7,
            },
            {
              d: '2026-04-15',
              btcPrice: 83000,
              priceMa200wRatio: 1.2,
              priceRealizedRatio: 1.1,
              mvrvZscore: 0.1,
              nupl: 0.18,
              lthMvrv: 1.1,
              lthSopr: 0.98,
              sthSopr: 1.01,
              sthMvrv: 1.05,
              puellMultiple: 0.72,
            },
          ];

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const light = await fetchHistoricalData({ forceRefresh: true });
    const full = await fetchHistoricalData({ forceRefresh: true, full: true });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/btc_indicators_history_light.json');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/btc_indicators_history_full_light.json');
    expect(light).toHaveLength(1);
    expect(full).toHaveLength(3);

    vi.unstubAllGlobals();
  });

  it('fetchHistoricalData falls back to legacy full history when full-light history is unavailable', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.includes('btc_indicators_history_full_light.json')) {
        return new Response('missing', { status: 404 });
      }

      return new Response(JSON.stringify([
        {
          d: '2026-04-14',
          btcPrice: 82500,
          priceMa200wRatio: 1.19,
          priceRealizedRatio: 1.08,
          mvrvZscore: 0.05,
          nupl: 0.17,
          lthMvrv: 1.08,
          lthSopr: 0.97,
          sthSopr: 1.0,
          sthMvrv: 1.03,
          puellMultiple: 0.7,
        },
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const full = await fetchHistoricalData({ forceRefresh: true, full: true });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/btc_indicators_history_full_light.json');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/btc_indicators_history.json');
    expect(full).toHaveLength(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('/btc_indicators_history_full_light.json'),
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('normalizeManifestData preserves history file hints and reports missing core fields', () => {
    const manifest = normalizeManifestData({
      generatedAt: '2026-06-20T19:53:58Z',
      latestDate: '2026-06-20',
      lastUpdated: '2026-06-20T19:53:58Z',
      historyRows: '5499',
      historyLightRows: 889,
      historyFullLightRows: 5499,
      historyFiles: {
        full: 'btc_indicators_history.json',
        fullLight: 'btc_indicators_history_full_light.json',
        light: 'btc_indicators_history_light.json',
        lightRecentDays: '730',
        lightFields: [
          'priceMa200wRatio',
          'mvrvZscore',
          'nupl',
          'lthMvrv',
          'lthSopr',
          'sthSopr',
          'sthMvrv',
        ],
      },
      schemaVersion: 'current',
      signalEventsV4Rows: 18,
      schemaContract: {
        canonicalModel: 'core8_independent_valuation',
        historyRequiredFields: [
          'priceMa200wRatio',
          'mvrvZscore',
          'nupl',
          'lthMvrv',
          'lthSopr',
          'sthSopr',
          'sthMvrv',
        ],
      },
      strategyMnavHealth: {
        latestDate: '2026-06-20',
        historyRows: 1,
        isStale: false,
      },
    });

    expect(manifest?.historyRows).toBe(5499);
    expect(manifest?.historyLightRows).toBe(889);
    expect(manifest?.historyFullLightRows).toBe(5499);
    expect(manifest?.historyFiles?.full).toBe('btc_indicators_history.json');
    expect(manifest?.historyFiles?.fullLight).toBe('btc_indicators_history_full_light.json');
    expect(manifest?.historyFiles?.lightRecentDays).toBe(730);
    expect(manifest?.signalEventsV4Rows).toBe(18);
    expect(manifest?.strategyMnavHealth?.isStale).toBe(false);
    expect(manifest?.schemaContract?.missingCoreHistoryFields).toEqual(['puellMultiple']);
  });

  it('normalizeManifestData rejects manifest payloads without required dates', () => {
    expect(normalizeManifestData({ generatedAt: '2026-06-20T19:53:58Z' })).toBeNull();
    expect(normalizeManifestData(null)).toBeNull();
  });

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
        signalCountV6: 6,
        totalScoreV4: 9,
        totalScoreV6: 9,
        maxTotalScoreV4: 12,
        maxTotalScoreV6: 14,
        scorePriceMa200w: 1,
        scoreMvrvZscoreCore: 1,
        scoreNuplCore: 1,
        scoreSthMvrv: 1,
        scoreSthSopr: 0,
        scoreLthMvrv: 2,
        scoreLthSopr: 0,
        scorePuell: 2,
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
          nuplCore: { trigger: 0.15, deep: 0 },
          valuationBlendV6: { method: 'max(mvrvZscoreCore,nuplCore)', displayRole: 'combined_frontend_indicator' },
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
    expect(latest?.signalCountV6).toBe(6);
    expect(latest?.totalScoreV4).toBe(9);
    expect(latest?.totalScoreV6).toBe(8);
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
    expect(latest?.thresholds?.valuationBlendV6?.displayRole).toBe('combined_frontend_indicator');
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

  it('getMA200ChartData keeps price history before the first valid MA200 value', () => {
    const history = [
      {
        d: '2026-01-01',
        btcPrice: 50000,
      },
      {
        d: '2026-01-02',
        btcPrice: 51000,
        ma200w: 45000,
        signalPriceMa200w: false,
      },
    ] as IndicatorData[];

    const chartData = getMA200ChartData(history, 'all');

    expect(chartData).toHaveLength(2);
    expect(chartData[0]).toMatchObject({
      date: '2026-01-01',
      price: 50000,
      ma200: null,
      signal: false,
    });
    expect(chartData[1]).toMatchObject({
      date: '2026-01-02',
      price: 51000,
      ma200: 45000,
    });
  });

  it('getIndicatorChartData builds the valuation blend display score', () => {
    const history = [
      {
        d: '2026-04-14',
        btcPrice: 83500,
        scoreMvrvZscoreCore: 0,
        scoreNuplCore: 1,
        valuationBlendScoreV6: 1,
        signalsV6: { valuationBlend: true },
      },
      {
        d: '2026-04-15',
        btcPrice: 82800,
        scoreMvrvZscoreCore: 2,
        scoreNuplCore: 1,
        valuationBlendScoreV6: 2,
        signalsV6: { valuationBlend: true },
      },
    ] as IndicatorData[];

    const chartData = getIndicatorChartData(history, 'valuationBlend', 'all');
    expect(chartData).toHaveLength(2);
    expect(chartData.map((point) => point.value)).toEqual([1, 2]);
    expect(chartData.map((point) => point.triggerValue)).toEqual([0.5, 0.5]);
    expect(chartData.map((point) => point.deepValue)).toEqual([1.5, 1.5]);
    expect(chartData.map((point) => point.signal)).toEqual([true, true]);
  });

  it('getIndicatorChartData uses smoothed SOPR values and dynamic thresholds', () => {
    const history = [
      {
        d: '2026-04-14',
        btcPrice: 83500,
        sthSopr: 0.99,
        sthSoprMa3: 1.01,
        lthSopr: 0.94,
        lthSoprMa3: 0.92,
        thresholds: {
          sthSopr: { trigger: 1.002, deep: 0.981 },
          lthSopr: { trigger: 0.91, deep: 0.82 },
        },
        signalsV6: { sthSoprTrigger: false, lthSopr: false },
      },
      {
        d: '2026-04-15',
        btcPrice: 82800,
        sthSopr: 0.96,
        sthSoprMa3: 0.985,
        lthSopr: 0.8,
        lthSoprMa3: 0.86,
        thresholds: {
          sthSopr: { trigger: 0.998, deep: 0.979 },
          lthSopr: { trigger: 0.9, deep: 0.8 },
        },
        signalsV6: { sthSoprTrigger: true, lthSopr: true },
      },
    ] as IndicatorData[];

    const sthSoprChart = getIndicatorChartData(history, 'sthSopr', 'all');
    expect(sthSoprChart.map((point) => point.value)).toEqual([1.01, 0.985]);
    expect(sthSoprChart.map((point) => point.triggerValue)).toEqual([1.002, 0.998]);
    expect(sthSoprChart.map((point) => point.signal)).toEqual([false, true]);

    const lthSoprChart = getIndicatorChartData(history, 'lthSopr', 'all');
    expect(lthSoprChart.map((point) => point.value)).toEqual([0.92, 0.86]);
    expect(lthSoprChart.map((point) => point.deepValue)).toEqual([0.82, 0.8]);
    expect(lthSoprChart.map((point) => point.signal)).toEqual([false, true]);
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
    expect(chartData.map((point) => point.triggerValue)).toEqual([0.15, 0.15]);
  });

  it('getIndicatorChartData starts full history at the first observed indicator value', () => {
    const history = [
      {
        d: '2026-04-12',
        btcPrice: 82000,
        nupl: null,
      },
      {
        d: '2026-04-13',
        btcPrice: 82500,
        nupl: undefined,
      },
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

    expect(chartData.map((point) => point.date)).toEqual(['2026-04-14', '2026-04-15']);
    expect(chartData.map((point) => point.value)).toEqual([0.18, null]);
  });

  it('normalizeIndicatorData preserves compact indicatorDates for NUPL chart gaps', () => {
    const observedRow = normalizeIndicatorData({
      d: '2026-06-04',
      btcPrice: 104000,
      nupl: 0.1606,
      indicatorDates: { nupl: '2026-06-04' },
    });
    const staleRow = normalizeIndicatorData({
      d: '2026-06-05',
      btcPrice: 103500,
      nupl: 0.1606,
      indicatorDates: { nupl: '2026-06-04' },
    });

    expect(observedRow?.indicatorDates?.nupl).toBe('2026-06-04');
    expect(staleRow?.indicatorDates?.nupl).toBe('2026-06-04');

    const chartData = getIndicatorChartData(
      [observedRow, staleRow].filter((item): item is IndicatorData => item !== null),
      'nupl',
      'all',
    );

    expect(chartData.map((point) => point.value)).toEqual([0.1606, null]);
  });

  it('normalizeLatestData preserves canonical current-model contract fields', () => {
    const latest = normalizeLatestData({
      date: '2026-06-20',
      btcPrice: 104000,
      canonical: {
        model: 'core8_independent_valuation',
        display_indicators: [
          'priceMa200w',
          'mvrvZscore',
          'nupl',
          'puell',
          'sthMvrv',
          'sthSopr',
          'lthMvrv',
          'lthSopr',
        ],
        compatibility_fields: [
          'priceRealized',
          'reserveRisk',
          'valuationBlendV6',
          'v2',
          'v4',
        ],
        score: {
          valuation: '4',
          trigger: 1,
          confirmation: 2,
          total: 7,
          max_total: 14,
          band: 'focus',
          confirmed_3d: 'false',
          confidence: '0.62',
        },
        signals: {
          priceMa200w: true,
          mvrvZscore: true,
          nupl: false,
          puell: true,
          sthMvrv: true,
          sthSoprTrigger: false,
          lthMvrv: true,
          lthSopr: false,
        },
        signal_count: 5,
        active_indicator_count: 8,
        fallback_mode: 'none',
      },
    });

    expect(latest?.canonical?.model).toBe('core8_independent_valuation');
    expect(latest?.canonical?.displayIndicators).toEqual([
      'priceMa200w',
      'mvrvZscore',
      'nupl',
      'puell',
      'sthMvrv',
      'sthSopr',
      'lthMvrv',
      'lthSopr',
    ]);
    expect(latest?.canonical?.compatibilityFields).toEqual([
      'priceRealized',
      'reserveRisk',
      'valuationBlendV6',
      'v2',
      'v4',
    ]);
    expect(latest?.canonical?.score?.valuation).toBe(4);
    expect(latest?.canonical?.score?.maxTotal).toBe(14);
    expect(latest?.canonical?.score?.confirmed3d).toBe(false);
    expect(latest?.canonical?.score?.confidence).toBe(0.62);
    expect(latest?.canonical?.signals?.priceRealized).toBeUndefined();
    expect(latest?.canonical?.signalCount).toBe(5);
    expect(latest?.canonical?.activeIndicatorCount).toBe(8);
    expect(latest?.canonical?.fallbackMode).toBe('none');
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
      lthSoprMa3: 1.012,
      sthSopr: 1.002,
      sthSoprMa3: 0.996,
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
        sthSopr: { trigger: 1.001, deep: 0.98 },
        lthSopr: { trigger: 0.9, deep: 0.75 },
        nuplCore: { trigger: 0.15, deep: 0 },
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
      triggerValue: 0.15,
    });
    expect(getIndicatorChartData(appended, 'sthSopr', 'all').at(-1)).toMatchObject({
      date: '2026-04-16',
      value: 0.996,
      triggerValue: 1.001,
    });
    expect(getIndicatorChartData(appended, 'lthSopr', 'all').at(-1)).toMatchObject({
      date: '2026-04-16',
      value: 1.012,
      triggerValue: 0.9,
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

  it('getEffectiveDataDate uses the oldest core display indicator date when the snapshot is not aligned', () => {
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
