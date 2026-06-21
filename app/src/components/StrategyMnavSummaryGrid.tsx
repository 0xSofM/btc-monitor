import { CircleDollarSign, Landmark, TrendingDown, TrendingUp } from 'lucide-react';

import type { StrategyMnavData } from '@/types';
import { formatUsdM } from './strategyMnavDisplay';

export function StrategyMnavSummaryGrid({ data }: { data: StrategyMnavData }) {
  const change = data.mnav.change;
  const ChangeIcon = change !== undefined && change < 0 ? TrendingDown : TrendingUp;
  const changeLabel = change === undefined ? '-' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}x`;

  return (
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
  );
}
