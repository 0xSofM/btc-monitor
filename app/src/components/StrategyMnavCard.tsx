import { useMemo, useState } from 'react';
import { Building2, CircleDollarSign, Database, Landmark, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { StrategyMnavData, StrategyMnavHistoryPoint } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MNAV_RANGES = [
  { key: '1m', label: '1月', days: 30 },
  { key: '6m', label: '6月', days: 180 },
  { key: '1y', label: '1年', days: 365 },
  { key: 'all', label: '全部', days: 0 },
] as const;

type MnavRange = (typeof MNAV_RANGES)[number]['key'];

type MnavTooltipEntry = {
  payload?: StrategyMnavHistoryPoint;
};

function formatUsdM(value: number | undefined): string {
  if (value === undefined) return '-';
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value.toFixed(0)}M`;
}

function formatNumber(value: number | undefined, digits = 2): string {
  return value === undefined ? '-' : value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return '-';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return `${new Date(timestamp).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function formatChartDate(value: string): string {
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[0].slice(2)}/${parts[1]}/${parts[2]}`;
}

function formatRangeChange(first: number | undefined, last: number | undefined): string {
  if (first === undefined || last === undefined) return '-';
  const change = last - first;
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}x`;
}

function observationLabel(point: StrategyMnavHistoryPoint): string {
  if (point.observationType === 'official_daily_close' || point.source === 'strategy_official_timeseries') {
    return 'Strategy 官方日线';
  }
  if (point.observationType === 'intraday_snapshot' || point.source === 'strategy_official_api') {
    return '最新盘中快照';
  }
  return '历史快照';
}

function bandLabel(band: string | undefined): string {
  if (band === 'discount') return '折价';
  if (band === 'low_premium') return '低溢价';
  if (band === 'normal_premium') return '常规溢价';
  if (band === 'elevated_premium') return '较高溢价';
  if (band === 'overheated') return '高溢价';
  return '未知';
}

function bandClass(band: string | undefined): string {
  if (band === 'discount') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300';
  if (band === 'low_premium') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  if (band === 'normal_premium') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300';
  if (band === 'elevated_premium') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300';
  if (band === 'overheated') return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300';
  return '';
}

function MnavTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: MnavTooltipEntry[];
  label?: string | number;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-md border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
      <p className="mb-1.5 text-sm font-semibold">{String(label ?? point.date)}</p>
      <p className="font-medium text-orange-600 dark:text-orange-400">mNAV：{point.value.toFixed(3)}x</p>
      <p className="mt-1 text-muted-foreground">口径：{observationLabel(point)}</p>
      {point.enterpriseValueUsdM !== undefined && (
        <p className="text-muted-foreground">企业价值：{formatUsdM(point.enterpriseValueUsdM)}</p>
      )}
      {point.btcReserveUsdM !== undefined && (
        <p className="text-muted-foreground">BTC 储备价值：{formatUsdM(point.btcReserveUsdM)}</p>
      )}
      {point.band && <p className="mt-1 text-muted-foreground">区间：{bandLabel(point.band)}</p>}
    </div>
  );
}

