import type { IndicatorData, LatestData } from '@/types';

import {
  DEFAULT_DEEP_THRESHOLDS,
  DEFAULT_THRESHOLDS,
  INDICATOR_CONFIG,
  TIME_RANGE_LABELS,
} from './indicatorConfig';
import { findIndicatorDates } from './indicatorDateSelectors';
import { hasUsableValue, toFiniteNumber } from './normalizers';

export { filterDataByTimeRange, getIndicatorChartData, getMA200ChartData } from './chartSelectors';
export { getDataFreshnessHours, getEffectiveDataDate, getOnchainFreshnessHours, getPriceFreshnessHours } from './freshnessSelectors';
export { latestDataToHistoryRow, mergeLatestIntoHistory } from './historyMergeSelectors';
export { findIndicatorDates } from './indicatorDateSelectors';
export { getSignalEvents } from './signalEventSelectors';
export { INDICATOR_CONFIG, TIME_RANGE_LABELS };

function toNumericPrice(value: number | string | undefined): number {
  return toFiniteNumber(value, 0);
}

function resolveCore8Score(latest: Pick<
  LatestData,
  | 'scorePriceMa200w'
  | 'scoreMvrvZscoreCore'
  | 'scoreNuplCore'
  | 'scorePuell'
  | 'scoreSthMvrv'
  | 'scoreSthSopr'
  | 'scoreLthMvrv'
  | 'scoreLthSopr'
>): {
  valuationScore: number;
  triggerScore: number;
  confirmationScore: number;
  totalScore: number;
} {
  const valuationScore = toFiniteNumber(latest.scorePriceMa200w, 0)
    + toFiniteNumber(latest.scoreMvrvZscoreCore, 0)
    + toFiniteNumber(latest.scoreNuplCore, 0)
    + toFiniteNumber(latest.scorePuell, 0);
  const triggerScore = Math.max(
    toFiniteNumber(latest.scoreSthMvrv, 0),
    toFiniteNumber(latest.scoreSthSopr, 0),
  );
  const confirmationScore = toFiniteNumber(latest.scoreLthMvrv, 0)
    + toFiniteNumber(latest.scoreLthSopr, 0);

  return {
    valuationScore,
    triggerScore,
    confirmationScore,
    totalScore: valuationScore + triggerScore + confirmationScore,
  };
}

function getThresholdRange(
  thresholds: LatestData['thresholds'] | IndicatorData['thresholds'],
  key: string,
  fallbackTrigger: number,
  fallbackDeep: number,
): { trigger: number; deep: number } {
  const threshold = thresholds?.[key];

  return {
    trigger:
      typeof threshold?.trigger === 'number' && Number.isFinite(threshold.trigger)
        ? threshold.trigger
        : fallbackTrigger,
    deep:
      typeof threshold?.deep === 'number' && Number.isFinite(threshold.deep)
        ? threshold.deep
        : fallbackDeep,
  };
}

