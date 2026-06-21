import type { IndicatorData } from '@/types';
import { getIndicatorChartData, getMA200ChartData } from '@/services/dataService';
import type { DetailSeriesPoint, IndicatorType, MaSeriesPoint, SignalMarkerPlan } from './indicatorChartUtils';
import {
  CHART_FLOOR_CONFIG,
  buildSignalMarkerPlan,
  getPaddedDomain,
  parseDateMs,
} from './indicatorChartUtils';

export type ChartDomains = {
  valueDomain: [number, number];
  priceDomain: [number, number];
};

export function buildDetailSeries(
  data: IndicatorData[],
  activeIndicator: IndicatorType,
): MaSeriesPoint[] | DetailSeriesPoint[] {
  if (activeIndicator === 'priceMa200w') {
    return getMA200ChartData(data, 'all').map((point) => ({
      ...point,
      time: parseDateMs(point.date),
      signalValue: point.signal ? point.price : null,
    })) as MaSeriesPoint[];
  }

  return getIndicatorChartData(data, activeIndicator, 'all').map((point) => ({
    ...point,
    time: parseDateMs(point.date),
    signalValue: point.signal && typeof point.value === 'number' ? point.value : null,
  })) as DetailSeriesPoint[];
}

export function buildMiniSeriesMap(data: IndicatorData[]): Record<IndicatorType, DetailSeriesPoint[]> {
  return {
    priceMa200w: getIndicatorChartData(data, 'priceMa200w', '1y') as DetailSeriesPoint[],
    mvrvZscore: getIndicatorChartData(data, 'mvrvZscore', '1y') as DetailSeriesPoint[],
    nupl: getIndicatorChartData(data, 'nupl', '1y') as DetailSeriesPoint[],
    puell: getIndicatorChartData(data, 'puell', '1y') as DetailSeriesPoint[],
    sthMvrv: getIndicatorChartData(data, 'sthMvrv', '1y') as DetailSeriesPoint[],
    sthSopr: getIndicatorChartData(data, 'sthSopr', '1y') as DetailSeriesPoint[],
    lthMvrv: getIndicatorChartData(data, 'lthMvrv', '1y') as DetailSeriesPoint[],
    lthSopr: getIndicatorChartData(data, 'lthSopr', '1y') as DetailSeriesPoint[],
  };
}

export function buildChartDomains(
  activeIndicator: IndicatorType,
  visibleDetailSeries: MaSeriesPoint[] | DetailSeriesPoint[],
): ChartDomains {
  if (activeIndicator === 'priceMa200w') {
    const visibleValues = (visibleDetailSeries as MaSeriesPoint[])
      .flatMap((row) => [row.price, row.ma200])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    const valueDomain = getPaddedDomain(visibleValues, 0.06, 0);

    return {
      valueDomain,
      priceDomain: valueDomain,
    };
  }

  const visibleIndicatorSeries = visibleDetailSeries as DetailSeriesPoint[];
  const values = visibleIndicatorSeries
    .flatMap((row) => [row.value, row.triggerValue])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const priceValues = visibleIndicatorSeries
    .map((row) => row.btcPrice)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 0;
  const padding = (dataMax - dataMin) * 0.12 || 0.5;

  return {
    valueDomain: [
      Math.min(dataMin - padding, CHART_FLOOR_CONFIG[activeIndicator]),
      dataMax + padding,
    ],
    priceDomain: getPaddedDomain(priceValues, 0.06, 0),
  };
}

export function buildVisibleSignalMarkerPlan(
  activeIndicator: IndicatorType,
  detailSeries: MaSeriesPoint[] | DetailSeriesPoint[],
  resolvedStartIndex: number,
  resolvedEndIndex: number,
): SignalMarkerPlan {
  if (!detailSeries.length) {
    return { keys: new Set<string>(), totalCount: 0, compact: false };
  }

  if (activeIndicator === 'priceMa200w') {
    return buildSignalMarkerPlan(
      detailSeries as MaSeriesPoint[],
      resolvedStartIndex,
      resolvedEndIndex,
      (point) => point.signal,
      (point) => point.date,
    );
  }

  return buildSignalMarkerPlan(
    detailSeries as DetailSeriesPoint[],
    resolvedStartIndex,
    resolvedEndIndex,
    (point) => point.signal && typeof point.value === 'number',
    (point) => point.date,
  );
}
