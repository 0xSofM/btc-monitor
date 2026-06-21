import { formatNumber } from './indicatorChartFormatters';

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

export { TIME_RANGES, RANGE_DAYS } from './indicatorChartRanges';
export {
  formatDate,
  formatDateFromMs,
  formatNumber,
  formatPriceAxis,
  formatPriceTooltip,
  formatTooltipValue,
  parseDateMs,
} from './indicatorChartFormatters';
export { buildSignalMarkerPlan } from './indicatorSignalMarkerPlan';
