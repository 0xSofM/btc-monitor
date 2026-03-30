import type { ChartDataPoint, IndicatorData, LatestData, SignalEvent, TimeRange } from '@/types';

import type { IndicatorKey } from './contracts';
import { hasUsableValue, toFiniteNumber } from './normalizers';

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '6m': 180 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

const DEFAULT_THRESHOLDS = {
  priceMa200w: 1,
  priceRealized: 1,
  reserveRisk: 0.0016,
  sthSopr: 1,
  sthMvrv: 1,
  puell: 0.6,
};

function toNumericPrice(value: number | string | undefined): number {
  return toFiniteNumber(value, 0);
}

function getApiDataDateFromRow(row: IndicatorData): Record<string, unknown> | null {
  const record = row as unknown as Record<string, unknown>;
  const payload = record.api_data_date ?? record.apiDataDate;
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return payload as Record<string, unknown>;
}

export function findIndicatorDates(data: IndicatorData[]): NonNullable<LatestData['indicatorDates']> {
  const latest = data[data.length - 1];
  if (!latest) {
    return {
      priceMa200w: undefined,
      priceRealized: undefined,
      reserveRisk: undefined,
      sthSopr: undefined,
      sthMvrv: undefined,
      puell: undefined,
    };
  }

  const fromPayload = latest.indicatorDates;
  if (fromPayload) {
    return {
      priceMa200w: fromPayload.priceMa200w ?? latest.d,
      priceRealized: fromPayload.priceRealized,
      reserveRisk: fromPayload.reserveRisk,
      sthSopr: fromPayload.sthSopr,
      sthMvrv: fromPayload.sthMvrv,
      puell: fromPayload.puell,
    };
  }

  const fromApiDataDate = getApiDataDateFromRow(latest);
  if (fromApiDataDate) {
    return {
      priceMa200w: String(fromApiDataDate.priceMa200w ?? fromApiDataDate.price_ma200w ?? latest.d),
      priceRealized:
        typeof fromApiDataDate.priceRealized === 'string'
          ? fromApiDataDate.priceRealized
          : typeof fromApiDataDate.price_realized === 'string'
            ? fromApiDataDate.price_realized
            : undefined,
      reserveRisk:
        typeof fromApiDataDate.reserveRisk === 'string'
          ? fromApiDataDate.reserveRisk
          : typeof fromApiDataDate.reserve_risk === 'string'
            ? fromApiDataDate.reserve_risk
            : undefined,
      sthSopr:
        typeof fromApiDataDate.sthSopr === 'string'
          ? fromApiDataDate.sthSopr
          : typeof fromApiDataDate.sth_sopr === 'string'
            ? fromApiDataDate.sth_sopr
            : undefined,
      sthMvrv:
        typeof fromApiDataDate.sthMvrv === 'string'
          ? fromApiDataDate.sthMvrv
          : typeof fromApiDataDate.sth_mvrv === 'string'
            ? fromApiDataDate.sth_mvrv
            : undefined,
      puell: typeof fromApiDataDate.puell === 'string' ? fromApiDataDate.puell : undefined,
    };
  }

  const dates: NonNullable<LatestData['indicatorDates']> = {
    priceMa200w: latest.d,
    priceRealized: undefined,
    reserveRisk: undefined,
    sthSopr: undefined,
    sthMvrv: undefined,
    puell: undefined,
  };

  for (let index = data.length - 1; index >= 0; index -= 1) {
    const row = data[index];

    if (!dates.priceRealized && hasUsableValue(row.realizedPrice)) {
      dates.priceRealized = row.d;
    }

    if (!dates.reserveRisk && hasUsableValue(row.reserveRisk)) {
      dates.reserveRisk = row.d;
    }

    if (!dates.sthSopr && hasUsableValue(row.sthSopr)) {
      dates.sthSopr = row.d;
    }

    if (!dates.sthMvrv && hasUsableValue(row.sthMvrv)) {
      dates.sthMvrv = row.d;
    }

    if (!dates.puell && hasUsableValue(row.puellMultiple)) {
      dates.puell = row.d;
    }
  }

  return dates;
}

