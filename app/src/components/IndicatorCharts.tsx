import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
  isFullHistoryLoaded?: boolean;
  isFullHistoryLoading?: boolean;
  onRequestFullHistory?: () => void | Promise<void>;
}

type IndicatorType = 'priceMa200w' | 'priceRealized' | 'mvrvZscore' | 'lthMvrv' | 'sthMvrv' | 'puell';

type DetailSeriesPoint = {
  date: string;
  value: number | null;
  signal: boolean;
  btcPrice?: number;
};

type MaSeriesPoint = {
  date: string;
  price: number;
  ma200: number;
  signal: boolean;
};

const INDICATOR_ORDER: IndicatorType[] = ['priceMa200w', 'priceRealized', 'mvrvZscore', 'lthMvrv', 'sthMvrv', 'puell'];

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

const BUY_ZONE_CONFIG: Record<IndicatorType, { min: number; max: number; description: string }> = {
  priceMa200w: { min: 0, max: 1, description: '< 1（深度 < 0.85）' },
  priceRealized: { min: 0, max: 1, description: '< 1（深度 < 0.90）' },
  mvrvZscore: { min: -1.5, max: 0, description: '< 0（深度 < -0.5）' },
  lthMvrv: { min: 0, max: 1, description: '< 1（深度 < 0.90）' },
  sthMvrv: { min: 0, max: 1, description: '< 1（深度 < 0.85）' },
  puell: { min: 0, max: 0.6, description: '< 0.6（深度 < 0.5）' },
};

type TooltipEntry = {
  color?: string;
  name?: string;
  value?: number;
  payload?: {
    btcPrice?: number;
  };
};

function formatDate(value: string): string {
  if (!value) {
    return '';
  }

  const parts = value.split('-');
  if (parts.length === 3) {
    return `${parts[0].slice(2)}/${parts[1]}/${parts[2]}`;
  }

  return value;
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

function formatPriceAxis(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }

  return `$${value.toFixed(0)}`;
}

function IndicatorTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 text-sm font-semibold">{formatDate(label ?? '')}</p>
      {payload.map((entry, index) => (
        <p key={`${entry.name ?? 'line'}-${index}`} style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value ?? 0)}
        </p>
      ))}
      {payload[0]?.payload?.btcPrice && (
        <p className="mt-1 text-muted-foreground">
          BTC Price: ${Number(payload[0].payload.btcPrice).toLocaleString('en-US')}
        </p>
      )}
    </div>
  );
}

