import type { IndicatorType } from './indicatorChartUtils';
import {
  BTC_PRICE_COMPARE_COLOR,
  SIGNAL_MARKER_FILL,
  SIGNAL_MARKER_INNER_FILL,
  SIGNAL_MARKER_STROKE,
} from './indicatorChartUtils';

interface IndicatorChartLegendProps {
  activeIndicator: IndicatorType;
  indicatorName: string;
  indicatorColor: string;
  showThresholds: boolean;
  signalCount: number;
  thresholdDescription: string;
}

function SignalMarkerSwatch() {
  return (
    <span
      className="h-3 w-3 rounded-full border"
      style={{
        backgroundColor: SIGNAL_MARKER_FILL,
        borderColor: SIGNAL_MARKER_STROKE,
        boxShadow: `inset 0 0 0 3px ${SIGNAL_MARKER_INNER_FILL}`,
      }}
    />
  );
}

export function IndicatorChartLegend({
  activeIndicator,
  indicatorName,
  indicatorColor,
  showThresholds,
  signalCount,
  thresholdDescription,
}: IndicatorChartLegendProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: indicatorColor }} />
        <span>{indicatorName}</span>
      </div>

      {activeIndicator === 'priceMa200w' ? (
        <>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4" style={{ borderTop: '2px dashed #3B82F6' }} />
            <span>200W-MA</span>
          </div>
          <div className="flex items-center gap-1">
            <SignalMarkerSwatch />
            <span>跌破 200W-MA 信号点</span>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5">
            {signalCount} 个信号
          </span>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4" style={{ borderTop: `2px dashed ${BTC_PRICE_COMPARE_COLOR}` }} />
            <span>BTC Price（右轴）</span>
          </div>
          {showThresholds && (
            <div className="flex items-center gap-1">
              <div className="h-0.5 w-4" style={{ borderTop: '2px dashed #10B981' }} />
              <span>触发阈值线（{thresholdDescription}）</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <SignalMarkerSwatch />
            <span>信号点</span>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5">
            {signalCount} 个信号
          </span>
        </>
      )}
    </div>
  );
}
