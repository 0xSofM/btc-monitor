import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { IndicatorTooltip } from './IndicatorChartOverlay';
import { renderSignalMarker, renderSkippedSignalMarker } from './indicatorChartMarkers';
import type { DetailSeriesPoint, SignalMarkerPlan } from './indicatorChartUtils';
import {
  BTC_PRICE_COMPARE_COLOR,
  formatDate,
  formatDateFromMs,
  formatNumber,
  formatPriceAxis,
} from './indicatorChartUtils';

interface IndicatorDetailChartProps {
  series: DetailSeriesPoint[];
  indicatorName: string;
  indicatorColor: string;
  valueDomain: [number, number];
  priceDomain: [number, number];
  showThresholds: boolean;
  signalMarkerPlan: SignalMarkerPlan;
  brushKey: number;
  brushStartIndex: number;
  brushEndIndex: number;
  onBrushChange: (range: { startIndex?: number; endIndex?: number } | null | undefined) => void;
}

export function IndicatorDetailChart({
  series,
  indicatorName,
  indicatorColor,
  valueDomain,
  priceDomain,
  showThresholds,
  signalMarkerPlan,
  brushKey,
  brushStartIndex,
  brushEndIndex,
  onBrushChange,
}: IndicatorDetailChartProps) {
  if (!series.length) {
    return <div className="flex h-[420px] items-center justify-center text-muted-foreground">暂无指标数据</div>;
  }

  const [yMin, yMax] = valueDomain;
  const [priceYMin, priceYMax] = priceDomain;

  return (
    <ResponsiveContainer width="100%" height={420}>
      <LineChart data={series} margin={{ top: 10, right: 28, left: 8, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={formatDateFromMs}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis yAxisId="indicator" tick={{ fontSize: 11 }} domain={[yMin, yMax]} tickFormatter={formatNumber} />
        <YAxis
          yAxisId="price"
          orientation="right"
          domain={[priceYMin, priceYMax]}
          tick={{ fontSize: 11, fill: BTC_PRICE_COMPARE_COLOR }}
          tickFormatter={formatPriceAxis}
          width={54}
        />
        <Tooltip content={<IndicatorTooltip />} />

        {showThresholds && (
          <Line
            yAxisId="indicator"
            type="monotone"
            dataKey="triggerValue"
            name="触发阈值"
            stroke="#10B981"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        )}

        <Line
          yAxisId="price"
          type="monotone"
          dataKey="btcPrice"
          name="BTC Price"
          stroke={BTC_PRICE_COMPARE_COLOR}
          strokeWidth={1.5}
          strokeDasharray="5 5"
          strokeOpacity={0.72}
          dot={false}
          activeDot={{ r: 4, stroke: BTC_PRICE_COMPARE_COLOR, strokeWidth: 1.5 }}
          connectNulls={false}
          isAnimationActive={false}
        />

        <Line
          yAxisId="indicator"
          type="monotone"
          dataKey="value"
          name={indicatorName}
          stroke={indicatorColor}
          strokeWidth={2}
          connectNulls={false}
          dot={false}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
        <Line
          yAxisId="indicator"
          type="monotone"
          dataKey="signalValue"
          name="信号点"
          stroke="transparent"
          strokeWidth={0}
          connectNulls={false}
          dot={(dotProps) => {
            const index = typeof dotProps.index === 'number' ? dotProps.index : -1;
            const payload = dotProps.payload as { date?: string } | undefined;
            const cx = typeof dotProps.cx === 'number' ? dotProps.cx : 0;
            const cy = typeof dotProps.cy === 'number' ? dotProps.cy : 0;
            const key = payload?.date ?? (index >= 0 ? String(index) : `${cx}-${cy}`);

            if (!signalMarkerPlan.keys.has(key)) {
              return renderSkippedSignalMarker(`indicator-signal-hidden-${key}`);
            }

            return renderSignalMarker(
              `indicator-signal-${key}`,
              cx,
              cy,
              signalMarkerPlan.compact,
            );
          }}
          activeDot={false}
          isAnimationActive={false}
        />

        <Brush
          key={brushKey}
          dataKey="date"
          height={30}
          stroke={indicatorColor}
          tickFormatter={formatDate}
          startIndex={brushStartIndex}
          endIndex={brushEndIndex}
          onChange={onBrushChange}
          travellerWidth={8}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
