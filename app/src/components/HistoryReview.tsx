import { useMemo, useState } from 'react';
import { Calendar, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { IndicatorData } from '@/types';
import { HistoryReviewFilters } from './HistoryReviewFilters';
import { HistoryReviewSummary } from './HistoryReviewSummary';
import {
  DEFAULT_MIN_SIGNALS,
  filterHistoryRows,
  getDateRange,
  getHistoryRowDisplay,
  getMaxSignalCount,
  getThresholdOptions,
  indexHistoryRows,
} from './historyReviewSelectors';

interface HistoryReviewProps {
  data: IndicatorData[];
}

export function HistoryReview({ data }: HistoryReviewProps) {
  const [minSignals, setMinSignals] = useState(DEFAULT_MIN_SIGNALS);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const indexedData = useMemo(() => indexHistoryRows(data), [data]);
  const maxSignalCount = useMemo(() => getMaxSignalCount(indexedData), [indexedData]);
  const strongSignalThreshold = Math.max(1, maxSignalCount - 1);
  const thresholdOptions = useMemo(() => getThresholdOptions(maxSignalCount), [maxSignalCount]);
  const dateRange = useMemo(() => getDateRange(indexedData), [indexedData]);
  const filteredHistory = useMemo(() => filterHistoryRows({
    indexedData,
    minSignals,
    startDate,
    endDate,
  }), [endDate, indexedData, minSignals, startDate]);
  const filteredData = filteredHistory.rows;

  const hasActiveFilters = Boolean(startDate || endDate || minSignals !== DEFAULT_MIN_SIGNALS);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setMinSignals(DEFAULT_MIN_SIGNALS);
  };

  return (
    <Card className="surface-card mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5" />
          历史信号记录
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <section className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
          数据范围：{dateRange.min || '-'} 至 {dateRange.max || '-'} | 共 {data.length} 条
        </section>

        <HistoryReviewFilters
          minSignals={minSignals}
          startDate={startDate}
          endDate={endDate}
          maxSignalCount={maxSignalCount}
          strongSignalThreshold={strongSignalThreshold}
          thresholdOptions={thresholdOptions}
          dateRange={dateRange}
          hasActiveFilters={hasActiveFilters}
          onMinSignalsChange={setMinSignals}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClearFilters={clearFilters}
        />

        {hasActiveFilters && (
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            当前筛选：
            <span className="ml-2">触发数 {'>='} {minSignals}</span>
            {startDate && <span className="ml-3">从 {startDate}</span>}
            {endDate && <span className="ml-3">到 {endDate}</span>}
          </section>
        )}

        <HistoryReviewSummary filteredHistory={filteredHistory} />

        {filteredData.length > 0 ? (
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
                {filteredData.slice(0, 120).map((item) => {
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

            {filteredData.length > 120 && (
              <p className="px-4 py-3 text-center text-sm text-muted-foreground">
                为保证可读性，另有 {filteredData.length - 120} 条记录未展示。
              </p>
            )}
          </section>
        ) : (
          <section className="rounded-xl border py-10 text-center text-muted-foreground">
            <Search className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>暂无符合当前筛选条件的数据。</p>
            <p className="text-sm">可尝试降低触发阈值或扩大日期范围。</p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
