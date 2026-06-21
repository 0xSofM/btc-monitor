import { Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { IndicatorData } from '@/types';
import { getHistoryRowDisplay } from './historyReviewSelectors';

interface HistoryReviewTableProps {
  rows: IndicatorData[];
  maxSignalCount: number;
}

export function HistoryReviewTable({ rows, maxSignalCount }: HistoryReviewTableProps) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border py-10 text-center text-muted-foreground">
        <Search className="mx-auto mb-3 h-10 w-10 opacity-50" />
        <p>暂无符合当前筛选条件的数据。</p>
        <p className="text-sm">可尝试降低触发阈值或扩大日期范围。</p>
      </section>
    );
  }

  return (
    <section className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>日期</TableHead>
            <TableHead>BTC价格</TableHead>
            <TableHead>触发数</TableHead>
            <TableHead>综合评分</TableHead>
            <TableHead>触发指标</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.slice(0, 120).map((item) => {
            const rowDisplay = getHistoryRowDisplay(item, maxSignalCount);

            return (
              <TableRow key={`${item.d}-${rowDisplay.signalCount}`}>
                <TableCell>{item.d}</TableCell>
                <TableCell className="font-medium">{rowDisplay.priceLabel}</TableCell>
                <TableCell>
                  <Badge
                    variant={rowDisplay.isStrongSignal ? 'default' : 'secondary'}
                    className={rowDisplay.isStrongSignal ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''}
                  >
                    {rowDisplay.signalCount} / {rowDisplay.totalSignals}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{rowDisplay.scoreLabel}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {rowDisplay.signalBadges.map((signal) => (
                      <Badge key={`${item.d}-${signal}`} variant="outline" className="text-xs">
                        {signal}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {rows.length > 120 && (
        <p className="px-4 py-3 text-center text-sm text-muted-foreground">
          为保证可读性，另有 {rows.length - 120} 条记录未展示。
        </p>
      )}
    </section>
  );
}
