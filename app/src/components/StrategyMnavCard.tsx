import { Building2, CircleDollarSign, Database, Landmark, TrendingDown, TrendingUp } from 'lucide-react';

import type { StrategyMnavData } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

export function StrategyMnavCard({ data }: { data: StrategyMnavData }) {
  const change = data.mnav.change;
  const ChangeIcon = change !== undefined && change < 0 ? TrendingDown : TrendingUp;
  const changeLabel = change === undefined ? '-' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}x`;

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
