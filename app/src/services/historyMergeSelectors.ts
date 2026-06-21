import type { IndicatorData, LatestData } from '@/types';

function getLatestHistoryMetricFields(
  latest: LatestData,
  existingRow: IndicatorData | undefined,
): Pick<
  IndicatorData,
  | 'btcPrice'
  | 'priceMa200wRatio'
  | 'priceRealizedRatio'
  | 'ma200w'
  | 'realizedPrice'
  | 'reserveRisk'
  | 'mvrvZscore'
  | 'nupl'
  | 'lthMvrv'
  | 'lthSopr'
  | 'lthSoprMa3'
  | 'sthSopr'
  | 'sthSoprMa3'
  | 'sthMvrv'
  | 'puellMultiple'
> {
  return {
    btcPrice: latest.btcPrice,
    priceMa200wRatio: latest.priceMa200wRatio,
    priceRealizedRatio: latest.priceRealizedRatio,
    ma200w: latest.ma200w ?? existingRow?.ma200w,
    realizedPrice: latest.realizedPrice ?? existingRow?.realizedPrice,
    reserveRisk: latest.reserveRisk,
    mvrvZscore: latest.mvrvZscore ?? existingRow?.mvrvZscore,
    nupl: latest.nupl ?? existingRow?.nupl,
    lthMvrv: latest.lthMvrv ?? existingRow?.lthMvrv,
    lthSopr: latest.lthSopr ?? existingRow?.lthSopr,
    lthSoprMa3: latest.lthSoprMa3 ?? existingRow?.lthSoprMa3,
    sthSopr: latest.sthSopr,
    sthSoprMa3: latest.sthSoprMa3 ?? existingRow?.sthSoprMa3,
    sthMvrv: latest.sthMvrv,
    puellMultiple: latest.puellMultiple,
  };
}

