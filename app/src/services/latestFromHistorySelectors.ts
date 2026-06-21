import type { IndicatorData, LatestData } from '@/types';

import { findIndicatorDates } from './indicatorDateSelectors';
import { deriveLatestHistoryCounts, resolveCore8Score } from './latestFromHistoryScores';
import { deriveLatestHistorySignals } from './latestFromHistorySignals';
import { resolveLatestHistoryValues } from './latestFromHistoryValues';

export function getLatestFromHistory(data: IndicatorData[]): LatestData | null {
  if (!data.length) {
    return null;
  }

  const latest = data[data.length - 1];

  const {
    btcPrice,
    priceMa200wRatio,
    priceRealizedRatio,
    reserveRisk,
    mvrvZscore,
    nupl,
    sthSopr,
    sthSoprMa3,
    sthSoprSignalValue,
    sthMvrv,
    puellMultiple,
    lthMvrv,
    lthSopr,
    lthSoprMa3,
    lthSoprSignalValue,
    thresholds,
  } = resolveLatestHistoryValues(latest);
  const {
    signals,
    signalsV4,
    signalsV6,
    signalMvrvZscoreCore,
    signalNuplCore,
    signalValuationBlendV6,
  } = deriveLatestHistorySignals({
    latest,
    priceMa200wRatio,
    priceRealizedRatio,
    reserveRisk,
    mvrvZscore,
    nupl,
    sthSoprSignalValue,
    sthMvrv,
    puellMultiple,
    lthMvrv,
    lthSoprSignalValue,
    thresholds,
  });

  const {
    groupedSignalCount,
    activeIndicatorCount,
    maxSignalScoreV2,
    groupedSignalCountV4,
    activeIndicatorCountV4,
    groupedSignalCountV6,
    activeIndicatorCountV6,
  } = deriveLatestHistoryCounts(latest, { signals, signalsV4, signalsV6 });
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
    lthSopr,
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
