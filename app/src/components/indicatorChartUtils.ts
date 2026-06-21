export type IndicatorType = 'priceMa200w' | 'mvrvZscore' | 'nupl' | 'puell' | 'sthMvrv' | 'sthSopr' | 'lthMvrv' | 'lthSopr';

export type DetailSeriesPoint = {
  date: string;
  time?: number;
  value: number | null;
  signalValue?: number | null;
  triggerValue?: number | null;
  deepValue?: number | null;
  signal: boolean;
  btcPrice?: number;
};

export type MaSeriesPoint = {
  date: string;
  time?: number;
  price: number;
  signalValue?: number | null;
  ma200: number | null;
  signal: boolean;
};

export const INDICATOR_ORDER: IndicatorType[] = ['priceMa200w', 'mvrvZscore', 'nupl', 'puell', 'sthMvrv', 'sthSopr', 'lthMvrv', 'lthSopr'];

export const TIME_RANGES = [
  { key: 'all', label: '全部' },
  { key: '1y', label: '1年' },
  { key: '6m', label: '6月' },
  { key: '1m', label: '1月' },
  { key: '1w', label: '1周' },
] as const;

export const RANGE_DAYS: Record<(typeof TIME_RANGES)[number]['key'], number> = {
  all: 0,
  '1y': 365,
  '6m': 180,
  '1m': 30,
  '1w': 7,
};

export const CHART_FLOOR_CONFIG: Record<IndicatorType, number> = {
  priceMa200w: 0,
  mvrvZscore: -2,
  nupl: -0.2,
  puell: 0,
  sthMvrv: 0,
  sthSopr: 0.9,
  lthMvrv: 0,
  lthSopr: 0.75,
};

export const SIGNAL_MARKER_FILL = '#ECFDF5';
export const SIGNAL_MARKER_STROKE = '#047857';
export const SIGNAL_MARKER_INNER_FILL = '#065F46';
export const BTC_PRICE_COMPARE_COLOR = '#64748B';

export type SignalMarkerPlan = {
  keys: Set<string>;
  totalCount: number;
  compact: boolean;
};

export type TooltipEntry = {
  color?: string;
  name?: string;
  value?: number;
  payload?: {
    btcPrice?: number;
    signal?: boolean;
  };
};

export function formatDate(value: string | number | null | undefined): string {
  if (!value) {
    return '';
  }

  const dateText = typeof value === 'number'
    ? new Date(value).toISOString().slice(0, 10)
    : value;
  const parts = dateText.split('-');
  if (parts.length === 3) {
    return `${parts[0].slice(2)}/${parts[1]}/${parts[2]}`;
  }

  return dateText;
}

export function parseDateMs(value: string): number {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDateFromMs(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  return formatDate(new Date(value).toISOString().slice(0, 10));
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  if (Math.abs(value) >= 10) {
    return value.toFixed(2);
  }

  if (Math.abs(value) >= 1) {
    return value.toFixed(3);
  }

  return value.toFixed(4);
}

export function findLatestObservedPoint(points: DetailSeriesPoint[]): DetailSeriesPoint | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (typeof point?.value === 'number' && Number.isFinite(point.value)) {
      return point;
    }
  }

  return null;
}

export function findLatestThresholdPoint(points: DetailSeriesPoint[]): DetailSeriesPoint | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (typeof point?.triggerValue === 'number' && Number.isFinite(point.triggerValue)) {
      return point;
    }
  }

  return null;
}

export function buildThresholdDescription(indicator: IndicatorType, point: DetailSeriesPoint | null): string {
  const triggerText = typeof point?.triggerValue === 'number' ? formatNumber(point.triggerValue) : '-';
  const deepText = typeof point?.deepValue === 'number' ? formatNumber(point.deepValue) : '-';

  switch (indicator) {
    case 'priceMa200w':
      return '固定阈值 < 1（深度 < 0.85）';
    case 'mvrvZscore':
      return '固定阈值 < 0（深度 < -0.5）';
    case 'nupl':
      return '固定阈值 < 0.15（深度 < 0）';
    case 'puell':
      return '固定阈值 < 0.6（深度 < 0.5）';
    case 'sthMvrv':
      return `滚动阈值 < ${triggerText}（深度 < ${deepText}，过去 1460 天 p27 / p13.5）`;
    case 'sthSopr':
      return `3 日均值滚动阈值 < ${triggerText}（深度 < ${deepText}，过去 1460 天 p27 / p13.5）`;
    case 'lthMvrv':
      return '固定阈值 < 1（深度 < 0.90）';
    case 'lthSopr':
      return `3 日均值滚动阈值 < ${triggerText}（深度 < ${deepText}，过去 1460 天 p20 / p10）`;
    default:
      return '阈值线';
  }
}

export function formatPriceAxis(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }

  return `$${value.toFixed(0)}`;
}

export function formatPriceTooltip(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatTooltipValue(entry: TooltipEntry): string {
  if (typeof entry.value !== 'number') {
    return '-';
  }

  if (entry.name === 'BTC Price' || entry.name === '200W-MA') {
    return formatPriceTooltip(entry.value);
  }

  return formatNumber(entry.value);
}

export function getPaddedDomain(values: number[], paddingRatio: number, floor?: number): [number, number] {
  if (values.length === 0) {
    return [floor ?? 0, 1];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * paddingRatio || Math.max(Math.abs(max) * paddingRatio, 1);
  const domainMin = min - padding;

  return [
    typeof floor === 'number' ? Math.max(floor, domainMin) : domainMin,
    max + padding,
  ];
}

function getSignalMarkerLimit(visiblePointCount: number): number {
  if (visiblePointCount > 3000) {
    return 42;
  }

  if (visiblePointCount > 1200) {
    return 56;
  }

  if (visiblePointCount > 500) {
    return 80;
  }

  return 140;
}

export function buildSignalMarkerPlan<T>(
  series: T[],
  startIndex: number,
  endIndex: number,
  isSignalPoint: (point: T) => boolean,
  getKey: (point: T) => string,
): SignalMarkerPlan {
  const signalIndexes: number[] = [];
  const safeStartIndex = Math.max(0, startIndex);
  const safeEndIndex = Math.min(series.length - 1, endIndex);

  for (let index = safeStartIndex; index <= safeEndIndex; index += 1) {
    const point = series[index];
    if (point && isSignalPoint(point)) {
      signalIndexes.push(index);
    }
  }

  const visiblePointCount = Math.max(0, safeEndIndex - safeStartIndex + 1);
  const markerLimit = getSignalMarkerLimit(visiblePointCount);
  const compact = signalIndexes.length > markerLimit;
  const step = compact ? Math.ceil(signalIndexes.length / markerLimit) : 1;
  const keys = new Set<string>();

  signalIndexes.forEach((index, signalIndex) => {
    if (!compact || signalIndex % step === 0 || signalIndex === signalIndexes.length - 1) {
      keys.add(getKey(series[index]));
    }
  });

  return {
    keys,
    totalCount: signalIndexes.length,
    compact,
  };
}
