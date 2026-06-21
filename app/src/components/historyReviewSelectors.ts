import type { IndicatorData } from '@/types';

export type IndexedHistoryRow = {
  row: IndicatorData;
  time: number;
  price: number;
  signalCount: number;
};

export type FilteredHistoryResult = {
  rows: IndicatorData[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
};

export type DateRange = {
  min: string;
  max: string;
};

export type HistoryRowDisplay = {
  priceLabel: string;
  signalCount: number;
  totalSignals: number;
  isStrongSignal: boolean;
  scoreLabel: string;
  signalBadges: string[];
};

export const DEFAULT_MIN_SIGNALS = 4;

export const EMPTY_FILTERED_HISTORY: FilteredHistoryResult = {
  rows: [],
  minPrice: 0,
  maxPrice: 0,
  avgPrice: 0,
};

export function parsePrice(value: number | string | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatPrice(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getSignalBadges(item: IndicatorData): string[] {
  const signals: string[] = [];

  if (item.signalPriceMa200w || item.signalPriceMa) signals.push('Price / 200W-MA');
  if (item.signalsV6?.mvrvZscore ?? item.signalMvrvZscoreCore) signals.push('MVRV Z-Score');
  if (item.signalsV6?.nupl ?? item.signalNuplCore ?? item.signalNupl) signals.push('NUPL');
  if (item.signalsV6?.puell ?? item.signalPuell) signals.push('Puell Multiple');
  if (item.signalsV6?.sthMvrv ?? item.signalSthMvrv) signals.push('STH-MVRV');
  if (item.signalsV6?.sthSoprTrigger ?? item.signalSthSoprTrigger ?? item.signalSthSoprAux ?? item.signalSthSopr) signals.push('STH-SOPR');
  if (item.signalsV6?.lthMvrv ?? item.signalLthMvrv) signals.push('LTH-MVRV');
  if (item.signalsV6?.lthSopr ?? item.signalLthSopr) signals.push('LTH-SOPR');

  return signals;
}

export function indexHistoryRows(data: IndicatorData[]): IndexedHistoryRow[] {
  return data.map((row) => ({
    row,
    time: Date.parse(`${row.d}T00:00:00Z`),
    price: parsePrice(row.btcPrice),
    signalCount: row.signalCountV6 ?? row.signalCountV4 ?? row.signalCount ?? 0,
  }));
}

export function getMaxSignalCount(indexedData: IndexedHistoryRow[]): number {
  return indexedData.reduce(
    (max, item) => Math.max(
      max,
      item.row.activeIndicatorCountV6 ?? item.row.activeIndicatorCountV4 ?? item.row.activeIndicatorCount ?? 0,
      item.signalCount,
    ),
    8,
  );
}

export function getThresholdOptions(maxSignalCount: number): number[] {
  const start = Math.max(1, maxSignalCount - 2);
  return Array.from({ length: maxSignalCount - start + 1 }, (_, index) => start + index);
}

export function getDateRange(indexedData: IndexedHistoryRow[]): DateRange {
  if (!indexedData.length) {
    return { min: '', max: '' };
  }

  return {
    min: indexedData[0]?.row.d ?? '',
    max: indexedData[indexedData.length - 1]?.row.d ?? '',
  };
}

export function filterHistoryRows(params: {
  indexedData: IndexedHistoryRow[];
  minSignals: number;
  startDate: string;
  endDate: string;
}): FilteredHistoryResult {
  const startAt = params.startDate ? Date.parse(`${params.startDate}T00:00:00Z`) : null;
  const endAt = params.endDate ? Date.parse(`${params.endDate}T23:59:59Z`) : null;
  const rows: IndicatorData[] = [];
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;
  let totalPrice = 0;

  for (let index = params.indexedData.length - 1; index >= 0; index -= 1) {
    const item = params.indexedData[index];
    if (!item || item.signalCount < params.minSignals) {
      continue;
    }

    if (startAt && item.time < startAt) {
      continue;
    }

    if (endAt && item.time > endAt) {
      continue;
    }

    rows.push(item.row);
    minPrice = Math.min(minPrice, item.price);
    maxPrice = Math.max(maxPrice, item.price);
    totalPrice += item.price;
  }

  if (!rows.length) {
    return EMPTY_FILTERED_HISTORY;
  }

  return {
    rows,
    minPrice,
    maxPrice,
    avgPrice: totalPrice / rows.length,
  };
}

export function getHistoryRowDisplay(
  item: IndicatorData,
  maxSignalCount: number,
): HistoryRowDisplay {
  const totalSignals = item.activeIndicatorCountV6
    ?? item.activeIndicatorCountV4
    ?? item.activeIndicatorCount
    ?? maxSignalCount;
  const signalCount = item.signalCountV6 ?? item.signalCountV4 ?? item.signalCount ?? 0;
  const maxScore = item.maxTotalScoreV6
    ?? item.maxTotalScoreV4
    ?? item.maxSignalScoreV2
    ?? totalSignals * 2;
  const score = item.totalScoreV6 ?? item.totalScoreV4 ?? item.signalScoreV2 ?? '-';

  return {
    priceLabel: formatPrice(parsePrice(item.btcPrice)),
    signalCount,
    totalSignals,
    isStrongSignal: signalCount >= Math.max(1, totalSignals - 1),
    scoreLabel: `${score} / ${maxScore}`,
    signalBadges: getSignalBadges(item),
  };
}
