import { Clock3 } from 'lucide-react';

type SignalOverviewDataHealthProps = {
  latestDataDate: string;
  totalIndicators: number;
  laggingIndicators: string[];
  hasLaggingIndicators: boolean;
  oldestIndicatorDate?: string;
  confidencePercent: number | null;
  fallbackLabel: string | null;
};

export function SignalOverviewDataHealth({
  latestDataDate,
  totalIndicators,
  laggingIndicators,
  hasLaggingIndicators,
  oldestIndicatorDate,
  confidencePercent,
  fallbackLabel,
}: SignalOverviewDataHealthProps) {
  return (
    <section className="rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-4 w-4" />
          记录日期：{latestDataDate}
        </span>
        {hasLaggingIndicators && oldestIndicatorDate && (
          <span>指标日期：{oldestIndicatorDate}</span>
        )}
      </div>

      {hasLaggingIndicators ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          数据滞后指标：{laggingIndicators.join('、')}
        </p>
      ) : (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          {totalIndicators} 个核心指标均与记录日期一致。
        </p>
      )}

      {(confidencePercent !== null || fallbackLabel) && (
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {confidencePercent !== null && (
            <span className="text-muted-foreground">信号置信度：{confidencePercent}%</span>
          )}
          {fallbackLabel && (
            <span className="text-amber-700 dark:text-amber-300">{fallbackLabel}</span>
          )}
        </div>
      )}
    </section>
  );
}