export function latestDataToHistoryRow(
  latest: LatestData,
  existingRow?: IndicatorData,
): IndicatorData {
  const signalsV4 = latest.signalsV4;
  const signalsV6 = latest.signalsV6;

  return {
    ...existingRow,
    d: latest.date,
    ...getLatestHistoryMetricFields(latest, existingRow),
    signalPriceMa200w: signalsV4?.priceMa200w ?? latest.signals.priceMa200w,
    signalPriceRealized: signalsV4?.priceRealized ?? latest.signals.priceRealized,
    signalReserveRisk: latest.signals.reserveRisk,
    signalReserveRiskV4: signalsV4?.reserveRisk ?? signalsV4?.mvrvZscore ?? existingRow?.signalReserveRiskV4,
    signalMvrvZscoreCore: latest.signalMvrvZscoreCore
      ?? signalsV6?.mvrvZscore
      ?? signalsV4?.mvrvZscore
      ?? signalsV4?.reserveRisk
      ?? existingRow?.signalMvrvZscoreCore,
    signalNupl: latest.signalNupl ?? signalsV6?.nupl ?? existingRow?.signalNupl,
    signalNuplCore: latest.signalNuplCore ?? signalsV6?.nupl ?? existingRow?.signalNuplCore,
    signalValuationBlendV6: latest.signalValuationBlendV6 ?? signalsV6?.valuationBlend ?? existingRow?.signalValuationBlendV6,
    signalSthSopr: latest.signals.sthSopr,
    signalSthMvrv: signalsV6?.sthMvrv ?? signalsV4?.sthMvrv ?? latest.signals.sthMvrv,
    signalSthGroup: latest.signalSthGroup ?? latest.signals.sthGroup ?? existingRow?.signalSthGroup,
    signalLthMvrv: signalsV6?.lthMvrv ?? signalsV4?.lthMvrv ?? existingRow?.signalLthMvrv,
    signalLthSopr: signalsV6?.lthSopr ?? signalsV4?.lthSopr ?? existingRow?.signalLthSopr,
    signalSthSoprTrigger: signalsV6?.sthSoprTrigger ?? signalsV4?.sthSoprTrigger ?? existingRow?.signalSthSoprTrigger,
    signalSthSoprAux: existingRow?.signalSthSoprAux,
    signalPuell: signalsV6?.puell ?? signalsV4?.puell ?? latest.signals.puell,
    signalCount: latest.signalCount,
    signalCountV4: latest.signalCountV4 ?? existingRow?.signalCountV4,
    signalCountV6: latest.signalCountV6 ?? existingRow?.signalCountV6,
    activeIndicatorCount: latest.activeIndicatorCount ?? existingRow?.activeIndicatorCount,
    activeIndicatorCountV4: latest.activeIndicatorCountV4 ?? existingRow?.activeIndicatorCountV4,
    activeIndicatorCountV6: latest.activeIndicatorCountV6 ?? existingRow?.activeIndicatorCountV6,
    maxSignalScoreV2: latest.maxSignalScoreV2 ?? existingRow?.maxSignalScoreV2,
    scorePriceMa200w: latest.scorePriceMa200w ?? existingRow?.scorePriceMa200w,
    scorePriceRealized: latest.scorePriceRealized ?? existingRow?.scorePriceRealized,
    scoreReserveRisk: latest.scoreReserveRisk ?? existingRow?.scoreReserveRisk,
    scoreReserveRiskV4: latest.scoreReserveRiskV4 ?? existingRow?.scoreReserveRiskV4,
    scoreMvrvZscore: latest.scoreMvrvZscore ?? existingRow?.scoreMvrvZscore,
    scoreMvrvZscoreCore: latest.scoreMvrvZscoreCore ?? existingRow?.scoreMvrvZscoreCore,
    scoreNupl: latest.scoreNupl ?? existingRow?.scoreNupl,
    scoreNuplCore: latest.scoreNuplCore ?? existingRow?.scoreNuplCore,
    valuationBlendScoreV6: latest.valuationBlendScoreV6 ?? existingRow?.valuationBlendScoreV6,
    scoreLthMvrv: latest.scoreLthMvrv ?? existingRow?.scoreLthMvrv,
    scoreLthSopr: latest.scoreLthSopr ?? existingRow?.scoreLthSopr,
    scoreSthSopr: latest.scoreSthSopr ?? existingRow?.scoreSthSopr,
    scoreSthMvrv: latest.scoreSthMvrv ?? existingRow?.scoreSthMvrv,
    scoreSthGroup: latest.scoreSthGroup ?? existingRow?.scoreSthGroup,
    scorePuell: latest.scorePuell ?? existingRow?.scorePuell,
    signalScoreV2: latest.signalScoreV2 ?? existingRow?.signalScoreV2,
    signalScoreV2Min3d: latest.signalScoreV2Min3d ?? existingRow?.signalScoreV2Min3d,
    signalConfirmed3d: latest.signalConfirmed3d ?? existingRow?.signalConfirmed3d,
    signalBandV2: latest.signalBandV2 ?? existingRow?.signalBandV2,
    valuationScore: latest.valuationScore ?? existingRow?.valuationScore,
    maxValuationScore: latest.maxValuationScore ?? existingRow?.maxValuationScore,
    triggerScore: latest.triggerScore ?? existingRow?.triggerScore,
    maxTriggerScore: latest.maxTriggerScore ?? existingRow?.maxTriggerScore,
    confirmationScore: latest.confirmationScore ?? existingRow?.confirmationScore,
    maxConfirmationScore: latest.maxConfirmationScore ?? existingRow?.maxConfirmationScore,
    auxiliaryScore: latest.auxiliaryScore ?? existingRow?.auxiliaryScore,
    maxAuxiliaryScore: latest.maxAuxiliaryScore ?? existingRow?.maxAuxiliaryScore,
    totalScoreV4: latest.totalScoreV4 ?? existingRow?.totalScoreV4,
    maxTotalScoreV4: latest.maxTotalScoreV4 ?? existingRow?.maxTotalScoreV4,
    totalScoreV4Min3d: latest.totalScoreV4Min3d ?? existingRow?.totalScoreV4Min3d,
    signalConfirmed3dV4: latest.signalConfirmed3dV4 ?? existingRow?.signalConfirmed3dV4,
    signalBandV4: latest.signalBandV4 ?? existingRow?.signalBandV4,
    valuationScoreV6: latest.valuationScoreV6 ?? existingRow?.valuationScoreV6,
    maxValuationScoreV6: latest.maxValuationScoreV6 ?? existingRow?.maxValuationScoreV6,
    triggerScoreV6: latest.triggerScoreV6 ?? existingRow?.triggerScoreV6,
    maxTriggerScoreV6: latest.maxTriggerScoreV6 ?? existingRow?.maxTriggerScoreV6,
    confirmationScoreV6: latest.confirmationScoreV6 ?? existingRow?.confirmationScoreV6,
    maxConfirmationScoreV6: latest.maxConfirmationScoreV6 ?? existingRow?.maxConfirmationScoreV6,
    totalScoreV6: latest.totalScoreV6 ?? existingRow?.totalScoreV6,
    maxTotalScoreV6: latest.maxTotalScoreV6 ?? existingRow?.maxTotalScoreV6,
    totalScoreV6Min3d: latest.totalScoreV6Min3d ?? existingRow?.totalScoreV6Min3d,
    signalConfirmed3dV6: latest.signalConfirmed3dV6 ?? existingRow?.signalConfirmed3dV6,
    signalBandV6: latest.signalBandV6 ?? existingRow?.signalBandV6,
    signalConfidence: latest.signalConfidence ?? existingRow?.signalConfidence,
    signalConfidenceV6: latest.signalConfidenceV6 ?? existingRow?.signalConfidenceV6,
    dataFreshnessScore: latest.dataFreshnessScore ?? existingRow?.dataFreshnessScore,
    dataFreshnessScoreV6: latest.dataFreshnessScoreV6 ?? existingRow?.dataFreshnessScoreV6,
    fallbackMode: latest.fallbackMode ?? existingRow?.fallbackMode,
    fallbackModeV6: latest.fallbackModeV6 ?? existingRow?.fallbackModeV6,
    staleIndicators: latest.staleIndicators ?? existingRow?.staleIndicators,
    coreIndicatorSet: latest.coreIndicatorSet ?? existingRow?.coreIndicatorSet,
    scoringModelVersion: latest.scoringModelVersion ?? existingRow?.scoringModelVersion,
    thresholds: latest.thresholds ?? existingRow?.thresholds,
    indicatorDates: latest.indicatorDates ?? existingRow?.indicatorDates,
    signalsV6: latest.signalsV6 ?? existingRow?.signalsV6,
    signalMvrvZ: latest.signalMvrvZ ?? existingRow?.signalMvrvZ,
  };
}

export function mergeLatestIntoHistory(
  history: IndicatorData[],
  latest: LatestData | null,
): IndicatorData[] {
  if (!latest?.date) {
    return history;
  }

  const existingIndex = history.findIndex((row) => row.d === latest.date);
  if (existingIndex >= 0) {
    const next = history.slice();
    next[existingIndex] = latestDataToHistoryRow(latest, next[existingIndex]);
    return next;
  }

  const lastHistoryDate = history.at(-1)?.d;
  if (lastHistoryDate && latest.date < lastHistoryDate) {
    return history;
  }

  return [
    ...history,
    latestDataToHistoryRow(latest),
  ];
}
