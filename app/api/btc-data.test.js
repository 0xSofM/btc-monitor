import { afterEach, describe, expect, it, vi } from 'vitest';

import handler from './btc-data.js';

const STATIC_LATEST = {
  date: '2026-06-20',
  lastUpdated: '2026-06-20T00:00:00.000Z',
  schemaVersion: 'current',
  indicatorSet: 'core8_bottom_independent_valuation_current',
  coreIndicatorSet: 'core8_bottom_independent_valuation_current',
  scoringModelVersion: 'core8_independent_valuation_current',
  legacyScoringModelVersion: 'v3_no_lookahead_replacement',
  btcPrice: 100000,
  ma200w: 50000,
  realizedPrice: 65000,
  reserveRisk: 0.002,
  lthMvrv: 1.2,
  lthSopr: 1.01,
  mvrvZscore: 0.2,
  nupl: 0.2,
  sthSopr: 1.01,
  sthMvrv: 1.05,
  puellMultiple: 0.8,
  priceMa200wRatio: 2,
  priceRealizedRatio: 1.5385,
  thresholds: {
    priceMa200wRatio: { trigger: 1, deep: 0.85 },
    priceRealizedRatio: { trigger: 1, deep: 0.9 },
    reserveRisk: { trigger: 0.0016, deep: 0.0012 },
    sthSopr: { trigger: 1, deep: 0.97 },
    sthMvrv: { trigger: 1, deep: 0.85 },
    puellMultiple: { trigger: 0.6, deep: 0.5 },
    lthMvrv: { trigger: 1, deep: 0.9 },
    lthSopr: { trigger: 0.9, deep: 0.75 },
    mvrvZscore: { trigger: 0, deep: -0.5 },
    mvrvZscoreCore: { trigger: 0, deep: -0.5 },
    nupl: { trigger: 0.15, deep: 0 },
    nuplCore: { trigger: 0.15, deep: 0 },
  },
  indicatorDates: {
    priceMa200w: '2026-06-20',
    priceRealized: '2026-06-20',
    reserveRisk: '2026-06-20',
    lthMvrv: '2026-06-20',
    lthSopr: '2026-06-20',
    mvrvZscore: '2026-06-20',
    nupl: '2026-06-20',
    sthSopr: '2026-06-20',
    sthMvrv: '2026-06-20',
    puell: '2026-06-20',
  },
  canonical: {
    model: 'core8_independent_valuation',
    displayIndicators: [
      'priceMa200w',
      'mvrvZscore',
      'nupl',
      'puell',
      'sthMvrv',
      'sthSopr',
      'lthMvrv',
      'lthSopr',
    ],
    compatibilityFields: [
      'priceRealized',
      'reserveRisk',
      'valuationBlendV6',
      'v2',
      'v4',
    ],
  },
};

const STATIC_HISTORY = [
  { d: '2026-06-18', btcPrice: 99000, totalScoreV6: 0, lthSopr: 1.02, sthSopr: 1.02 },
  { d: '2026-06-19', btcPrice: 99500, totalScoreV6: 0, lthSopr: 1.01, sthSopr: 1.01 },
];

function point(date, value) {
  return [[Date.parse(`${date}T00:00:00Z`) / 1000, value]];
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('btc-data edge handler', () => {
  it('keeps runtime latest canonical contract aligned with static pipeline', async () => {
    const fetchMock = vi.fn(async (url) => {
      const target = String(url);

      if (target.endsWith('/btc_indicators_latest.json')) {
        return Response.json(STATIC_LATEST);
      }

      if (target.endsWith('/btc_indicators_history_light.json')) {
        return Response.json(STATIC_HISTORY);
      }

      if (target.endsWith('/btc_indicators_history.json')) {
        return Response.json(STATIC_HISTORY);
      }

      if (target.includes('moving_average_price')) {
        return Response.json(point('2026-06-20', 100000));
      }

      if (target.includes('200wma')) {
        return Response.json(point('2026-06-20', 50000));
      }

      if (target.includes('realized_price')) {
        return Response.json(point('2026-06-20', 65000));
      }

      if (target.includes('reserve_risk')) {
        return Response.json(point('2026-06-20', 0.002));
      }

      if (target.includes('lth_mvrv')) {
        return Response.json(point('2026-06-20', 1.2));
      }

      if (target.includes('lth_sopr')) {
        return Response.json(point('2026-06-20', 1.01));
      }

      if (target.includes('mvrv_zscore')) {
        return Response.json(point('2026-06-20', 0.2));
      }

      if (target.includes('nupl_data')) {
        return Response.json(point('2026-06-20', 0.2));
      }

      if (target.includes('sth_sopr')) {
        return Response.json(point('2026-06-20', 1.01));
      }

      if (target.includes('sth_mvrv')) {
        return Response.json(point('2026-06-20', 1.05));
      }

      if (target.includes('puell_multiple')) {
        return Response.json(point('2026-06-20', 0.8));
      }

      if (target.includes('api.blockchain.info')) {
        return Response.json({ market_price_usd: 100000 });
      }

      if (target.includes('coinbase.com')) {
        return Response.json({ data: { amount: '100000' } });
      }

      if (target.includes('coingecko.com')) {
        return Response.json({ bitcoin: { usd: 100000 } });
      }

      if (target.includes('bitcoin-data.com') || target.includes('r.jina.ai')) {
        return Response.json([]);
      }

      throw new Error(`Unexpected fetch URL: ${target}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(new Request('https://example.test/api/btc-data/latest'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.schemaVersion).toBe('current');
    expect(payload.scoringModelVersion).toBe('core8_independent_valuation_current');
    expect(payload.indicatorSet).toBe('core8_bottom_independent_valuation_current');
    expect(payload.canonical.model).toBe('core8_independent_valuation');
    expect(payload.canonical.displayIndicators).toEqual(STATIC_LATEST.canonical.displayIndicators);
    expect(payload.canonical.compatibilityFields).toEqual(STATIC_LATEST.canonical.compatibilityFields);
    expect(payload.canonical.model).not.toBe('v6');
  });
});