export function getLatestFromHistory(data: IndicatorData[]): LatestData | null {
  if (!data.length) {
    return null;
  }

  const latest = data[data.length - 1];

  const btcPrice = toNumericPrice(latest.btcPrice);
  const priceMa200wRatio = toFiniteNumber(latest.priceMa200wRatio, 0);
  const priceRealizedRatio = toFiniteNumber(latest.priceRealizedRatio, 0);
  const reserveRisk = toFiniteNumber(latest.reserveRisk, 0);
  const sthSopr = toFiniteNumber(latest.sthSopr, 0);
  const sthMvrv = toFiniteNumber(latest.sthMvrv, 0);
  const puellMultiple = toFiniteNumber(latest.puellMultiple, 0);

  const signals = {
    priceMa200w: latest.signalPriceMa200w ?? latest.signalPriceMa ?? priceMa200wRatio < DEFAULT_THRESHOLDS.priceMa200w,
    priceRealized: latest.signalPriceRealized ?? priceRealizedRatio < DEFAULT_THRESHOLDS.priceRealized,
    reserveRisk: latest.signalReserveRisk ?? reserveRisk < DEFAULT_THRESHOLDS.reserveRisk,
    sthSopr: latest.signalSthSopr ?? sthSopr < DEFAULT_THRESHOLDS.sthSopr,
    sthMvrv: latest.signalSthMvrv ?? sthMvrv < DEFAULT_THRESHOLDS.sthMvrv,
    puell: latest.signalPuell ?? puellMultiple < DEFAULT_THRESHOLDS.puell,
  };

  return {
    date: latest.d,
    btcPrice,
    priceMa200wRatio,
    priceRealizedRatio,
    ma200w: latest.ma200w,
    realizedPrice: latest.realizedPrice,
    reserveRisk,
    sthSopr,
    sthMvrv,
    puellMultiple,
    signalCount: latest.signalCount ?? Object.values(signals).filter(Boolean).length,
    signalScoreV2: latest.signalScoreV2,
    signalScoreV2Min3d: latest.signalScoreV2Min3d ?? null,
    signalConfirmed3d: latest.signalConfirmed3d,
    signalBandV2: latest.signalBandV2,
    signals,
    indicatorDates: findIndicatorDates(data),
  };
}

export function enrichLatestDataWithHistory(latest: LatestData, history: IndicatorData[]): LatestData {
  if (!history.length) {
    return latest;
  }

  return {
    ...latest,
    indicatorDates: latest.indicatorDates ?? findIndicatorDates(history),
  };
}

export function filterDataByTimeRange(data: IndicatorData[], range: TimeRange): IndicatorData[] {
  if (range === 'all') {
    return data;
  }

  const cutoffTime = Date.now() - TIME_RANGE_MS[range];
  return data.filter((item) => Date.parse(`${item.d}T00:00:00Z`) >= cutoffTime);
}

function isChartDataPoint(item: ChartDataPoint | null): item is ChartDataPoint {
  return item !== null;
}

export function getIndicatorChartData(
  data: IndicatorData[],
  indicator: IndicatorKey,
  range: TimeRange,
): ChartDataPoint[] {
  const filteredData = filterDataByTimeRange(data, range);

  return filteredData
    .map((item): ChartDataPoint | null => {
      let value: number | null = null;
      let signal = false;

      if (indicator === 'priceMa200w') {
        value = item.priceMa200wRatio ?? null;
        signal = item.signalPriceMa200w ?? item.signalPriceMa ?? false;
      }

      if (indicator === 'priceRealized') {
        value = item.priceRealizedRatio ?? null;
        signal = item.signalPriceRealized ?? false;
      }

      if (indicator === 'reserveRisk') {
        value = item.reserveRisk ?? null;
        signal = item.signalReserveRisk ?? false;
      }

      if (indicator === 'sthSopr') {
        value = item.sthSopr ?? null;
        signal = item.signalSthSopr ?? false;
      }

      if (indicator === 'sthMvrv') {
        value = item.sthMvrv ?? null;
        signal = item.signalSthMvrv ?? false;
      }

      if (indicator === 'puell') {
        value = item.puellMultiple ?? null;
        signal = item.signalPuell ?? false;
      }

      if (value === null) {
        return null;
      }

      const btcPrice = toNumericPrice(item.btcPrice);
      if (value === 0 && btcPrice === 0) {
        return null;
      }

      return {
        date: item.d,
        value,
        btcPrice,
        signal,
      };
    })
    .filter(isChartDataPoint);
}

