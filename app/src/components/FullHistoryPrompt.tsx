import { Maximize2, MousePointerClick, Sparkles } from 'lucide-react';

export function FullHistoryPrompt() {
  return (
    <div
      className="relative overflow-hidden rounded-lg border-2 border-orange-300 bg-gradient-to-r from-orange-50 via-amber-50 to-card p-4 text-sm shadow-xl shadow-orange-500/10 ring-1 ring-orange-200 dark:border-orange-800 dark:from-orange-950/55 dark:via-amber-950/35 dark:to-card dark:ring-orange-900/80"
      role="note"
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-orange-500" aria-hidden="true" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg shadow-orange-600/25 ring-4 ring-orange-200 dark:ring-orange-900">
            <MousePointerClick className="h-8 w-8 animate-pulse" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1 space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-orange-700 dark:text-orange-300">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2.5 py-1 text-white shadow-sm">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                操作提示
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                先看轻量历史
              </span>
            </p>

            <div className="rounded-lg bg-orange-600 px-4 py-4 text-white shadow-lg shadow-orange-600/25 ring-2 ring-orange-400 dark:bg-orange-500 dark:ring-orange-300">
              <p className="text-2xl font-black leading-tight sm:text-3xl">
                点击任一指标小图表后展开完整历史大图表。
              </p>
              <p className="mt-2 text-sm font-semibold text-orange-50/90">
                小图表用于快速预览，点击后再加载全量历史数据。
              </p>
            </div>
          </div>
        </div>

        <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-orange-200 bg-white/75 px-4 py-3 text-sm font-bold text-orange-800 shadow-sm dark:border-orange-900 dark:bg-black/15 dark:text-orange-200 lg:self-center">
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          点击后加载全量数据
        </span>
      </div>

      <div className="mt-4 border-t border-orange-200/80 pt-3 text-orange-800 dark:border-orange-900/80 dark:text-orange-200">
        点击小图表后再加载全量历史数据，页面初次打开更轻快。
      </div>
    </div>
  );
}
