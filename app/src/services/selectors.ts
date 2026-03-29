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
      mvrvZ: undefined,
      lthMvrv: undefined,
      puell: undefined,
      nupl: undefined,
    };
  }

  const fromPayload = latest.indicatorDates;
  if (fromPayload) {
    return {
      priceMa200w: fromPayload.priceMa200w ?? latest.d,
      mvrvZ: fromPayload.mvrvZ,
      lthMvrv: fromPayload.lthMvrv,
      puell: fromPayload.puell,
      nupl: fromPayload.nupl,
    };
  }

  const fromApiDataDate = getApiDataDateFromRow(latest);
  if (fromApiDataDate) {
    return {
      priceMa200w: String(fromApiDataDate.priceMa200w ?? fromApiDataDate.price_ma200w ?? latest.d),
      mvrvZ: typeof fromApiDataDate.mvrvZ === 'string'
        ? fromApiDataDate.mvrvZ
        : (typeof fromApiDataDate.mvrv_z === 'string' ? fromApiDataDate.mvrv_z : undefined),
      lthMvrv: typeof fromApiDataDate.lthMvrv === 'string'
        ? fromApiDataDate.lthMvrv
        : (typeof fromApiDataDate.lth_mvrv === 'string' ? fromApiDataDate.lth_mvrv : undefined),
      puell: typeof fromApiDataDate.puell === 'string' ? fromApiDataDate.puell : undefined,
      nupl: typeof fromApiDataDate.nupl === 'string' ? fromApiDataDate.nupl : undefined,
    };
  }

  const dates: NonNullable<LatestData['indicatorDates']> = {
    priceMa200w: latest.d,
    mvrvZ: undefined,
    lthMvrv: undefined,
    puell: undefined,
    nupl: undefined,
  };

  for (let index = data.length - 1; index >= 0; index -= 1) {
    const row = data[index];

    if (!dates.mvrvZ && hasUsableValue(row.mvrvZscore)) {
      dates.mvrvZ = row.d;
    }

    if (!dates.lthMvrv && hasUsableValue(row.lthMvrv)) {
      dates.lthMvrv = row.d;
    }

    if (!dates.puell && hasUsableValue(row.puellMultiple)) {
      dates.puell = row.d;
    }

    if (!dates.nupl && hasUsableValue(row.nupl)) {
      dates.nupl = row.d;
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
  const mvrvZscore = toFiniteNumber(latest.mvrvZscore, 0);
  const lthMvrv = toFiniteNumber(latest.lthMvrv, 0);
  const puellMultiple = toFiniteNumber(latest.puellMultiple, 0);
  const nupl = toFiniteNumber(latest.nupl, 0);

  const signals = {
    priceMa200w: priceMa200wRatio < 1,
    mvrvZ: mvrvZscore < 0,
    lthMvrv: lthMvrv < 1,
    puell: puellMultiple < 0.5,
    nupl: nupl < 0,
  };

  return {
    date: latest.d,
    btcPrice,
    priceMa200wRatio,
    ma200w: latest.ma200w,
    mvrvZscore,
    lthMvrv,
    puellMultiple,
    nupl,
    signalCount: Object.values(signals).filter(Boolean).length,
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
        signal = item.signalPriceMa ?? false;
      }

      if (indicator === 'mvrvZ') {
        value = item.mvrvZscore ?? null;
        signal = item.signalMvrvZ ?? false;
      }

      if (indicator === 'lthMvrv') {
        value = item.lthMvrv ?? null;
        signal = item.signalLthMvrv ?? false;
      }

      if (indicator === 'puell') {
        value = item.puellMultiple ?? null;
        signal = item.signalPuell ?? false;
      }

      if (indicator === 'nupl') {
        value = item.nupl ?? null;
        signal = item.signalNupl ?? false;
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
        signal: item.signalPriceMa ?? false,
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
        item.signalPriceMa ? 'Price/200W-MA' : '',
        item.signalMvrvZ ? 'MVRV-Z' : '',
        item.signalLthMvrv ? 'LTH-MVRV' : '',
        item.signalPuell ? 'Puell' : '',
        item.signalNupl ? 'NUPL' : '',
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
    name: 'BTC价格 / 200周均线',
    unit: '',
    targetValue: 1,
    color: '#F7931A',
    description: '价格相对200周均线的位置',
  },
  mvrvZ: {
    name: 'MVRV Z-Score',
    unit: '',
    targetValue: 0,
    color: '#3B82F6',
    description: '市场价值相对实现价值的标准化偏离',
  },
  lthMvrv: {
    name: 'LTH-MVRV',
    unit: '',
    targetValue: 1,
    color: '#10B981',
    description: '长期持有者未实现盈亏比率',
  },
  puell: {
    name: 'Puell Multiple',
    unit: '',
    targetValue: 0.5,
    color: '#8B5CF6',
    description: '矿工收入相对历史常态的位置',
  },
  nupl: {
    name: 'NUPL',
    unit: '',
    targetValue: 0,
    color: '#EF4444',
    description: '全网净未实现盈亏',
  },
};

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1w': '近1周',
  '1m': '近1个月',
  '6m': '近6个月',
  '1y': '近1年',
  all: '全部历史',
};