export function getMA200ChartData(
  data: IndicatorData[],
  range: TimeRange,
): { date: string; price: number; ma200: number; signal: boolean }[] {
  return filterDataByTimeRange(data, range)
    .filter((item) => hasUsableValue(item.btcPrice) && (hasUsableValue(item.ma200w) || hasUsableValue(item.priceMa200wRatio)))
    .map((item) => {
      const price = toNumericPrice(item.btcPrice);
      let ma200 = item.ma200w;

      if ((!ma200 || ma200 <= 0) && item.priceMa200wRatio && item.priceMa200wRatio > 0) {
        ma200 = price / item.priceMa200wRatio;
      }

      return {
        date: item.d,
        price,
        ma200: toFiniteNumber(ma200, 0),
        signal: item.signalPriceMa200w ?? item.signalPriceMa ?? false,
      };
    });
}

export function getSignalEvents(data: IndicatorData[], minSignals = 4): SignalEvent[] {
  return data
    .filter((item) => (item.signalCount ?? 0) >= minSignals)
    .map((item) => ({
      date: item.d,
      btcPrice: toNumericPrice(item.btcPrice),
      signalCount: item.signalCount ?? 0,
      triggeredIndicators: [
        item.signalPriceMa200w || item.signalPriceMa ? 'Price/200W-MA' : '',
        item.signalPriceRealized ? 'Price/Realized' : '',
        item.signalReserveRisk ? 'Reserve Risk' : '',
        item.signalSthSopr ? 'STH-SOPR' : '',
        item.signalSthMvrv ? 'STH-MVRV' : '',
        item.signalPuell ? 'Puell' : '',
      ].filter(Boolean),
    }));
}

export function getDataFreshnessHours(date: string): number {
  if (!date) {
    return 0;
  }

  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs <= 0) {
    return 0;
  }

  return Number((diffMs / (1000 * 60 * 60)).toFixed(1));
}

export const INDICATOR_CONFIG = {
  priceMa200w: {
    name: 'Price / 200W MA',
    unit: '',
    targetValue: 1,
    color: '#F7931A',
    description: 'Spot price relative to the 200-week moving average.',
  },
  priceRealized: {
    name: 'Price / Realized Price',
    unit: '',
    targetValue: 1,
    color: '#0EA5E9',
    description: 'Spot price relative to on-chain realized price.',
  },
  reserveRisk: {
    name: 'Reserve Risk',
    unit: '',
    targetValue: 0.0016,
    color: '#10B981',
    description: 'Long-term holder risk/reward regime.',
  },
  sthSopr: {
    name: 'STH-SOPR',
    unit: '',
    targetValue: 1,
    color: '#EAB308',
    description: 'Short-term holder realized loss/profit ratio.',
  },
  sthMvrv: {
    name: 'STH-MVRV',
    unit: '',
    targetValue: 1,
    color: '#22C55E',
    description: 'Short-term holder unrealized PnL pressure.',
  },
  puell: {
    name: 'Puell Multiple',
    unit: '',
    targetValue: 0.6,
    color: '#F97316',
    description: 'Miner revenue vs historical baseline.',
  },
} as const;

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1w': 'Last 1W',
  '1m': 'Last 1M',
  '6m': 'Last 6M',
  '1y': 'Last 1Y',
  all: 'All History',
};
