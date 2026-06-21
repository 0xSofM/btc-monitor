import { Database } from 'lucide-react';

import type { StrategyMnavData } from '@/types';
import { formatTimestamp } from './strategyMnavDisplay';

export function StrategyMnavMetadata({ data }: { data: StrategyMnavData }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
      <Database className="h-3.5 w-3.5" />
      <span>MSTR 时间：{formatTimestamp(data.mstr.timestampUtc)}</span>
      <span>|</span>
      <span>BTC 时间：{formatTimestamp(data.btcReserve.timestamp)}</span>
      <span>|</span>
      <span>计算口径：企业价值 / BTC 储备价值</span>
    </div>
  );
}
