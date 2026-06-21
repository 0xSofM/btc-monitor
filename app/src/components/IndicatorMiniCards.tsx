import {
  Area,
  AreaChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

import { INDICATOR_CONFIG } from '@/services/dataService';
import type { DetailSeriesPoint, IndicatorType } from './indicatorChartUtils';
import {
  INDICATOR_ORDER,
  buildThresholdDescription,
  findLatestObservedPoint,
  findLatestThresholdPoint,
  formatNumber,
} from './indicatorChartUtils';

interface IndicatorMiniCardsProps {
  activeIndicator: IndicatorType;
  miniSeriesMap: Record<IndicatorType, DetailSeriesPoint[]>;
  showThresholds: boolean;
  onActivateIndicator: (indicator: IndicatorType) => void;
}

export function IndicatorMiniCards({
  activeIndicator,
  miniSeriesMap,
  showThresholds,
  onActivateIndicator,
}: IndicatorMiniCardsProps) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {INDICATOR_ORDER.map((indicatorKey) => {
        const indicatorConfig = INDICATOR_CONFIG[indicatorKey];
        const points = miniSeriesMap[indicatorKey];
        const latest = points.length > 0 ? findLatestObservedPoint(points) : null;
        const latestThreshold = points.length > 0 ? findLatestThresholdPoint(points) : null;
        const isActive = activeIndicator === indicatorKey;

        return (
          <button
            key={indicatorKey}
            type="button"
            onClick={() => onActivateIndicator(indicatorKey)}
            className={`rounded-xl border bg-card/80 p-3 text-left transition-all ${
              isActive
                ? 'ring-1 ring-primary/60 shadow-sm'
                : 'hover:-translate-y-0.5 hover:border-muted-foreground/30'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{indicatorConfig.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  latest?.signal
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {latest?.signal ? '触发' : '中性'}
              </span>
            </div>

            <div className="mb-2 text-lg font-semibold">
              {latest && typeof latest.value === 'number' ? formatNumber(latest.value) : '-'}
            </div>

            <div className="h-16">
              {points.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={points}>
                    <defs>
                      <linearGradient id={`mini-${indicatorKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={indicatorConfig.color} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={indicatorConfig.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {showThresholds && (
                      <Line
                        type="monotone"
                        dataKey="triggerValue"
                        name="触发阈值"
                        stroke={indicatorConfig.color}
                        strokeWidth={1.25}
                        strokeDasharray="2 2"
                        strokeOpacity={0.45}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={indicatorConfig.color}
                      strokeWidth={2}
                      fill={`url(#mini-${indicatorKey})`}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">暂无数据</div>
              )}
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              触发区间：{buildThresholdDescription(indicatorKey, latestThreshold)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
