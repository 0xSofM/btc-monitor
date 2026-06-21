import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { IndicatorData } from '@/types';
import { IndicatorChartDetailPanel } from './IndicatorChartDetailPanel';
import { IndicatorChartsHeader } from './IndicatorChartsHeader';
import { FullHistoryPrompt } from './FullHistoryPrompt';
import { IndicatorMiniCards } from './IndicatorMiniCards';
import { useIndicatorChartData } from './useIndicatorChartData';
import { useIndicatorChartState } from './useIndicatorChartState';
import {
  TIME_RANGES,
} from './indicatorChartUtils';

interface IndicatorChartsProps {
  data: IndicatorData[];
  historyMode?: 'none' | 'light' | 'full';
  isHistoryLoading?: boolean;
  isFullHistoryLoading?: boolean;
  onRequestFullHistory?: () => Promise<void> | void;
}

export function IndicatorCharts({
  data,
  historyMode = 'light',
  isHistoryLoading = false,
  isFullHistoryLoading = false,
  onRequestFullHistory,
}: IndicatorChartsProps) {
  const {
    activeIndicator,
    isDetailExpanded,
    hasRequestedFullHistory,
    showThresholds,
    selectedRange,
    brushStartIndex,
    brushEndIndex,
    brushKey,
    activateIndicator,
    selectTimeRange,
    resetRange,
    handleBrushChange,
    setShowThresholds,
    setIsDetailExpanded,
  } = useIndicatorChartState();
  const {
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
  } = useIndicatorChartData({
    data,
    activeIndicator,
    brushStartIndex,
    brushEndIndex,
  });

  return (
    <Card className="surface-card mb-6">
      <CardHeader>
        <IndicatorChartsHeader
          historyMode={historyMode}
          historyStartDate={historyStartDate}
          historyEndDate={historyEndDate}
          rowCount={data.length}
          isHistoryLoading={isHistoryLoading}
          isDetailExpanded={isDetailExpanded}
          selectedRange={selectedRange}
          timeRanges={TIME_RANGES}
          showThresholds={showThresholds}
          onSelectRange={(rangeKey) => selectTimeRange(rangeKey, totalPoints)}
          onResetView={resetRange}
          onToggleThresholds={() => setShowThresholds((prev) => !prev)}
          onCollapseDetail={() => setIsDetailExpanded(false)}
        />
      </CardHeader>

      <CardContent>
        <IndicatorMiniCards
          activeIndicator={activeIndicator}
          miniSeriesMap={miniSeriesMap}
          showThresholds={showThresholds}
          onActivateIndicator={(indicatorKey) => activateIndicator(indicatorKey, {
            expandDetail: true,
            shouldRequestFullHistory: historyMode !== 'full',
            onRequestFullHistory,
          })}
        />

        {!isDetailExpanded ? (
          <FullHistoryPrompt />
        ) : (
          <IndicatorChartDetailPanel
            activeIndicator={activeIndicator}
            detailSeries={detailSeries}
            indicatorName={config.name}
            indicatorColor={config.color}
            indicatorDescription={config.description}
            valueDomain={chartDomains.valueDomain}
            priceDomain={chartDomains.priceDomain}
            showThresholds={showThresholds}
            signalMarkerPlan={signalMarkerPlan}
            brushKey={brushKey}
            brushStartIndex={brushStartIndex}
            brushEndIndex={resolvedEndIndex}
            thresholdDescription={thresholdDescription}
            isFullHistoryLoading={historyMode !== 'full' && isFullHistoryLoading}
            showFallbackNotice={historyMode !== 'full' && hasRequestedFullHistory}
            onActivateIndicator={(indicatorKey) => activateIndicator(indicatorKey, {
              expandDetail: historyMode !== 'full',
              shouldRequestFullHistory: historyMode !== 'full',
              onRequestFullHistory,
            })}
            onBrushChange={handleBrushChange}
          />
        )}
      </CardContent>
    </Card>
  );
}
