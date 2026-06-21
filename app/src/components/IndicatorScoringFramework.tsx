import { Info } from 'lucide-react';

export function IndicatorScoringFramework() {
  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-300" />
        <div>
          <h3 className="font-semibold text-blue-800 dark:text-blue-200">分层评分框架</h3>
          <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
            系统跟踪 8 个核心指标，并按估值、短期触发、长期确认三层汇总。
            估值层包含 Price / 200W-MA、MVRV Z-Score、NUPL 和 Puell Multiple，满分 8 分。
            触发层取 STH-MVRV 与 STH-SOPR 的较高分，满分 2 分。
            确认层由 LTH-MVRV 与 LTH-SOPR 独立计分，满分 4 分。
            总分上限为 14 分，并使用 3 日确认规则降低单日波动对信号判断的影响。
          </p>
        </div>
      </div>
    </section>
  );
}
