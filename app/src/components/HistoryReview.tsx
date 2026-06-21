import { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IndicatorData } from '@/types';
import { HistoryReviewFilters } from './HistoryReviewFilters';
import { HistoryReviewSummary } from './HistoryReviewSummary';
import { HistoryReviewTable } from './HistoryReviewTable';
import {
  DEFAULT_MIN_SIGNALS,
  filterHistoryRows,
  getDateRange,
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

        <HistoryReviewTable rows={filteredData} maxSignalCount={maxSignalCount} />
      </CardContent>
    </Card>
  );
}
