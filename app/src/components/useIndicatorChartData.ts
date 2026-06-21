import { useMemo } from 'react';

import type { IndicatorData } from '@/types';
import { INDICATOR_CONFIG, getIndicatorChartData, getMA200ChartData } from '@/services/dataService';
import type { DetailSeriesPoint, IndicatorType, MaSeriesPoint, SignalMarkerPlan } from './indicatorChartUtils';
import {
  CHART_FLOOR_CONFIG,
  buildSignalMarkerPlan,
  buildThresholdDescription,
  findLatestThresholdPoint,
  getPaddedDomain,
  parseDateMs,
} from './indicatorChartUtils';

type ChartDomains = {
  valueDomain: [number, number];
  priceDomain: [number, number];
};

type UseIndicatorChartDataOptions = {
  data: IndicatorData[];
  activeIndicator: IndicatorType;
  brushStartIndex: number;
  brushEndIndex?: number;
};

function buildDetailSeries(
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

function buildMiniSeriesMap(data: IndicatorData[]): Record<IndicatorType, DetailSeriesPoint[]> {
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

function buildChartDomains(
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

function buildVisibleSignalMarkerPlan(
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

export function useIndicatorChartData({
  data,
  activeIndicator,
  brushStartIndex,
  brushEndIndex,
}: UseIndicatorChartDataOptions) {
  const detailSeries = useMemo(
    () => buildDetailSeries(data, activeIndicator),
    [activeIndicator, data],
  );
  const miniSeriesMap = useMemo(() => buildMiniSeriesMap(data), [data]);
  const config = INDICATOR_CONFIG[activeIndicator];
  const detailThresholdPoint = activeIndicator === 'priceMa200w'
    ? null
    : findLatestThresholdPoint(detailSeries as DetailSeriesPoint[]);
  const thresholdDescription = activeIndicator === 'priceMa200w'
    ? '价格跌破 200W-MA 时通常进入长期底部观察区。'
    : buildThresholdDescription(activeIndicator, detailThresholdPoint);
  const totalPoints = detailSeries.length;
  const historyStartDate = data[0]?.d ?? '-';
  const historyEndDate = data.at(-1)?.d ?? '-';

  const resolvedEndIndex = totalPoints > 0
    ? Math.min(brushEndIndex ?? (totalPoints - 1), totalPoints - 1)
    : 0;
  const resolvedStartIndex = totalPoints > 0
    ? Math.min(brushStartIndex, resolvedEndIndex)
    : 0;
  const visibleDetailSeries = useMemo(() => (
    totalPoints > 0 ? detailSeries.slice(resolvedStartIndex, resolvedEndIndex + 1) : []
  ), [detailSeries, resolvedEndIndex, resolvedStartIndex, totalPoints]);
  const chartDomains = useMemo(
    () => buildChartDomains(activeIndicator, visibleDetailSeries),
    [activeIndicator, visibleDetailSeries],
  );
  const signalMarkerPlan = useMemo(
    () => buildVisibleSignalMarkerPlan(activeIndicator, detailSeries, resolvedStartIndex, resolvedEndIndex),
    [activeIndicator, detailSeries, resolvedEndIndex, resolvedStartIndex],
  );

  return {
    detailSeries,
    miniSeriesMap,
    config,
    thresholdDescription,
    totalPoints,
    historyStartDate,
    historyEndDate,
    resolvedEndIndex,
    chartDomains,
    signalMarkerPlan,
  };
}
