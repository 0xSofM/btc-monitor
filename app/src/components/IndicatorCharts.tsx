import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IndicatorData } from '@/types';
import { INDICATOR_CONFIG, getIndicatorChartData, getMA200ChartData } from '@/services/dataService';

interface IndicatorChartsProps {
  data: IndicatorData[];
  isHistoryLoading?: boolean;
}

type IndicatorType = 'priceMa200w' | 'mvrvZscore' | 'nupl' | 'puell' | 'sthMvrv' | 'sthSopr' | 'lthMvrv' | 'lthSopr';

type DetailSeriesPoint = {
  date: string;
  time?: number;
  value: number | null;
  triggerValue?: number | null;
  deepValue?: number | null;
  signal: boolean;
  btcPrice?: number;
};

type MaSeriesPoint = {
  date: string;
  time?: number;
  price: number;
  ma200: number | null;
  signal: boolean;
};

const INDICATOR_ORDER: IndicatorType[] = ['priceMa200w', 'mvrvZscore', 'nupl', 'puell', 'sthMvrv', 'sthSopr', 'lthMvrv', 'lthSopr'];

const TIME_RANGES = [
  { key: 'all', label: '全部' },
  { key: '1y', label: '1年' },
  { key: '6m', label: '6月' },
  { key: '1m', label: '1月' },
  { key: '1w', label: '1周' },
] as const;

const RANGE_DAYS: Record<(typeof TIME_RANGES)[number]['key'], number> = {
  all: 0,
  '1y': 365,
  '6m': 180,
  '1m': 30,
  '1w': 7,
};

const CHART_FLOOR_CONFIG: Record<IndicatorType, number> = {
  priceMa200w: 0,
  mvrvZscore: -2,
  nupl: -0.2,
  puell: 0,
  sthMvrv: 0,
  sthSopr: 0.9,
  lthMvrv: 0,
  lthSopr: 0.75,
};

const SIGNAL_MARKER_FILL = '#ECFDF5';
const SIGNAL_MARKER_STROKE = '#047857';
const SIGNAL_MARKER_INNER_FILL = '#065F46';
const BTC_PRICE_COMPARE_COLOR = '#64748B';

type SignalMarkerPlan = {
  indexes: Set<number>;
  totalCount: number;
  compact: boolean;
};

type TooltipEntry = {
  color?: string;
  name?: string;
  value?: number;
  payload?: {
    btcPrice?: number;
    signal?: boolean;
  };
};

function formatDate(value: string | number | null | undefined): string {
  if (!value) {
    return '';
  }

  const dateText = typeof value === 'number'
    ? new Date(value).toISOString().slice(0, 10)
    : value;
  const parts = dateText.split('-');
  if (parts.length === 3) {
    return `${parts[0].slice(2)}/${parts[1]}/${parts[2]}`;
  }

  return dateText;
}

function parseDateMs(value: string): number {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateFromMs(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  return formatDate(new Date(value).toISOString().slice(0, 10));
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  if (Math.abs(value) >= 10) {
    return value.toFixed(2);
  }

  if (Math.abs(value) >= 1) {
    return value.toFixed(3);
  }

  return value.toFixed(4);
}

function findLatestObservedPoint(points: DetailSeriesPoint[]): DetailSeriesPoint | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (typeof point?.value === 'number' && Number.isFinite(point.value)) {
      return point;
    }
  }

  return null;
}

function findLatestThresholdPoint(points: DetailSeriesPoint[]): DetailSeriesPoint | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (typeof point?.triggerValue === 'number' && Number.isFinite(point.triggerValue)) {
      return point;
    }
  }

  return null;
}

function buildThresholdDescription(indicator: IndicatorType, point: DetailSeriesPoint | null): string {
  const triggerText = typeof point?.triggerValue === 'number' ? formatNumber(point.triggerValue) : '-';
  const deepText = typeof point?.deepValue === 'number' ? formatNumber(point.deepValue) : '-';

  switch (indicator) {
    case 'priceMa200w':
      return '固定阈值 < 1（深度 < 0.85）';
    case 'mvrvZscore':
      return '固定阈值 < 0（深度 < -0.5）';
    case 'nupl':
      return '固定阈值 < 0.15（深度 < 0）';
    case 'puell':
      return '固定阈值 < 0.6（深度 < 0.5）';
    case 'sthMvrv':
      return `滚动阈值 < ${triggerText}（深度 < ${deepText}，过去 1460 天 p27 / p13.5）`;
    case 'sthSopr':
      return `3 日均值滚动阈值 < ${triggerText}（深度 < ${deepText}，过去 1460 天 p27 / p13.5）`;
    case 'lthMvrv':
      return '固定阈值 < 1（深度 < 0.90）';
    case 'lthSopr':
      return `3 日均值滚动阈值 < ${triggerText}（深度 < ${deepText}，过去 1460 天 p20 / p10）`;
    default:
      return '阈值线';
  }
}