export function IndicatorCharts({
  data,
  isFullHistoryLoaded = false,
  isFullHistoryLoading = false,
  onRequestFullHistory,
}: IndicatorChartsProps) {
  const [activeIndicator, setActiveIndicator] = useState<IndicatorType>('priceMa200w');
  const [showThresholds, setShowThresholds] = useState(true);
  const [selectedRange, setSelectedRange] = useState<(typeof TIME_RANGES)[number]['key']>('all');
  const [brushStartIndex, setBrushStartIndex] = useState(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  const [brushKey, setBrushKey] = useState(0);

  const detailSeries = useMemo(() => {
    if (activeIndicator === 'priceMa200w') {
      return getMA200ChartData(data, 'all') as MaSeriesPoint[];
    }

    return getIndicatorChartData(data, activeIndicator, 'all') as DetailSeriesPoint[];
  }, [activeIndicator, data]);

  const miniSeriesMap = useMemo(() => {
    return {
      priceMa200w: getIndicatorChartData(data, 'priceMa200w', '1y') as DetailSeriesPoint[],
      priceRealized: getIndicatorChartData(data, 'priceRealized', '1y') as DetailSeriesPoint[],
      mvrvZscore: getIndicatorChartData(data, 'mvrvZscore', '1y') as DetailSeriesPoint[],
      lthMvrv: getIndicatorChartData(data, 'lthMvrv', '1y') as DetailSeriesPoint[],
      sthMvrv: getIndicatorChartData(data, 'sthMvrv', '1y') as DetailSeriesPoint[],
      puell: getIndicatorChartData(data, 'puell', '1y') as DetailSeriesPoint[],
    };
  }, [data]);

  const config = INDICATOR_CONFIG[activeIndicator];
  const buyZone = BUY_ZONE_CONFIG[activeIndicator];
  const totalPoints = detailSeries.length;

  const resolvedEndIndex = totalPoints > 0
    ? Math.min(brushEndIndex ?? (totalPoints - 1), totalPoints - 1)
    : 0;

  const resolvedStartIndex = totalPoints > 0
    ? Math.min(brushStartIndex, resolvedEndIndex)
    : 0;

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
    <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
      {INDICATOR_ORDER.map((indicatorKey) => {
        const indicatorConfig = INDICATOR_CONFIG[indicatorKey];
        const points = miniSeriesMap[indicatorKey];
        const latest = points.length > 0 ? findLatestObservedPoint(points) : null;
        const zone = BUY_ZONE_CONFIG[indicatorKey];
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
                      <ReferenceLine y={zone.max} stroke={indicatorConfig.color} strokeDasharray="2 2" strokeOpacity={0.45} />
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

            <p className="mt-2 text-[11px] text-muted-foreground">触发区间：{zone.description}</p>
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
      .filter((value) => Number.isFinite(value) && value > 0);

    const min = visibleValues.length ? Math.min(...visibleValues) : 0;
    const max = visibleValues.length ? Math.max(...visibleValues) : 0;
    const padding = (max - min) * 0.06;
    const domainMin = Math.max(0, min - padding);
    const domainMax = max + padding;

    return (
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={series} margin={{ top: 10, right: 24, left: 8, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
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
      .map((row) => row.value)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const dataMin = values.length ? Math.min(...values) : 0;
    const dataMax = values.length ? Math.max(...values) : 0;
    const padding = (dataMax - dataMin) * 0.12 || 0.5;
    const yMin = Math.min(dataMin - padding, buyZone.min);
    const yMax = Math.max(dataMax + padding, buyZone.max);

    return (
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={series} margin={{ top: 10, right: 24, left: 8, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} domain={[yMin, yMax]} tickFormatter={formatNumber} />
          <Tooltip content={<IndicatorTooltip />} />

          {showThresholds && <ReferenceLine y={buyZone.max} stroke="#10B981" strokeDasharray="4 4" />}

          <Line
            type="monotone"
            dataKey="value"
            name={config.name}
            stroke={config.color}
            strokeWidth={2}
            connectNulls={false}
            dot={(dotProps) => {
              const payload = dotProps.payload as { signal?: boolean } | undefined;
              if (!payload?.signal) {
                return <></>;
              }

              const cx = typeof dotProps.cx === 'number' ? dotProps.cx : 0;
              const cy = typeof dotProps.cy === 'number' ? dotProps.cy : 0;

              return <circle cx={cx} cy={cy} r={3.5} fill="#10B981" stroke="#ffffff" strokeWidth={1.5} />;
            }}
            activeDot={{ r: 6 }}
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
            <CardTitle className="text-lg font-semibold">Core-6 历史图表</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2.5 py-1 ${
                  isFullHistoryLoaded
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                }`}
              >
                {isFullHistoryLoaded ? '已加载全量历史' : '已加载轻量历史'}
              </span>

              {!isFullHistoryLoaded && (
                <button
                  type="button"
                  onClick={() => void onRequestFullHistory?.()}
                  disabled={isFullHistoryLoading}
                  className="rounded-md border px-2 py-1 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFullHistoryLoading ? '正在加载全量历史...' : '加载全量历史'}
                </button>
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
        </div>

        {activeIndicator === 'priceMa200w' ? renderPriceChart() : renderIndicatorChart()}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: config.color }} />
            <span>{config.name}</span>
          </div>

          {activeIndicator === 'priceMa200w' ? (
            <div className="flex items-center gap-1">
              <div className="h-0.5 w-4" style={{ borderTop: '2px dashed #3B82F6' }} />
              <span>200W-MA</span>
            </div>
          ) : (
            <>
              {showThresholds && (
                <div className="flex items-center gap-1">
                  <div className="h-0.5 w-4" style={{ borderTop: '2px dashed #10B981' }} />
                  <span>触发阈值线（{buyZone.description}）</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>信号点</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
