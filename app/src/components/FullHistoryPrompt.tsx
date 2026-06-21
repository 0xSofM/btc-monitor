import { ArrowRight, Maximize2, MousePointerClick, Sparkles } from 'lucide-react';

export function FullHistoryPrompt() {
  return (
    <div
      className="relative overflow-hidden rounded-lg border-2 border-orange-300 bg-gradient-to-r from-orange-50 via-amber-50 to-card text-sm shadow-lg shadow-orange-500/10 ring-1 ring-orange-200 dark:border-orange-800 dark:from-orange-950/55 dark:via-amber-950/35 dark:to-card dark:ring-orange-900/80"
      role="note"
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-orange-500" aria-hidden="true" />
      <div className="flex flex-col gap-4 px-5 py-4 pl-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white shadow-md shadow-orange-600/25 ring-4 ring-orange-200 dark:ring-orange-900">
            <MousePointerClick className="h-7 w-7 animate-pulse" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-orange-700 dark:text-orange-300">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2.5 py-1 text-white shadow-sm">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                操作提示
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                先看轻量历史
              </span>
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-black leading-tight text-orange-950 dark:text-orange-50 sm:text-2xl">
              <span>点击任一指标小图表</span>
              <ArrowRight className="h-5 w-5 shrink-0 text-orange-500" aria-hidden="true" />
              <span className="rounded-md bg-orange-600 px-2 py-1 text-white shadow-sm">
                展开完整历史大图表
              </span>
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md bg-orange-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-600/20 sm:self-center">
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          展开完整历史
        </span>
      </div>
      <div className="border-t border-orange-200/80 bg-white/55 px-5 py-3 pl-6 text-orange-800 dark:border-orange-900/80 dark:bg-black/10 dark:text-orange-200">
        点击小图表后再加载全量历史数据，页面初次打开更轻快。
      </div>
    </div>
  );
}