function formatPriceAxis(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }

  return `$${value.toFixed(0)}`;
}

function formatPriceTooltip(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatTooltipValue(entry: TooltipEntry): string {
  if (typeof entry.value !== 'number') {
    return '-';
  }

  if (entry.name === 'BTC Price' || entry.name === '200W-MA') {
    return formatPriceTooltip(entry.value);
  }

  return formatNumber(entry.value);
}

function getPaddedDomain(values: number[], paddingRatio: number, floor?: number): [number, number] {
  if (values.length === 0) {
    return [floor ?? 0, 1];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * paddingRatio || Math.max(Math.abs(max) * paddingRatio, 1);
  const domainMin = min - padding;

  return [
    typeof floor === 'number' ? Math.max(floor, domainMin) : domainMin,
    max + padding,
  ];
}

function getSignalMarkerLimit(visiblePointCount: number): number {
  if (visiblePointCount > 3000) {
    return 42;
  }

  if (visiblePointCount > 1200) {
    return 56;
  }

  if (visiblePointCount > 500) {
    return 80;
  }

  return 140;
}

function buildSignalMarkerPlan<T>(
  series: T[],
  startIndex: number,
  endIndex: number,
  isSignalPoint: (point: T) => boolean,
): SignalMarkerPlan {
  const signalIndexes: number[] = [];
  const safeStartIndex = Math.max(0, startIndex);
  const safeEndIndex = Math.min(series.length - 1, endIndex);

  for (let index = safeStartIndex; index <= safeEndIndex; index += 1) {
    const point = series[index];
    if (point && isSignalPoint(point)) {
      signalIndexes.push(index);
    }
  }

  const visiblePointCount = Math.max(0, safeEndIndex - safeStartIndex + 1);
  const markerLimit = getSignalMarkerLimit(visiblePointCount);
  const compact = signalIndexes.length > markerLimit;
  const step = compact ? Math.ceil(signalIndexes.length / markerLimit) : 1;
  const indexes = new Set<number>();

  signalIndexes.forEach((index, signalIndex) => {
    if (!compact || signalIndex % step === 0 || signalIndex === signalIndexes.length - 1) {
      indexes.add(index);
    }
  });

  return {
    indexes,
    totalCount: signalIndexes.length,
    compact,
  };
}

function renderHiddenSignalDot(key: string, cx: number, cy: number) {
  return <circle key={key} cx={cx} cy={cy} r={0} fill="transparent" />;
}

function renderSignalMarker(key: string, cx: number, cy: number, compact: boolean) {
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

function IndicatorTooltip({
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

export function IndicatorCharts({
  data,
  isHistoryLoading = false,
}: IndicatorChartsProps) {
  const [activeIndicator, setActiveIndicator] = useState<IndicatorType>('priceMa200w');
  const [showThresholds, setShowThresholds] = useState(true);
  const [selectedRange, setSelectedRange] = useState<(typeof TIME_RANGES)[number]['key']>('all');
  const [brushStartIndex, setBrushStartIndex] = useState(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  const [brushKey, setBrushKey] = useState(0);

  const detailSeries = useMemo(() => {
    const withTime = <T extends { date: string }>(points: T[]): Array<T & { time: number }> =>
      points.map((point) => ({ ...point, time: parseDateMs(point.date) }));

    if (activeIndicator === 'priceMa200w') {
      return withTime(getMA200ChartData(data, 'all')) as MaSeriesPoint[];
    }

    return withTime(getIndicatorChartData(data, activeIndicator, 'all')) as DetailSeriesPoint[];
  }, [activeIndicator, data]);

  const miniSeriesMap = useMemo(() => {
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
  }, [data]);

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
  const signalMarkerSummary = useMemo(() => {
    if (!totalPoints) {
      return { totalCount: 0, compact: false };
    }

    if (activeIndicator === 'priceMa200w') {
      return buildSignalMarkerPlan(
        detailSeries as MaSeriesPoint[],
        resolvedStartIndex,
        resolvedEndIndex,
        (point) => point.signal,
      );
    }

    return buildSignalMarkerPlan(
      detailSeries as DetailSeriesPoint[],
      resolvedStartIndex,
      resolvedEndIndex,
      (point) => point.signal && typeof point.value === 'number',
    );
  }, [activeIndicator, detailSeries, resolvedEndIndex, resolvedStartIndex, totalPoints]);

  const activateIndicator = (indicator: IndicatorType) => {
    setActiveIndicator(indicator);
    setSelectedRange('all');
    setBrushStartIndex(0);
    setBrushEndIndex(undefined);
    setBrushKey((prev) => prev + 1);
  };

  const handleTimeRangeSelect = (rangeKey: (typeof TIME_RANGES)[number]['key']) => {
    if (!totalPoints) {
      return;
    }

    const days = RANGE_DAYS[rangeKey];
    const startIndex = rangeKey === 'all' ? 0 : Math.max(0, totalPoints - days);

    setSelectedRange(rangeKey);
    setBrushStartIndex(startIndex);
    setBrushEndIndex(totalPoints - 1);
    setBrushKey((prev) => prev + 1);
  };

  const resetView = () => {
    setSelectedRange('all');
    setBrushStartIndex(0);
    setBrushEndIndex(undefined);
    setBrushKey((prev) => prev + 1);
  };

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number } | null | undefined) => {
    if (!range) {
      return;
    }

    if (typeof range.startIndex === 'number') {
      setBrushStartIndex(range.startIndex);
    }

    if (typeof range.endIndex === 'number') {
      setBrushEndIndex(range.endIndex);
    }
  };

  const renderMiniCards = () => (
    <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {INDICATOR_ORDER.map((indicatorKey) => {
        const indicatorConfig = INDICATOR_CONFIG[indicatorKey];
        const points = miniSeriesMap[indicatorKey];
        const latest = points.length > 0 ? findLatestObservedPoint(points) : null;
        const latestThreshold = points.length > 0 ? findLatestThresholdPoint(points) : null;
        const isActive = activeIndicator === indicatorKey;

        return (
          <button
            key={indicatorKey}
            type="button"
            onClick={() => activateIndicator(indicatorKey)}
            className={`rounded-xl border bg-card/80 p-3 text-left transition-all ${
              isActive
                ? 'ring-1 ring-primary/60 shadow-sm'
                : 'hover:-translate-y-0.5 hover:border-muted-foreground/30'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{indicatorConfig.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  latest?.signal
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {latest?.signal ? '触发' : '中性'}
              </span>
            </div>

            <div className="mb-2 text-lg font-semibold">
              {latest && typeof latest.value === 'number' ? formatNumber(latest.value) : '-'}
            </div>

            <div className="h-16">
              {points.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={points}>
                    <defs>
                      <linearGradient id={`mini-${indicatorKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={indicatorConfig.color} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={indicatorConfig.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {showThresholds && (
                      <Line
                        type="monotone"
                        dataKey="triggerValue"
                        name="触发阈值"
                        stroke={indicatorConfig.color}
                        strokeWidth={1.25}
                        strokeDasharray="2 2"
                        strokeOpacity={0.45}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={indicatorConfig.color}
                      strokeWidth={2}
                      fill={`url(#mini-${indicatorKey})`}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">暂无数据</div>
              )}
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              触发区间：{buildThresholdDescription(indicatorKey, latestThreshold)}
            </p>
          </button>
        );
      })}
    </div>
  );

  const renderPriceChart = () => {
    const series = detailSeries as MaSeriesPoint[];
    if (!series.length) {
      return <div className="flex h-[420px] items-center justify-center text-muted-foreground">暂无 MA200 数据</div>;
    }

    const visible = series.slice(resolvedStartIndex, resolvedEndIndex + 1);
    const visibleValues = visible
      .flatMap((row) => [row.price, row.ma200])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

    const [domainMin, domainMax] = getPaddedDomain(visibleValues, 0.06, 0);
    const signalMarkerPlan = buildSignalMarkerPlan(
      series,
      resolvedStartIndex,
      resolvedEndIndex,
      (point) => point.signal,
    );

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
            dataKey="price"
            name="跌破 200W-MA 信号点"
            stroke="transparent"
            strokeWidth={0}
            dot={(dotProps) => {
              const index = typeof dotProps.index === 'number' ? dotProps.index : -1;
              const cx = typeof dotProps.cx === 'number' ? dotProps.cx : 0;
              const cy = typeof dotProps.cy === 'number' ? dotProps.cy : 0;
              const key = index >= 0 ? index : `${cx}-${cy}`;

              if (!signalMarkerPlan.indexes.has(index)) {
                return renderHiddenSignalDot(`price-ma200-signal-hidden-${key}`, cx, cy);
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
            endIndex={resolvedEndIndex}
            onChange={handleBrushChange}
            travellerWidth={8}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderIndicatorChart = () => {
    const series = detailSeries as DetailSeriesPoint[];
    if (!series.length) {
      return <div className="flex h-[420px] items-center justify-center text-muted-foreground">暂无指标数据</div>;
    }

    const visible = series.slice(resolvedStartIndex, resolvedEndIndex + 1);
    const values = visible
      .flatMap((row) => [row.value, row.triggerValue])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const priceValues = visible
      .map((row) => row.btcPrice)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    const dataMin = values.length ? Math.min(...values) : 0;
    const dataMax = values.length ? Math.max(...values) : 0;
    const padding = (dataMax - dataMin) * 0.12 || 0.5;
    const yMin = Math.min(dataMin - padding, CHART_FLOOR_CONFIG[activeIndicator]);
    const yMax = dataMax + padding;
    const [priceYMin, priceYMax] = getPaddedDomain(priceValues, 0.06, 0);
    const signalMarkerPlan = buildSignalMarkerPlan(
      series,
      resolvedStartIndex,
      resolvedEndIndex,
      (point) => point.signal && typeof point.value === 'number',
    );

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
            name={config.name}
            stroke={config.color}
            strokeWidth={2}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="indicator"
            type="monotone"
            dataKey="value"
            name="信号点"
            stroke="transparent"
            strokeWidth={0}
            connectNulls={false}
            dot={(dotProps) => {
              const index = typeof dotProps.index === 'number' ? dotProps.index : -1;
              const cx = typeof dotProps.cx === 'number' ? dotProps.cx : 0;
              const cy = typeof dotProps.cy === 'number' ? dotProps.cy : 0;
              const key = index >= 0 ? index : `${cx}-${cy}`;

              if (!signalMarkerPlan.indexes.has(index)) {
                return renderHiddenSignalDot(`indicator-signal-hidden-${key}`, cx, cy);
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
            stroke={config.color}
            tickFormatter={formatDate}
            startIndex={brushStartIndex}
            endIndex={resolvedEndIndex}
            onChange={handleBrushChange}
            travellerWidth={8}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="surface-card mb-6">
      <CardHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-semibold">核心指标历史图表</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                历史数据
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                {historyStartDate} 至 {historyEndDate} · {data.length.toLocaleString('en-US')} 条
              </span>
              {isHistoryLoading && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  正在更新数据
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range.key}
                type="button"
                onClick={() => handleTimeRangeSelect(range.key)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  selectedRange === range.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {range.label}
              </button>
            ))}

            <button
              type="button"
              onClick={resetView}
              className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
            >
              重置视图
            </button>

            <button
              type="button"
              onClick={() => setShowThresholds((prev) => !prev)}
              className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
            >
              {showThresholds ? '隐藏阈值线' : '显示阈值线'}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {renderMiniCards()}

        <div className="mb-4 flex flex-wrap gap-2">
          {INDICATOR_ORDER.map((indicatorKey) => {
            const indicator = INDICATOR_CONFIG[indicatorKey];
            const isActive = indicatorKey === activeIndicator;

            return (
              <button
                key={indicatorKey}
                type="button"
                onClick={() => activateIndicator(indicatorKey)}
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

        {activeIndicator === 'priceMa200w' ? renderPriceChart() : renderIndicatorChart()}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: config.color }} />
            <span>{config.name}</span>
          </div>

          {activeIndicator === 'priceMa200w' ? (
            <>
              <div className="flex items-center gap-1">
                <div className="h-0.5 w-4" style={{ borderTop: '2px dashed #3B82F6' }} />
                <span>200W-MA</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className="h-3 w-3 rounded-full border"
                  style={{
                    backgroundColor: SIGNAL_MARKER_FILL,
                    borderColor: SIGNAL_MARKER_STROKE,
                    boxShadow: `inset 0 0 0 3px ${SIGNAL_MARKER_INNER_FILL}`,
                  }}
                />
                <span>跌破 200W-MA 信号点</span>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5">
                {signalMarkerSummary.totalCount} 个信号
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
                <span
                  className="h-3 w-3 rounded-full border"
                  style={{
                    backgroundColor: SIGNAL_MARKER_FILL,
                    borderColor: SIGNAL_MARKER_STROKE,
                    boxShadow: `inset 0 0 0 3px ${SIGNAL_MARKER_INNER_FILL}`,
                  }}
                />
                <span>信号点</span>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5">
                {signalMarkerSummary.totalCount} 个信号
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
