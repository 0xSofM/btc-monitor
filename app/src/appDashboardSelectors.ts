import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

import type { MarketAssessment } from '@/components/MarketAssessmentCard';
import type { StatusTile } from '@/components/StatusStrip';
import type { LatestData } from '@/types';
import type { Core8Display, DataSource, IndicatorDateKey } from './appDisplay';
import {
  formatFallbackModeLabel,
  formatSignalBand,
  resolveScoreThresholds,
  sourceLabel,
} from './appDisplay';
import {
  getEffectiveDataDate,
  getOnchainFreshnessHours,
  getPriceFreshnessHours,
} from '@/services/dataService';

const TOTAL_CORE_INDICATORS = 8;

const indicatorDateLabels: Partial<Record<IndicatorDateKey, string>> = {
  priceMa200w: 'Price / 200W-MA',
  mvrvZscore: 'MVRV Z-Score',
  nupl: 'NUPL',
  lthMvrv: 'LTH-MVRV',
  lthSopr: 'LTH-SOPR',
  sthSopr: 'STH-SOPR',
  sthMvrv: 'STH-MVRV',
  puell: 'Puell Multiple',
};

function buildIndicatorDateEntries(latestData: LatestData) {
  return ([
    ['priceMa200w', latestData.indicatorDates?.priceMa200w],
    ['mvrvZscore', latestData.indicatorDates?.mvrvZscore],
    ['nupl', latestData.indicatorDates?.nupl],
    ['puell', latestData.indicatorDates?.puell],
    ['sthMvrv', latestData.indicatorDates?.sthMvrv],
    ['sthSopr', latestData.indicatorDates?.sthSopr],
    ['lthMvrv', latestData.indicatorDates?.lthMvrv],
    ['lthSopr', latestData.indicatorDates?.lthSopr],
  ] as Array<[IndicatorDateKey, string | undefined]>)
    .filter((entry): entry is [IndicatorDateKey, string] => Boolean(entry[1]));
}

function buildLaggingIndicatorLabels(latestData: LatestData): string[] {
  return buildIndicatorDateEntries(latestData)
    .filter(([, value]) => value < latestData.date)
    .map(([key]) => indicatorDateLabels[key] ?? key);
}

