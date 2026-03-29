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
}

type IndicatorType = 'priceMa200w' | 'mvrvZ' | 'lthMvrv' | 'puell' | 'nupl';

type DetailSeriesPoint = {
  date: string;
  value: number;
  signal: boolean;
  btcPrice?: number;
};

type MaSeriesPoint = {
  date: string;
  price: number;
  ma200: number;
  signal: boolean;
};

const INDICATOR_ORDER: IndicatorType[] = ['priceMa200w', 'mvrvZ', 'lthMvrv', 'puell', 'nupl'];

const TIME_RANGES = [
  { key: 'all', label: 'All' },
  { key: '1y', label: '1Y' },
  { key: '6m', label: '6M' },
  { key: '1m', label: '1M' },
  { key: '1w', label: '1W' },
] as const;

const BUY_ZONE_CONFIG: Record<IndicatorType, { min: number; max: number; description: string }> = {
  priceMa200w: { min: 0, max: 1, description: '0 ~ 1' },
  mvrvZ: { min: -1, max: 0, description: '-1 ~ 0' },
  lthMvrv: { min: 0, max: 1, description: '0 ~ 1' },
  puell: { min: 0, max: 0.5, description: '0 ~ 0.5' },
  nupl: { min: -1, max: 0, description: '-1 ~ 0' },
};

type TooltipPayloadItem = {
  color?: string;
  name?: string;
  value?: number;
  payload?: {
    btcPrice?: number;
  };
};

type TooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
};

type LineDotProps = {
  cx?: number;
  cy?: number;
  payload?: {
    signal?: boolean;
  };
};