export function StrategyMnavCard({
  data,
  history = [],
}: {
  data: StrategyMnavData;
  history?: StrategyMnavHistoryPoint[];
}) {
  const [selectedRange, setSelectedRange] = useState<MnavRange>('all');
  const change = data.mnav.change;
  const ChangeIcon = change !== undefined && change < 0 ? TrendingDown : TrendingUp;
  const changeLabel = change === undefined ? '-' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}x`;
  const chartData = useMemo(() => {
    const byDate = new Map(history.map((point) => [point.date, point]));
    if (data.mnav.value !== undefined) {
      byDate.set(data.date, {
        date: data.date,
        generatedAt: data.generatedAt,
        value: data.mnav.value,
        band: data.mnav.band,
        riskFlag: data.mnav.riskFlag,
        enterpriseValueUsdM: data.mstr.enterpriseValueUsdM,
        btcReserveUsdM: data.btcReserve.btcReserveUsdM,
        marketCapUsdM: data.mstr.marketCapUsdM,
        equityPremium: data.mnav.equityPremium,
        mstrPrice: data.mstr.price,
        btcPrice: data.btcReserve.btcPriceUsd,
        btcHoldings: data.btcReserve.btcHoldings,
        satsPerShare: data.btcReserve.satsPerShare,
        mstrTimestampUtc: data.mstr.timestampUtc,
        btcTimestamp: data.btcReserve.timestamp,
        source: data.source,
        observationType: 'intraday_snapshot',
      });
    }

    const sorted = Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
    const range = MNAV_RANGES.find((item) => item.key === selectedRange);
    if (!range?.days || sorted.length === 0) return sorted;

    const endTimestamp = Date.parse(`${sorted.at(-1)?.date}T00:00:00Z`);
    if (!Number.isFinite(endTimestamp)) return sorted;
    const cutoff = endTimestamp - range.days * 24 * 60 * 60 * 1000;
    return sorted.filter((point) => Date.parse(`${point.date}T00:00:00Z`) >= cutoff);
  }, [data, history, selectedRange]);
  const chartDomain = useMemo<[number, number]>(() => {
    const values = chartData.map((point) => point.value).concat(1);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const padding = Math.max((maximum - minimum) * 0.12, 0.03);
    return [Math.max(0, minimum - padding), maximum + padding];
  }, [chartData]);
  const firstPoint = chartData[0];
  const lastPoint = chartData.at(-1);

  return (
    <Card className="surface-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-orange-500" />
              MSTR mNAV
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Strategy 官方企业价值 / BTC 储备价值，用于观察 BTC 代理资产溢价。
            </p>
          </div>
          <Badge variant="outline" className={bandClass(data.mnav.band)}>
            {bandLabel(data.mnav.band)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">mNAV</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {data.mnav.value === undefined ? '-' : `${data.mnav.value.toFixed(2)}x`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ChangeIcon className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">日变化</p>
              <p className="mt-1 font-semibold">{changeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">企业价值</p>
              <p className="mt-1 font-semibold">{formatUsdM(data.mstr.enterpriseValueUsdM)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">BTC 储备价值</p>
              <p className="mt-1 font-semibold">{formatUsdM(data.btcReserve.btcReserveUsdM)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          mNAV 大于 1 表示 MSTR 相对其 BTC 储备存在溢价，小于 1 表示折价。该指标用于外部风险偏好观察，不参与 BTC 底部评分。
        </div>

        <section className="min-w-0 border-y py-4" aria-labelledby="mnav-history-title">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 id="mnav-history-title" className="text-sm font-semibold">mNAV 历史曲线</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {firstPoint?.date ?? '-'} 至 {lastPoint?.date ?? '-'} · {chartData.length} 条 · 区间变化 {formatRangeChange(firstPoint?.value, lastPoint?.value)}
              </p>
            </div>
            <div className="inline-flex w-fit rounded-md border bg-muted/40 p-0.5" aria-label="mNAV 历史时间范围">
              {MNAV_RANGES.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  aria-pressed={selectedRange === range.key}
                  onClick={() => setSelectedRange(range.key)}
                  className={`h-7 min-w-11 rounded px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selectedRange === range.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[230px] w-full sm:h-[270px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mnav-history-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    domain={chartDomain}
                    axisLine={false}
                    tickLine={false}
                    width={54}
                    tickFormatter={(value: number) => `${value.toFixed(2)}x`}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <Tooltip content={<MnavTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }} />
                  <ReferenceLine
                    y={1}
                    stroke="#64748b"
                    strokeDasharray="4 4"
                    label={{ value: '1x', position: 'insideTopRight', fill: '#64748b', fontSize: 11 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="mNAV"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    fill="url(#mnav-history-fill)"
                    dot={chartData.length <= 60 ? { r: 3, fill: '#f97316', strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: '#f97316', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无历史数据</div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">BTC 持仓</p>
            <p className="font-medium">{formatNumber(data.btcReserve.btcHoldings, 0)} BTC</p>
          </div>
          <div>
            <p className="text-muted-foreground">MSTR 价格</p>
            <p className="font-medium">${formatNumber(data.mstr.price)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">BTC 价格</p>
            <p className="font-medium">${formatNumber(data.btcReserve.btcPriceUsd, 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">股权溢价</p>
            <p className="font-medium">
              {data.mnav.equityPremium === undefined ? '-' : `${data.mnav.equityPremium.toFixed(2)}x`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          <span>MSTR 时间：{formatTimestamp(data.mstr.timestampUtc)}</span>
          <span>|</span>
          <span>BTC 时间：{formatTimestamp(data.btcReserve.timestamp)}</span>
          <span>|</span>
          <span>计算口径：企业价值 / BTC 储备价值</span>
        </div>
      </CardContent>
    </Card>
  );
}