function buildMarketAssessment(
  effectiveScore: number,
  effectiveMaxScore: number,
  hasLayeredScore: boolean,
): MarketAssessment {
  const scoreThresholds = resolveScoreThresholds(effectiveMaxScore);

  if (effectiveScore >= scoreThresholds.extreme) {
    return {
      boxClass: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/50',
      iconClass: 'text-green-600 dark:text-green-300',
      titleClass: 'text-green-800 dark:text-green-200',
      textClass: 'text-green-700 dark:text-green-300',
      title: '极端底部区',
      description: hasLayeredScore
        ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，估值、触发、确认三层指标形成较强一致性。`
        : `当前评分 ${effectiveScore}/${effectiveMaxScore}，多个底部识别指标处于深度区域。`,
    };
  }

  if (effectiveScore >= scoreThresholds.accumulate) {
    return {
      boxClass: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50',
      iconClass: 'text-emerald-600 dark:text-emerald-300',
      titleClass: 'text-emerald-800 dark:text-emerald-200',
      textClass: 'text-emerald-700 dark:text-emerald-300',
      title: '信号增强区',
      description: hasLayeredScore
        ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，至少两层指标显示底部识别信号增强。`
        : `当前评分 ${effectiveScore}/${effectiveMaxScore}，底部识别信号较强。`,
    };
  }

  if (effectiveScore >= scoreThresholds.focus) {
    return {
      boxClass: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50',
      iconClass: 'text-amber-600 dark:text-amber-300',
      titleClass: 'text-amber-800 dark:text-amber-200',
      textClass: 'text-amber-700 dark:text-amber-300',
      title: '重点观察区',
      description: hasLayeredScore
        ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，部分指标进入底部识别区间，确认信号仍需观察。`
        : `当前评分 ${effectiveScore}/${effectiveMaxScore}，部分底部识别信号已出现。`,
    };
  }

  return {
    boxClass: 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60',
    iconClass: 'text-slate-600 dark:text-slate-300',
    titleClass: 'text-slate-800 dark:text-slate-200',
    textClass: 'text-slate-700 dark:text-slate-300',
    title: '观察区',
    description: hasLayeredScore
      ? `当前总分 ${effectiveScore}/${effectiveMaxScore}，底部识别信号尚未形成一致性。`
      : `当前评分 ${effectiveScore}/${effectiveMaxScore}，暂未出现明确的大周期底部信号。`,
  };
}

function buildStatusTiles(params: {
  latestData: LatestData;
  dataSource: DataSource;
  hasLayeredScore: boolean;
  effectiveScore: number;
  effectiveMaxScore: number;
  effectiveSignalBand: string;
  signalCountDisplay: number;
  isSignalConfirmed: boolean;
  confidencePercent: number | null;
  fallbackModeLabel: string | null;
  freshnessPercent: number | null;
}): StatusTile[] {
  const baseTiles = [
    {
      label: params.hasLayeredScore ? '综合评分' : '加权评分',
      value: `${params.effectiveScore}/${params.effectiveMaxScore}`,
      note: params.effectiveSignalBand,
      icon: TrendingUp,
    },
    {
      label: '指标触发',
      value: `${params.signalCountDisplay}/${TOTAL_CORE_INDICATORS}`,
      note: params.isSignalConfirmed ? '已确认3日' : '等待确认',
      icon: params.isSignalConfirmed ? CheckCircle2 : AlertTriangle,
    },
    {
      label: '数据来源',
      value: sourceLabel(params.dataSource),
      note: `截至 ${params.latestData.date}`,
      icon: Database,
    },
  ];

  if (!params.hasLayeredScore) {
    return baseTiles;
  }

  return [
    baseTiles[0],
    baseTiles[1],
    {
      label: '信号置信度',
      value: params.confidencePercent === null ? '-' : `${params.confidencePercent}%`,
      note: params.fallbackModeLabel ?? (params.freshnessPercent === null ? '' : `新鲜度 ${params.freshnessPercent}%`),
      icon: ShieldCheck,
    },
    baseTiles[2],
  ];
}

export function buildDashboardDisplay(
  latestData: LatestData | null,
  core8Display: Core8Display | null,
  dataSource: DataSource,
) {
  if (!latestData) {
    return {
      laggingIndicators: [],
      oldestIndicatorDate: undefined,
      priceFreshnessHours: 0,
      onchainFreshnessHours: 0,
      signalCountDisplay: 0,
      totalCoreIndicators: TOTAL_CORE_INDICATORS,
      marketAssessment: null,
      statusTiles: [],
      totalScoreV6: undefined,
      maxTotalScoreV6: 14,
      totalScoreV4: undefined,
      maxTotalScoreV4: 14,
    };
  }

  const laggingIndicators = buildLaggingIndicatorLabels(latestData);
  const effectiveDataDate = getEffectiveDataDate(latestData.date, latestData.indicatorDates);
  const oldestIndicatorDate = effectiveDataDate < latestData.date ? effectiveDataDate : undefined;
  const priceFreshnessHours = getPriceFreshnessHours(latestData.indicatorDates);
  const onchainFreshnessHours = getOnchainFreshnessHours(latestData.date, latestData.indicatorDates);
  const signalScoreV2 = latestData.signalScoreV2 ?? 0;
  const maxSignalScoreV2 = latestData.maxSignalScoreV2 ?? 10;
  const totalScoreV6 = core8Display?.totalScore ?? latestData.totalScoreV6;
  const maxTotalScoreV6 = core8Display?.maxTotalScore ?? latestData.maxTotalScoreV6 ?? 14;
  const totalScoreV4 = latestData.totalScoreV4;
  const maxTotalScoreV4 = latestData.maxTotalScoreV4 ?? 14;
  const hasLayeredScore = totalScoreV6 !== undefined || totalScoreV4 !== undefined;
  const signalCountDisplay = core8Display?.signalCount
    ?? latestData.signalCountV6
    ?? latestData.signalCountV4
    ?? latestData.signalCount
    ?? 0;
  const effectiveScore = totalScoreV6 ?? totalScoreV4 ?? signalScoreV2;
  const effectiveMaxScore = totalScoreV6 !== undefined
    ? maxTotalScoreV6
    : totalScoreV4 !== undefined
      ? maxTotalScoreV4
      : maxSignalScoreV2;
  const effectiveSignalBand = formatSignalBand(
    latestData.signalBandV6 ?? latestData.signalBandV4 ?? latestData.signalBandV2,
    effectiveScore,
    effectiveMaxScore,
  );
  const isSignalConfirmed = latestData.signalConfirmed3dV6
    ?? latestData.signalConfirmed3dV4
    ?? latestData.signalConfirmed3d
    ?? false;
  const fallbackModeLabel = formatFallbackModeLabel(
    core8Display?.fallbackMode ?? latestData.fallbackModeV6 ?? latestData.fallbackMode,
  );
  const confidenceValue = latestData.signalConfidenceV6 ?? latestData.signalConfidence;
  const freshnessValue = latestData.dataFreshnessScoreV6 ?? latestData.dataFreshnessScore;
  const confidencePercent = confidenceValue === undefined ? null : Math.round(confidenceValue * 100);
  const freshnessPercent = freshnessValue === undefined ? null : Math.round(freshnessValue * 100);

  return {
    laggingIndicators,
    oldestIndicatorDate,
    priceFreshnessHours,
    onchainFreshnessHours,
    signalCountDisplay,
    totalCoreIndicators: TOTAL_CORE_INDICATORS,
    marketAssessment: buildMarketAssessment(effectiveScore, effectiveMaxScore, hasLayeredScore),
    statusTiles: buildStatusTiles({
      latestData,
      dataSource,
      hasLayeredScore,
      effectiveScore,
      effectiveMaxScore,
      effectiveSignalBand,
      signalCountDisplay,
      isSignalConfirmed,
      confidencePercent,
      fallbackModeLabel,
      freshnessPercent,
    }),
    totalScoreV6,
    maxTotalScoreV6,
    totalScoreV4,
    maxTotalScoreV4,
  };
}