export function getLatestFromHistory(data: IndicatorData[]): LatestData | null {
  if (!data.length) {
    return null;
  }

  const latest = data[data.length - 1];

  const btcPrice = toNumericPrice(latest.btcPrice);
  const priceMa200wRatio = toFiniteNumber(latest.priceMa200wRatio, 0);
  const priceRealizedRatio = toFiniteNumber(latest.priceRealizedRatio, 0);
  const reserveRisk = toFiniteNumber(latest.reserveRisk, 0);
  const mvrvZscore = toFiniteNumber(latest.mvrvZscore, 0);
  const nupl = toFiniteNumber(latest.nupl, 0);
  const sthSoprRaw = toFiniteNumber(latest.sthSopr, 0);
  const sthSoprMa3 = latest.sthSoprMa3;
  const sthSopr = sthSoprRaw;
  const sthSoprSignalValue = toFiniteNumber(sthSoprMa3 ?? latest.sthSopr, 0);
  const sthMvrv = toFiniteNumber(latest.sthMvrv, 0);
  const puellMultiple = toFiniteNumber(latest.puellMultiple, 0);
  const lthMvrv = toFiniteNumber(latest.lthMvrv, 0);
  const lthSoprRaw = toFiniteNumber(latest.lthSopr, 0);
  const lthSoprMa3 = latest.lthSoprMa3;
  const lthSoprValue = lthSoprRaw;
  const lthSoprSignalValue = toFiniteNumber(lthSoprMa3 ?? latest.lthSopr, 0);
  const priceMa200wThreshold = getThresholdRange(
    latest.thresholds,
    'priceMa200wRatio',
    DEFAULT_THRESHOLDS.priceMa200w,
    DEFAULT_DEEP_THRESHOLDS.priceMa200w,
  );
  const priceRealizedThreshold = getThresholdRange(
    latest.thresholds,
    'priceRealizedRatio',
    DEFAULT_THRESHOLDS.priceRealized,
    DEFAULT_DEEP_THRESHOLDS.priceRealized,
  );
  const reserveRiskThreshold = getThresholdRange(
    latest.thresholds,
    'reserveRisk',
    DEFAULT_THRESHOLDS.reserveRisk,
    DEFAULT_DEEP_THRESHOLDS.reserveRisk,
  );
  const mvrvZscoreThreshold = getThresholdRange(
    latest.thresholds,
    'mvrvZscoreCore',
    DEFAULT_THRESHOLDS.mvrvZscore,
    DEFAULT_DEEP_THRESHOLDS.mvrvZscore,
  );
  const nuplThreshold = getThresholdRange(
    latest.thresholds,
    'nuplCore',
    DEFAULT_THRESHOLDS.nupl,
    DEFAULT_DEEP_THRESHOLDS.nupl,
  );
  const sthSoprThreshold = getThresholdRange(
    latest.thresholds,
    'sthSopr',
    DEFAULT_THRESHOLDS.sthSopr,
    DEFAULT_DEEP_THRESHOLDS.sthSopr,
  );
  const sthMvrvThreshold = getThresholdRange(
    latest.thresholds,
    'sthMvrv',
    DEFAULT_THRESHOLDS.sthMvrv,
    DEFAULT_DEEP_THRESHOLDS.sthMvrv,
  );
  const lthMvrvThreshold = getThresholdRange(
    latest.thresholds,
    'lthMvrv',
    DEFAULT_THRESHOLDS.lthMvrv,
    DEFAULT_DEEP_THRESHOLDS.lthMvrv,
  );
  const lthSoprThreshold = getThresholdRange(
    latest.thresholds,
    'lthSopr',
    DEFAULT_THRESHOLDS.lthSopr,
    DEFAULT_DEEP_THRESHOLDS.lthSopr,
  );
  const puellThreshold = getThresholdRange(
    latest.thresholds,
    'puellMultiple',
    DEFAULT_THRESHOLDS.puell,
    DEFAULT_DEEP_THRESHOLDS.puell,
  );
  const signalMvrvZscoreCore = latest.signalMvrvZscoreCore
    ?? latest.signalReserveRiskV4
    ?? latest.signalMvrvZ
    ?? (mvrvZscore < mvrvZscoreThreshold.trigger);
  const signalNuplCore = latest.signalNuplCore
    ?? latest.signalNupl
    ?? (nupl < nuplThreshold.trigger);
  const signalValuationBlendV6 = latest.signalValuationBlendV6
    ?? latest.signalsV6?.valuationBlend
    ?? (signalMvrvZscoreCore || signalNuplCore);

  const signals = {
    priceMa200w: latest.signalPriceMa200w ?? latest.signalPriceMa ?? priceMa200wRatio < priceMa200wThreshold.trigger,
    priceRealized: latest.signalPriceRealized ?? priceRealizedRatio < priceRealizedThreshold.trigger,
    reserveRisk: latest.signalReserveRisk ?? reserveRisk < reserveRiskThreshold.trigger,
    sthSopr: latest.signalSthSopr ?? sthSoprSignalValue < sthSoprThreshold.trigger,
    sthMvrv: latest.signalSthMvrv ?? sthMvrv < sthMvrvThreshold.trigger,
    sthGroup: latest.signalSthGroup ?? ((latest.signalSthSopr ?? (sthSoprSignalValue < sthSoprThreshold.trigger)) || (latest.signalSthMvrv ?? (sthMvrv < sthMvrvThreshold.trigger))),
    puell: latest.signalPuell ?? puellMultiple < puellThreshold.trigger,
  };
  const signalsV4 = {
    priceMa200w: latest.signalPriceMa200w ?? latest.signalPriceMa ?? priceMa200wRatio < priceMa200wThreshold.trigger,
    priceRealized: latest.signalPriceRealized ?? priceRealizedRatio < priceRealizedThreshold.trigger,
    reserveRisk: signalMvrvZscoreCore,
    mvrvZscore: signalMvrvZscoreCore,
    sthMvrv: latest.signalSthMvrv ?? sthMvrv < sthMvrvThreshold.trigger,
    lthMvrv: latest.signalLthMvrv ?? lthMvrv < lthMvrvThreshold.trigger,
    lthSopr: latest.signalLthSopr ?? (lthSoprSignalValue < lthSoprThreshold.trigger),
    puell: latest.signalPuell ?? puellMultiple < puellThreshold.trigger,
    sthSoprTrigger: latest.signalSthSoprTrigger ?? latest.signalSthSoprAux ?? latest.signalSthSopr ?? (sthSoprSignalValue < sthSoprThreshold.trigger),
  };
  const signalsV6 = {
    priceMa200w: latest.signalsV6?.priceMa200w ?? signalsV4.priceMa200w,
    priceRealized: latest.signalsV6?.priceRealized ?? signalsV4.priceRealized,
    mvrvZscore: latest.signalsV6?.mvrvZscore ?? signalMvrvZscoreCore,
    nupl: latest.signalsV6?.nupl ?? signalNuplCore,
    valuationBlend: latest.signalsV6?.valuationBlend ?? signalValuationBlendV6,
    sthMvrv: latest.signalsV6?.sthMvrv ?? signalsV4.sthMvrv,
    sthSoprTrigger: latest.signalsV6?.sthSoprTrigger ?? signalsV4.sthSoprTrigger,
    lthMvrv: latest.signalsV6?.lthMvrv ?? signalsV4.lthMvrv,
    lthSopr: latest.signalsV6?.lthSopr ?? signalsV4.lthSopr,
    puell: latest.signalsV6?.puell ?? signalsV4.puell,
  };

  const groupedSignalCount = [
    signals.priceMa200w,
    signals.priceRealized,
    signals.reserveRisk,
    signals.sthGroup ?? (signals.sthSopr || signals.sthMvrv),
    signals.puell,
  ].filter(Boolean).length;
  const activeIndicatorCount = latest.activeIndicatorCount ?? 5;
  const maxSignalScoreV2 = latest.maxSignalScoreV2 ?? (activeIndicatorCount * 2);
  const groupedSignalCountV4 = [
    signalsV4.priceMa200w,
    signalsV4.priceRealized,
    signalsV4.mvrvZscore,
    signalsV4.sthMvrv,
    signalsV4.lthMvrv,
    signalsV4.lthSopr,
    signalsV4.puell,
  ].filter(Boolean).length;
  const activeIndicatorCountV4 = latest.activeIndicatorCountV4 ?? (hasUsableValue(latest.mvrvZscore) ? 7 : 6);
  const groupedSignalCountV6 = [
    signalsV6.priceMa200w,
    signalsV6.mvrvZscore,
    signalsV6.nupl,
    signalsV6.sthMvrv,
    signalsV6.sthSoprTrigger,
    signalsV6.lthMvrv,
    signalsV6.lthSopr,
    signalsV6.puell,
  ].filter(Boolean).length;
  const activeIndicatorCountV6 = latest.activeIndicatorCountV6 ?? 8;
  const derivedCore8Score = resolveCore8Score(latest);
  const maxValuationScoreV6 = 8;
  const maxTriggerScoreV6 = 2;
  const maxConfirmationScoreV6 = 4;
  const maxTotalScoreV6 = maxValuationScoreV6 + maxTriggerScoreV6 + maxConfirmationScoreV6;

  return {
    date: latest.d,
    btcPrice,
    priceMa200wRatio,
    priceRealizedRatio,
    ma200w: latest.ma200w,
    realizedPrice: latest.realizedPrice,
    reserveRisk,
    mvrvZscore,
    nupl,
    lthMvrv,
    lthSopr: lthSoprValue,
    lthSoprMa3,
    sthSopr,
    sthSoprMa3,
    sthMvrv,
    puellMultiple,
    signalCount: latest.signalCount ?? groupedSignalCount,
    activeIndicatorCount,
    signalCountV4: latest.signalCountV4 ?? groupedSignalCountV4,
    activeIndicatorCountV4,
    signalCountV6: groupedSignalCountV6,
    activeIndicatorCountV6,
    maxSignalScoreV2,
    signalScoreV2: latest.signalScoreV2,
    signalScoreV2Min3d: latest.signalScoreV2Min3d ?? null,
    signalConfirmed3d: latest.signalConfirmed3d,
    signalBandV2: latest.signalBandV2,
    valuationScore: latest.valuationScore,
    maxValuationScore: latest.maxValuationScore,
    triggerScore: latest.triggerScore,
    maxTriggerScore: latest.maxTriggerScore,
    confirmationScore: latest.confirmationScore,
    maxConfirmationScore: latest.maxConfirmationScore,
    auxiliaryScore: latest.auxiliaryScore,
    maxAuxiliaryScore: latest.maxAuxiliaryScore,
    totalScoreV4: latest.totalScoreV4,
    maxTotalScoreV4: latest.maxTotalScoreV4,
    totalScoreV4Min3d: latest.totalScoreV4Min3d ?? null,
    signalConfirmed3dV4: latest.signalConfirmed3dV4,
    signalBandV4: latest.signalBandV4,
    valuationScoreV6: derivedCore8Score.valuationScore,
    maxValuationScoreV6,
    triggerScoreV6: derivedCore8Score.triggerScore,
    maxTriggerScoreV6,
    confirmationScoreV6: derivedCore8Score.confirmationScore,
    maxConfirmationScoreV6,
    totalScoreV6: derivedCore8Score.totalScore,
    maxTotalScoreV6,
    totalScoreV6Min3d: latest.totalScoreV6Min3d ?? null,
    signalConfirmed3dV6: latest.signalConfirmed3dV6,
    signalBandV6: latest.signalBandV6,
    signalConfidence: latest.signalConfidence,
    signalConfidenceV6: latest.signalConfidenceV6,
    dataFreshnessScore: latest.dataFreshnessScore,
    dataFreshnessScoreV6: latest.dataFreshnessScoreV6,
    fallbackMode: latest.fallbackMode,
    fallbackModeV6: latest.fallbackModeV6 === 'valuation_blend_inactive'
      ? 'valuation_metrics_inactive'
      : latest.fallbackModeV6,
    scoreMvrvZscoreCore: latest.scoreMvrvZscoreCore,
    signalMvrvZscoreCore,
    scoreNupl: latest.scoreNupl,
    scoreNuplCore: latest.scoreNuplCore,
    valuationBlendScoreV6: latest.valuationBlendScoreV6,
    signalNupl: latest.signalNupl,
    signalNuplCore,
    signalValuationBlendV6,
    scoreSthGroup: latest.scoreSthGroup,
    signalSthGroup: latest.signalSthGroup,
    signals,
    signalsV4,
    signalsV6,
    thresholds: latest.thresholds,
    indicatorDates: findIndicatorDates(data),
  };
}

export function enrichLatestDataWithHistory(latest: LatestData, history: IndicatorData[]): LatestData {
  if (!history.length) {
    return latest;
  }

  return {
    ...latest,
    indicatorDates: latest.indicatorDates ?? findIndicatorDates(history),
  };
}


