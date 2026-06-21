import { Building2 } from 'lucide-react';

import type { StrategyMnavData } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, getMnavBandClass, getMnavBandLabel } from './strategyMnavDisplay';
import { StrategyMnavMetadata } from './StrategyMnavMetadata';
import { StrategyMnavSummaryGrid } from './StrategyMnavSummaryGrid';

export function StrategyMnavCard({ data }: { data: StrategyMnavData }) {
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
          <Badge variant="outline" className={getMnavBandClass(data.mnav.band)}>
            {getMnavBandLabel(data.mnav.band)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <StrategyMnavSummaryGrid data={data} />

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

        <StrategyMnavMetadata data={data} />
      </CardContent>
    </Card>
  );
}
