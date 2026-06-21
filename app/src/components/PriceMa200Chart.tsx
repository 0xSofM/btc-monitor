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
import type { MaSeriesPoint, SignalMarkerPlan } from './indicatorChartUtils';
import {
  formatDate,
  formatDateFromMs,
  formatPriceAxis,
} from './indicatorChartUtils';

interface PriceMa200ChartProps {
  series: MaSeriesPoint[];
  valueDomain: [number, number];
  signalMarkerPlan: SignalMarkerPlan;
  brushKey: number;
  brushStartIndex: number;
  brushEndIndex: number;
  onBrushChange: (range: { startIndex?: number; endIndex?: number } | null | undefined) => void;
}

export function PriceMa200Chart({
  series,
  valueDomain,
  signalMarkerPlan,
  brushKey,
  brushStartIndex,
  brushEndIndex,
  onBrushChange,
}: PriceMa200ChartProps) {
  if (!series.length) {
    return <div className="flex h-[420px] items-center justify-center text-muted-foreground">暂无 MA200 数据</div>;
  }

  const [domainMin, domainMax] = valueDomain;

  return (
    <ResponsiveContainer width="100%" height={420}>
      <LineChart data={series} margin={{ top: 10, right: 24, left: 8, bottom: 30 }}>
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
        <YAxis yAxisId="left" domain={[domainMin, domainMax]} tick={{ fontSize: 11 }} tickFormatter={formatPriceAxis} />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[domainMin, domainMax]}
          tick={{ fontSize: 11 }}
          tickFormatter={formatPriceAxis}
        />
        <Tooltip content={<IndicatorTooltip />} />

        <Line
          yAxisId="left"
          type="monotone"
          dataKey="price"
          name="BTC Price"
          stroke="#F7931A"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="signalValue"
          name="跌破 200W-MA 信号点"
          stroke="transparent"
          strokeWidth={0}
          dot={(dotProps) => {
            const index = typeof dotProps.index === 'number' ? dotProps.index : -1;
            const payload = dotProps.payload as { date?: string } | undefined;
            const cx = typeof dotProps.cx === 'number' ? dotProps.cx : 0;
            const cy = typeof dotProps.cy === 'number' ? dotProps.cy : 0;
            const key = payload?.date ?? (index >= 0 ? String(index) : `${cx}-${cy}`);

            if (!signalMarkerPlan.keys.has(key)) {
              return renderSkippedSignalMarker(`price-ma200-signal-hidden-${key}`);
            }

            return renderSignalMarker(
              `price-ma200-signal-${key}`,
              cx,
              cy,
              signalMarkerPlan.compact,
            );
          }}
          activeDot={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="ma200"
          name="200W-MA"
          stroke="#3B82F6"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
        />

        <Brush
          key={brushKey}
          dataKey="date"
          height={30}
          stroke="#F7931A"
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
