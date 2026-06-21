import { INDICATOR_CONFIG } from '@/services/dataService';
import type {
  DetailSeriesPoint,
  IndicatorType,
  MaSeriesPoint,
  SignalMarkerPlan,
} from './indicatorChartUtils';
import { INDICATOR_ORDER } from './indicatorChartUtils';
import { IndicatorChartLegend } from './IndicatorChartLegend';
import { IndicatorDetailChart } from './IndicatorDetailChart';
import { PriceMa200Chart } from './PriceMa200Chart';

type IndicatorChartDetailPanelProps = {
  activeIndicator: IndicatorType;
  detailSeries: MaSeriesPoint[] | DetailSeriesPoint[];
  indicatorName: string;
  indicatorColor: string;
  indicatorDescription: string;
  valueDomain: [number, number];
  priceDomain: [number, number];
  showThresholds: boolean;
  signalMarkerPlan: SignalMarkerPlan;
  brushKey: number;
  brushStartIndex: number;
  brushEndIndex: number;
  thresholdDescription: string;
  isFullHistoryLoading: boolean;
  showFallbackNotice: boolean;
  onActivateIndicator: (indicatorKey: IndicatorType) => void;
  onBrushChange: (range: { startIndex?: number; endIndex?: number } | null | undefined) => void;
};

export function IndicatorChartDetailPanel({
  activeIndicator,
  detailSeries,
  indicatorName,
  indicatorColor,
  indicatorDescription,
  valueDomain,
  priceDomain,
  showThresholds,
  signalMarkerPlan,
  brushKey,
  brushStartIndex,
  brushEndIndex,
  thresholdDescription,
  isFullHistoryLoading,
  showFallbackNotice,
  onActivateIndicator,
  onBrushChange,
}: IndicatorChartDetailPanelProps) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {INDICATOR_ORDER.map((indicatorKey) => {
          const indicator = INDICATOR_CONFIG[indicatorKey];
          const isActive = indicatorKey === activeIndicator;

          return (
            <button
              key={indicatorKey}
              type="button"
              onClick={() => onActivateIndicator(indicatorKey)}
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
        <span className="font-medium" style={{ color: indicatorColor }}>
          {indicatorName}
        </span>
        <span className="mx-2">|</span>
        <span>{indicatorDescription}</span>
        {activeIndicator !== 'priceMa200w' && (
          <>
            <span className="mx-2">|</span>
            <span>{thresholdDescription}</span>
          </>
        )}
      </div>

      {isFullHistoryLoading ? (
        <div className="flex h-[420px] flex-col items-center justify-center rounded-lg border bg-muted/20 text-muted-foreground">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p>正在加载完整历史数据...</p>
        </div>
      ) : (
        <>
          {showFallbackNotice && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              完整历史暂不可用，当前使用轻量历史展示。
            </div>
          )}

          {activeIndicator === 'priceMa200w' ? (
            <PriceMa200Chart
              series={detailSeries as MaSeriesPoint[]}
              valueDomain={valueDomain}
              signalMarkerPlan={signalMarkerPlan}
              brushKey={brushKey}
              brushStartIndex={brushStartIndex}
              brushEndIndex={brushEndIndex}
              onBrushChange={onBrushChange}
            />
          ) : (
            <IndicatorDetailChart
              series={detailSeries as DetailSeriesPoint[]}
              indicatorName={indicatorName}
              indicatorColor={indicatorColor}
              valueDomain={valueDomain}
              priceDomain={priceDomain}
              showThresholds={showThresholds}
              signalMarkerPlan={signalMarkerPlan}
              brushKey={brushKey}
              brushStartIndex={brushStartIndex}
              brushEndIndex={brushEndIndex}
              onBrushChange={onBrushChange}
            />
          )}

          <IndicatorChartLegend
            activeIndicator={activeIndicator}
            indicatorName={indicatorName}
            indicatorColor={indicatorColor}
            showThresholds={showThresholds}
            signalCount={signalMarkerPlan.totalCount}
            thresholdDescription={thresholdDescription}
          />
        </>
      )}
    </>
  );
}
