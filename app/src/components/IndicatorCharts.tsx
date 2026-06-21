import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { IndicatorData } from '@/types';
import { INDICATOR_CONFIG } from '@/services/dataService';
import type { DetailSeriesPoint, MaSeriesPoint } from './indicatorChartUtils';
import { IndicatorChartLegend } from './IndicatorChartLegend';
import { IndicatorChartsHeader } from './IndicatorChartsHeader';
import { IndicatorDetailChart } from './IndicatorDetailChart';
import { FullHistoryPrompt } from './FullHistoryPrompt';
import { IndicatorMiniCards } from './IndicatorMiniCards';
import { PriceMa200Chart } from './PriceMa200Chart';
import { useIndicatorChartData } from './useIndicatorChartData';
import { useIndicatorChartState } from './useIndicatorChartState';
import {
  INDICATOR_ORDER,
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

  const renderPriceChart = () => {
    return (
      <PriceMa200Chart
        series={detailSeries as MaSeriesPoint[]}
        valueDomain={chartDomains.valueDomain}
        signalMarkerPlan={signalMarkerPlan}
        brushKey={brushKey}
        brushStartIndex={brushStartIndex}
        brushEndIndex={resolvedEndIndex}
        onBrushChange={handleBrushChange}
      />
    );
  };

  const renderIndicatorChart = () => {
    return (
      <IndicatorDetailChart
        series={detailSeries as DetailSeriesPoint[]}
        indicatorName={config.name}
        indicatorColor={config.color}
        valueDomain={chartDomains.valueDomain}
        priceDomain={chartDomains.priceDomain}
        showThresholds={showThresholds}
        signalMarkerPlan={signalMarkerPlan}
        brushKey={brushKey}
        brushStartIndex={brushStartIndex}
        brushEndIndex={resolvedEndIndex}
        onBrushChange={handleBrushChange}
      />
    );
  };

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
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {INDICATOR_ORDER.map((indicatorKey) => {
                const indicator = INDICATOR_CONFIG[indicatorKey];
                const isActive = indicatorKey === activeIndicator;

                return (
                  <button
                    key={indicatorKey}
                    type="button"
                    onClick={() => activateIndicator(indicatorKey, {
                      expandDetail: historyMode !== 'full',
                      shouldRequestFullHistory: historyMode !== 'full',
                      onRequestFullHistory,
                    })}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    style={{ backgroundColor: isActive ? indicator.color : undefined }}
                  >
                    {indicator.name}
                  </button>
                );
              })}
            </div>

            <div className="mb-4 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium" style={{ color: config.color }}>
                {config.name}
              </span>
              <span className="mx-2">|</span>
              <span>{config.description}</span>
              {activeIndicator !== 'priceMa200w' && (
                <>
                  <span className="mx-2">|</span>
                  <span>{thresholdDescription}</span>
                </>
              )}
            </div>

            {historyMode !== 'full' && isFullHistoryLoading ? (
              <div className="flex h-[420px] flex-col items-center justify-center rounded-lg border bg-muted/20 text-muted-foreground">
                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                <p>正在加载完整历史数据...</p>
              </div>
            ) : (
              <>
                {historyMode !== 'full' && hasRequestedFullHistory && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    完整历史暂不可用，当前使用轻量历史展示。
                  </div>
                )}

                {activeIndicator === 'priceMa200w' ? renderPriceChart() : renderIndicatorChart()}

                <IndicatorChartLegend
                  activeIndicator={activeIndicator}
                  indicatorName={config.name}
                  indicatorColor={config.color}
                  showThresholds={showThresholds}
                  signalCount={signalMarkerPlan.totalCount}
                  thresholdDescription={thresholdDescription}
                />
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
