import type { IndicatorCardProps } from '@/components/IndicatorCard';
import type { LatestData } from '@/types';
import type { Core8Display } from './appDisplay';

export function buildIndicatorCards(
  latestData: LatestData | null,
  core8Display: Core8Display | null,
): IndicatorCardProps[] {
  return latestData
    ? [
        {
          name: 'Price / 200W-MA',
          description: '长周期趋势锚点',
          currentValue: latestData.priceMa200wRatio,
          targetValue: 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.priceMa200w ?? latestData.signals.priceMa200w,
          format: 'ratio' as const,
          color: '#F7931A',
          dataDate: latestData.indicatorDates?.priceMa200w || latestData.date,
          detailValue: latestData.ma200w
            ? `BTC $${latestData.btcPrice.toLocaleString()} / 200W-MA $${Math.round(latestData.ma200w).toLocaleString()}`
            : `BTC $${latestData.btcPrice.toLocaleString()}`,
        },
        {
          name: 'MVRV Z-Score',
          description: '市值相对链上成本的标准化偏离，估值层',
          currentValue: latestData.mvrvZscore ?? 0,
          targetValue: latestData.thresholds?.mvrvZscoreCore?.trigger ?? 0,
          targetOperator: 'lt' as const,
          format: 'number' as const,
          color: '#10B981',
          dataDate: latestData.indicatorDates?.mvrvZscore || latestData.date,
          detailValue: `计分 ${latestData.scoreMvrvZscoreCore ?? 0}/2，深度阈值 < ${(latestData.thresholds?.mvrvZscoreCore?.deep ?? -0.5).toFixed(2)}`,
          triggered: core8Display?.signals.mvrvZscore ?? false,
        },
        {
          name: 'NUPL',
          description: '全网净未实现盈亏，估值层',
          currentValue: latestData.nupl ?? 0,
          targetValue: latestData.thresholds?.nuplCore?.trigger ?? 0.15,
          targetOperator: 'lt' as const,
          format: 'number' as const,
          color: '#0EA5E9',
          dataDate: latestData.indicatorDates?.nupl || latestData.date,
          detailValue: `计分 ${latestData.scoreNuplCore ?? 0}/2，深度阈值 < ${(latestData.thresholds?.nuplCore?.deep ?? 0).toFixed(2)}`,
          triggered: core8Display?.signals.nupl ?? false,
        },
        {
          name: 'Puell Multiple',
          description: '矿工收入压力，估值层',
          currentValue: latestData.puellMultiple,
          targetValue: latestData.thresholds?.puellMultiple?.trigger ?? 0.6,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.puell ?? latestData.signalsV4?.puell ?? latestData.signals.puell,
          format: 'ratio' as const,
          color: '#F97316',
          dataDate: latestData.indicatorDates?.puell || latestData.date,
        },
        {
          name: 'STH-MVRV',
          description: '短期群体压力深度（滚动分位阈值）',
          currentValue: latestData.sthMvrv,
          targetValue: latestData.thresholds?.sthMvrv?.trigger ?? 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.sthMvrv ?? latestData.signalsV4?.sthMvrv ?? latestData.signals.sthMvrv,
          format: 'ratio' as const,
          color: '#22C55E',
          dataDate: latestData.indicatorDates?.sthMvrv || latestData.date,
          detailValue: latestData.thresholds?.sthMvrv
            ? `滚动阈值：1460天 p27=${(latestData.thresholds.sthMvrv.trigger ?? 1).toFixed(4)}，深度 p13.5=${(latestData.thresholds.sthMvrv.deep ?? 0.85).toFixed(4)}`
            : undefined,
        },
        {
          name: 'STH-SOPR',
          description: '短期持有者已实现盈亏，触发层',
          currentValue: latestData.sthSoprMa3 ?? latestData.sthSopr,
          targetValue: latestData.thresholds?.sthSopr?.trigger ?? 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.sthSoprTrigger
            ?? latestData.signalsV4?.sthSoprTrigger
            ?? latestData.signals.sthSopr,
          format: 'ratio' as const,
          color: '#EAB308',
          dataDate: latestData.indicatorDates?.sthSopr || latestData.date,
          detailValue: latestData.thresholds?.sthSopr
            ? `3日均值，原始值 ${(latestData.sthSopr ?? 0).toFixed(4)}；滚动阈值 p27=${(latestData.thresholds.sthSopr.trigger ?? 1).toFixed(4)}，深度 p13.5=${(latestData.thresholds.sthSopr.deep ?? 0.97).toFixed(4)}`
            : `3日均值，原始值 ${(latestData.sthSopr ?? 0).toFixed(4)}`,
        },
        {
          name: 'LTH-MVRV',
          description: '长期持有者未实现盈亏，确认层',
          currentValue: latestData.lthMvrv ?? 0,
          targetValue: latestData.thresholds?.lthMvrv?.trigger ?? 1,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.lthMvrv ?? latestData.signalsV4?.lthMvrv ?? false,
          format: 'ratio' as const,
          color: '#8B5CF6',
          dataDate: latestData.indicatorDates?.lthMvrv || latestData.date,
        },
        {
          name: 'LTH-SOPR',
          description: '长期持有者已实现盈亏，确认层',
          currentValue: latestData.lthSoprMa3 ?? latestData.lthSopr ?? 0,
          targetValue: latestData.thresholds?.lthSopr?.trigger ?? 0.9,
          targetOperator: 'lt' as const,
          triggered: latestData.signalsV6?.lthSopr ?? latestData.signalsV4?.lthSopr ?? false,
          format: 'ratio' as const,
          color: '#A855F7',
          dataDate: latestData.indicatorDates?.lthSopr || latestData.date,
          detailValue: latestData.thresholds?.lthSopr
            ? `3日均值，原始值 ${(latestData.lthSopr ?? 0).toFixed(4)}；滚动阈值 p20=${(latestData.thresholds.lthSopr.trigger ?? 0.9).toFixed(4)}，深度 p10=${(latestData.thresholds.lthSopr.deep ?? 0.75).toFixed(4)}`
            : `3日均值，原始值 ${(latestData.lthSopr ?? 0).toFixed(4)}`,
        },
      ]
    : [];
}