function formatDate(value: string): string {
  if (!value) return '';
  const parts = value.split('-');
  if (parts.length === 3) {
    return `${parts[0].slice(2)}/${parts[1]}/${parts[2]}`;
  }
  return value;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 10) return value.toFixed(2);
  if (Math.abs(value) >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

function formatCurrencyShort(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function IndicatorTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-white p-3 text-sm shadow-lg dark:bg-gray-900">
      <p className="mb-1 font-medium">{formatDate(label ?? '')}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value ?? 0)}
        </p>
      ))}
      {payload[0]?.payload?.btcPrice && (
        <p className="mt-1 text-muted-foreground">
          BTC: ${Number(payload[0].payload.btcPrice).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export function IndicatorCharts({ data }: IndicatorChartsProps) {
  const [activeIndicator, setActiveIndicator] = useState<IndicatorType>('priceMa200w');
  const [brushKey, setBrushKey] = useState(0);
  const [brushStartIndex, setBrushStartIndex] = useState(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  const detailSeries = useMemo(() => {
    if (activeIndicator === 'priceMa200w') {
      return getMA200ChartData(data, 'all') as MaSeriesPoint[];
    }
    return getIndicatorChartData(data, activeIndicator, 'all') as DetailSeriesPoint[];
  }, [activeIndicator, data]);

  const miniSeriesMap = useMemo(() => {
    const map: Record<IndicatorType, DetailSeriesPoint[]> = {
      priceMa200w: getIndicatorChartData(data, 'priceMa200w', '1y') as DetailSeriesPoint[],
      mvrvZ: getIndicatorChartData(data, 'mvrvZ', '1y') as DetailSeriesPoint[],
      lthMvrv: getIndicatorChartData(data, 'lthMvrv', '1y') as DetailSeriesPoint[],
      puell: getIndicatorChartData(data, 'puell', '1y') as DetailSeriesPoint[],
      nupl: getIndicatorChartData(data, 'nupl', '1y') as DetailSeriesPoint[],
    };
    return map;
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
    setBrushStartIndex(0);
    setBrushEndIndex(undefined);
    setBrushKey((prev) => prev + 1);
  };

  const handleTimeRangeSelect = (rangeKey: (typeof TIME_RANGES)[number]['key']) => {
    const total = totalPoints;
    if (!total) return;

    let start = 0;
    if (rangeKey === '1w') start = Math.max(0, total - 7);
    if (rangeKey === '1m') start = Math.max(0, total - 30);
    if (rangeKey === '6m') start = Math.max(0, total - 180);
    if (rangeKey === '1y') start = Math.max(0, total - 365);

    setBrushStartIndex(start);
    setBrushEndIndex(total - 1);
    setBrushKey((prev) => prev + 1);
  };

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number } | null | undefined) => {
    if (!range) return;
    if (typeof range.startIndex === 'number') {
      setBrushStartIndex(range.startIndex);
    }
    if (typeof range.endIndex === 'number') {
      setBrushEndIndex(range.endIndex);
    }
  };

  const renderMiniCards = () => {
    return (
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {INDICATOR_ORDER.map((indicatorKey) => {
          const indicatorConfig = INDICATOR_CONFIG[indicatorKey];
          const points = miniSeriesMap[indicatorKey];
          const latest = points.length > 0 ? points[points.length - 1] : null;
          const zone = BUY_ZONE_CONFIG[indicatorKey];
          const isActive = activeIndicator === indicatorKey;

          return (
            <button
              key={indicatorKey}
              type="button"
              onClick={() => activateIndicator(indicatorKey)}
              className={`rounded-xl border bg-card p-3 text-left transition-all ${
                isActive ? 'ring-2 ring-offset-1' : 'hover:border-muted-foreground/30'
              }`}
              style={isActive ? { boxShadow: `0 0 0 2px ${indicatorConfig.color}33` } : undefined}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{indicatorConfig.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    latest?.signal ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {latest?.signal ? 'Signal' : 'Neutral'}
                </span>
              </div>

              <div className="mb-2 text-lg font-semibold">
                {latest ? formatNumber(latest.value) : '-'}
              </div>

              <div className="h-20">
                {points.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={points}>
                      <defs>
                        <linearGradient id={`mini-${indicatorKey}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={indicatorConfig.color} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={indicatorConfig.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <ReferenceLine y={zone.max} stroke={indicatorConfig.color} strokeDasharray="2 2" strokeOpacity={0.5} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={indicatorConfig.color}
                        strokeWidth={2}
                        fill={`url(#mini-${indicatorKey})`}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No data</div>
                )}
              </div>

              <div className="mt-2 text-[11px] text-muted-foreground">Buy zone: {zone.description}</div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderPriceChart = () => {
    const series = detailSeries as MaSeriesPoint[];
    if (!series.length) {
      return <div className="flex h-[420px] items-center justify-center text-muted-foreground">No MA data</div>;
    }

    const visible = series.slice(resolvedStartIndex, resolvedEndIndex + 1);
    const allValues = visible.flatMap((row) => [row.price, row.ma200]).filter((v) => Number.isFinite(v) && v > 0);
    const min = allValues.length ? Math.min(...allValues) : 0;
    const max = allValues.length ? Math.max(...allValues) : 0;
    const padding = (max - min) * 0.05;
    const domainMin = Math.max(0, min - padding);
    const domainMax = max + padding;

    return (
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={series} margin={{ top: 10, right: 24, left: 8, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={formatCurrencyShort} domain={[domainMin, domainMax]} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            tickFormatter={formatCurrencyShort}
            domain={[domainMin, domainMax]}
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
            name="200W MA"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            strokeDasharray="6 4"
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
      return <div className="flex h-[420px] items-center justify-center text-muted-foreground">No indicator data</div>;
    }

    const visible = series.slice(resolvedStartIndex, resolvedEndIndex + 1);
    const values = visible.map((row) => row.value).filter((v) => Number.isFinite(v));
    const dataMin = values.length ? Math.min(...values) : 0;
    const dataMax = values.length ? Math.max(...values) : 0;
    const padding = (dataMax - dataMin) * 0.1 || 0.5;
    const yMin = Math.min(dataMin - padding, buyZone.min);
    const yMax = Math.max(dataMax + padding, buyZone.max);

    return (
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={series} margin={{ top: 10, right: 24, left: 8, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} domain={[yMin, yMax]} tickFormatter={formatNumber} />
          <Tooltip content={<IndicatorTooltip />} />

          <ReferenceLine
            y={buyZone.max}
            stroke="#10B981"
            strokeDasharray="4 4"
            label={{ value: `Buy zone ${buyZone.description}`, position: 'right', fontSize: 10, fill: '#10B981' }}
          />

          <Line
            type="monotone"
            dataKey="value"
            name={config.name}
            stroke={config.color}
            strokeWidth={2}
            dot={(props: LineDotProps) => {
              if (props?.payload?.signal) {
                return <circle cx={props.cx} cy={props.cy} r={3.5} fill="#10B981" stroke="#fff" strokeWidth={1.5} />;
              }
              return <></>;
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
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-semibold">5-Indicator History Charts</CardTitle>
          <div className="flex flex-wrap gap-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.key}
                type="button"
                onClick={() => handleTimeRangeSelect(range.key)}
                className="rounded-md bg-muted px-2 py-1 text-xs transition-colors hover:bg-muted/80"
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {renderMiniCards()}

        <div className="mb-4 flex flex-wrap gap-2">
          {INDICATOR_ORDER.map((indicatorKey) => {
            const item = INDICATOR_CONFIG[indicatorKey];
            const isActive = indicatorKey === activeIndicator;
            return (
              <button
                key={indicatorKey}
                type="button"
                onClick={() => activateIndicator(indicatorKey)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                style={{ backgroundColor: isActive ? item.color : undefined }}
              >
                {item.name}
              </button>
            );
          })}
        </div>

        <div className="mb-4 rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
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
              <span>200W MA</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <div className="h-0.5 w-4" style={{ borderTop: '2px dashed #10B981' }} />
                <span>Buy threshold ({buyZone.description})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>Signal points</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
