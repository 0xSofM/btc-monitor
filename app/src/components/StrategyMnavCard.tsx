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
  if (band === 'discount') return 'Discount';
  if (band === 'low_premium') return 'Low premium';
  if (band === 'normal_premium') return 'Normal premium';
  if (band === 'elevated_premium') return 'Elevated';
  if (band === 'overheated') return 'Overheated';
  return 'Unknown';
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
            <p className="mt-1 text-sm text-muted-foreground">Strategy official EV / BTC Reserve</p>
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
              <p className="text-xs font-medium text-muted-foreground">Daily change</p>
              <p className="mt-1 font-semibold">{changeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Enterprise value</p>
              <p className="mt-1 font-semibold">{formatUsdM(data.mstr.enterpriseValueUsdM)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">BTC reserve</p>
              <p className="mt-1 font-semibold">{formatUsdM(data.btcReserve.btcReserveUsdM)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">BTC holdings</p>
            <p className="font-medium">{formatNumber(data.btcReserve.btcHoldings, 0)} BTC</p>
          </div>
          <div>
            <p className="text-muted-foreground">MSTR price</p>
            <p className="font-medium">${formatNumber(data.mstr.price)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">BTC price</p>
            <p className="font-medium">${formatNumber(data.btcReserve.btcPriceUsd, 0)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Equity premium</p>
            <p className="font-medium">
              {data.mnav.equityPremium === undefined ? '-' : `${data.mnav.equityPremium.toFixed(2)}x`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          <span>MSTR close: {formatTimestamp(data.mstr.timestampUtc)}</span>
          <span>|</span>
          <span>BTC: {formatTimestamp(data.btcReserve.timestamp)}</span>
          <span>|</span>
          <span>Formula: {data.formula ?? 'enterpriseValueUsd / btcReserveUsd'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
