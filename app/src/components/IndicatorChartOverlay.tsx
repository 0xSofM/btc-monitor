import type { TooltipEntry } from './indicatorChartUtils';
import { SIGNAL_MARKER_STROKE, formatDate, formatTooltipValue } from './indicatorChartUtils';

export function IndicatorTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const displayPayload = payload.filter((entry) => (
    entry.name !== '信号点' && entry.name !== '跌破 200W-MA 信号点'
  ));
  const hasBtcPriceLine = displayPayload.some((entry) => entry.name === 'BTC Price');
  const signalTriggered = payload.some((entry) => entry.payload?.signal);

  return (
    <div className="rounded-lg border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 text-sm font-semibold">{formatDate(label ?? '')}</p>
      {displayPayload.map((entry, index) => (
        <p key={`${entry.name ?? 'line'}-${index}`} style={{ color: entry.color }}>
          {entry.name}: {formatTooltipValue(entry)}
        </p>
      ))}
      {payload[0]?.payload?.btcPrice && !hasBtcPriceLine && (
        <p className="mt-1 text-muted-foreground">
          BTC Price: ${Number(payload[0].payload.btcPrice).toLocaleString('en-US')}
        </p>
      )}
      {signalTriggered && (
        <p className="mt-1 font-medium" style={{ color: SIGNAL_MARKER_STROKE }}>
          信号：触发
        </p>
      )}
    </div>
  );
}
