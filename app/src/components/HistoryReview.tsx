import { useMemo, useState } from 'react';
import { Calendar, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { IndicatorData } from '@/types';
import {
  DEFAULT_MIN_SIGNALS,
  filterHistoryRows,
  formatPrice,
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

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="min-signals">最少触发数</Label>
            <select
              id="min-signals"
              value={minSignals}
              onChange={(event) => setMinSignals(Number(event.target.value))}
              className="mt-1 w-full rounded-md border bg-background p-2"
            >
              {thresholdOptions.map((value) => (
                <option key={value} value={value}>
                  {value}（{value >= maxSignalCount ? '极强' : value >= strongSignalThreshold ? '强' : '关注'}）
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="start-date">开始日期</Label>
            <Input
              id="start-date"
              type="date"
              min={dateRange.min}
              max={dateRange.max}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="end-date">结束日期</Label>
            <Input
              id="end-date"
              type="date"
              min={dateRange.min}
              max={dateRange.max}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={clearFilters} disabled={!hasActiveFilters} className="w-full">
              <X className="mr-2 h-4 w-4" />
              清空筛选
            </Button>
          </div>
        </section>

        {hasActiveFilters && (
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            当前筛选：
            <span className="ml-2">触发数 {'>='} {minSignals}</span>
            {startDate && <span className="ml-3">从 {startDate}</span>}
            {endDate && <span className="ml-3">到 {endDate}</span>}
          </section>
        )}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <article className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">命中天数</p>
            <p className="text-2xl font-bold">{filteredData.length}</p>
          </article>

          <article className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">最低价格</p>
            <p className="text-xl font-semibold">{filteredData.length ? formatPrice(filteredHistory.minPrice) : '-'}</p>
          </article>

          <article className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">最高价格</p>
            <p className="text-xl font-semibold">{filteredData.length ? formatPrice(filteredHistory.maxPrice) : '-'}</p>
          </article>

          <article className="rounded-xl border bg-background/70 p-4">
            <p className="text-sm text-muted-foreground">平均价格</p>
            <p className="text-xl font-semibold">{filteredData.length ? formatPrice(filteredHistory.avgPrice) : '-'}</p>
          </article>
        </section>

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
