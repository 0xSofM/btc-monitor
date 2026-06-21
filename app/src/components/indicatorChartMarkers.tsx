import {
  SIGNAL_MARKER_FILL,
  SIGNAL_MARKER_INNER_FILL,
  SIGNAL_MARKER_STROKE,
} from './indicatorChartUtils';

export function renderSignalMarker(key: string, cx: number, cy: number, compact: boolean) {
  const outerRadius = compact ? 4 : 4.8;
  const innerRadius = compact ? 1.7 : 2.15;

  return (
    <g key={key}>
      <circle
        cx={cx}
        cy={cy}
        r={outerRadius}
        fill={SIGNAL_MARKER_FILL}
        stroke={SIGNAL_MARKER_STROKE}
        strokeWidth={1.4}
      />
      <circle cx={cx} cy={cy} r={innerRadius} fill={SIGNAL_MARKER_INNER_FILL} />
    </g>
  );
}

export function renderSkippedSignalMarker(key: string) {
  return <g key={key} />;
}
