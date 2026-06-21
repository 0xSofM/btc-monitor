import { Maximize2, MousePointerClick } from 'lucide-react';

export function FullHistoryPrompt() {
  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-orange-400 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-100 px-4 py-4 text-sm shadow-lg ring-1 ring-orange-200/80 dark:border-orange-700 dark:from-orange-950/80 dark:via-amber-950/50 dark:to-orange-950/80 dark:ring-orange-900/70">
      <div className="absolute right-0 top-0 h-full w-24 bg-orange-200/30 blur-2xl dark:bg-orange-500/10" aria-hidden="true" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white shadow-md ring-4 ring-orange-200/80 dark:bg-orange-500 dark:ring-orange-900/70">
            <MousePointerClick className="h-6 w-6 animate-pulse" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-orange-600 px-2.5 py-1 text-[11px] font-bold uppercase text-white shadow-sm dark:bg-orange-500">
              操作提示
            </span>
            <p className="mt-2 text-lg font-extrabold leading-tight text-orange-950 dark:text-orange-50">
              点击任一指标小图表，展开完整历史大图表
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-orange-900 dark:text-orange-100">
              <span className="rounded-md bg-white/80 px-2 py-1 font-semibold text-orange-700 shadow-sm dark:bg-orange-950/70 dark:text-orange-200">
                先看轻量历史
              </span>
              <span className="text-orange-700 dark:text-orange-200">点击后再加载全量历史数据</span>
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-orange-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-md dark:bg-orange-500">
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          展开完整历史
        </span>
      </div>
    </div>
  );
}
