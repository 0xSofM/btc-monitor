import { CardTitle } from '@/components/ui/card';
import type { TIME_RANGES } from './indicatorChartUtils';

type TimeRangeKey = (typeof TIME_RANGES)[number]['key'];

interface IndicatorChartsHeaderProps {
  historyMode: 'none' | 'light' | 'full';
  historyStartDate: string;
  historyEndDate: string;
  rowCount: number;
  isHistoryLoading: boolean;
  isDetailExpanded: boolean;
  selectedRange: TimeRangeKey;
  timeRanges: typeof TIME_RANGES;
  showThresholds: boolean;
  onSelectRange: (rangeKey: TimeRangeKey) => void;
  onResetView: () => void;
  onToggleThresholds: () => void;
  onCollapseDetail: () => void;
}

export function IndicatorChartsHeader({
  historyMode,
  historyStartDate,
  historyEndDate,
  rowCount,
  isHistoryLoading,
  isDetailExpanded,
  selectedRange,
  timeRanges,
  showThresholds,
  onSelectRange,
  onResetView,
  onToggleThresholds,
  onCollapseDetail,
}: IndicatorChartsHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg font-semibold">核心指标历史图表</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {historyMode === 'full' ? '完整历史' : '轻量历史'}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            {historyStartDate} 至 {historyEndDate} · {rowCount.toLocaleString('en-US')} 条
          </span>
          {isHistoryLoading && (
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              正在更新数据
            </span>
          )}
        </div>
      </div>

      {isDetailExpanded && (
        <div className="flex flex-wrap items-center gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => onSelectRange(range.key)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                selectedRange === range.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {range.label}
            </button>
          ))}

          <button
            type="button"
            onClick={onResetView}
            className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
          >
            重置视图
          </button>

          <button
            type="button"
            onClick={onToggleThresholds}
            className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
          >
            {showThresholds ? '隐藏阈值线' : '显示阈值线'}
          </button>

          <button
            type="button"
            onClick={onCollapseDetail}
            className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
          >
            收起大图表
          </button>
        </div>
      )}
    </div>
  );
}
