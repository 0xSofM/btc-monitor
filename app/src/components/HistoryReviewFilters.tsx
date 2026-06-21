import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DateRange } from './historyReviewSelectors';

interface HistoryReviewFiltersProps {
  minSignals: number;
  startDate: string;
  endDate: string;
  maxSignalCount: number;
  strongSignalThreshold: number;
  thresholdOptions: number[];
  dateRange: DateRange;
  hasActiveFilters: boolean;
  onMinSignalsChange: (value: number) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClearFilters: () => void;
}

export function HistoryReviewFilters({
  minSignals,
  startDate,
  endDate,
  maxSignalCount,
  strongSignalThreshold,
  thresholdOptions,
  dateRange,
  hasActiveFilters,
  onMinSignalsChange,
  onStartDateChange,
  onEndDateChange,
  onClearFilters,
}: HistoryReviewFiltersProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <div>
        <Label htmlFor="min-signals">最少触发数</Label>
        <select
          id="min-signals"
          value={minSignals}
          onChange={(event) => onMinSignalsChange(Number(event.target.value))}
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
          onChange={(event) => onStartDateChange(event.target.value)}
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
          onChange={(event) => onEndDateChange(event.target.value)}
          className="mt-1"
        />
      </div>

      <div className="flex items-end">
        <Button variant="outline" onClick={onClearFilters} disabled={!hasActiveFilters} className="w-full">
          <X className="mr-2 h-4 w-4" />
          清空筛选
        </Button>
      </div>
    </section>
  );
}
