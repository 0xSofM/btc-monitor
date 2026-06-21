import { useMemo } from 'react';

import type { IndicatorData } from '@/types';
import { INDICATOR_CONFIG } from '@/services/dataService';
import type { DetailSeriesPoint, IndicatorType } from './indicatorChartUtils';
import {
  buildThresholdDescription,
  findLatestThresholdPoint,
} from './indicatorChartUtils';
import {
  buildChartDomains,
  buildDetailSeries,
  buildMiniSeriesMap,
  buildVisibleSignalMarkerPlan,
} from './indicatorChartDataBuilders';

type UseIndicatorChartDataOptions = {
  data: IndicatorData[];
  activeIndicator: IndicatorType;
  brushStartIndex: number;
  brushEndIndex?: number;
};

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
