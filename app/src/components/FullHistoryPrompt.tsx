import { ArrowRight, Maximize2, MousePointerClick } from 'lucide-react';

export function FullHistoryPrompt() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-orange-300 bg-card text-sm shadow-md ring-1 ring-orange-100 dark:border-orange-800 dark:ring-orange-900/70"
      role="note"
    >
      <div className="flex flex-col gap-3 bg-orange-600 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white shadow-sm ring-1 ring-white/30">
            <MousePointerClick className="h-6 w-6 animate-pulse" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-orange-100">
              操作提示
            </p>
            <p className="text-lg font-extrabold leading-snug text-white sm:text-xl">
              点击任一指标小图表后展开完整历史大图表
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-white px-3.5 py-2.5 text-sm font-bold text-orange-700 shadow-sm">
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          展开完整历史
        </span>
      </div>
      <div className="grid gap-2 px-4 py-3 text-orange-950 dark:text-orange-100 sm:grid-cols-[auto_1fr] sm:items-center">
        <span className="inline-flex w-fit items-center rounded-md bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          先看轻量历史
        </span>
        <span className="flex flex-wrap items-center gap-2 text-orange-800 dark:text-orange-200">
          <ArrowRight className="h-4 w-4 text-orange-500" aria-hidden="true" />
          点击小图表后再加载全量历史数据，页面初次打开更轻快。
        </span>
      </div>
    </div>
  );
}
